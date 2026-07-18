"use server";
// KSPAY 주문은 취소 신청만 기록해 KSTA 수동 처리하고, LAONPAY 등록카드 주문은
// 부분취소 없이 관리자 취소 요청만 생성한다. 어느 경로도 이 Action에서 PG 취소하지 않는다.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireShopUser } from "@/lib/auth";
import { getPgProvider } from "@/lib/kspay";
import { sanitizePgParam } from "@/lib/format";
import { getDisabledBillingResult } from "@/lib/billing";
import { createKspayResultToken } from "@/lib/kspay/result-token";
import { createLaonpayBillingClient } from "@/lib/laonpay/billing-client";
import {
  billingRequestFingerprint,
  calculateOrderAmount,
  isBillingIntegrationAccount,
  isBillingIntegrationEnabled,
  orderGoodsName,
} from "@/lib/laonpay/billing-policy";
import {
  acquireTransactionLock,
  isPaymentProcessingMarker,
  LAONPAY_BILLING_PROCESSING_MARKER,
  lockAndValidateInventory,
} from "@/lib/order-guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

const schema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(200, "사유는 200자 이내로 입력해 주세요.").optional(),
});

export type CancelResult = { ok: true } | { ok: false; error: string };

async function requestKspayCancel(
  orderId: string,
  userId: string,
  reason: string | undefined,
): Promise<CancelResult> {
  // 기존 KSPAY 주문은 신청만 기록하고 운영자가 KSTA에서 수동 취소한다.
  const updated = await prisma.shopOrder.updateMany({
    where: { id: orderId, userId, status: "PAID" },
    data: {
      status: "CANCEL_REQUESTED",
      cancelRequestedAt: new Date(),
      cancelReason: reason || null,
    },
  });
  if (updated.count === 0) return { ok: false, error: "취소 신청할 수 없는 주문입니다." };

  revalidatePath(`/order/${orderId}`);
  return { ok: true };
}

