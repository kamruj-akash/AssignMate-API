import { Router } from "express";
import { Role } from "../../../../prisma/src/generated/prisma/enums";
import { auth } from "../../middleware/authCheck";
import {
  dataValidationZod,
  queryValidationZod,
} from "../../middleware/validation";
import { reviewController } from "./review.controller";
import {
  CreateReviewZod,
  GetExpertReviewsQueryZod,
} from "./review.validations";

const router = Router();

router.post(
  "/write",
  auth(Role.STUDENT),
  dataValidationZod(CreateReviewZod),
  reviewController.writeReview,
);
// keep this above "/:assignmentId" so "expert" is not read as an assignment id
router.get(
  "/expert/:expertId",
  queryValidationZod(GetExpertReviewsQueryZod),
  reviewController.getExpertReviews,
);
router.get("/:assignmentId", reviewController.getReviewByAssignmentId);

export const ReviewRoute = router;
