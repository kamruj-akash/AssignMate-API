import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { Prisma } from "../../../../prisma/src/generated/prisma/client";
import {
  AssignmentStatus,
  EscrowStatus,
  PaymentStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type {
  AssignmentInclude,
  AssignmentWhereInput,
} from "../../../../prisma/src/generated/prisma/models";
import type { IQuery } from "../../interface";
import cloudinary from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";
import { emailService } from "../../utils/email/email.service";
import type {
  IAssignmentActionPayload,
  ICreateAssignment,
  IResolveCancellationPayload,
} from "./assignment.interface";

const createAssignment = async (
  payload: ICreateAssignment,
  reqUser: RequestUser,
  attachments?: Express.Multer.File,
) => {
  const { title, description, budget, deadline } = payload;
  const existUser = await prisma.user.findUnique({
    where: { id: reqUser.userId },
    include: {
      student: true,
    },
  });

  let attachmentUrl: UploadApiResponse | null = null;
  if (attachments) {
    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { resource_type: "auto", folder: "assignment-attachments" },
            async (error, result) => {
              if (error) {
                return reject(error);
              }

              if (!result) {
                return reject(
                  new AppError(
                    httpStatus.INTERNAL_SERVER_ERROR,
                    "No result returned from Cloudinary",
                  ),
                );
              }
              resolve(result);
            },
          )
          .end(attachments.buffer);
      },
    );
    attachmentUrl = uploadResult;
  }

  const assignment = await prisma.assignment.create({
    data: {
      studentId: existUser?.student?.id as string,
      title,
      description,
      attachmentUrl: attachmentUrl
        ? {
            secure_url: attachmentUrl.secure_url,
            publicId: attachmentUrl.public_id,
          }
        : undefined,
      budget,
      deadline,
    },
  });
  return assignment;
};

const getOpenAssignments = async (query: IQuery) => {
  const searchTerm = query.searchTerm || "";
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "asc";
  const andConditions: AssignmentWhereInput[] = [
    {
      status: AssignmentStatus.OPEN,
    },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        AND: andConditions,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.assignment.count({
      where: {
        AND: andConditions,
      },
    }),
  ]);
  const totalPages = Math.ceil(total / limit);

  return {
    data: assignments,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const getAssignmentById = async (assignmentId: string) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    omit: { submissionUrl: true, disputedReason: true },
  });
  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }
  return assignment;
};

