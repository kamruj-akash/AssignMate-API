import httpStatus from "http-status";
import {
  PaymentGateway,
  PaymentStatus,
} from "../../../../prisma/src/generated/prisma/enums";
import envConfig from "../../config/env";
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
          callbackURL: `${envConfig.backend_url}/api/v1/appointment/callback/bkash`,
          amount: assignment.budget,
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: assignment.id,
        }),
      },
    );
    const bkashResult = await bkashResponse.json();

    if (!bkashResult.statusCode || bkashResult.statusCode !== "0000") {
      throw new Error("Failed to initiate checkout with bKash");
    }
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

export const paymentService = {
  initiateCheckout,
};
