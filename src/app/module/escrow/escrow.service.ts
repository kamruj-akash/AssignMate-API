import httpStatus from "http-status";
import {
  EscrowStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type { EscrowWhereInput } from "../../../../prisma/src/generated/prisma/models";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";
import type { IEscrowBucket, IRevenueAnalyticsQuery } from "./escrow.interface";

const round2 = (value: number) => Math.round(value * 100) / 100;

const splitOf = (
  totalAmount: number,
  platformCommission: number,
  expertEarnings: number,
) => ({
  platformCommissionRate: platformCommission,
  expertEarningsRate: expertEarnings,
  platformRevenue: round2((totalAmount * platformCommission) / 100),
  expertPayout: round2((totalAmount * expertEarnings) / 100),
});

const getEscrowByAssignmentId = async (
  assignmentId: string,
  reqUser: RequestUser,
) => {
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

  // admins see any vault; the two counterparties only see their own.
  const isAdmin = existUser.role === Role.ADMIN;
  if (!isAdmin) {
    const isOwningStudent =
      existUser.role === Role.STUDENT &&
      !!existUser.student &&
      existUser.student.id === escrow.assignment.studentId;

    const isAssignedExpert =
      existUser.role === Role.EXPERT &&
      !!existUser.expert &&
      existUser.expert.id === escrow.assignment.assignedExpertId;

    if (!isOwningStudent && !isAssignedExpert) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You don't have access to this escrow",
      );
    }
  }

  const totalAmount = Number(escrow.totalAmount);
  const {
    studentId,
    assignedExpertId,
    student,
    assignedExpert,
    ...assignment
  } = escrow.assignment;

  return {
    id: escrow.id,
    assignmentId: escrow.assignmentId,
    status: escrow.status,
    totalAmount,
    disbursedAt: escrow.disbursedAt,
    createdAt: escrow.createdAt,
    updatedAt: escrow.updatedAt,
    breakdown: splitOf(
      totalAmount,
      Number(escrow.platformCommission),
      Number(escrow.expertEarnings),
    ),
    assignment,
    expert: assignedExpert,
    student: isAdmin ? student : undefined,
  };
};

const getRevenueAnalytics = async (query: IRevenueAnalyticsQuery) => {
  const { from, to } = query;

  const where: EscrowWhereInput = {};
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const escrows = await prisma.escrow.findMany({
    where,
    select: {
      totalAmount: true,
      platformCommission: true,
      expertEarnings: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const emptyBucket = (): IEscrowBucket => ({ count: 0, amount: 0 });

  const byStatus: Record<EscrowStatus, IEscrowBucket> = {
    [EscrowStatus.HELD]: emptyBucket(),
    [EscrowStatus.RELEASED_TO_EXPERT]: emptyBucket(),
    [EscrowStatus.REFUNDED_TO_STUDENT]: emptyBucket(),
  };

  const monthlyMap = new Map<
    string,
    {
      month: string;
      escrowCount: number;
      grossVolume: number;
      platformRevenue: number;
      expertPayouts: number;
    }
  >();

  let grossVolume = 0;
  let platformRevenue = 0;
  let pendingPlatformRevenue = 0;
  let expertPayouts = 0;
  let refundedToStudents = 0;

  for (const escrow of escrows) {
    const totalAmount = Number(escrow.totalAmount);
    const split = splitOf(
      totalAmount,
      Number(escrow.platformCommission),
      Number(escrow.expertEarnings),
    );

    grossVolume += totalAmount;

    const bucket = byStatus[escrow.status];
    bucket.count += 1;
    bucket.amount = round2(bucket.amount + totalAmount);

    const month = escrow.createdAt.toISOString().slice(0, 7);
    const monthRow = monthlyMap.get(month) ?? {
      month,
      escrowCount: 0,
      grossVolume: 0,
      platformRevenue: 0,
      expertPayouts: 0,
    };
    monthRow.escrowCount += 1;
    monthRow.grossVolume = round2(monthRow.grossVolume + totalAmount);

    if (escrow.status === EscrowStatus.RELEASED_TO_EXPERT) {
      platformRevenue += split.platformRevenue;
      expertPayouts += split.expertPayout;
      monthRow.platformRevenue = round2(
        monthRow.platformRevenue + split.platformRevenue,
      );
      monthRow.expertPayouts = round2(
        monthRow.expertPayouts + split.expertPayout,
      );
    }

    if (escrow.status === EscrowStatus.HELD) {
      pendingPlatformRevenue += split.platformRevenue;
    }

    if (escrow.status === EscrowStatus.REFUNDED_TO_STUDENT) {
      refundedToStudents += totalAmount;
    }

    monthlyMap.set(month, monthRow);
  }

  return {
    range: {
      from: from ?? null,
      to: to ?? null,
    },
    totals: {
      escrowCount: escrows.length,
      grossVolume: round2(grossVolume),
      platformRevenue: round2(platformRevenue),
      pendingPlatformRevenue: round2(pendingPlatformRevenue),
      expertPayouts: round2(expertPayouts),
      refundedToStudents: round2(refundedToStudents),
    },
    byStatus,
    monthly: [...monthlyMap.values()],
  };
};

export const escrowService = {
  getEscrowByAssignmentId,
  getRevenueAnalytics,
};
