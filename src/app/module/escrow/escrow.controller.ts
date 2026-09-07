import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IQuery } from "../../interface";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
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
  const query: IQuery = req.query;
  const analytics = await escrowService.getRevenueAnalytics(query);

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
