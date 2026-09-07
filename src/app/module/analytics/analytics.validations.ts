import { z } from "zod";

export const AnalyticsRangeQueryZod = z
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
