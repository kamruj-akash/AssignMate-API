import httpStatus from "http-status";
import {
  AssignmentStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type { ReviewWhereInput } from "../../../../prisma/src/generated/prisma/models";
import type { IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";
import type { ICreateReview, IRatingDistribution } from "./review.interface";

const writeReview = async (payload: ICreateReview, reqUser: RequestUser) => {
  const { assignmentId, rating, comment } = payload;

  const existUser = await prisma.user.findUnique({
    where: { id: reqUser.userId, role: Role.STUDENT },
    include: { student: true },
  });
  if (!existUser || !existUser.student) {
    throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId, studentId: existUser.student.id },
    include: { review: { select: { id: true } } },
  });
  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }

  if (assignment.status !== AssignmentStatus.COMPLETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You can only review a completed assignment",
    );
  }

  if (!assignment.assignedExpertId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This assignment has no assigned expert to review",
    );
  }

  if (assignment.review) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already reviewed this assignment",
    );
  }

  const review = await prisma.review.create({
    data: {
      assignmentId: assignment.id,
      expertId: assignment.assignedExpertId,
      studentId: existUser.id,
      rating,
      comment,
    },
    include: {
      assignment: { select: { id: true, title: true, status: true } },
      expert: {
        select: {
          id: true,
          university: true,
          department: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  return review;
};

const getExpertReviews = async (expertId: string, query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const rating = query.rating ? Number(query.rating) : undefined;

  const expert = await prisma.expert.findUnique({
    where: { id: expertId },
    select: {
      id: true,
      university: true,
      department: true,
      user: { select: { id: true, name: true } },
    },
  });
  if (!expert) {
    throw new AppError(httpStatus.NOT_FOUND, "Expert not found");
  }

  const listWhere: ReviewWhereInput = {
    expertId,
    ...(rating ? { rating } : {}),
  };

  const [reviews, total, summary, grouped] = await Promise.all([
    prisma.review.findMany({
      where: listWhere,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        assignment: { select: { id: true, title: true } },
        student: { select: { id: true, name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.review.count({ where: listWhere }),
    prisma.review.aggregate({
      where: { expertId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { expertId },
      _count: { _all: true },
    }),
  ]);

  const distribution: IRatingDistribution = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  for (const row of grouped) {
    const key = String(row.rating) as keyof IRatingDistribution;
    if (key in distribution) {
      distribution[key] = row._count._all;
    }
  }

  const totalPages = Math.ceil(total / limit);

  return {
    data: {
      expert,
      summary: {
        totalReviews: summary._count._all,
        averageRating: summary._avg.rating
          ? Math.round(summary._avg.rating * 100) / 100
          : 0,
        distribution,
      },
      reviews,
    },
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const getReviewByAssignmentId = async (assignmentId: string) => {
  const review = await prisma.review.findUnique({
    where: { assignmentId },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      assignment: { select: { id: true, title: true, status: true } },
      student: { select: { id: true, name: true } },
      expert: {
        select: {
          id: true,
          university: true,
          department: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!review) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No review found for this assignment",
    );
  }

  return review;
};

export const reviewService = {
  writeReview,
  getExpertReviews,
  getReviewByAssignmentId,
};
