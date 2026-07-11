"use server";

import { requireShopAdmin } from "@/lib/auth";
import { preparePaymentResolution, type PaymentResolution } from "@/lib/admin-order";
import { prisma } from "@/lib/db";
import { acquireTransactionLock } from "@/lib/order-guard";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export type AdminPaymentState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectTo?: string;
};

const orderIdSchema = z.string().trim().min(1).max(100);
const reasonSchema = z
  .string()
  .trim()
  .min(5, "KSTA에서 확인한 내용을 5자 이상 기록해 주세요.")
  .max(500, "확인 메모는 500자 이내로 입력해 주세요.");
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const paidSchema = z.object({
  orderId: orderIdSchema,
  confirmedAmount: z.coerce
    .number()
    .int()
    .positive("KSTA 승인 금액을 입력해 주세요.")
    .max(2_147_483_647, "승인 금액이 허용 범위를 초과했습니다."),
  approvalNo: z.string().trim().min(1, "KSTA 승인번호를 입력해 주세요.").max(64, "승인번호는 64자 이내로 입력해 주세요."),
  pgTrno: z.string().trim().min(1, "KSTA PG 거래번호를 입력해 주세요.").max(100, "PG 거래번호는 100자 이내로 입력해 주세요."),
  cardName: optionalText(50, "결제수단 표기는 50자 이내로 입력해 주세요."),
  reason: reasonSchema,
  confirmed: z.literal("on", { errorMap: () => ({ message: "KSTA 대조 완료 항목을 확인해 주세요." }) }),
});

const failedSchema = z.object({
  orderId: orderIdSchema,
  confirmedMoid: z.string().trim().min(1, "주문번호를 다시 입력해 주세요.").max(100),
  reason: reasonSchema,
  confirmed: z.literal("on", { errorMap: () => ({ message: "미승인 또는 취소 확인 항목을 확인해 주세요." }) }),
});

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

async function resolvePayment(
  adminUserId: string,
  orderId: string,
  resolution: PaymentResolution,
  confirmedMoid?: string,
): Promise<AdminPaymentState> {
  let result: { ok: true } | { ok: false; error: string } | null;
  try {
    result = await prisma.$transaction(async (tx) => {
      // PG callback과 같은 잠금 키를 공유해 관리자 처리와 자동 확정이 서로 덮어쓰지 않게 한다.
      await acquireTransactionLock(tx, `order:${orderId}`);

      // 역할이 액션 시작 직후 변경된 경우도 차단하도록 트랜잭션 안에서 다시 확인한다.
      const actor = await tx.shopUser.findFirst({
        where: { id: adminUserId, role: "ADMIN", deletedAt: null },
        select: { id: true, email: true },
      });
      if (!actor) return { ok: false as const, error: "관리자 권한을 다시 확인해 주세요." };

      const order = await tx.shopOrder.findUnique({
        where: { id: orderId },
        select: { id: true, moid: true, status: true, approvalNo: true, totalAmount: true, updatedAt: true },
      });
      if (!order) return { ok: false as const, error: "주문을 찾을 수 없습니다." };
      if (resolution.decision === "FAILED" && confirmedMoid !== order.moid) {
        return { ok: false as const, error: "입력한 주문번호가 현재 주문과 일치하지 않습니다." };
      }

      const prepared = preparePaymentResolution(order, resolution);
      if (!prepared.ok) return { ok: false as const, error: prepared.error };

      await tx.shopOrder.update({
        where: { id: order.id },
        data: prepared.orderData,
      });
      await tx.shopOrderAuditLog.create({
        data: {
          orderId: order.id,
          actorUserId: actor.id,
          actorEmail: actor.email,
          ...prepared.auditData,
        },
      });

      return { ok: true as const };
    }, TX_OPTIONS);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", message: "이 PG 거래번호는 이미 다른 주문에 등록되어 있습니다." };
    }
    result = null;
  }

  if (!result) return { status: "error", message: "결제 상태를 확정하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  if (!result.ok) return { status: "error", message: result.error };

  // /admin, /order/[id], /mypage는 모두 force-dynamic이다. 액션 응답에는 성공
  // 상태만 반환하고, 클라이언트가 이 전환을 끝낸 뒤 새 GET으로 이동하게 한다.
  // Next 15에서 revalidatePath/redirect를 useActionState 응답에 결합하면 제거될
  // 폼의 pending 전환이 끝나지 않는 회귀가 있어 둘 다 여기서 호출하지 않는다.
  const outcome = resolution.decision === "PAID" ? "paid" : "failed";
  return {
    status: "success",
    message: "결제 확인 결과와 감사 이력을 저장했습니다.",
    redirectTo: `/admin?paymentResolved=${outcome}`,
  };
}

export async function confirmPaymentPaidAction(
  _previous: AdminPaymentState,
  formData: FormData,
): Promise<AdminPaymentState> {
  const admin = await requireShopAdmin();
  const parsed = paidSchema.safeParse({
    orderId: formData.get("orderId"),
    confirmedAmount: formData.get("confirmedAmount"),
    approvalNo: formData.get("approvalNo"),
    pgTrno: formData.get("pgTrno") ?? "",
    cardName: formData.get("cardName") ?? "",
    reason: formData.get("reason"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };
  }

  return resolvePayment(admin.id, parsed.data.orderId, {
    decision: "PAID",
    confirmedAmount: parsed.data.confirmedAmount,
    approvalNo: parsed.data.approvalNo,
    pgTrno: parsed.data.pgTrno,
    cardName: parsed.data.cardName,
    reason: parsed.data.reason,
  });
}

export async function confirmPaymentFailedAction(
  _previous: AdminPaymentState,
  formData: FormData,
): Promise<AdminPaymentState> {
  const admin = await requireShopAdmin();
  const parsed = failedSchema.safeParse({
    orderId: formData.get("orderId"),
    confirmedMoid: formData.get("confirmedMoid"),
    reason: formData.get("reason"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };
  }

  return resolvePayment(
    admin.id,
    parsed.data.orderId,
    { decision: "FAILED", reason: parsed.data.reason },
    parsed.data.confirmedMoid,
  );
}
