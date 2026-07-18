import { z } from "zod";

const opaqueId = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);
const isoDate = z.string().datetime({ offset: true });
const nullableIsoDate = isoDate.nullable();
const safeText = (max: number) => z.string().trim().min(1).max(max);
const exactSafeText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value === value.trim(), "앞뒤 공백을 포함할 수 없습니다.");

export const billingMethodStatusSchema = z.enum(["ACTIVE", "DEREGISTERING", "DEREGISTERED", "UNKNOWN"]);
export const billingRegistrationStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "DECLINED",
  "UNKNOWN",
  "EXPIRED",
]);
export const billingChargeStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "DECLINED",
  "UNKNOWN",
  "CANCEL_REQUESTED",
  "CANCELED",
]);
export const billingCancelRequestStatusSchema = z.enum(["REQUESTED", "PROCESSING", "DONE", "REJECTED"]);

export const billingErrorSchema = z
  .object({
    code: safeText(64),
    message: safeText(300),
  })
  .strict();

export const billingPaymentMethodSchema = z
  .object({
    id: opaqueId,
    cardName: safeText(64),
    cardLast4: z.string().regex(/^\d{4}$/),
    cardType: safeText(32),
    status: billingMethodStatusSchema,
    registeredAt: isoDate,
    verifiedAt: nullableIsoDate,
    deregisteredAt: nullableIsoDate,
  })
  .strict();

export const billingRegistrationIntentCreatedSchema = z
  .object({
    registrationId: opaqueId,
    hostedUrl: z.string().url().max(2_048),
    expiresAt: isoDate,
    status: billingRegistrationStatusSchema,
  })
  .strict();

export const billingRegistrationStatusResponseSchema = z
  .object({
    registrationId: opaqueId,
    status: billingRegistrationStatusSchema,
    expiresAt: isoDate,
    paymentMethod: billingPaymentMethodSchema.nullable(),
    error: billingErrorSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "SUCCEEDED" && !value.paymentMethod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "성공한 등록에는 결제수단이 필요합니다.",
      });
    }
    if (value.status !== "SUCCEEDED" && value.paymentMethod) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "완료 전 등록에는 결제수단을 포함할 수 없습니다.",
      });
    }
  });

export const billingPaymentMethodListSchema = z
  .object({
    paymentMethods: z.array(billingPaymentMethodSchema).max(10),
  })
  .strict();

export const billingChargeSchema = z
  .object({
    id: opaqueId,
    externalOrderId: opaqueId,
    status: billingChargeStatusSchema,
    amount: z.number().int().positive().safe(),
    paymentId: opaqueId.nullable(),
    createdAt: isoDate,
    updatedAt: isoDate,
    error: billingErrorSchema.nullable(),
  })
  .strict();

export const billingChargeResponseSchema = z.object({ charge: billingChargeSchema }).strict();

export const billingDeregisterResponseSchema = z
  .object({
    paymentMethod: z
      .object({
        id: opaqueId,
        status: billingMethodStatusSchema,
        deregisteredAt: nullableIsoDate,
        updatedAt: isoDate,
      })
      .strict(),
    idempotent: z.boolean(),
  })
  .strict();

export const billingCancelRequestResponseSchema = z
  .object({
    cancelRequest: z
      .object({
        id: opaqueId,
        status: billingCancelRequestStatusSchema,
        createdAt: isoDate,
      })
      .strict(),
    charge: z
      .object({
        id: opaqueId,
        status: billingChargeStatusSchema,
      })
      .strict(),
    idempotent: z.boolean(),
  })
  .strict();

export const billingCancelRequestStatusResponseSchema = z
  .object({
    cancelRequest: z
      .object({
        id: opaqueId,
        status: billingCancelRequestStatusSchema,
        reason: exactSafeText(200).nullable(),
        rejectReason: exactSafeText(500).nullable(),
        createdAt: isoDate,
        processedAt: nullableIsoDate,
      })
      .strict(),
    charge: billingChargeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const validPair =
      ((value.cancelRequest.status === "REQUESTED" ||
        value.cancelRequest.status === "PROCESSING") &&
        value.charge.status === "CANCEL_REQUESTED") ||
      (value.cancelRequest.status === "DONE" &&
        value.charge.status === "CANCELED") ||
      (value.cancelRequest.status === "REJECTED" &&
        value.charge.status === "PAID");
    if (!validPair) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["charge", "status"],
        message: "취소요청 상태와 결제 상태가 일치하지 않습니다.",
      });
    }
  });

export const billingApiErrorResponseSchema = z
  .object({
    error: billingErrorSchema,
  })
  .strict();

export type BillingPaymentMethod = z.infer<typeof billingPaymentMethodSchema>;
export type BillingRegistrationStatus = z.infer<typeof billingRegistrationStatusSchema>;
export type BillingCharge = z.infer<typeof billingChargeSchema>;
export type BillingMethodStatus = z.infer<typeof billingMethodStatusSchema>;
export type BillingCancelRequestStatus = z.infer<typeof billingCancelRequestStatusSchema>;
