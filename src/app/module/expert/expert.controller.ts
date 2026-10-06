import httpStatus from "http-status";
import type { IQuery } from "../../interface";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { expertService } from "./expert.service";

const registerExpert = catchAsync(async (req, res) => {
  await expertService.registerExpert(req.body);
  //   res.redirect("/expert/verify-otp");
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Expert registered successfully, please check your email for OTP",
    data: null,
  });
});

const verifyExpert = catchAsync(async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const documents = files?.documents?.map((file: any) => file) ?? [];
  const result = await expertService.verifyExpert(req.body, documents);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Expert verified successfully",
    data: result,
  });
});

const approveExpert = catchAsync(async (req, res) => {
  const payload = req.body as {
    status: string;
    reason?: string;
    expertId: string;
  };
  const user = req.user as RequestUser;
  await expertService.approveExpert(payload, user);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Expert approved successfully",
    data: null,
  });
});

const studentRegisterExpert = catchAsync(async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const documents = files?.documents?.map((file: any) => file) ?? [];
  const user = req.user as RequestUser;
  const result = await expertService.studentRegisterExpert(
    req.body,
    documents,
    user,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Expert registered successfully, please wait for approval!",
    data: result,
  });
});

const getAllExperts = catchAsync(async (req, res) => {
  const query = req.query as unknown as IQuery;
  const data = await expertService.getAllExperts(
    query,
    req.user as RequestUser,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Experts fetched successfully",
    data,
  });
});

const updateMyProfile = catchAsync(async (req, res) => {
  const result = await expertService.updateMyProfile(
    req.user as RequestUser,
    req.body,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Profile updated successfully",
    data: result,
  });
});

export const expertController = {
  getAllExperts,
  updateMyProfile,
  registerExpert,
  verifyExpert,
  approveExpert,
  studentRegisterExpert,
};
