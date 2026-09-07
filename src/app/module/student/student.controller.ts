import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IQuery } from "../../interface";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { studentService } from "./student.service";

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await studentService.getMyProfile(req.user as RequestUser);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Student profile retrieved successfully",
    data: profile,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await studentService.updateMyProfile(
    req.body,
    req.user as RequestUser,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Student profile updated successfully",
    data: profile,
  });
});

const getAllStudents = catchAsync(async (req: Request, res: Response) => {
  const query: IQuery = req.query;
  const result = await studentService.getAllStudents(query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Students retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getStudentById = catchAsync(async (req: Request, res: Response) => {
  const student = await studentService.getStudentById(
    req.params.studentId as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Student retrieved successfully",
    data: student,
  });
});

export const studentController = {
  getMyProfile,
  updateMyProfile,
  getAllStudents,
  getStudentById,
};
