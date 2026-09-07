import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";

const router = Router();

router.get("/vault/:assignmentId", auth(Role.ADMIN, Role.EXPERT, Role.STUDENT));
router.get("/admin/revenue-analytics", auth(Role.ADMIN));

export const EscrowRoute = router;