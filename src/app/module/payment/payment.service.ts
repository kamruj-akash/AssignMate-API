import httpStatus from "http-status";
import {
  AssignmentStatus,
  EscrowStatus,
  PaymentGateway,
  PaymentStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type {
  PaymentInclude,
  PaymentWhereInput,
} from "../../../../prisma/src/generated/prisma/models";
import envConfig from "../../config/env";
import type { IQuery } from "../../interface";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";

const initiateCheckout = async (assignmentId: string, user: RequestUser) => {
  const idToken = await getBkashIdToken();
  const userExist = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    include: {
      student: true,
    },
  });
  if (!userExist || !userExist.student) {
    throw new Error("User not found or not a student");
  }

  const assignment = await prisma.assignment.findUnique({
    where: {
      id: assignmentId,
      studentId: userExist.student.id,
    },
  });
  if (!assignment) {
    throw new Error("Assignment not found");
  }
  const existPayment = await prisma.payment.findUnique({
    where: {
      assignmentId: assignment.id,
    },
  });

  if (existPayment?.status === PaymentStatus.PAID) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment already completed for this assignment",
    );
  }
  const transaction = await prisma.$transaction(async (tx) => {
    const bkashResponse = await fetch(
      `${envConfig.bkash_url}/tokenized/checkout/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: idToken as string,
          "X-App-Key": envConfig.bkash_app_key as string,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: userExist.phoneNo || userExist.email,
          callbackURL: `${envConfig.api_base_url}/payment/callback/bkash`,
          amount: assignment.budget,
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: assignment.id,
        }),
      },
    );
    const bkashResult: any = await bkashResponse.json();

    if (!bkashResult.statusCode || bkashResult.statusCode !== "0000") {
      throw new Error("Failed to initiate checkout with bKash");
    }
    if (existPayment) {
      await tx.payment.update({
        where: {
          assignmentId: assignment.id,
        },
        data: {
          amount: Number(bkashResult.amount),
          merchantInvoiceNumber: bkashResult.merchantInvoiceNumber,
          bkashTrxId: bkashResult.paymentID,
          paymentGateway: PaymentGateway.BKASH,
          transactionId: bkashResult.paymentID,
          assignmentId: assignment.id,
          bkashPaymentId: bkashResult.paymentID,
          status: PaymentStatus.INITIATED,
          gatewayResponse: bkashResult,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          amount: Number(bkashResult.amount),
          merchantInvoiceNumber: bkashResult.merchantInvoiceNumber,
          bkashTrxId: bkashResult.paymentID,
          paymentGateway: PaymentGateway.BKASH,
          transactionId: bkashResult.paymentID,
          assignmentId: assignment.id,
          bkashPaymentId: bkashResult.paymentID,
          status: PaymentStatus.INITIATED,
          gatewayResponse: bkashResult,
        },
      });
    }

    if (bkashResult.statusCode !== "0000") {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        bkashResult.statusMessage || "bKash payment creation failed",
      );
    }

    return bkashResult.bkashURL;
  });

  return transaction;
};

const bkashCallback = async (query: Record<string, any>) => {
  const { paymentID, status, signature } = query;
  if (!paymentID)
    throw new AppError(httpStatus.BAD_REQUEST, "Payment Id is Missing");
  if (!status) throw new AppError(httpStatus.BAD_REQUEST, "Status is Missing");
  if (!signature)
    throw new AppError(httpStatus.BAD_REQUEST, "Signature is Missing");

  const idToken = await getBkashIdToken();
  const bkashPaymentVerifyResponse = await fetch(
    `${envConfig.bkash_url}/tokenized/checkout/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: idToken as string,
        "X-App-Key": envConfig.bkash_app_key as string,
      },
      body: JSON.stringify({ paymentID: paymentID }),
    },
  );
  const bkashPaymentVerifyResult: any = await bkashPaymentVerifyResponse.json();
  console.log(bkashPaymentVerifyResult);

  if (status === "success") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: {
          assignmentId: bkashPaymentVerifyResult.merchantInvoiceNumber,
        },
        data: {
          status: PaymentStatus.PAID,
          gatewayResponse: bkashPaymentVerifyResult,
          bkashTrxId: bkashPaymentVerifyResult.trxID,
          amount: Number(bkashPaymentVerifyResult.amount),
          paidAt: bkashPaymentVerifyResult.paymentExecuteTime,
          payerReference: bkashPaymentVerifyResult.payerReference,
        },
      });

      await tx.assignment.update({
        where: {
          id: bkashPaymentVerifyResult.merchantInvoiceNumber,
        },
        data: {
          status: AssignmentStatus.ASSIGNED,
          escrow: {
            create: {
              totalAmount: Number(bkashPaymentVerifyResult.amount),
              status: EscrowStatus.HELD,
            },
          },
        },
      });
    });

    return {
      redirectUrl: `${envConfig.frontend_url}/assignment/${bkashPaymentVerifyResult.merchantInvoiceNumber}/result?paymentStatus=success`,
    };
  }

  if (status === "failure") {
    await prisma.payment.update({
      where: {
        assignmentId: bkashPaymentVerifyResult.merchantInvoiceNumber,
      },
      data: {
        status: PaymentStatus.FAILED,
      },
    });
    return {
      redirectUrl: `${envConfig.frontend_url}/assignment/${bkashPaymentVerifyResult.merchantInvoiceNumber}/result?paymentStatus=failure`,
    };
  }

  if (status === "cancel") {
    return {
      redirectUrl: `${envConfig.frontend_url}/assignment/${bkashPaymentVerifyResult.merchantInvoiceNumber}/result?paymentStatus=cancel`,
    };
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Invalid payment status received from bKash",
  );
};

