import httpStatus from "http-status";
import {
  BidStatus,
  EscrowStatus,
  PaymentStatus,
} from "../../../../prisma/src/generated/prisma/enums";
import type { StudentWhereInput } from "../../../../prisma/src/generated/prisma/models";
import type { IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";
import type { IUpdateStudentProfile } from "./student.interface";

const getStudentStats = async (studentId: string, userId: string) => {
  const assignments = await prisma.assignment.findMany({
    where: { studentId },
    select: { status: true },
  });

  const assignmentsByStatus = {
    OPEN: 0,
    ASSIGNED: 0,
    AWAITING_PAYMENT: 0,
    IN_PROGRESS: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    DISPUTED: 0,
  };
  for (const assignment of assignments) {
    assignmentsByStatus[assignment.status] =
      assignmentsByStatus[assignment.status] + 1;
  }

  const pendingBids = await prisma.assignmentBid.count({
    where: {
      status: BidStatus.PENDING,
      assignment: { studentId },
    },
  });

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
    where: { studentId: userId },
  });

  return {
    assignments: {
      total: assignments.length,
      byStatus: assignmentsByStatus,
    },
    bidsReceived: { pending: pendingBids },
    spending: {
      totalPaid: Number(totalPaid.toFixed(2)),
      pendingPayments,
      inEscrow: Number(inEscrow.toFixed(2)),
      refunded: Number(refunded.toFixed(2)),
    },
    reviewsWritten,
  };
};

const getMyProfile = async (user: RequestUser) => {
  const existStudent = await prisma.student.findUnique({
    where: { userId: user.userId },
    select: {
      id: true,
      institution: true,
      academicLevel: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          imageUrl: true,
          status: true,
          emailVerified: true,
        },
      },
    },
  });
  if (!existStudent) {
    throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
  }

  const stats = await getStudentStats(existStudent.id, user.userId);

  return { ...existStudent, stats };
};

const updateMyProfile = async (
  payload: IUpdateStudentProfile,
  user: RequestUser,
) => {
  const { name, phoneNo, institution, academicLevel } = payload;

  const existStudent = await prisma.student.findUnique({
    where: { userId: user.userId },
  });
  if (!existStudent) {
    throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
  }

  const transaction = await prisma.$transaction(async (tx) => {
    if (name || phoneNo) {
      await tx.user.update({
        where: { id: user.userId },
        data: { name, phoneNo },
      });
    }

    if (institution || academicLevel) {
      await tx.student.update({
        where: { id: existStudent.id },
        data: { institution, academicLevel },
      });
    }

    const student = await tx.student.findUnique({
      where: { id: existStudent.id },
      select: {
        id: true,
        institution: true,
        academicLevel: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            imageUrl: true,
            status: true,
            emailVerified: true,
          },
        },
      },
    });

    return student;
  });

  return transaction;
};

const getAllStudents = async (query: IQuery) => {
  const searchTerm = query.searchTerm || "";
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const andConditions: StudentWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { institution: { contains: searchTerm, mode: "insensitive" } },
        { academicLevel: { contains: searchTerm, mode: "insensitive" } },
        { user: { name: { contains: searchTerm, mode: "insensitive" } } },
        { user: { email: { contains: searchTerm, mode: "insensitive" } } },
      ],
    });
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where: { AND: andConditions },
      select: {
        id: true,
        institution: true,
        academicLevel: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            status: true,
            emailVerified: true,
          },
        },
        _count: { select: { assignmentTasks: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.student.count({ where: { AND: andConditions } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: students,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const getStudentById = async (studentId: string) => {
  const existStudent = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      institution: true,
      academicLevel: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          status: true,
          emailVerified: true,
        },
      },
      _count: { select: { assignmentTasks: true } },
    },
  });
  if (!existStudent) {
    throw new AppError(httpStatus.NOT_FOUND, "Student not found");
  }

  const stats = await getStudentStats(existStudent.id, existStudent.user.id);

  const recentAssignments = await prisma.assignment.findMany({
    where: { studentId: existStudent.id },
    select: {
      id: true,
      title: true,
      status: true,
      budget: true,
      deadline: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return { ...existStudent, stats, recentAssignments };
};

export const studentService = {
  getMyProfile,
  updateMyProfile,
  getAllStudents,
  getStudentById,
};
