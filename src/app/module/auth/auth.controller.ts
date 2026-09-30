import httpStatus from "http-status";
import envConfig from "../../config/env";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authService } from "./auth.service";

const registerUser = catchAsync(async (req, res) => {
  await authService.registerUser(req.body);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User registered successfully. Please check your email for OTP.",
    data: null,
  });
});

const verifyRegOtp = catchAsync(async (req, res) => {
  const user = await authService.verifyRegOtp(req.body);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User verified successfully.",
    data: user,
  });
});

const forgetPassword = catchAsync(async (req, res) => {
  const result = await authService.forgetPassword(req.body.email);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Password reset email sent successfully.",
    data: null,
  });
});
const verifyForgetPasswordOtp = catchAsync(async (req, res) => {
  const result = await authService.verifyForgetPasswordOtp(req.body);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Password reset successfully.",
    data: result,
  });
});

const loginUser = catchAsync(async (req, res) => {
  const result = await authService.loginUser(req.body);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: envConfig.node_env !== "production",
    sameSite: envConfig.node_env === "production" ? "lax" : "none",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    secure: envConfig.node_env !== "production",
    sameSite: envConfig.node_env === "production" ? "lax" : "none",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: `${result.role} logged in successfully.`,
    data: result,
  });
});

const getMe = catchAsync(async (req, res) => {
  const userInfo = await authService.getMe(req.user);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User info retrieved successfully.",
    data: userInfo,
  });
});

const googleLogin = catchAsync(async (req, res) => {
  const result = await authService.googleLogin(req.body);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User logged in successfully.",
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const result = await authService.refreshToken(req.cookies.refreshToken);
  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    secure: envConfig.node_env !== "production",
    sameSite: envConfig.node_env === "production" ? "lax" : "none",
    maxAge: 60 * 15, // 15 minutes
  });
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: envConfig.node_env !== "production",
    sameSite: envConfig.node_env === "production" ? "lax" : "none",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Access token refreshed successfully.",
    data: result,
  });
});

export const authController = {
  registerUser,
  verifyRegOtp,
  forgetPassword,
  verifyForgetPasswordOtp,
  loginUser,
  getMe,
  googleLogin,
  refreshToken,
};
