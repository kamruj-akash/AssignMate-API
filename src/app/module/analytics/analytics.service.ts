import httpStatus from "http-status";
import {
  BidStatus,
  EscrowStatus,
  ExpertVerificationStatus,
  PaymentStatus,
  Role,
  UserStatus,
} from "../../../../prisma/src/generated/prisma/enums";
import type { IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";

const emptyAssignmentStatus = () => ({
  OPEN: 0,
  ASSIGNED: 0,
  AWAITING_PAYMENT: 0,
  IN_PROGRESS: 0,
  SUBMITTED: 0,
  UNDER_REVIEW: 0,
  COMPLETED: 0,
  CANCELLED: 0,
  DISPUTED: 0,
});

const emptyBidStatus = () => ({
  PENDING: 0,
  ACCEPTED: 0,
  REJECTED: 0,
});

const getAdminOverview = async (query: IQuery) => {
  const from = query.from as string | undefined;
  const to = query.to as string | undefined;

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) {
    createdAt.gte = new Date(from);
  }
  if (to) {
    createdAt.lte = new Date(to);
  }

  const totalUsers = await prisma.user.count({ where: { createdAt } });
  const totalStudents = await prisma.user.count({
    where: { createdAt, role: Role.STUDENT },
  });
  const totalExperts = await prisma.user.count({
    where: { createdAt, role: Role.EXPERT },
  });
  const totalAdmins = await prisma.user.count({
    where: { createdAt, role: Role.ADMIN },
  });
  const blockedUsers = await prisma.user.count({
    where: { createdAt, status: UserStatus.BLOCK },
  });

  const pendingExperts = await prisma.expert.count({
    where: { createdAt, verificationStatus: ExpertVerificationStatus.PENDING },
  });
  const approvedExperts = await prisma.expert.count({
    where: { createdAt, verificationStatus: ExpertVerificationStatus.APPROVE },
  });
  const rejectedExperts = await prisma.expert.count({
    where: { createdAt, verificationStatus: ExpertVerificationStatus.REJECT },
  });

  const assignments = await prisma.assignment.findMany({
    where: { createdAt },
    select: { status: true },
  });

  const assignmentsByStatus = emptyAssignmentStatus();
  for (const assignment of assignments) {
    assignmentsByStatus[assignment.status] =
      assignmentsByStatus[assignment.status] + 1;
  }

  const completionRate =
    assignments.length === 0
      ? 0
      : Number(
          ((assignmentsByStatus.COMPLETED / assignments.length) * 100).toFixed(
            2,
          ),
        );
  const disputeRate =
    assignments.length === 0
      ? 0
      : Number(
          ((assignmentsByStatus.DISPUTED / assignments.length) * 100).toFixed(
            2,
          ),
        );

  const bids = await prisma.assignmentBid.findMany({
    where: { createdAt },
    select: { status: true },
  });

  const bidsByStatus = emptyBidStatus();
  for (const bid of bids) {
    bidsByStatus[bid.status] = bidsByStatus[bid.status] + 1;
  }

  const acceptanceRate =
    bids.length === 0
      ? 0
      : Number(((bidsByStatus.ACCEPTED / bids.length) * 100).toFixed(2));

  const payments = await prisma.payment.findMany({
    where: { createdAt },
    select: { amount: true, status: true },
  });

  const paymentsByStatus = {
    INITIATED: 0,
    PAID: 0,
    FAILED: 0,
    REFUNDED: 0,
  };
  let paidVolume = 0;
  for (const payment of payments) {
    paymentsByStatus[payment.status] = paymentsByStatus[payment.status] + 1;
    if (payment.status === PaymentStatus.PAID) {
      paidVolume = paidVolume + Number(payment.amount);
    }
  }

  const escrows = await prisma.escrow.findMany({
    where: { createdAt },
    select: {
      totalAmount: true,
      platformCommission: true,
      status: true,
    },
  });

  const escrowByStatus = {
    HELD: { count: 0, amount: 0 },
    RELEASED_TO_EXPERT: { count: 0, amount: 0 },
    REFUNDED_TO_STUDENT: { count: 0, amount: 0 },
  };
  let platformRevenue = 0;
  let pendingPlatformRevenue = 0;
  for (const escrow of escrows) {
    const totalAmount = Number(escrow.totalAmount);
    const commission = (totalAmount * Number(escrow.platformCommission)) / 100;

    escrowByStatus[escrow.status].count =
      escrowByStatus[escrow.status].count + 1;
    escrowByStatus[escrow.status].amount =
      escrowByStatus[escrow.status].amount + totalAmount;

    if (escrow.status === EscrowStatus.RELEASED_TO_EXPERT) {
      platformRevenue = platformRevenue + commission;
    }
    if (escrow.status === EscrowStatus.HELD) {
      pendingPlatformRevenue = pendingPlatformRevenue + commission;
    }
  }

  const reviews = await prisma.review.findMany({
    where: { createdAt },
    select: { rating: true },
  });

  let ratingSum = 0;
  for (const review of reviews) {
    ratingSum = ratingSum + review.rating;
  }
  const averageRating =
    reviews.length === 0 ? 0 : Number((ratingSum / reviews.length).toFixed(2));

  return {
    range: { from: from || null, to: to || null },
    users: {
      total: totalUsers,
      byRole: {
        STUDENT: totalStudents,
        EXPERT: totalExperts,
        ADMIN: totalAdmins,
      },
      blocked: blockedUsers,
    },
    experts: {
      byVerificationStatus: {
        PENDING: pendingExperts,
        APPROVE: approvedExperts,
        REJECT: rejectedExperts,
      },
    },
    assignments: {
      total: assignments.length,
      byStatus: assignmentsByStatus,
      completionRate,
      disputeRate,
    },
    bids: {
      total: bids.length,
      byStatus: bidsByStatus,
      acceptanceRate,
    },
    payments: {
      total: payments.length,
      byStatus: paymentsByStatus,
      paidVolume: Number(paidVolume.toFixed(2)),
    },
    escrow: {
      byStatus: escrowByStatus,
      platformRevenue: Number(platformRevenue.toFixed(2)),
      pendingPlatformRevenue: Number(pendingPlatformRevenue.toFixed(2)),
    },
    reviews: {
      total: reviews.length,
      averageRating,
    },
  };
};