export async function requestCancelAction(input: { orderId: string; reason?: string }): Promise<CancelResult> {
  const user = await requireShopUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };

  const orderSnapshot = await prisma.shopOrder.findFirst({
    where: { id: parsed.data.orderId, userId: user.id, status: "PAID" },
    select: { cardName: true },
  });
  if (!orderSnapshot) return { ok: false, error: "취소 신청할 수 없는 주문입니다." };
  const labeledBillingOrder = orderSnapshot.cardName?.includes("(LAONPAY 원클릭)") === true;

  if (!isBillingIntegrationEnabled(user.email)) {
    // 연동 환경이 일시적으로 제거되어도 이미 승인된 등록카드 주문을 KSPAY 수동취소
    // 경로로 잘못 전환하지 않는다.
    if (labeledBillingOrder) {
      return {
        ok: false,
        error: "등록카드 취소 연동을 확인할 수 없습니다. 재신청하지 말고 고객센터에 문의해 주세요.",
      };
    }
    return requestKspayCancel(parsed.data.orderId, user.id, parsed.data.reason);
  }

  // 결제 원장 스키마가 아직 적용되지 않은 배포에서는 기존 KSPAY 취소로 추정해
  // 우회하지 않는다. 등록카드 결제를 일반 취소로 잘못 접수하는 것보다 안전하게 차단한다.
  const existingCharge = await prisma.shopBillingCharge
    .findFirst({
      where: { orderId: parsed.data.orderId, userId: user.id },
      select: { id: true, status: true, paymentMethodId: true },
    })
    .catch(() => undefined);
  if (existingCharge === undefined) {
    return { ok: false, error: "취소 신청 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요." };
  }
  if (!existingCharge) {
    if (labeledBillingOrder) {
      return {
        ok: false,
        error: "등록카드 결제 원장을 확인할 수 없습니다. 재신청하지 말고 고객센터에 문의해 주세요.",
      };
    }
    return requestKspayCancel(parsed.data.orderId, user.id, parsed.data.reason);
  }
  // 등록카드 거절 뒤 같은 주문번호로 KSPAY 재결제에 성공한 주문은 기존의
  // DECLINED 원장이 남아 있어도 현재 결제수단 기준으로 KSPAY 취소 신청을 사용한다.
  if (!labeledBillingOrder && existingCharge.status === "DECLINED") {
    return requestKspayCancel(parsed.data.orderId, user.id, parsed.data.reason);
  }
  if (existingCharge.status !== "PAID") {
    return {
      ok: false,
      error: "주문 결제 원장 상태를 확인할 수 없습니다. 재신청하지 말고 고객센터에 문의해 주세요.",
    };
  }

  // 등록카드 결제는 외부 취소를 직접 실행하지 않고 LAONPAY 관리자 취소 요청만
  // 한 번 생성한다. 부분취소 금액은 전달하지 않으며 기존 요청이 있으면 재호출하지 않는다.
  const prepared = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `order:${parsed.data.orderId}`);
    await acquireTransactionLock(tx, `billing-method:${existingCharge.paymentMethodId}`);
    const [order, charge, paymentMethod] = await Promise.all([
      tx.shopOrder.findFirst({
        where: { id: parsed.data.orderId, userId: user.id },
      }),
      tx.shopBillingCharge.findFirst({
        where: { orderId: parsed.data.orderId, userId: user.id },
        include: { cancelRequest: true },
      }),
      tx.shopBillingPaymentMethod.findFirst({
        where: { id: existingCharge.paymentMethodId, userId: user.id },
        select: { id: true, status: true },
      }),
    ]);
    if (
      !order ||
      !charge ||
      !paymentMethod ||
      order.status !== "PAID" ||
      charge.status !== "PAID" ||
      charge.paymentMethodId !== paymentMethod.id ||
      !charge.laonpayChargeId
    ) {
      return { ok: false as const, error: "취소 신청할 수 없는 주문입니다." };
    }
    if (paymentMethod.status === "DEREGISTERING" || paymentMethod.status === "UNKNOWN") {
      return {
        ok: false as const,
        error: "카드 해지 상태를 확인 중이어서 취소 신청을 시작할 수 없습니다.",
      };
    }
    if (
      charge.cancelRequest &&
      (charge.cancelRequest.status !== "REQUESTING" ||
        charge.cancelRequest.requestSentAt)
    ) {
      return {
        ok: false as const,
        error: "이미 취소 신청을 처리 중입니다. 새로 신청하지 말고 주문 상태를 확인해 주세요.",
      };
    }
    // 외부 호출 전 프로세스가 중단된 REQUESTING 행만 같은 멱등키/저장 사유로
    // 이어갈 수 있다. requestSentAt이 있는 행은 어떤 경우에도 재호출하지 않는다.
    const cancelRequest =
      charge.cancelRequest ??
      (await tx.shopBillingCancelRequest.create({
        data: {
          userId: user.id,
          chargeId: charge.id,
          idempotencyKey: randomUUID(),
          reason: parsed.data.reason || null,
          status: "REQUESTING",
        },
      }));
    if (
      charge.cancelRequest &&
      charge.cancelRequest.reason !== (parsed.data.reason || null)
    ) {
      return {
        ok: false as const,
        error: "이미 시작한 취소 신청의 사유와 일치하지 않습니다. 주문 상태를 확인해 주세요.",
      };
    }
    return { ok: true as const, order, charge, cancelRequest };
  }, TX_OPTIONS).catch(() => null);

  if (!prepared) {
    return { ok: false, error: "취소 신청 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요." };
  }
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const sendClaimed = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `order:${prepared.order.id}`);
    await acquireTransactionLock(tx, `billing-method:${prepared.charge.paymentMethodId}`);
    const claimed = await tx.shopBillingCancelRequest.updateMany({
      where: {
        id: prepared.cancelRequest.id,
        userId: user.id,
        chargeId: prepared.charge.id,
        status: "REQUESTING",
        requestSentAt: null,
      },
      data: { requestSentAt: new Date() },
    });
    return claimed.count === 1;
  }, TX_OPTIONS).catch(() => false);
  if (!sendClaimed) {
    return {
      ok: false,
      error: "이미 취소 신청을 처리 중입니다. 새로 신청하지 말고 주문 상태를 확인해 주세요.",
    };
  }

  const result = await createLaonpayBillingClient().createCancelRequest(
    prepared.charge.laonpayChargeId!,
    user.id,
    prepared.cancelRequest.reason ?? undefined,
    prepared.cancelRequest.idempotencyKey,
  );

  const sameRemoteCharge =
    result.ok && result.data.charge.id === prepared.charge.laonpayChargeId;
  const accepted =
    sameRemoteCharge &&
    result.ok &&
    result.data.charge.status === "CANCEL_REQUESTED" &&
    (result.data.cancelRequest.status === "REQUESTED" ||
      result.data.cancelRequest.status === "PROCESSING");
  const rejected =
    result.ok
      ? sameRemoteCharge && result.data.cancelRequest.status === "REJECTED"
      : result.outcome === "REJECTED";

  const finalized = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `order:${prepared.order.id}`);
    await acquireTransactionLock(tx, `billing-method:${prepared.charge.paymentMethodId}`);
    const [order, charge, cancelRequest] = await Promise.all([
      tx.shopOrder.findUnique({ where: { id: prepared.order.id } }),
      tx.shopBillingCharge.findUnique({ where: { id: prepared.charge.id } }),
      tx.shopBillingCancelRequest.findUnique({ where: { id: prepared.cancelRequest.id } }),
    ]);
    if (
      !order ||
      !charge ||
      !cancelRequest ||
      order.userId !== user.id ||
      charge.userId !== user.id ||
      cancelRequest.userId !== user.id ||
      charge.orderId !== order.id ||
      cancelRequest.chargeId !== charge.id ||
      order.status !== "PAID" ||
      charge.status !== "PAID" ||
      cancelRequest.status !== "REQUESTING"
    ) {
      return { ok: false as const };
    }

    if (accepted && result.ok) {
      await tx.shopBillingCancelRequest.update({
        where: { id: cancelRequest.id },
        data: {
          laonpayCancelRequestId: result.data.cancelRequest.id,
          status: result.data.cancelRequest.status,
        },
      });
      await tx.shopBillingCharge.update({
        where: { id: charge.id },
        data: { status: "CANCEL_REQUESTED" },
      });
      await tx.shopOrder.update({
        where: { id: order.id },
        data: {
          status: "CANCEL_REQUESTED",
          cancelRequestedAt: new Date(),
          // 최초 원장에 저장하고 실제 LAONPAY 요청에 사용한 값과 일치시킨다.
          cancelReason: cancelRequest.reason,
        },
      });
      return { ok: true as const, accepted: true as const };
    }

    await tx.shopBillingCancelRequest.update({
      where: { id: cancelRequest.id },
      data: {
        ...(result.ok && sameRemoteCharge
          ? { laonpayCancelRequestId: result.data.cancelRequest.id }
          : {}),
        status: rejected ? "REJECTED" : "UNKNOWN",
      },
    });
    return { ok: true as const, accepted: false as const };
  }, TX_OPTIONS).catch(() => null);

  if (!finalized?.ok || !finalized.accepted) {
    return {
      ok: false,
      error: rejected
        ? "취소 신청이 접수되지 않았습니다. 고객센터에 문의해 주세요."
        : "취소 신청 결과를 확인하지 못했습니다. 재신청하지 말고 고객센터에 문의해 주세요.",
    };
  }

  revalidatePath(`/order/${parsed.data.orderId}`);
  return { ok: true };
}

