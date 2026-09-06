import type { CookieOptions, NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
  UserStatus,
  type Role,
} from "../../../prisma/src/generated/prisma/enums";
import envConfig from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

export interface RequestUser {
  email: string;
  name: string;
  userId: string;
  role: Role;
  phoneNo?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes

const isUsableToken = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const token = value.trim();
  if (!token || token === "undefined" || token === "null" || token === "Bearer")
    return false;
  return token.split(".").length === 3;
};

const extractToken = (req: Request): string | undefined => {
  const cookieToken = req.cookies?.accessToken;
  if (isUsableToken(cookieToken)) return cookieToken.trim();

  const rawHeader = req.headers.authorization;
  if (!rawHeader) return undefined;

  const headerToken = rawHeader.startsWith("Bearer ")
    ? rawHeader.slice(7).trim()
    : rawHeader.trim();

  return isUsableToken(headerToken) ? headerToken : undefined;
};

const getAccessCookieOptions = (): CookieOptions => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  };
};

// auth(Role.ADMIN, Role.USER, Role.AUTHOR)
export const auth = (...requiredRoles: Role[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = extractToken(req);
    const refreshToken = req.cookies?.refreshToken;

    let payload: JwtPayload | undefined;

    if (accessToken) {
      const verifiedAccess = jwtUtils.verifyToken(
        accessToken,
        envConfig.jwt_access_secret,
      );
      if (verifiedAccess.success) {
        payload = verifiedAccess.data as JwtPayload;
      }
    }

    if (!payload) {
      if (!isUsableToken(refreshToken)) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "You are not logged in. Please log in to access this resource.",
        );
      }

      const verifiedRefresh = jwtUtils.verifyToken(
        refreshToken.trim(),
        envConfig.jwt_refresh_secret,
      );

      if (!verifiedRefresh.success) {
        res.clearCookie("accessToken", getAccessCookieOptions());
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Session expired. Please log in again.",
        );
      }

      const refreshPayload = verifiedRefresh.data as JwtPayload;
      const { iat: _iat, exp: _exp, ...cleanPayload } = refreshPayload;

      const newAccessToken = jwtUtils.createToken(
        cleanPayload,
        envConfig.jwt_access_secret,
        envConfig.jwt_access_expires_in as SignOptions,
      );

      res.cookie("accessToken", newAccessToken, getAccessCookieOptions());

      res.setHeader("x-access-token", newAccessToken);

      payload = cleanPayload as JwtPayload;
    }

    const { email, name, userId, role } = payload as JwtPayload & {
      email: string;
      name: string;
      userId: string;
      role: Role;
    };

    if (!userId || !email) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Invalid token payload. Please log in again.",
      );
    }

    if (requiredRoles.length && !requiredRoles.includes(role)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Forbidden. You don't have permission to access this resource.",
      );
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, email, name, role },
    });

    if (!user) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "User not found. Please log in again.",
      );
    }

    if (user.status === UserStatus.BLOCK) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account has been blocked. Please contact support.",
      );
    }

    req.user = {
      email: user.email,
      name: user.name,
      phoneNo: user.phoneNo || "",
      userId: user.id,
      role: user.role,
    };

    next();
  });
};
