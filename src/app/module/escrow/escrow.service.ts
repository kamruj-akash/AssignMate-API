import httpStatus from "http-status";
import {
  EscrowStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type { IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";

const getEscrowByAssignmentId = async (
  assignmentId: string,
  user: RequestUser,
) => {
  const existUser = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { student: true, expert: true },
  });
  if (!existUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const escrow = await prisma.escrow.findUnique({
    where: { assignmentId },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          status: true,
          budget: true,
          deadline: true,
          studentId: true,
          assignedExpertId: true,
          student: {
            select: {
              id: true,
              institution: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          assignedExpert: {
            select: {
              id: true,
              university: true,
              department: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!escrow) {
    throw new AppError(httpStatus.NOT_FOUND, "Escrow not found");
  }

  if (existUser.role === Role.STUDENT) {
    if (!existUser.student) {
      throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
    }
    if (existUser.student.id !== escrow.assignment.studentId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You don't have access to this escrow",
      );
    }
  }

  if (existUser.role === Role.EXPERT) {
    if (!existUser.expert) {
      throw new AppError(httpStatus.NOT_FOUND, "Expert profile not found");
    }
    if (existUser.expert.id !== escrow.assignment.assignedExpertId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You don't have access to this escrow",
      );
    }
  }

  const totalAmount = Number(escrow.totalAmount);
  const platformRevenue =
    (totalAmount * Number(escrow.platformCommission)) / 100;
  const expertPayout = (totalAmount * Number(escrow.expertEarnings)) / 100;

  return {
    id: escrow.id,
    assignmentId: escrow.assignmentId,
    status: escrow.status,
    totalAmount,
    disbursedAt: escrow.disbursedAt,
    createdAt: escrow.createdAt,
    updatedAt: escrow.updatedAt,
    breakdown: {
      platformCommissionRate: Number(escrow.platformCommission),
      expertEarningsRate: Number(escrow.expertEarnings),
      platformRevenue: Number(platformRevenue.toFixed(2)),
      expertPayout: Number(expertPayout.toFixed(2)),
    },
    assignment: {
      id: escrow.assignment.id,
      title: escrow.assignment.title,
      status: escrow.assignment.status,
      budget: escrow.assignment.budget,
      deadline: escrow.assignment.deadline,
    },
    student: escrow.assignment.student,
    expert: escrow.assignment.assignedExpert,
  };
};

const getRevenueAnalytics = async (query: IQuery) => {
  const from = query.from as string | undefined;
  const to = query.to as string | undefined;

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) {
    createdAt.gte = new Date(from);
  }
  if (to) {
    createdAt.lte = new Date(to);
  }

  const escrows = await prisma.escrow.findMany({
    where: { createdAt },
    select: {
      totalAmount: true,
      platformCommission: true,
      expertEarnings: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byStatus = {
    HELD: { count: 0, amount: 0 },
    RELEASED_TO_EXPERT: { count: 0, amount: 0 },
    REFUNDED_TO_STUDENT: { count: 0, amount: 0 },
  };

  const monthly: {
    month: string;
    escrowCount: number;
    grossVolume: number;
    platformRevenue: number;
    expertPayouts: number;
  }[] = [];

  let grossVolume = 0;
  let platformRevenue = 0;
  let pendingPlatformRevenue = 0;
  let expertPayouts = 0;
  let refundedToStudents = 0;

  for (const escrow of escrows) {
    const totalAmount = Number(escrow.totalAmount);
    const commission = (totalAmount * Number(escrow.platformCommission)) / 100;
    const payout = (totalAmount * Number(escrow.expertEarnings)) / 100;

    grossVolume = grossVolume + totalAmount;
    byStatus[escrow.status].count = byStatus[escrow.status].count + 1;
    byStatus[escrow.status].amount = byStatus[escrow.status].amount + totalAmount;

    const month = escrow.createdAt.toISOString().slice(0, 7);
    let monthRow = monthly.find((row) => row.month === month);
    if (!monthRow) {
      monthRow = {
        month,
        escrowCount: 0,
        grossVolume: 0,
        platformRevenue: 0,
        expertPayouts: 0,
      };
      monthly.push(monthRow);
    }
    monthRow.escrowCount = monthRow.escrowCount + 1;
    monthRow.grossVolume = monthRow.grossVolume + totalAmount;

    if (escrow.status === EscrowStatus.RELEASED_TO_EXPERT) {
      platformRevenue = platformRevenue + commission;
      expertPayouts = expertPayouts + payout;
      monthRow.platformRevenue = monthRow.platformRevenue + commission;
      monthRow.expertPayouts = monthRow.expertPayouts + payout;
    }
    if (escrow.status === EscrowStatus.HELD) {
      pendingPlatformRevenue = pendingPlatformRevenue + commission;
    }
    if (escrow.status === EscrowStatus.REFUNDED_TO_STUDENT) {
      refundedToStudents = refundedToStudents + totalAmount;
    }
  }

  for (const row of monthly) {
    row.grossVolume = Number(row.grossVolume.toFixed(2));
    row.platformRevenue = Number(row.platformRevenue.toFixed(2));
    row.expertPayouts = Number(row.expertPayouts.toFixed(2));
  }

  return {
    range: { from: from || null, to: to || null },
    totals: {
      escrowCount: escrows.length,
      grossVolume: Number(grossVolume.toFixed(2)),
      platformRevenue: Number(platformRevenue.toFixed(2)),
      pendingPlatformRevenue: Number(pendingPlatformRevenue.toFixed(2)),
      expertPayouts: Number(expertPayouts.toFixed(2)),
      refundedToStudents: Number(refundedToStudents.toFixed(2)),
    },
    byStatus,
    monthly,
  };
};

export const escrowService = {
  getEscrowByAssignmentId,
  getRevenueAnalytics,
};