const getMyAssignments = async (reqUser: RequestUser, query: IQuery) => {
  const searchTerm = query.searchTerm || "";
  const status = query.status as AssignmentStatus | undefined;
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "asc";

  const existUser = await prisma.user.findUnique({
    where: { id: reqUser.userId },
    include: {
      student: true,
      expert: true,
    },
  });
  if (!existUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const andConditions: AssignmentWhereInput[] = [];
  let include: AssignmentInclude;

  if (existUser.role === Role.STUDENT) {
    if (!existUser.student) {
      throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
    }
    andConditions.push({ studentId: existUser.student.id });
    include = {
      assignedExpert: {
        select: {
          id: true,
          university: true,
          department: true,
          user: { select: { name: true, email: true } },
        },
      },
      _count: { select: { bids: true } },
    };
  } else if (existUser.role === Role.EXPERT) {
    if (!existUser.expert) {
      throw new AppError(httpStatus.NOT_FOUND, "Expert profile not found");
    }
    // assignments the expert has actually won / is working on.
    // pending bids are exposed separately via /bid/my-bids
    andConditions.push({ assignedExpertId: existUser.expert.id });
    include = {
      student: {
        select: {
          id: true,
          institution: true,
          academicLevel: true,
          user: { select: { name: true, email: true } },
        },
      },
      acceptedBid: {
        select: {
          id: true,
          proposedAmount: true,
          estimatedDelivery: true,
          status: true,
        },
      },
    };
  } else {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only students and experts have their own assignments",
    );
  }

  if (status) {
    if (!Object.values(AssignmentStatus).includes(status)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status. Allowed values: ${Object.values(AssignmentStatus).join(", ")}`,
      );
    }
    andConditions.push({ status });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        AND: andConditions,
      },
      include,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.assignment.count({
      where: {
        AND: andConditions,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    data: assignments,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const submitAssignment = async (
  reqUser: RequestUser,
  assignmentId: string,
  status: AssignmentStatus,
  attachment?: Express.Multer.File,
) => {
  const existUser = await prisma.user.findUnique({
    where: { id: reqUser.userId, role: Role.EXPERT },
    include: {
      expert: true,
    },
  });

  if (!existUser || !existUser.expert) {
    throw new AppError(httpStatus.NOT_FOUND, "Expert profile not found");
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId, assignedExpertId: existUser.expert?.id },
    include: {
      student: { include: { user: { omit: { password: true } } } },
    },
  });
  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }
  if (existUser.expert?.id !== assignment.assignedExpertId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not assigned to this assignment",
    );
  }

  if (
    assignment.status !== AssignmentStatus.ASSIGNED &&
    assignment.status !== AssignmentStatus.IN_PROGRESS
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Assignment is not in a state that allows submission",
    );
  }

  if (status === AssignmentStatus.IN_PROGRESS) {
    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.IN_PROGRESS },
    });
    return updatedAssignment;
  }

  if (status === AssignmentStatus.SUBMITTED && attachment) {
    const attachmentUploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { resource_type: "auto", folder: "assignment-submissions" },
            async (error, result) => {
              if (error) {
                return reject(error);
              }

              if (!result) {
                return reject(
                  new AppError(
                    httpStatus.INTERNAL_SERVER_ERROR,
                    "No result returned from Cloudinary",
                  ),
                );
              }
              resolve(result);
            },
          )
          .end(attachment?.buffer);
      },
    );

    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.SUBMITTED,
        submissionUrl: {
          url: attachmentUploadResult.secure_url,
          publicId: attachmentUploadResult.public_id,
        },
      },
    });

    await emailService.sendAssignmentSubmitted(assignment.student.user.email, {
      studentName: assignment.student.user.name,
      expertName: existUser.name,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
    });

    return updatedAssignment;
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Invalid status or missing attachment for submission",
  );
};

// moves a HELD escrow to the expert's wallet; returns the credited earnings
const releaseEscrowToExpert = async (
  tx: Prisma.TransactionClient,
  assignmentId: string,
  expertId: string,
) => {
  const getEscrow = await tx.escrow.findUnique({
    where: { assignmentId: assignmentId },
  });

  if (!getEscrow) {
    throw new AppError(httpStatus.NOT_FOUND, "Escrow not found");
  }

  const expertEarnings = (
    (Number(getEscrow.totalAmount) * Number(getEscrow.expertEarnings)) /
    100
  ).toFixed(2);

  const released = await tx.escrow.updateMany({
    where: { id: getEscrow.id, status: EscrowStatus.HELD },
    data: {
      status: EscrowStatus.RELEASED_TO_EXPERT,
      disbursedAt: new Date(),
    },
  });

  if (released.count === 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This escrow has already been settled",
    );
  }

  await tx.expert.update({
    where: { id: expertId },
    data: {
      walletBalance: {
        increment: new Prisma.Decimal(expertEarnings),
      },
    },
  });

  return expertEarnings;
};

const assignmentAction = async (
  reqUser: RequestUser,
  assignmentId: string,
  payload: IAssignmentActionPayload,
) => {
  const existUser = await prisma.user.findUnique({
    where: { id: reqUser.userId, role: Role.STUDENT },
    include: {
      student: true,
    },
  });
  if (!existUser || !existUser.student) {
    throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
  }
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId, studentId: existUser.student?.id },
    include: {
      assignedExpert: { include: { user: { omit: { password: true } } } },
    },
  });
  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }

  if (existUser.student?.id !== assignment.studentId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not the owner of this assignment",
    );
  }
  if (
    assignment.status !== AssignmentStatus.SUBMITTED &&
    assignment.status !== AssignmentStatus.UNDER_REVIEW
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Assignment is not in a state that allows action",
    );
  }

  if (payload.status === assignment.status) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Assignment is already in the requested status",
    );
  }

  if (payload.status === AssignmentStatus.UNDER_REVIEW) {
    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.UNDER_REVIEW,
      },
    });
    return updatedAssignment;
  }

  if (payload.status === AssignmentStatus.CANCELLED) {
    if (!payload.reason?.trim()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Reason is required for cancelling an assignment",
      );
    }
    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.CANCELLED,
        disputedReason: payload.reason.trim(),
      },
    });
    return updatedAssignment;
  }
  if (payload.status === AssignmentStatus.COMPLETED) {
    let expertEarnings = "0.00";

    const transaction = await prisma.$transaction(async (tx) => {
      const completed = await tx.assignment.updateMany({
        where: {
          id: assignmentId,
          status: {
            in: [AssignmentStatus.SUBMITTED, AssignmentStatus.UNDER_REVIEW],
          },
        },
        data: {
          status: AssignmentStatus.COMPLETED,
        },
      });

      if (completed.count === 0) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This assignment has already been completed",
        );
      }

      expertEarnings = await releaseEscrowToExpert(
        tx,
        assignmentId,
        assignment.assignedExpertId as string,
      );

      return tx.assignment.findUnique({ where: { id: assignmentId } });
    });

    if (assignment.assignedExpert) {
      await emailService.sendAssignmentCompleted(
        assignment.assignedExpert.user.email,
        {
          expertName: assignment.assignedExpert.user.name,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          earnings: expertEarnings,
        },
      );
    }

    return transaction;
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Invalid status for assignment action",
  );
};

const deleteAssignment = async (reqUser: RequestUser, assignmentId: string) => {
  const existUser = await prisma.user.findUnique({
    where: { id: reqUser.userId, role: Role.STUDENT },
    include: { student: true },
  });
  if (!existUser || !existUser.student) {
    throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }
  if (assignment.studentId !== existUser.student.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not the owner of this assignment",
    );
  }
  if (assignment.status !== AssignmentStatus.OPEN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only open assignments can be deleted",
    );
  }

  // payment, escrow and bids cascade on delete, so the OPEN guard has to hold
  // at write time, not just at read time
  const deleted = await prisma.assignment.deleteMany({
    where: {
      id: assignmentId,
      studentId: existUser.student.id,
      status: AssignmentStatus.OPEN,
      assignedExpertId: null,
    },
  });
  if (deleted.count === 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Assignment can no longer be deleted",
    );
  }

  const attachment = assignment.attachmentUrl as { publicId?: string } | null;
  if (attachment?.publicId) {
    for (const resource_type of ["image", "raw", "video"] as const) {
      try {
        const res = await cloudinary.uploader.destroy(attachment.publicId, {
          resource_type,
        });
        if (res.result === "ok") break;
      } catch (error) {
        console.error("Failed to delete assignment attachment", error);
        break;
      }
    }
  }

  return { id: assignmentId };
};

// cancelled by the student but escrow still HELD = waiting on an admin decision
const getCancellationRequests = async (query: IQuery) => {
  const searchTerm = query.searchTerm || "";
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  const andConditions: AssignmentWhereInput[] = [
    {
      status: AssignmentStatus.CANCELLED,
      escrow: { is: { status: EscrowStatus.HELD } },
    },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        {
          student: {
            user: { name: { contains: searchTerm, mode: "insensitive" } },
          },
        },
        {
          assignedExpert: {
            user: { name: { contains: searchTerm, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where: { AND: andConditions },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
        assignedExpert: {
          select: {
            id: true,
            university: true,
            user: { select: { name: true, email: true } },
          },
        },
        escrow: {
          select: {
            id: true,
            totalAmount: true,
            expertEarnings: true,
            status: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.assignment.count({ where: { AND: andConditions } }),
  ]);

  return {
    data: assignments,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// APPROVE: cancellation upheld -> DISPUTED, escrow refunded to the student
// REJECT: cancellation overruled -> COMPLETED, escrow released to the expert
const resolveCancellation = async (
  assignmentId: string,
  payload: IResolveCancellationPayload,
) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      assignedExpert: { include: { user: { omit: { password: true } } } },
    },
  });
  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }
  if (assignment.status !== AssignmentStatus.CANCELLED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only cancelled assignments can be reviewed",
    );
  }
  if (!assignment.assignedExpertId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This assignment has no assigned expert",
    );
  }

  let expertEarnings = "0.00";
  const nextStatus =
    payload.decision === "APPROVE"
      ? AssignmentStatus.DISPUTED
      : AssignmentStatus.COMPLETED;

  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.assignment.updateMany({
      where: { id: assignmentId, status: AssignmentStatus.CANCELLED },
      data: { status: nextStatus },
    });
    if (moved.count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "This cancellation has already been reviewed",
      );
    }

    if (payload.decision === "APPROVE") {
      const refunded = await tx.escrow.updateMany({
        where: { assignmentId, status: EscrowStatus.HELD },
        data: {
          status: EscrowStatus.REFUNDED_TO_STUDENT,
          disbursedAt: new Date(),
        },
      });
      if (refunded.count === 0) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This escrow has already been settled",
        );
      }
      await tx.payment.updateMany({
        where: { assignmentId, status: PaymentStatus.PAID },
        data: { status: PaymentStatus.REFUNDED },
      });
    } else {
      expertEarnings = await releaseEscrowToExpert(
        tx,
        assignmentId,
        assignment.assignedExpertId as string,
      );
    }

    return tx.assignment.findUnique({ where: { id: assignmentId } });
  });

  if (payload.decision === "REJECT" && assignment.assignedExpert) {
    await emailService.sendAssignmentCompleted(
      assignment.assignedExpert.user.email,
      {
        expertName: assignment.assignedExpert.user.name,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        earnings: expertEarnings,
      },
    );
  }

  return result;
};

export const assignmentService = {
  createAssignment,
  getOpenAssignments,
  getAssignmentById,
  getMyAssignments,
  submitAssignment,
  assignmentAction,
  deleteAssignment,
  getCancellationRequests,
  resolveCancellation,
};