// ── LAONPAY 등록카드 취소 상태 대사 ──────────────────────────────────────

const refreshBillingCancelSchema = z.object({
  orderId: z.string().min(1),
});

export type RefreshBillingCancelResult =
  | { ok: true; status: "CANCELED" | "PENDING" | "UNKNOWN" }
  | { ok: false; error: string };

export async function refreshBillingCancelStatusAction(input: {
  orderId: string;
}): Promise<RefreshBillingCancelResult> {
  const user = await requireShopUser();
  const parsed = refreshBillingCancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "주문 정보를 확인해 주세요." };
  if (!isBillingIntegrationEnabled(user.email)) {
    return { ok: false, error: "등록카드 취소 상태 조회가 준비되지 않았습니다." };
  }

  const prepared = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `order:${parsed.data.orderId}`);
      const chargeProbe = await tx.shopBillingCharge.findFirst({
        where: { orderId: parsed.data.orderId, userId: user.id },
        select: { id: true, paymentMethodId: true },
      });
      if (!chargeProbe) {
        return { ok: false as const, error: "등록카드 결제 내역을 찾을 수 없습니다." };
      }
      // 결제·해지·취소가 같은 결제수단을 수정할 때 항상 order → paymentMethod 순서로 잠근다.
      await acquireTransactionLock(tx, `billing-method:${chargeProbe.paymentMethodId}`);
      const charge = await tx.shopBillingCharge.findUnique({
        where: { id: chargeProbe.id },
        include: {
          order: { include: { items: true } },
          paymentMethod: true,
          cancelRequest: true,
        },
      });
      if (
        !charge ||
        !charge.cancelRequest ||
        charge.userId !== user.id ||
        charge.order.userId !== user.id ||
        charge.paymentMethod.userId !== user.id ||
        charge.orderId !== charge.order.id ||
        charge.paymentMethodId !== charge.paymentMethod.id ||
        charge.cancelRequest.userId !== user.id ||
        charge.cancelRequest.chargeId !== charge.id ||
        !charge.laonpayChargeId ||
        charge.order.items.length === 0
      ) {
        return { ok: false as const, error: "등록카드 취소 내역을 확인할 수 없습니다." };
      }
      if (
        charge.order.status === "CANCELED" &&
        charge.status === "CANCELED" &&
        charge.cancelRequest.status === "DONE"
      ) {
        return { ok: true as const, done: true as const, status: "CANCELED" as const };
      }

      const acceptedRequest =
        charge.order.status === "CANCEL_REQUESTED" &&
        charge.status === "CANCEL_REQUESTED" &&
        (charge.cancelRequest.status === "REQUESTED" ||
          charge.cancelRequest.status === "PROCESSING");
      // POST 응답 유실 또는 외부 호출 직후 프로세스 중단 상태. requestSentAt이 있어야
      // 실제 외부 요청 가능성이 있으므로, 이 경우에만 읽기 전용 GET 대사를 허용한다.
      const uncertainRequest =
        charge.order.status === "PAID" &&
        charge.status === "PAID" &&
        (charge.cancelRequest.status === "REQUESTING" ||
          charge.cancelRequest.status === "UNKNOWN") &&
        charge.cancelRequest.requestSentAt !== null;
      if (!acceptedRequest && !uncertainRequest) {
        return { ok: false as const, error: "상태를 조회할 수 없는 취소 요청입니다." };
      }

      const amount = calculateOrderAmount(charge.order.items);
      if (amount !== charge.order.totalAmount || amount !== charge.amount) {
        return {
          ok: false as const,
          error: "주문 결제 금액이 일치하지 않아 취소 상태 조회를 중단했습니다.",
        };
      }
      return {
        ok: true as const,
        done: false as const,
        charge,
        amount,
      };
    }, TX_OPTIONS)
    .catch(() => null);

  if (!prepared) {
    return { ok: false, error: "취소 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요." };
  }
  if (!prepared.ok) return { ok: false, error: prepared.error };
  if (prepared.done) return { ok: true, status: prepared.status };

  // 취소 요청 POST는 어떤 경우에도 재호출하지 않는다. 저장된 LAONPAY charge ID를
  // 사용한 읽기 전용 상태 조회만 수행한다.
  const result = await createLaonpayBillingClient().getCharge(
    prepared.charge.laonpayChargeId!,
    randomUUID(),
  );
  if (
    !result.ok ||
    result.data.charge.id !== prepared.charge.laonpayChargeId ||
    result.data.charge.externalOrderId !== prepared.charge.order.id ||
    result.data.charge.amount !== prepared.amount ||
    result.data.charge.paymentId !== prepared.charge.providerPaymentId
  ) {
    return {
      ok: false,
      error:
        "취소 처리 결과를 확인하지 못했습니다. 다시 취소하지 말고 고객센터에 문의해 주세요.",
    };
  }

  const remoteStatus = result.data.charge.status;
  const finalized = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `order:${prepared.charge.order.id}`);
      await acquireTransactionLock(
        tx,
        `billing-method:${prepared.charge.paymentMethod.id}`,
      );
      const charge = await tx.shopBillingCharge.findUnique({
        where: { id: prepared.charge.id },
        include: {
          order: { include: { items: true } },
          paymentMethod: true,
          cancelRequest: true,
        },
      });
      if (
        !charge ||
        !charge.cancelRequest ||
        charge.userId !== user.id ||
        charge.order.userId !== user.id ||
        charge.paymentMethod.userId !== user.id ||
        charge.orderId !== prepared.charge.order.id ||
        charge.paymentMethodId !== prepared.charge.paymentMethod.id ||
        charge.cancelRequest.userId !== user.id ||
        charge.cancelRequest.chargeId !== charge.id ||
        charge.laonpayChargeId !== result.data.charge.id ||
        charge.providerPaymentId !== result.data.charge.paymentId
      ) {
        return { ok: false as const };
      }
      const currentAmount = calculateOrderAmount(charge.order.items);
      if (
        currentAmount !== charge.order.totalAmount ||
        currentAmount !== charge.amount ||
        currentAmount !== result.data.charge.amount
      ) {
        return { ok: false as const };
      }
      if (
        charge.order.status === "CANCELED" &&
        charge.status === "CANCELED" &&
        charge.cancelRequest.status === "DONE"
      ) {
        return { ok: true as const, status: "CANCELED" as const };
      }

      const acceptedRequest =
        charge.order.status === "CANCEL_REQUESTED" &&
        charge.status === "CANCEL_REQUESTED" &&
        (charge.cancelRequest.status === "REQUESTED" ||
          charge.cancelRequest.status === "PROCESSING");
      const uncertainRequest =
        charge.order.status === "PAID" &&
        charge.status === "PAID" &&
        (charge.cancelRequest.status === "REQUESTING" ||
          charge.cancelRequest.status === "UNKNOWN") &&
        charge.cancelRequest.requestSentAt !== null;
      if (!acceptedRequest && !uncertainRequest) {
        return { ok: false as const };
      }

      if (remoteStatus === "CANCELED") {
        await tx.shopBillingCancelRequest.update({
          where: { id: charge.cancelRequest.id },
          data: { status: "DONE" },
        });
        await tx.shopBillingCharge.update({
          where: { id: charge.id },
          data: { status: "CANCELED" },
        });
        await tx.shopOrder.update({
          where: { id: charge.order.id },
          data: {
            status: "CANCELED",
            ...(uncertainRequest
              ? {
                  cancelRequestedAt: charge.cancelRequest.requestSentAt,
                  cancelReason: charge.cancelRequest.reason,
                }
              : {}),
          },
        });
        return { ok: true as const, status: "CANCELED" as const };
      }

      if (remoteStatus === "CANCEL_REQUESTED") {
        if (uncertainRequest) {
          // charge 상태가 취소 접수를 증명하므로 응답을 잃은 로컬 원장을 복구한다.
          // GET에는 cancelRequest ID가 없으므로 존재하지 않는 외부 ID는 만들지 않는다.
          await tx.shopBillingCancelRequest.update({
            where: { id: charge.cancelRequest.id },
            data: { status: "REQUESTED" },
          });
          await tx.shopBillingCharge.update({
            where: { id: charge.id },
            data: { status: "CANCEL_REQUESTED" },
          });
          await tx.shopOrder.update({
            where: { id: charge.order.id },
            data: {
              status: "CANCEL_REQUESTED",
              cancelRequestedAt: charge.cancelRequest.requestSentAt,
              cancelReason: charge.cancelRequest.reason,
            },
          });
        }
        return { ok: true as const, status: "PENDING" as const };
      }

      // GET charge만으로 PAID를 취소 거절로 해석할 수 없다. PENDING/PAID/DECLINED/
      // UNKNOWN도 기존 취소 원장을 진행·회귀시키지 않고 명시적 확인 대기로 남긴다.
      return { ok: true as const, status: "UNKNOWN" as const };
    }, TX_OPTIONS)
    .catch(() => null);

  if (!finalized?.ok) {
    return {
      ok: false,
      error: "취소 상태 저장을 확인하지 못했습니다. 다시 취소하지 말고 고객센터에 문의해 주세요.",
    };
  }
  revalidatePath(`/order/${parsed.data.orderId}`);
  revalidatePath("/mypage");
  return { ok: true, status: finalized.status };
}

