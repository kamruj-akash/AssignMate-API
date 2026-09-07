import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";

const router = Router();

router.post("/write", auth(Role.STUDENT));
router.get("/expert/:expertId");
router.get("/:assignmentId");

export const ReviewRoute = router;
