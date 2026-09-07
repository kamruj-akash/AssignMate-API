import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";
import { queryValidationZod } from "../../middleware/validation";
import { escrowController } from "./escrow.controller";
import { RevenueAnalyticsQueryZod } from "./escrow.validations";

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

export const EscrowRoute = router;