export async function refreshBillingCancelStatusFormAction(
  orderId: string,
  _formData: FormData,
): Promise<void> {
  const result = await refreshBillingCancelStatusAction({ orderId });
  const outcome = result.ok ? result.status.toLowerCase() : "error";
  redirect(`/order/${encodeURIComponent(orderId)}?billingCancelRefresh=${outcome}`);
}

// ── LAONPAY 등록카드 결제 상태 대사 ──────────────────────────────────────

const refreshBillingChargeSchema = z.object({
  orderId: z.string().min(1),
});

export type RefreshBillingChargeResult =
  | { ok: true; status: "PAID" | "DECLINED" | "PENDING" | "UNKNOWN" }
  | { ok: false; error: string };

export async function refreshBillingChargeStatusAction(input: {
  orderId: string;
}): Promise<RefreshBillingChargeResult> {
  const user = await requireShopUser();
  const parsed = refreshBillingChargeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "주문 정보를 확인해 주세요." };
  if (!isBillingIntegrationEnabled(user.email)) {
    return { ok: false, error: "등록카드 결제 상태 조회가 준비되지 않았습니다." };
  }

  const prepared = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `order:${parsed.data.orderId}`);
    const chargeProbe = await tx.shopBillingCharge.findFirst({
      where: { orderId: parsed.data.orderId, userId: user.id },
      select: { id: true, paymentMethodId: true },
    });
    if (!chargeProbe) {
      return { ok: false as const, error: "등록카드 결제 내역을 찾을 수 없습니다." };
    }
    await acquireTransactionLock(tx, `billing-method:${chargeProbe.paymentMethodId}`);
    const charge = await tx.shopBillingCharge.findUnique({
      where: { id: chargeProbe.id },
      include: {
        order: { include: { items: true } },
        paymentMethod: true,
      },
    });
    if (
      !charge ||
      charge.order.userId !== user.id ||
      charge.paymentMethod.userId !== user.id
    ) {
      return { ok: false as const, error: "등록카드 결제 내역을 찾을 수 없습니다." };
    }
    if (charge.status === "PAID" && charge.order.status === "PAID") {
      return { ok: true as const, done: true as const, status: "PAID" as const };
    }
    if (charge.status === "DECLINED" && charge.order.status === "FAILED") {
      return { ok: true as const, done: true as const, status: "DECLINED" as const };
    }
    if (
      charge.order.status !== "PENDING" ||
      charge.order.approvalNo !== LAONPAY_BILLING_PROCESSING_MARKER ||
      !["REQUESTING", "PENDING", "UNKNOWN"].includes(charge.status) ||
      charge.order.items.length === 0
    ) {
      return { ok: false as const, error: "상태를 조회할 수 없는 주문입니다." };
    }

    const amount = calculateOrderAmount(charge.order.items);
    const requestBody = {
      externalCustomerId: user.id,
      externalOrderId: charge.order.id,
      amount,
      goodsName: orderGoodsName(charge.order.items),
      buyerName: (charge.order.receiverName ?? user.name).slice(0, 100),
      ...(charge.order.receiverPhone
        ? { buyerPhone: charge.order.receiverPhone.replace(/\D/g, "").slice(0, 20) }
        : {}),
      buyerEmail: user.email,
    };
    if (
      amount !== charge.order.totalAmount ||
      amount !== charge.amount ||
      billingRequestFingerprint(requestBody) !== charge.requestFingerprint
    ) {
      return { ok: false as const, error: "주문 결제 정보가 일치하지 않아 상태 조회를 중단했습니다." };
    }
    let claimedCharge = charge;
    if (!charge.laonpayChargeId) {
      // checkout 최초 호출과 같은 잠금 범위를 사용해 전체 생명주기에서 POST를
      // 최초 1회 + reconciliation 1회로 제한한다.
      await acquireTransactionLock(tx, `billing-charge:${charge.id}`);
      const latestCharge = await tx.shopBillingCharge.findUnique({
        where: { id: charge.id },
        include: {
          order: { include: { items: true } },
          paymentMethod: true,
        },
      });
      if (
        !latestCharge ||
        latestCharge.userId !== user.id ||
        latestCharge.orderId !== charge.orderId
      ) {
        return {
          ok: false as const,
          error: "등록카드 결제 내역을 확인할 수 없습니다.",
        };
      }
      if (latestCharge.laonpayChargeId) {
        claimedCharge = latestCharge;
      } else {
        if (latestCharge.requestAttempts >= 2) {
          return {
            ok: false as const,
            error: "결제 요청 결과를 확인할 식별자를 받지 못했습니다. 재요청하지 말고 고객센터에 문의해 주세요.",
          };
        }
        claimedCharge = await tx.shopBillingCharge.update({
          where: { id: charge.id },
          data: { requestAttempts: { increment: 1 } },
          include: {
            order: { include: { items: true } },
            paymentMethod: true,
          },
        });
      }
    }
    return { ok: true as const, done: false as const, charge: claimedCharge, requestBody };
  }, TX_OPTIONS).catch(() => null);

  if (!prepared) {
    return { ok: false, error: "결제 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요." };
  }
  if (!prepared.ok) return { ok: false, error: prepared.error };
  if (prepared.done) return { ok: true, status: prepared.status };

  const client = createLaonpayBillingClient();
  // provider ID가 있으면 GET만 사용한다. ID를 잃은 최초 POST의 응답 미수신 상태에서만
  // 저장한 같은 key+동일 body로 reconciliation POST를 정확히 한 번 호출한다.
  const result = prepared.charge.laonpayChargeId
    ? await client.getCharge(prepared.charge.laonpayChargeId, randomUUID())
    : await client.chargePaymentMethod(
        prepared.charge.paymentMethod.laonpayPaymentMethodId,
        prepared.requestBody,
        prepared.charge.idempotencyKey,
      );

  if (
    !result.ok ||
    result.data.charge.externalOrderId !== prepared.charge.order.id ||
    result.data.charge.amount !== prepared.charge.amount ||
    (prepared.charge.laonpayChargeId &&
      result.data.charge.id !== prepared.charge.laonpayChargeId)
  ) {
    await prisma.shopBillingCharge
      .updateMany({
        where: {
          id: prepared.charge.id,
          userId: user.id,
          status: { in: ["REQUESTING", "PENDING", "UNKNOWN"] },
        },
        data: { status: "UNKNOWN", failureCode: "RESULT_UNCONFIRMED" },
      })
      .catch(() => undefined);
    return {
      ok: false,
      error: "결제 결과를 확인하지 못했습니다. 새로 결제하지 말고 고객센터에 문의해 주세요.",
    };
  }

  const remoteCharge = result.data.charge;
  const remoteStatus =
    remoteCharge.status === "PAID" || remoteCharge.status === "DECLINED"
      ? remoteCharge.status
      : remoteCharge.status === "PENDING" || remoteCharge.status === "UNKNOWN"
        ? remoteCharge.status
        : "UNKNOWN";

  const finalized = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `order:${prepared.charge.order.id}`);
    await acquireTransactionLock(
      tx,
      `billing-method:${prepared.charge.paymentMethod.id}`,
    );
    const [order, charge, paymentMethod] = await Promise.all([
      tx.shopOrder.findUnique({ where: { id: prepared.charge.order.id } }),
      tx.shopBillingCharge.findUnique({ where: { id: prepared.charge.id } }),
      tx.shopBillingPaymentMethod.findUnique({
        where: { id: prepared.charge.paymentMethod.id },
      }),
    ]);
    if (
      !order ||
      !charge ||
      !paymentMethod ||
      order.userId !== user.id ||
      charge.userId !== user.id ||
      paymentMethod.userId !== user.id ||
      charge.orderId !== order.id ||
      charge.paymentMethodId !== paymentMethod.id
    ) {
      return { ok: false as const };
    }
    if (order.status === "PAID" && charge.status === "PAID") {
      return { ok: true as const, status: "PAID" as const };
    }
    if (order.status === "FAILED" && charge.status === "DECLINED") {
      return { ok: true as const, status: "DECLINED" as const };
    }
    if (
      order.status !== "PENDING" ||
      order.approvalNo !== LAONPAY_BILLING_PROCESSING_MARKER ||
      !["REQUESTING", "PENDING", "UNKNOWN"].includes(charge.status)
    ) {
      return { ok: false as const };
    }
    if (
      (charge.laonpayChargeId && charge.laonpayChargeId !== remoteCharge.id) ||
      (charge.providerPaymentId !== null &&
        charge.providerPaymentId !== remoteCharge.paymentId)
    ) {
      await tx.shopBillingCharge.update({
        where: { id: charge.id },
        data: { status: "UNKNOWN", failureCode: "RESULT_ID_MISMATCH" },
      });
      return { ok: true as const, status: "UNKNOWN" as const };
    }

    const sharedChargeData = {
      laonpayChargeId: remoteCharge.id,
      providerPaymentId: remoteCharge.paymentId,
      failureCode: remoteCharge.error?.code?.slice(0, 64) ?? null,
    };
    if (remoteStatus === "PAID") {
      await tx.shopBillingCharge.update({
        where: { id: charge.id },
        data: { ...sharedChargeData, status: "PAID" },
      });
      await tx.shopOrder.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          approvalNo: null,
          pgTrno: null,
          cardName: `${paymentMethod.cardName} (LAONPAY 원클릭)`,
        },
      });
      return { ok: true as const, status: "PAID" as const };
    }
    if (remoteStatus === "DECLINED") {
      await tx.shopBillingCharge.update({
        where: { id: charge.id },
        data: { ...sharedChargeData, status: "DECLINED" },
      });
      await tx.shopOrder.update({
        where: { id: order.id },
        data: { status: "FAILED", approvalNo: null },
      });
      return { ok: true as const, status: "DECLINED" as const };
    }
    await tx.shopBillingCharge.update({
      where: { id: charge.id },
      data: { ...sharedChargeData, status: remoteStatus },
    });
    return { ok: true as const, status: remoteStatus };
  }, TX_OPTIONS).catch(() => null);

  if (!finalized?.ok) {
    return { ok: false, error: "결제 상태 저장을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요." };
  }
  revalidatePath(`/order/${parsed.data.orderId}`);
  revalidatePath("/mypage");
  return { ok: true, status: finalized.status };
}