const PAYMENT_SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "amount",
  "status",
  "paidAt",
];

const paymentHistory = async (query: IQuery, user: RequestUser) => {
  const searchTerm = query.searchTerm || "";
  const status = query.status as PaymentStatus | undefined;
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = PAYMENT_SORTABLE_FIELDS.includes(query.sortBy as string)
    ? (query.sortBy as string)
    : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const userExist = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    include: {
      student: true,
    },
  });
  if (!userExist) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  const andConditions: PaymentWhereInput[] = [];
  const isAdmin = userExist.role === Role.ADMIN;

  // students only ever see the payments of their own assignments,
  // admins see every payment in the system.
  if (!isAdmin) {
    if (userExist.role !== Role.STUDENT) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Only students and admins can view payment history",
      );
    }
    if (!userExist.student) {
      throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
    }
    andConditions.push({
      assignment: { studentId: userExist.student.id },
    });
  }

  if (status) {
    if (!Object.values(PaymentStatus).includes(status)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status. Allowed values: ${Object.values(PaymentStatus).join(", ")}`,
      );
    }
    andConditions.push({ status });
  }

  if (searchTerm) {
    const orConditions: PaymentWhereInput[] = [
      { transactionId: { contains: searchTerm, mode: "insensitive" } },
      { bkashTrxId: { contains: searchTerm, mode: "insensitive" } },
      { merchantInvoiceNumber: { contains: searchTerm, mode: "insensitive" } },
      { payerReference: { contains: searchTerm, mode: "insensitive" } },
      {
        assignment: {
          title: { contains: searchTerm, mode: "insensitive" },
        },
      },
    ];

    if (isAdmin) {
      orConditions.push({
        assignment: {
          student: {
            user: {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { email: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
        },
      });
    }

    andConditions.push({ OR: orConditions });
  }

  const include: PaymentInclude = {
    assignment: {
      select: {
        id: true,
        title: true,
        status: true,
        budget: true,
        deadline: true,
        ...(isAdmin
          ? {
              student: {
                select: {
                  id: true,
                  institution: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            }
          : {}),
      },
    },
  };

  const payments = await prisma.payment.findMany({
    where: {
      AND: andConditions,
    },
    include,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const total = await prisma.payment.count({
    where: {
      AND: andConditions,
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data: payments,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const paymentService = {
  initiateCheckout,
  bkashCallback,
  paymentHistory,
};
