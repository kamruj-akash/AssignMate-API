import { z } from "zod";

export const RegisterExpertZod = z.object({
  name: z.string("Not a String").min(3).max(255),
  email: z.string().email("invalid email").min(3),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(64, "Password must be at most 64 characters"),
});

export const VerifyExpertZod = z.object({
  email: z.string().email("invalid email").min(3),
  otp: z.string().length(6, "OTP must be 6 characters"),
  university: z.string().min(2, "University must be at least 2 characters"),
  department: z.string().min(2, "Department must be at least 2 characters"),
  ratePerAssignment: z
    .number("Rate per assignment must be a number")
    .positive("Rate per assignment must be greater than 0"),
  bio: z.string().max(1000, "Bio must be at most 1000 characters").optional(),
});

export const StudentRegisterExpertZod = z.object({
  university: z.string().min(2, "University must be at least 2 characters"),
  department: z.string().min(2, "Department must be at least 2 characters"),
  ratePerAssignment: z
    .number("Rate per assignment must be a number")
    .positive("Rate per assignment must be greater than 0"),
  bio: z.string().max(1000, "Bio must be at most 1000 characters").optional(),
});

export const ApproveExpertZod = z
  .object({
    expertId: z.string().uuid("Invalid expert id"),
    status: z
      .string("Status is required")
      .transform((value) => value.toUpperCase())
      .pipe(
        z.enum(
          ["APPROVE", "REJECT"],
          "Status must be either APPROVE or REJECT",
        ),
      ),
    reason: z
      .string()
      .max(500, "Reason must be at most 500 characters")
      .optional(),
  })
  .refine((data) => data.status !== "REJECT" || !!data.reason?.trim(), {
    message: "Reason is required when rejecting an expert",
    path: ["reason"],
  });

const EXPERT_SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "university",
  "department",
  "ratePerAssignment",
  "walletBalance",
  "isVerified",
  "verificationStatus",
] as const;

export const GetAllExpertsQueryZod = z.object({
  searchTerm: z.string().optional(),
  status: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(
      z.enum(
        ["PENDING", "APPROVE", "REJECT"],
        "Status must be PENDING, APPROVE or REJECT",
      ),
    )
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
  sortBy: z.enum(EXPERT_SORTABLE_FIELDS, "Invalid sortBy field").optional(),
  sortOrder: z
    .enum(["asc", "desc"], "Sort order must be asc or desc")
    .optional(),
});

// university/department are what the admin verified, so they stay read-only
export const UpdateExpertProfileZod = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(255, "Name must be at most 255 characters")
      .optional(),
    phoneNo: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,15}$/, "Phone number must be 7-15 digits")
      .optional(),
    bio: z
      .string()
      .trim()
      .max(1000, "Bio must be at most 1000 characters")
      .optional(),
    ratePerAssignment: z
      .number("Rate per assignment must be a number")
      .positive("Rate per assignment must be greater than 0")
      .optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });
