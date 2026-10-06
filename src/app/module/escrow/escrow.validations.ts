import { z } from "zod";

export const RevenueAnalyticsQueryZod = z
  .object({
    from: z
      .string()
      .datetime("`from` must be a valid ISO date string")
      .optional(),
    to: z.string().datetime("`to` must be a valid ISO date string").optional(),
  })
  .refine(
    (data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to),
    {
      message: "`from` must be earlier than or equal to `to`",
      path: ["from"],
    },
  );

export const ExpertEarningsQueryZod = z.object({
  status: z
    .enum(
      ["HELD", "RELEASED_TO_EXPERT", "REFUNDED_TO_STUDENT"],
      "Status must be HELD, RELEASED_TO_EXPERT or REFUNDED_TO_STUDENT",
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
    .optional(),
});
