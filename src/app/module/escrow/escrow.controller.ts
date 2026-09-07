import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRevenueAnalyticsQuery } from "./escrow.interface";
import { escrowService } from "./escrow.service";

const getEscrowByAssignmentId = catchAsync(
  async (req: Request, res: Response) => {
    const escrow = await escrowService.getEscrowByAssignmentId(
      req.params.assignmentId as string,
      req.user as RequestUser,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Escrow retrieved successfully",
      data: escrow,
    });
  },
);

const getRevenueAnalytics = catchAsync(async (req: Request, res: Response) => {
  const analytics = await escrowService.getRevenueAnalytics(
    req.query as IRevenueAnalyticsQuery,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Revenue analytics retrieved successfully",
    data: analytics,
  });
});

export const escrowController = {
  getEscrowByAssignmentId,
  getRevenueAnalytics,
};
