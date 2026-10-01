import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";
import { dataValidationZod } from "../../middleware/validation";
import { authController } from "./auth.controller";
import {
  ForgetPasswordVerifyOtpZod,
  ForgetPasswordZod,
  LoginUserZod,
  RegisterUserZod,
  VerifyRegOtpZod,
} from "./auth.validation";

const router = Router();

router.post(
  "/register",
  dataValidationZod(RegisterUserZod),
  authController.registerUser,
);

router.post(
  "/verify-register",
  dataValidationZod(VerifyRegOtpZod),
  authController.verifyRegOtp,
);

router.post(
  "/forget-password",
  dataValidationZod(ForgetPasswordZod),
  authController.forgetPassword,
);

router.post(
  "/verify-forget-password-otp",
  dataValidationZod(ForgetPasswordVerifyOtpZod),
  authController.verifyForgetPasswordOtp,
);

router.post(
  "/login",
  dataValidationZod(LoginUserZod),
  authController.loginUser,
);

router.get(
  "/me",
  auth(Role.STUDENT, Role.EXPERT, Role.ADMIN),
  authController.getMe,
);

router.post("/google-login", authController.googleLogin);

router.post("/refresh-token", authController.refreshToken);

router.post("/logout", authController.logoutUser);

export const AuthRoute = router;
