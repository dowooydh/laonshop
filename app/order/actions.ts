"use server";
// 취소·반품 신청 접수 — NEEDS_PG_SPEC: 카드 승인취소 API 미확보.
// 신청만 기록하고, 운영자가 KSTA에서 수동 취소 후 상태를 CANCELED로 전환한다.
import { prisma } from "@/lib/db";
import { requireShopUser } from "@/lib/auth";
import { getPgProvider } from "@/lib/kspay";
import { sanitizePgParam } from "@/lib/format";
import { BILLING_TEST_EMAILS } from "@/lib/billing";
import { acquireTransactionLock, lockAndValidateInventory, PAYMENT_PROCESSING_MARKER } from "@/lib/order-guard";
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

// ── 결제 재개 — 결제창이 닫혔거나 실패한 주문(PENDING/FAILED)을 같은 주문번호로 다시 결제 ──

const retrySchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["card", "kakaopay", "naverpay", "bank", "oneclick"]),
  billingCardId: z.string().optional(), // oneclick 전용 — 미지정 시 첫 등록 카드
});

export type RetryPaymentResult =
  | { ok: true; formAction: string; formFields: Record<string, string> }
  | { ok: true; redirect: string }
  | { ok: false; error: string };

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

export async function retryPaymentAction(input: {
  orderId: string;
  method: "card" | "kakaopay" | "naverpay" | "bank" | "oneclick";
  billingCardId?: string;
}): Promise<RetryPaymentResult> {
  const user = await requireShopUser();
  const parsed = retrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "입력값을 확인해 주세요." };
  const { orderId, method, billingCardId } = parsed.data;

  let card: { maskedCardNumb: string } | null = null;
  if (method === "oneclick") {
    // 카드 선택: billingCardId 지정 시 본인 소유 검증(IDOR 차단), 미지정 시 첫 등록 카드
    card = billingCardId
      ? await prisma.shopBillingCard.findFirst({ where: { id: billingCardId, userId: user.id }, select: { maskedCardNumb: true } })
      : await prisma.shopBillingCard.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { maskedCardNumb: true } });
    if (!card) return { ok: false, error: "등록된 카드가 없습니다. 설정에서 카드를 먼저 등록해 주세요." };
    if (!BILLING_TEST_EMAILS.includes(user.email)) {
      return { ok: false, error: "원클릭 결제는 서비스 준비 중입니다. 카드·간편결제를 이용해 주세요." };
    }
  }

  // 주문 잠금과 상품 행 잠금 안에서 재고를 다시 확인한다. 실패 주문도 같은 주문번호로만
  // 재개하며, 이미 결제된 주문은 어떤 재시도도 상태를 바꾸지 않는다.
  const prepared = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `order:${orderId}`);
    const order = await tx.shopOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.userId !== user.id || !["PENDING", "FAILED"].includes(order.status) || order.items.length === 0) {
      return { ok: false as const, error: "결제를 진행할 수 없는 주문입니다." };
    }
    if (order.approvalNo === PAYMENT_PROCESSING_MARKER) {
      return { ok: false as const, error: "결제 결과를 확인 중입니다. 잠시 후 주문내역을 확인해 주세요." };
    }
    const inventory = await lockAndValidateInventory(tx, order.items, order.id);
    if (!inventory.ok) {
      if (order.status !== "FAILED") {
        await tx.shopOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
      }
      return inventory;
    }
    if (method === "oneclick") {
      const paid = await tx.shopOrder.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          approvalNo: `MB${Date.now().toString().slice(-8)}`,
          cardName: `등록카드 ${card!.maskedCardNumb}`,
        },
        include: { items: true },
      });
      return { ok: true as const, order: paid };
    }
    const pendingOrder = await tx.shopOrder.update({
      where: { id: order.id },
      data: { status: "PENDING" },
      include: { items: true },
    });
    return { ok: true as const, order: pendingOrder };
  }, TX_OPTIONS).catch(() => null);

  if (!prepared) return { ok: false, error: "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const order = prepared.order;
  if (method === "oneclick") {
    revalidatePath(`/order/${order.id}`);
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  const base = process.env.SHOP_APP_URL ?? "http://localhost:3003";
  const goodsName =
    order.items.length > 1 ? `${order.items[0].name} 외 ${order.items.length - 1}건` : order.items[0].name;

  // 승인 전 시도는 동일 moid 재사용 가능 — 새 주문을 만들지 않아 주문번호가 유지된다
  const res = await getPgProvider().createAuthOrder({
    paymentId: order.id,
    payMethod: method,
    moid: order.moid,
    amount: order.totalAmount,
    goodsName: sanitizePgParam(goodsName),
    ordername: sanitizePgParam(user.name),
    buyerPhone: (order.receiverPhone ?? user.phone ?? "").replace(/\D/g, ""),
    buyerEmail: user.email,
    storeId: "2999199999", // 테스트 MID (실제 sndStoreid는 KSPAY_STORE_ID env 사용)
    returnUrl: `${base}/order/${order.id}`,
    callbackUrl: `${base}/api/pg/kspay/callback`,
  });

  if (res.formAction && res.formFields) {
    return { ok: true, formAction: res.formAction, formFields: res.formFields };
  }
  return { ok: false, error: "결제창을 열 수 없습니다. (PG 설정 확인)" };
}