export async function refreshBillingChargeStatusFormAction(
  orderId: string,
  _formData: FormData,
): Promise<void> {
  const result = await refreshBillingChargeStatusAction({ orderId });
  const outcome = result.ok ? result.status.toLowerCase() : "error";
  redirect(`/order/${encodeURIComponent(orderId)}?billingRefresh=${outcome}`);
}

// ── 결제 재개 — 결제창이 닫혔거나 실패한 주문(PENDING/FAILED)을 같은 주문번호로 다시 결제 ──

const retrySchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["card", "kakaopay", "naverpay", "bank", "oneclick"]),
  billingCardId: z.string().optional(), // 폐기된 oneclick 화면의 재전송 호환용
});

export type RetryPaymentResult =
  | { ok: true; formAction: string; formFields: Record<string, string> }
  | { ok: true; redirect: string }
  | { ok: false; error: string };

export async function retryPaymentAction(input: {
  orderId: string;
  method: "card" | "kakaopay" | "naverpay" | "bank" | "oneclick";
  billingCardId?: string;
}): Promise<RetryPaymentResult> {
  const user = await requireShopUser();
  const parsed = retrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "입력값을 확인해 주세요." };
  const { orderId, method } = parsed.data;
  const disabledBilling = getDisabledBillingResult(method);
  if (disabledBilling) return disabledBilling;

  // 주문 잠금과 상품 행 잠금 안에서 재고를 다시 확인한다. 실패 주문도 같은 주문번호로만
  // 재개하며, 이미 결제된 주문은 어떤 재시도도 상태를 바꾸지 않는다.
  const prepared = await prisma.$transaction(async (tx) => {
    if (isBillingIntegrationAccount(user.email)) {
      await acquireTransactionLock(tx, `billing-checkout-user:${user.id}`);
      const unresolvedOtherOrder = await tx.shopOrder.findFirst({
        where: {
          userId: user.id,
          id: { not: orderId },
          status: "PENDING",
          approvalNo: LAONPAY_BILLING_PROCESSING_MARKER,
        },
        select: { id: true },
      });
      if (unresolvedOtherOrder) {
        return {
          ok: false as const,
          error:
            "다른 주문의 등록카드 결제 결과를 확인 중입니다. 새로 결제하지 말고 주문내역에서 상태를 확인해 주세요.",
        };
      }
    }
    await acquireTransactionLock(tx, `order:${orderId}`);
    const order = await tx.shopOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.userId !== user.id || !["PENDING", "FAILED"].includes(order.status) || order.items.length === 0) {
      return { ok: false as const, error: "결제를 진행할 수 없는 주문입니다." };
    }
    if (isPaymentProcessingMarker(order.approvalNo)) {
      return { ok: false as const, error: "결제 결과를 확인 중입니다. 잠시 후 주문내역을 확인해 주세요." };
    }
    const inventory = await lockAndValidateInventory(tx, order.items, order.id);
    if (!inventory.ok) {
      if (order.status !== "FAILED") {
        await tx.shopOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
      }
      return inventory;
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
  const base = process.env.SHOP_APP_URL ?? "http://localhost:3003";
  const goodsName =
    order.items.length > 1 ? `${order.items[0].name} 외 ${order.items.length - 1}건` : order.items[0].name;

  // 승인 전 시도는 동일 moid 재사용 가능 — 새 주문을 만들지 않아 주문번호가 유지된다
  const res = await getPgProvider().createAuthOrder({
    paymentId: order.id,
    payMethod: method as "card" | "kakaopay" | "naverpay" | "bank",
    moid: order.moid,
    amount: order.totalAmount,
    goodsName: sanitizePgParam(goodsName),
    ordername: sanitizePgParam(user.name),
    buyerPhone: (order.receiverPhone ?? user.phone ?? "").replace(/\D/g, ""),
    buyerEmail: user.email,
    storeId: "2999199999", // 테스트 MID (실제 sndStoreid는 KSPAY_STORE_ID env 사용)
    returnUrl: `${base}/order/${order.id}`,
    callbackUrl: `${base}/api/pg/kspay/callback`,
    resultToken: createKspayResultToken(order),
  });

  if (res.formAction && res.formFields) {
    return { ok: true, formAction: res.formAction, formFields: res.formFields };
  }
  return { ok: false, error: "결제창을 열 수 없습니다. (PG 설정 확인)" };
}
