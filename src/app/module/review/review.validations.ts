import { z } from "zod";

const REVIEW_SORTABLE_FIELDS = ["createdAt", "updatedAt", "rating"] as const;

export const CreateReviewZod = z.object({
  assignmentId: z
    .string("Assignment ID must be a string")
    .uuid("Assignment ID must be a valid UUID"),
  rating: z
    .number("Rating must be a number")
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string("Comment must be a string")
    .min(3, "Comment must be at least 3 characters")
    .max(1000, "Comment must be at most 1000 characters")
    .trim()
    .optional(),
});

export const GetExpertReviewsQueryZod = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5")
    .optional(),
  page: z.coerce
    .number()
    .int()
    .positive("Page must be a positive number")
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .positive("Limit must be a positive number")
    .max(100, "Limit must be at most 100")
    .optional(),
  sortBy: z.enum(REVIEW_SORTABLE_FIELDS, "Invalid sortBy field").optional(),
  sortOrder: z
    .enum(["asc", "desc"], "Sort order must be asc or desc")
    .optional(),
});