const getStudentOverview = async (user: RequestUser) => {
  const existUser = await prisma.user.findUnique({
    where: { id: user.userId, role: Role.STUDENT },
    include: { student: true },
  });
  if (!existUser || !existUser.student) {
    throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
  }

  const studentId = existUser.student.id;

  const assignments = await prisma.assignment.findMany({
    where: { studentId },
    select: { status: true },
  });

  const assignmentsByStatus = emptyAssignmentStatus();
  for (const assignment of assignments) {
    assignmentsByStatus[assignment.status] =
      assignmentsByStatus[assignment.status] + 1;
  }

  const bids = await prisma.assignmentBid.findMany({
    where: { assignment: { studentId } },
    select: { status: true },
  });

  const bidsByStatus = emptyBidStatus();
  for (const bid of bids) {
    bidsByStatus[bid.status] = bidsByStatus[bid.status] + 1;
  }

  const payments = await prisma.payment.findMany({
    where: { assignment: { studentId } },
    select: { amount: true, status: true },
  });

  let totalPaid = 0;
  let pendingPayments = 0;
  for (const payment of payments) {
    if (payment.status === PaymentStatus.PAID) {
      totalPaid = totalPaid + Number(payment.amount);
    }
    if (payment.status === PaymentStatus.INITIATED) {
      pendingPayments = pendingPayments + 1;
    }
  }

  const escrows = await prisma.escrow.findMany({
    where: { assignment: { studentId } },
    select: { totalAmount: true, status: true },
  });

  let inEscrow = 0;
  let refunded = 0;
  for (const escrow of escrows) {
    if (escrow.status === EscrowStatus.HELD) {
      inEscrow = inEscrow + Number(escrow.totalAmount);
    }
    if (escrow.status === EscrowStatus.REFUNDED_TO_STUDENT) {
      refunded = refunded + Number(escrow.totalAmount);
    }
  }

  const reviewsWritten = await prisma.review.count({
    where: { studentId: existUser.id },
  });

  return {
    assignments: {
      total: assignments.length,
      byStatus: assignmentsByStatus,
      completed: assignmentsByStatus.COMPLETED,
      awaitingPayment: assignmentsByStatus.AWAITING_PAYMENT,
    },
    bidsReceived: {
      total: bids.length,
      byStatus: bidsByStatus,
    },
    spending: {
      totalPaid: Number(totalPaid.toFixed(2)),
      pendingPayments,
      inEscrow: Number(inEscrow.toFixed(2)),
      refunded: Number(refunded.toFixed(2)),
    },
    reviewsWritten,
  };
};

