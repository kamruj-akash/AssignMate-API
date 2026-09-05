import httpStatus from "http-status";
import {
  AssignmentStatus,
  BidStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type { IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";
import type { IBidAssignment } from "./bid.interface";

const bidAssignment = async (
  bidPayload: IBidAssignment,
  reqUser: RequestUser,
) => {
  const { assignmentId, proposedAmount, estimatedDelivery, coverNote } =
    bidPayload;
  const existExpert = await prisma.user.findUnique({
    where: { id: reqUser.userId, role: Role.EXPERT },
    include: { expert: true },
  });
  if (!existExpert || !existExpert.expert) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only experts can place bids on assignments",
    );
  }
  const existBid = await prisma.assignmentBid.findFirst({
    where: {
      assignmentId,
      expertId: existExpert.expert.id,
    },
  });
  if (existBid) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already placed a bid on this assignment",
    );
  }
  const existAssignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!existAssignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }
  if (existAssignment.status !== AssignmentStatus.OPEN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot place a bid on a closed assignment",
    );
  }

  const bid = await prisma.assignmentBid.create({
    data: {
      proposedAmount,
      estimatedDelivery,
      coverNote,
      assignmentId,
      expertId: existExpert.expert.id,
    },
  });

  return bid;
};

const getBidByAssignmentId = async (
  assignmentId: string,
  user: RequestUser,
  query: IQuery,
) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "asc";

  const existUser = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { student: true },
  });
  if (!existUser || !existUser.student) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only students can view bids on assignments",
    );
  }
  const existAssignment = await prisma.assignment.findUnique({
    where: { id: assignmentId, studentId: existUser.student.id },
  });
  if (!existAssignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }
  const bids = await prisma.assignmentBid.findMany({
    where: {
      assignmentId,
      status: { in: [BidStatus.PENDING, BidStatus.ACCEPTED] },
    },
    select: {
      id: true,
      proposedAmount: true,
      estimatedDelivery: true,
      coverNote: true,
      status: true,
      expert: {
        select: {
          id: true,
          userId: true,
          university: true,
          department: true,
          bio: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  });

  const total = await prisma.assignmentBid.count({
    where: {
      assignmentId,
      status: { in: [BidStatus.PENDING, BidStatus.ACCEPTED] },
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  const totalPages = Math.ceil(total / limit);

  return {
    bids,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
};

const getMyBids = async (user: RequestUser, query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "asc";

  const existExpert = await prisma.user.findUnique({
    where: { id: user.userId, role: Role.EXPERT },
    include: { expert: true },
  });
  if (!existExpert || !existExpert.expert) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only experts can view their bids",
    );
  }
  const bids = await prisma.assignmentBid.findMany({
    where: { expertId: existExpert.expert.id },
    include: {
      assignment: {
        select: {
          title: true,
          description: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });
  const total = await prisma.assignmentBid.count({
    where: { expertId: existExpert.expert.id },
  });
  const totalPages = Math.ceil(total / limit);

  return {
    bids,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
};

const deleteBid = async (bidId: string, user: RequestUser) => {
  const existExpert = await prisma.user.findUnique({
    where: { id: user.userId, role: Role.EXPERT },
    include: { expert: true },
  });

  if (!existExpert || !existExpert.expert) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only experts can delete their bids",
    );
  }

  const bid = await prisma.assignmentBid.findUnique({
    where: { id: bidId, expertId: existExpert.expert.id },
  });

  if (!bid) {
    throw new AppError(httpStatus.NOT_FOUND, "Bid not found");
  }

  if (bid.status !== BidStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only pending bids can be deleted!",
    );
  }

  await prisma.assignmentBid.delete({
    where: { id: bidId, expertId: existExpert.expert.id },
  });

  return;
};

const acceptBid = async (bidId: string, user: RequestUser) => {
  const existUser = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { student: true },
  });

  if (!existUser || !existUser.student) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only students can accept bids on assignments",
    );
  }
  const bid = await prisma.assignmentBid.findUnique({
    where: { id: bidId },
    include: { assignment: true },
  });

  if (!bid) {
    throw new AppError(httpStatus.NOT_FOUND, "Bid not found");
  }

  if (bid.assignment.status !== AssignmentStatus.OPEN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot accept a bid on a closed assignment",
    );
  }

  if (bid.assignment.studentId !== existUser.student.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to accept this bid",
    );
  }
  if (bid.assignment.status !== AssignmentStatus.OPEN) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot accept a bid on a closed assignment",
    );
  }
  if (bid.status !== BidStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only pending bids can be accepted!",
    );
  }
  const transaction = await prisma.$transaction(async (tx) => {
    await tx.assignment.update({
      where: { id: bid.assignmentId, status: AssignmentStatus.OPEN },
      data: {
        status: AssignmentStatus.AWAITING_PAYMENT,
        assignedExpertId: bid.expertId,
        acceptedBidId: bid.id,
      },
    });

    const acceptedBid = await tx.assignmentBid.update({
      where: { id: bid.id, status: BidStatus.PENDING },
      data: { status: BidStatus.ACCEPTED },
    });

    await tx.assignmentBid.updateMany({
      where: {
        assignmentId: bid.assignmentId,
        id: { not: bid.id },
        status: BidStatus.PENDING,
      },
      data: {
        status: BidStatus.REJECTED,
        cancelReason: "Another bid has been accepted!",
      },
    });

    return acceptedBid;
  });
  return transaction;
};

export const bidService = {
  bidAssignment,
  getBidByAssignmentId,
  getMyBids,
  deleteBid,
  acceptBid,
};
