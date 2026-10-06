import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/authCheck";
import {
  dataValidationZod,
  multipartDataValidationZod,
  queryValidationZod,
} from "../../middleware/validation";
import { expertController } from "./expert.controller";
import {
  ApproveExpertZod,
  GetAllExpertsQueryZod,
  RegisterExpertZod,
  StudentRegisterExpertZod,
  UpdateExpertProfileZod,
  VerifyExpertZod,
} from "./expert.validation";

const router = Router();

router.post(
  "/register",
  dataValidationZod(RegisterExpertZod),
  expertController.registerExpert,
);
router.post(
  "/verify",
  upload.fields([{ name: "documents", maxCount: 5 }]),
  multipartDataValidationZod(VerifyExpertZod),
  expertController.verifyExpert,
);
router.post(
  "/approve",
  auth(Role.ADMIN),
  dataValidationZod(ApproveExpertZod),
  expertController.approveExpert,
);
router.post(
  "/student-apply",
  auth(Role.STUDENT),
  upload.fields([{ name: "documents", maxCount: 5 }]),
  multipartDataValidationZod(StudentRegisterExpertZod),
  expertController.studentRegisterExpert,
);
router.get(
  "/get-all",
  auth(Role.ADMIN),
  queryValidationZod(GetAllExpertsQueryZod),
  expertController.getAllExperts,
);

router.patch(
  "/profile",
  auth(Role.EXPERT),
  dataValidationZod(UpdateExpertProfileZod),
  expertController.updateMyProfile,
);

export const ExpertRoute = router;
