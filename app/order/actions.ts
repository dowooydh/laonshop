"use server";
// 취소·반품 신청 접수 — NEEDS_PG_SPEC: 카드 승인취소 API 미확보.
// 신청만 기록하고, 운영자가 KSTA에서 수동 취소 후 상태를 CANCELED로 전환한다.
import { prisma } from "@/lib/db";
import { requireShopUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(200, "사유는 200자 이내로 입력해 주세요.").optional(),
});

export type CancelResult = { ok: true } | { ok: false; error: string };

export async function requestCancelAction(input: { orderId: string; reason?: string }): Promise<CancelResult> {
  const user = await requireShopUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };

  // 본인 소유 + 결제완료 주문만 — 조건부 update로 상태 경합 차단
  const updated = await prisma.shopOrder.updateMany({
    where: { id: parsed.data.orderId, userId: user.id, status: "PAID" },
    data: {
      status: "CANCEL_REQUESTED",
      cancelRequestedAt: new Date(),
      cancelReason: parsed.data.reason || null,
    },
  });
  if (updated.count === 0) return { ok: false, error: "취소 신청할 수 없는 주문입니다." };

  revalidatePath(`/order/${parsed.data.orderId}`);
  return { ok: true };
}
