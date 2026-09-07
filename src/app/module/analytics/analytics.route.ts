import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";
import { queryValidationZod } from "../../middleware/validation";
import { analyticsController } from "./analytics.controller";
import { AnalyticsRangeQueryZod } from "./analytics.validations";

const router = Router();

router.get(
  "/admin/overview",
  auth(Role.ADMIN),
  queryValidationZod(AnalyticsRangeQueryZod),
  analyticsController.getAdminOverview,
);
router.get(
  "/student/overview",
  auth(Role.STUDENT),
  analyticsController.getStudentOverview,
);
router.get(
  "/expert/overview",
  auth(Role.EXPERT),
  analyticsController.getExpertOverview,
);

export const AnalyticsRoute = router;
