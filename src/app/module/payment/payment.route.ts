// /initiate-checkout

import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";
import { paymentController } from "./payment.controller";

const router = Router();

router.post(
  "/initiate-checkout/:assignmentId",
  auth(Role.STUDENT),
  paymentController.initiateCheckout,
);
router.get("/callback/bkash", paymentController.bkashCallback);
router.get(
  "/history",
  auth(Role.ADMIN, Role.STUDENT),
  paymentController.paymentHistory,
);

export const PaymentRoute = router;
