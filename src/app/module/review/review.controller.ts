import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IQuery } from "../../interface";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { reviewService } from "./review.service";

const writeReview = catchAsync(async (req: Request, res: Response) => {
  const review = await reviewService.writeReview(
    req.body,
    req.user as RequestUser,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Review submitted successfully",
    data: review,
  });
});

const getExpertReviews = catchAsync(async (req: Request, res: Response) => {
  const query: IQuery = req.query;
  const result = await reviewService.getExpertReviews(
    req.params.expertId as string,
    query,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Expert reviews retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getReviewByAssignmentId = catchAsync(
  async (req: Request, res: Response) => {
    const review = await reviewService.getReviewByAssignmentId(
      req.params.assignmentId as string,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Review retrieved successfully",
      data: review,
    });
  },
);

export const reviewController = {
  writeReview,
  getExpertReviews,
  getReviewByAssignmentId,
};
