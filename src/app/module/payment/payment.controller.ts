import httpStatus from "http-status";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { paymentService } from "./payment.service";

const initiateCheckout = catchAsync(async (req, res) => {
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

const bkashCallback = catchAsync(async (req, res) => {
  const callbackData = await paymentService.bkashCallback(req.query);
  res.redirect(callbackData.redirectUrl as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Bkash callback processed successfully",
    data: null,
  });
});

export const paymentController = {
  initiateCheckout,
  bkashCallback,
};
