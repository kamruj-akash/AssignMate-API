import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IQuery } from "../../interface";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { analyticsService } from "./analytics.service";

const getAdminOverview = catchAsync(async (req: Request, res: Response) => {
  const query: IQuery = req.query;
  const overview = await analyticsService.getAdminOverview(query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Platform analytics retrieved successfully",
    data: overview,
  });
});

const getStudentOverview = catchAsync(async (req: Request, res: Response) => {
  const overview = await analyticsService.getStudentOverview(
    req.user as RequestUser,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Student analytics retrieved successfully",
    data: overview,
  });
});

const getExpertOverview = catchAsync(async (req: Request, res: Response) => {
  const overview = await analyticsService.getExpertOverview(
    req.user as RequestUser,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Expert analytics retrieved successfully",
    data: overview,
  });
});

export const analyticsController = {
  getAdminOverview,
  getStudentOverview,
  getExpertOverview,
};
