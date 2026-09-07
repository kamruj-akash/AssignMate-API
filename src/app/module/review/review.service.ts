import httpStatus from "http-status";
import {
  AssignmentStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type { IQuery } from "../../interface";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";
import type { ICreateReview } from "./review.interface";

const writeReview = async (payload: ICreateReview, reqUser: RequestUser) => {
  const { assignmentId, rating, comment } = payload;

  const existUser = await prisma.user.findUnique({
    where: { id: reqUser.userId, role: Role.STUDENT },
    include: { student: true },
  });
  if (!existUser || !existUser.student) {
    throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
  }

  const existAssignment = await prisma.assignment.findUnique({
    where: { id: assignmentId, studentId: existUser.student.id },
  });
  if (!existAssignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }

  if (existAssignment.status !== AssignmentStatus.COMPLETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You can only review a completed assignment",
    );
  }

  if (!existAssignment.assignedExpertId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This assignment has no assigned expert to review",
    );
  }

  const existReview = await prisma.review.findUnique({
    where: { assignmentId },
  });
  if (existReview) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already reviewed this assignment",
    );
  }

  const review = await prisma.review.create({
    data: {
      assignmentId: existAssignment.id,
      expertId: existAssignment.assignedExpertId,
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
  const rating = Number(query.rating) || undefined;
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const existExpert = await prisma.expert.findUnique({
    where: { id: expertId },
    select: {
      id: true,
      university: true,
      department: true,
      user: { select: { id: true, name: true } },
    },
  });
  if (!existExpert) {
    throw new AppError(httpStatus.NOT_FOUND, "Expert not found");
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { expertId, rating },
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
    prisma.review.count({ where: { expertId, rating } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const allReviews = await prisma.review.findMany({
    where: { expertId },
    select: { rating: true },
  });

  const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let ratingSum = 0;
  for (const review of allReviews) {
    ratingSum = ratingSum + review.rating;
    if (review.rating === 1) distribution["1"] = distribution["1"] + 1;
    if (review.rating === 2) distribution["2"] = distribution["2"] + 1;
    if (review.rating === 3) distribution["3"] = distribution["3"] + 1;
    if (review.rating === 4) distribution["4"] = distribution["4"] + 1;
    if (review.rating === 5) distribution["5"] = distribution["5"] + 1;
  }

  const averageRating =
    allReviews.length === 0
      ? 0
      : Number((ratingSum / allReviews.length).toFixed(2));

  return {
    data: {
      expert: existExpert,
      summary: {
        totalReviews: allReviews.length,
        averageRating,
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
