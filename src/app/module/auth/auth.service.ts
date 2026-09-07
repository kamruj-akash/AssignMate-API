import bcrypt from "bcryptjs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import { type JwtPayload, type SignOptions } from "jsonwebtoken";
import {
  AuthProvider,
  Role,
  UserStatus,
} from "../../../../prisma/src/generated/prisma/enums";
import envConfig from "../../config/env";
import { redisClient } from "../../config/redis";
import { googleClient } from "../../lib/googleClient";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { emailService } from "../../utils/email/email.service";
import { jwtUtils } from "../../utils/jwt";
import type {
  IForgetPasswordVerifyOtp,
  ILoginUser,
  IRegisterUser,
  IVerifyRegOtp,
} from "./auth.interface";

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const registerUser = async (payload: IRegisterUser) => {
  const { name, password, role } = payload;
  const email = payload.email.trim().toLowerCase();
  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    if (isUserExists.authProvider === "GOOGLE") {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "User already exists with Google login, please login with Google and set a password to login with email and password",
      );
    }
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User already exists, please login",
    );
  }
  const otp = generateOtp();
  const storedUser = await redisClient.set(
    `newUser:${email}`,
    JSON.stringify({
      name,
      email,
      password: await bcrypt.hash(
        password,
        Number(envConfig.bcrypt_salt_rounds),
      ),
      role,
    }),
    { EX: 3600 },
  );
  const storedOtp = await redisClient.set(`registerOtp:${email}`, otp, {
    EX: 3600,
  });
  if (!storedUser || !storedOtp) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Something went wrong, please try again",
    );
  }

  try {
    await emailService.sendRegistrationOtp(email, {
      name,
      otp,
      expiresInMinutes: 60,
    });
  } catch (error) {
    await redisClient.del(`newUser:${email}`);
    await redisClient.del(`registerOtp:${email}`);
    throw error;
  }

  return;
};

const verifyRegOtp = async (payload: IVerifyRegOtp) => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();
  const storedOtp = await redisClient.get(`registerOtp:${email}`);
  if (!storedOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP has expired, please try again",
    );
  }
  if (storedOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP, please try again");
  }
  const userData = await redisClient.get(`newUser:${email}`);
  if (!userData) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User data has expired, please try again",
    );
  }
  const { name, password } = JSON.parse(userData);
  const registerUser = await prisma.user.create({
    data: {
      email,
      name,
      password,
      emailVerified: true,
      role: Role.STUDENT,
      student: {
        create: {
          institution: "",
          academicLevel: "",
        },
      },
    },
    omit: {
      password: true,
    },
    include: {
      student: true,
    },
  });
  await redisClient.del(`newUser:${email}`);
  await redisClient.del(`registerOtp:${email}`);

  await emailService.sendWelcome(email, { name, role: Role.STUDENT });

  return registerUser;
};

const forgetPassword = async (userEmail: string) => {
  const email = userEmail.trim().toLowerCase();
  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (!isUserExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User does not exist, please register",
    );
  }
  const otp = generateOtp();
  const storedOtp = await redisClient.set(`forgetPasswordOtp:${email}`, otp, {
    EX: 300,
  });
  if (!storedOtp) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Something went wrong, please try again",
    );
  }

  try {
    await emailService.sendPasswordResetOtp(email, {
      name: isUserExists.name,
      otp,
      expiresInMinutes: 5,
    });
  } catch (error) {
    await redisClient.del(`forgetPasswordOtp:${email}`);
    throw error;
  }

  return;
};

const verifyForgetPasswordOtp = async (payload: IForgetPasswordVerifyOtp) => {
  const { newPassword, otp } = payload;
  const email = payload.email.trim().toLowerCase();
  const storedOtp = await redisClient.get(`forgetPasswordOtp:${email}`);
  if (!storedOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP has expired, please try again",
    );
  }
  if (storedOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP, please try again");
  }
  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      password: await bcrypt.hash(
        newPassword,
        Number(envConfig.bcrypt_salt_rounds),
      ),
    },
    omit: { password: true },
  });
  await redisClient.del(`forgetPasswordOtp:${email}`);

  return updatedUser;
};

const loginUser = async (payload: ILoginUser) => {
  const { password } = payload;
  const userEmail = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User does not exist, please register",
    );
  }

  if (!user.password && user.authProvider === "GOOGLE") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User does not have a password, please login with Google!",
    );
  }

  const isMatch = await bcrypt.compare(password, user.password!);
  if (!isMatch) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Password is incorrect, please try again",
    );
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    envConfig.jwt_refresh_secret,
    envConfig.jwt_refresh_expires_in as SignOptions,
  );

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    envConfig.jwt_access_secret,
    envConfig.jwt_access_expires_in as SignOptions,
  );

  return { refreshToken, accessToken, role: user.role };
};

const getMe = async (user: any) => {
  const userData = await prisma.user.findUnique({
    where: { id: user.userId },
    omit: { password: true },
    include: {
      student: true,
      expert: true,
    },
  });
  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return userData;
};

const googleLogin = async (googleIdToken: string) => {
  let googleIdTokenPayload: TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: googleIdToken,
      audience: envConfig.gClient_id,
    });
    googleIdTokenPayload = ticket.getPayload();
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.message || "Invalid or expired Google Id Token!",
    );
  }

  if (
    !googleIdTokenPayload?.email ||
    !googleIdTokenPayload?.email_verified ||
    !googleIdTokenPayload?.name
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Google Id Token does not contain a verified email address!",
    );
  }
  const { name, email, sub: googleId } = googleIdTokenPayload;
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        authProvider: AuthProvider.GOOGLE,
        googleId,
        emailVerified: true,
        role: Role.STUDENT,
        student: {
          create: {
            institution: "",
            academicLevel: "",
          },
        },
      },
      include: {
        student: true,
      },
    });

    await emailService.sendWelcome(user.email, {
      name: user.name,
      role: Role.STUDENT,
    });
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    envConfig.jwt_refresh_secret,
    envConfig.jwt_refresh_expires_in as SignOptions,
  );

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    envConfig.jwt_access_secret,
    envConfig.jwt_access_expires_in as SignOptions,
  );

  return { refreshToken, accessToken };
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    envConfig.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      envConfig.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User is inactive or not found",
    );
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    envConfig.jwt_access_secret,
    envConfig.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    envConfig.jwt_refresh_secret,
    envConfig.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const authService = {
  registerUser,
  verifyRegOtp,
  forgetPassword,
  verifyForgetPasswordOtp,
  loginUser,
  getMe,
  googleLogin,
  refreshToken,
};
