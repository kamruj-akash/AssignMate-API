import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";
import { queryValidationZod } from "../../middleware/validation";
import { escrowController } from "./escrow.controller";
import {
  ExpertEarningsQueryZod,
  RevenueAnalyticsQueryZod,
} from "./escrow.validations";

const router = Router();

router.get(
  "/vault/:assignmentId",
  auth(Role.ADMIN, Role.EXPERT, Role.STUDENT),
  escrowController.getEscrowByAssignmentId,
);
router.get(
  "/admin/revenue-analytics",
  auth(Role.ADMIN),
  queryValidationZod(RevenueAnalyticsQueryZod),
  escrowController.getRevenueAnalytics,
);

router.get(
  "/expert/earnings",
  auth(Role.EXPERT),
  queryValidationZod(ExpertEarningsQueryZod),
  escrowController.getExpertEarnings,
);

export const EscrowRoute = router;
