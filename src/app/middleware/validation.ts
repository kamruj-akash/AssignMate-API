import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { z } from "zod";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

const formatIssues = (error: z.ZodError) =>
  error.issues
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join("; ");

export const dataValidationZod = (zodSchema: z.ZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body ?? {};
    // console.log("data in ZOD is", payload);
    const result = zodSchema.safeParse(payload);
    if (!result.success) {
      throw new AppError(httpStatus.BAD_REQUEST, formatIssues(result.error));
    }
    req.body = result.data;
    next();
  });
};

export const multipartDataValidationZod = (zodSchema: z.ZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const rawPayload = (req.body ?? {}).body;
    // console.log(rawPayload);
    if (typeof rawPayload !== "string") {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "A `body` field containing the JSON payload is required",
      );
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "The `body` field must contain valid JSON",
      );
    }

    const result = zodSchema.safeParse(parsedPayload);
    if (!result.success) {
      throw new AppError(httpStatus.BAD_REQUEST, formatIssues(result.error));
    }
    req.body = result.data;
    next();
  });
};

export const queryValidationZod = (zodSchema: z.ZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = zodSchema.safeParse(req.query ?? {});
    if (!result.success) {
      throw new AppError(httpStatus.BAD_REQUEST, formatIssues(result.error));
    }
    Object.defineProperty(req, "query", {
      value: result.data,
      writable: true,
      configurable: true,
    });
    next();
  });
};
