import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { paymentService } from "./payment.service";

const initiateCheckout = catchAsync(async (req: Request, res: Response) => {
  const checkoutData = await paymentService.initiateCheckout(
    req.params.assignmentId as string,
    req.user as RequestUser,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Checkout initiated successfully",
    data: checkoutData,
  });
});

const bkashCallback = catchAsync(async (req: Request, res: Response) => {
  const callbackData = await paymentService.bkashCallback(req.query);
  res.redirect(callbackData.redirectUrl as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Bkash callback processed successfully",
    data: null,
  });
});

const paymentHistory = catchAsync(async (req: Request, res: Response) => {});

export const paymentController = {
  initiateCheckout,
  bkashCallback,
  paymentHistory,
};
