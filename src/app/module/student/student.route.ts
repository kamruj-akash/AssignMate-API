import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";
import {
  dataValidationZod,
  queryValidationZod,
} from "../../middleware/validation";
import { studentController } from "./student.controller";
import {
  GetAllStudentsQueryZod,
  UpdateStudentProfileZod,
} from "./student.validations";

const router = Router();

router.get("/me", auth(Role.STUDENT), studentController.getMyProfile);
router.patch(
  "/me",
  auth(Role.STUDENT),
  dataValidationZod(UpdateStudentProfileZod),
  studentController.updateMyProfile,
);
router.get(
  "/get-all",
  auth(Role.ADMIN),
  queryValidationZod(GetAllStudentsQueryZod),
  studentController.getAllStudents,
);
// keep this last so "me" and "get-all" are not read as a student id
router.get("/:studentId", auth(Role.ADMIN), studentController.getStudentById);

export const StudentRoute = router;
