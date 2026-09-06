import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IQuery } from "../../interface";
import type { RequestUser } from "../../middleware/authCheck";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { assignmentService } from "./assignment.service";

const createAssignment = catchAsync(async (req: Request, res: Response) => {
  const attachment = req.file as Express.Multer.File | undefined;

  const assignment = await assignmentService.createAssignment(
    req.body,
    req.user as RequestUser,
    attachment,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Assignment created successfully",
    data: assignment,
  });
});

const getOpenAssignments = catchAsync(async (req: Request, res: Response) => {
  const query: IQuery = req.query;
  const result = await assignmentService.getOpenAssignments(query);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Assignments retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAssignmentById = catchAsync(async (req: Request, res: Response) => {
  const { assignmentId } = req.params;
  const assignment = await assignmentService.getAssignmentById(
    assignmentId as string,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Assignment retrieved successfully",
    data: assignment,
  });
});

const getMyAssignments = catchAsync(async (req: Request, res: Response) => {
  const query: IQuery = req.query;
  const result = await assignmentService.getMyAssignments(
    req.user as RequestUser,
    query,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "My assignments retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const submitAssignment = catchAsync(async (req: Request, res: Response) => {
  const attachment = req.file as Express.Multer.File;
  const assignmentId = req.params.assignmentId as string;
  const { status } = req.body;

  const assignment = await assignmentService.submitAssignment(
    req.user as RequestUser,
    assignmentId,
    status,
    attachment,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Assignment submitted successfully",
    data: assignment,
  });
});

const assignmentAction = catchAsync(async (req: Request, res: Response) => {
  const { assignmentId } = req.params;
  const { status, reason } = req.body;

  const assignment = await assignmentService.assignmentAction(
    req.user as RequestUser,
    assignmentId as string,
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Assignment action performed successfully",
    data: assignment,
  });
});

export const assignmentController = {
  createAssignment,
  getOpenAssignments,
  getAssignmentById,
  submitAssignment,
  getMyAssignments,
  assignmentAction,
};