const getExpertOverview = async (user: RequestUser) => {
  const existUser = await prisma.user.findUnique({
    where: { id: user.userId, role: Role.EXPERT },
    include: { expert: true },
  });
  if (!existUser || !existUser.expert) {
    throw new AppError(httpStatus.NOT_FOUND, "Expert profile not found");
  }

  const expertId = existUser.expert.id;

  const bids = await prisma.assignmentBid.findMany({
    where: { expertId },
    select: { status: true },
  });

  const bidsByStatus = emptyBidStatus();
  for (const bid of bids) {
    bidsByStatus[bid.status] = bidsByStatus[bid.status] + 1;
  }

  const winRate =
    bids.length === 0
      ? 0
      : Number(((bidsByStatus.ACCEPTED / bids.length) * 100).toFixed(2));

  const assignments = await prisma.assignment.findMany({
    where: { assignedExpertId: expertId },
    select: { status: true },
  });

  const assignmentsByStatus = emptyAssignmentStatus();
  for (const assignment of assignments) {
    assignmentsByStatus[assignment.status] =
      assignmentsByStatus[assignment.status] + 1;
  }

  const escrows = await prisma.escrow.findMany({
    where: { assignment: { assignedExpertId: expertId } },
    select: { totalAmount: true, expertEarnings: true, status: true },
  });

  let released = 0;
  let pendingInEscrow = 0;
  for (const escrow of escrows) {
    const payout =
      (Number(escrow.totalAmount) * Number(escrow.expertEarnings)) / 100;

    if (escrow.status === EscrowStatus.RELEASED_TO_EXPERT) {
      released = released + payout;
    }
    if (escrow.status === EscrowStatus.HELD) {
      pendingInEscrow = pendingInEscrow + payout;
    }
  }

  const reviews = await prisma.review.findMany({
    where: { expertId },
    select: { rating: true },
  });

  let ratingSum = 0;
  for (const review of reviews) {
    ratingSum = ratingSum + review.rating;
  }
  const averageRating =
    reviews.length === 0 ? 0 : Number((ratingSum / reviews.length).toFixed(2));

  return {
    profile: {
      isVerified: existUser.expert.isVerified,
      verificationStatus: existUser.expert.verificationStatus,
    },
    bids: {
      total: bids.length,
      byStatus: bidsByStatus,
      winRate,
    },
    assignments: {
      total: assignments.length,
      byStatus: assignmentsByStatus,
    },
    earnings: {
      walletBalance: Number(Number(existUser.expert.walletBalance).toFixed(2)),
      released: Number(released.toFixed(2)),
      pendingInEscrow: Number(pendingInEscrow.toFixed(2)),
    },
    reputation: {
      totalReviews: reviews.length,
      averageRating,
    },
  };
};

export const analyticsService = {
  getAdminOverview,
  getStudentOverview,
  getExpertOverview,
};
