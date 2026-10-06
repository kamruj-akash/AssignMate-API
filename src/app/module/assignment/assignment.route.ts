import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/authCheck";
import {
  dataValidationZod,
  multipartDataValidationZod,
  queryValidationZod,
} from "../../middleware/validation";
import { assignmentController } from "./assignment.controller";
import {
  CreateAssignmentZod,
  getCancellationRequestsQueryZod,
  resolveCancellationZod,
  submitAssignmentZod,
} from "./assignment.validations";

const router = Router();

// all routes are prefixed with /api/v1/assignment
router.post(
  "/create",
  upload.single("attachment"),
  auth(Role.STUDENT),
  multipartDataValidationZod(CreateAssignmentZod),
  assignmentController.createAssignment,
);
router.get("/feed", assignmentController.getOpenAssignments);
router.get("/:assignmentId/get", assignmentController.getAssignmentById);
router.get(
  "/my-assignments",
  auth(Role.STUDENT, Role.EXPERT),
  assignmentController.getMyAssignments,
);

router.patch(
  "/:assignmentId/submit",
  upload.single("attachment"),
  auth(Role.EXPERT),
  multipartDataValidationZod(submitAssignmentZod),
  assignmentController.submitAssignment,
);

router.patch(
  "/:assignmentId/action",
  auth(Role.STUDENT),
  assignmentController.assignmentAction,
);

router.delete(
  "/:assignmentId/delete",
  auth(Role.STUDENT),
  assignmentController.deleteAssignment,
);

router.get(
  "/admin/cancellations",
  auth(Role.ADMIN),
  queryValidationZod(getCancellationRequestsQueryZod),
  assignmentController.getCancellationRequests,
);
router.patch(
  "/admin/cancellations/:assignmentId/resolve",
  auth(Role.ADMIN),
  dataValidationZod(resolveCancellationZod),
  assignmentController.resolveCancellation,
);

export const AssignmentRoutes = router;
