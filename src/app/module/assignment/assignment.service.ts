import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { Prisma } from "../../../../prisma/src/generated/prisma/client";
import {
  AssignmentStatus,
  EscrowStatus,
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
import type { IAssignmentActionPayload } from "./assignment.interface";
import type { ICreateAssignment } from "./export interface IAssignmentActionPayload {   status: AssignmentStatus;   reason?: string; }";

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

  const assignments = await prisma.assignment.findMany({
    where: {
      AND: andConditions,
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });
  const total = await prisma.assignment.count({
    where: {
      AND: andConditions,
    },
  });

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

  const assignments = await prisma.assignment.findMany({
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
  const total = await prisma.assignment.count({
    where: {
      AND: andConditions,
    },
  });

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
  const existUser = await prisma.user.findUniqueOrThrow({
    where: { id: reqUser.userId, role: Role.EXPERT },
    include: {
      expert: true,
    },
  });
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId, assignedExpertId: existUser.expert?.id },
  });
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

    return updatedAssignment;
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Invalid status or missing attachment for submission",
  );
};

const assignmentAction = async (
  reqUser: RequestUser,
  assignmentId: string,
  payload: IAssignmentActionPayload,
) => {
  const existUser = await prisma.user.findUniqueOrThrow({
    where: { id: reqUser.userId, role: Role.STUDENT },
    include: {
      student: true,
    },
  });
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId, studentId: existUser.student?.id },
  });

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
  if (payload.status === AssignmentStatus.DISPUTED) {
    if (payload.status === AssignmentStatus.DISPUTED && !payload.reason) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Reason is required for disputing an assignment",
      );
    }
    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.DISPUTED,
        disputedReason: payload.reason,
      },
    });
    return updatedAssignment;
  }
  console.log(assignment.assignedExpertId);
  if (payload.status === AssignmentStatus.COMPLETED) {
    const transaction = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.COMPLETED,
        },
      });
      const getEscrow = await tx.escrow.findUniqueOrThrow({
        where: { assignmentId: assignmentId },
      });

      await tx.expert.update({
        where: { id: assignment.assignedExpertId as string },
        data: {
          walletBalance: {
            increment: new Prisma.Decimal(
              (
                (Number(getEscrow.totalAmount) *
                  Number(getEscrow.expertEarnings)) /
                100
              ).toFixed(2),
            ),
          },
        },
      });

      await tx.escrow.update({
        where: { id: getEscrow.id },
        data: {
          status: EscrowStatus.RELEASED_TO_EXPERT,
          disbursedAt: new Date(),
        },
      });

      return updatedAssignment;
    });
    return transaction;
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Invalid status for assignment action",
  );
};

export const assignmentService = {
  createAssignment,
  getOpenAssignments,
  getAssignmentById,
  getMyAssignments,
  submitAssignment,
  assignmentAction,
};
