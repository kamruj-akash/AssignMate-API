import { z } from "zod";

const STUDENT_SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "institution",
  "academicLevel",
] as const;

export const UpdateStudentProfileZod = z
  .object({
    name: z
      .string("Name must be a string")
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(255, "Name must be at most 255 characters")
      .optional(),
    phoneNo: z
      .string("Phone number must be a string")
      .trim()
      .min(6, "Phone number must be at least 6 characters")
      .max(20, "Phone number must be at most 20 characters")
      .optional(),
    institution: z
      .string("Institution must be a string")
      .trim()
      .min(2, "Institution must be at least 2 characters")
      .max(255, "Institution must be at most 255 characters")
      .optional(),
    academicLevel: z
      .string("Academic level must be a string")
      .trim()
      .min(2, "Academic level must be at least 2 characters")
      .max(100, "Academic level must be at most 100 characters")
      .optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message:
      "Provide at least one of: name, phoneNo, institution, academicLevel",
  });

export const GetAllStudentsQueryZod = z.object({
  searchTerm: z.string().optional(),
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
  sortBy: z.enum(STUDENT_SORTABLE_FIELDS, "Invalid sortBy field").optional(),
  sortOrder: z
    .enum(["asc", "desc"], "Sort order must be asc or desc")
    .optional(),
});
