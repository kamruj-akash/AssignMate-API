import { z } from "zod";

export interface PaymentInitiateCheckoutRequest {
  paymentID: string;
  bkashURL: string;
  callbackURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
  amount: string;
  intent: string;
  currency: string;
  paymentCreateTime: string;
  transactionStatus: string;
  merchantInvoiceNumber: string;
  statusCode: string;
  statusMessage: string;
}

const PAYMENT_SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "amount",
  "status",
  "paidAt",
] as const;

export const GetPaymentHistoryQueryZod = z.object({
  searchTerm: z.string().optional(),
  status: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(
      z.enum(
        ["INITIATED", "PAID", "FAILED", "REFUNDED"],
        "Status must be INITIATED, PAID, FAILED or REFUNDED",
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
  sortBy: z.enum(PAYMENT_SORTABLE_FIELDS, "Invalid sortBy field").optional(),
  sortOrder: z
    .enum(["asc", "desc"], "Sort order must be asc or desc")
    .optional(),
});
