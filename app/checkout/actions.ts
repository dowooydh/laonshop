"use server";
// 주문 생성 + KSPAY 인증결제창 호출. 가격은 서버에서 상품 재조회로 신뢰(위변조 차단).
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPgProvider } from "@/lib/kspay";
import { isKspayRestLiveEnabled, payOldCert } from "@/lib/kspay/webfep";
import { createKspayResultToken } from "@/lib/kspay/result-token";
import { sanitizePgParam } from "@/lib/format";
import { z } from "zod";
import { requireShopUser } from "@/lib/auth";
import { getDisabledBillingResult, MANUAL_PAYMENT_DISABLED_MESSAGE, ONECLICK_PAYMENT_DISABLED_MESSAGE } from "@/lib/billing";
import { createLaonpayBillingClient } from "@/lib/laonpay/billing-client";
import {
  createManualPaymentDemoApproval,
  getManualPaymentIssuerLabel,
  resolveManualPaymentMode,
} from "@/lib/manual-payment-demo";
import {
  billingRequestFingerprint,
  canClaimBillingChargeAttempt,
  calculateOrderAmount,
  decideBillingChargeLedger,
  isBillingIntegrationAccount,
  isBillingIntegrationEnabled,
  isProvablyLocalBillingCharge,
  orderGoodsName,
  type BillingChargeLedgerExpectation,
  type BillingChargeLedgerSnapshot,
} from "@/lib/laonpay/billing-policy";
import {
  acquireTransactionLock,
  createIdempotentMoid,
  isPaymentProcessingMarker,
  LAONPAY_BILLING_PROCESSING_MARKER,
  lockAndValidateInventory,
  PAYMENT_PROCESSING_MARKER,
} from "@/lib/order-guard";

const schema = z.object({
  // KSPAY 결제창 수단 — 가상계좌는 KSNET 미지원으로 제외.
  // oneclick = LAONPAY hosted 등록카드 / manual = 수기결제(구인증) 카드정보 직접 입력.
  method: z.enum(["card", "kakaopay", "naverpay", "bank", "oneclick", "manual", "manual_demo"]).default("card"),
  items: z
    .array(
      z.object({
        productId: z.string(),
        qty: z.number().int().positive().max(99, "수량은 1회 최대 99개까지 주문할 수 있습니다."),
        size: z.string().optional(),
      }),
    )
    .min(1, "장바구니가 비어 있습니다.")
    .max(50, "한 번에 주문할 수 있는 상품 종류를 초과했습니다."),
  idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/, "주문 요청 식별값이 올바르지 않습니다."),
  receiverName: z.string().trim().min(1, "받는 분 이름을 입력해 주세요.").max(30),
  receiverPhone: z.string().trim().min(1, "연락처를 입력해 주세요.").max(20),
  zipcode: z.union([z.string().trim().max(10), z.literal("")]).optional(),
  address: z.string().trim().min(1, "배송지를 입력해 주세요.").max(200),
  addressDetail: z.union([z.string().trim().max(100), z.literal("")]).optional(),
  // 브라우저에는 라온샵 로컬의 불투명 결제수단 ID만 전달한다.
  billingCardId: z.string().min(8).max(128).optional(),
  // 심사 시연은 카드 원문을 서버로 보내지 않고 허용된 카드사 코드만 전달한다.
  demoIssuer: z
    .string()
    .min(1)
    .max(16)
    .refine((value) => getManualPaymentIssuerLabel(value) !== null, "카드사를 확인해 주세요.")
    .optional(),
  // manual(구인증) 전용 — 카드정보는 승인 요청 후 즉시 폐기, 저장·로그 금지 (절대 규칙 2)
  manualCard: z
    .object({
      issuerCode: z
        .string()
        .min(1)
        .max(16)
        .refine((value) => getManualPaymentIssuerLabel(value) !== null, "카드사를 확인해 주세요."),
      cardNo: z.string().regex(/^\d{15,16}$/, "카드번호 15~16자리를 입력해 주세요."),
      expMm: z.string().regex(/^(0[1-9]|1[0-2])$/, "유효기간 월(MM)을 확인해 주세요."),
      expYy: z.string().regex(/^\d{2}$/, "유효기간 연도(YY)를 확인해 주세요."),
      pw2: z.string().regex(/^\d{2}$/, "비밀번호 앞 2자리를 입력해 주세요."),
      birth6: z.string().regex(/^\d{6}(\d{4})?$/, "생년월일 6자리(법인카드는 사업자번호 10자리)를 입력해 주세요."),
    })
    .optional(),
}).superRefine((value, ctx) => {
  if (value.method === "manual") {
    if (!value.manualCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manualCard"],
        message: "카드 정보를 입력해 주세요.",
      });
    }
    if (value.demoIssuer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["demoIssuer"],
        message: "결제 정보를 확인해 주세요.",
      });
    }
    return;
  }
  if (value.method === "manual_demo") {
    if (!value.demoIssuer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["demoIssuer"],
        message: "카드사를 선택해 주세요.",
      });
    }
    if (value.manualCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manualCard"],
        message: "시연 결제에는 카드 원문을 전송할 수 없습니다.",
      });
    }
    return;
  }
  if (value.manualCard || value.demoIssuer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["method"],
      message: "결제 정보를 확인해 주세요.",
    });
  }
});

export type CheckoutInput = z.input<typeof schema>;
export type CheckoutResult =
  | { ok: true; formAction: string; formFields: Record<string, string> }
  | { ok: true; redirect: string }
  | { ok: false; error: string; recoveryOrderId?: string };

export type CheckoutRecoveryResult =
  | { ok: true; orderId: string }
  | { ok: false };

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

function buildBillingChargeRequest(
  user: { id: string; name: string; email: string },
  order: {
    id: string;
    receiverName: string | null;
    receiverPhone: string | null;
    items: Array<{ name: string; price: number; qty: number }>;
  },
) {
  const amount = calculateOrderAmount(order.items);
  const requestBody = {
    externalCustomerId: user.id,
    externalOrderId: order.id,
    amount,
    goodsName: orderGoodsName(order.items),
    buyerName: (order.receiverName ?? user.name).slice(0, 100),
    ...(order.receiverPhone
      ? { buyerPhone: order.receiverPhone.replace(/\D/g, "").slice(0, 20) }
      : {}),
    buyerEmail: user.email,
  };
  return { amount, requestBody };
}

type LocalBillingCharge = BillingChargeLedgerSnapshot & { id: string };
type LocalBillingFailureCode =
  | "LOCAL_AMOUNT_CHANGED"
  | "LOCAL_REQUEST_CHANGED"
  | "LOCAL_INVENTORY_REJECTED"
  | "PAYMENT_METHOD_UNAVAILABLE";

async function closeLocalBillingChargeAndOrder(
  tx: Prisma.TransactionClient,
  charge: LocalBillingCharge,
  expected: BillingChargeLedgerExpectation,
  failureCode: LocalBillingFailureCode,
): Promise<void> {
  const closedCharge = await tx.shopBillingCharge.updateMany({
    where: {
      id: charge.id,
      userId: expected.userId,
      orderId: expected.orderId,
      paymentMethodId: expected.paymentMethodId,
      status: "REQUESTING",
      requestAttempts: 0,
      laonpayChargeId: null,
      providerPaymentId: null,
      amount: charge.amount,
      requestFingerprint: charge.requestFingerprint,
    },
    data: { status: "DECLINED", failureCode },
  });
  if (closedCharge.count !== 1) throw new Error("로컬 빌링 청구 종료 경합");

  const closedOrder = await tx.shopOrder.updateMany({
    where: {
      id: expected.orderId,
      userId: expected.userId,
      status: "PENDING",
      approvalNo: LAONPAY_BILLING_PROCESSING_MARKER,
    },
    data: { status: "FAILED", approvalNo: null },
  });
  if (closedOrder.count !== 1) throw new Error("로컬 빌링 주문 종료 경합");
}

async function closeBillingOrderWithoutCharge(
  tx: Prisma.TransactionClient,
  userId: string,
  orderId: string,
): Promise<void> {
  const closedOrder = await tx.shopOrder.updateMany({
    where: {
      id: orderId,
      userId,
      status: "PENDING",
      approvalNo: LAONPAY_BILLING_PROCESSING_MARKER,
      billingCharge: null,
    },
    data: { status: "FAILED", approvalNo: null },
  });
  if (closedOrder.count !== 1) throw new Error("청구 전 빌링 주문 종료 경합");
}

type BillingChargeClaimExpected = BillingChargeLedgerExpectation & {
  chargeId: string;
  expectedAttempt: number;
  laonpayPaymentMethodId: string;
  user: { id: string; name: string; email: string };
};

type BillingChargeClaimResult =
  | {
      kind: "CLAIMED";
      attempt: 1 | 2;
      idempotencyKey: string;
      laonpayPaymentMethodId: string;
      requestBody: ReturnType<typeof buildBillingChargeRequest>["requestBody"];
    }
  | { kind: "LOCAL_DECLINED" }
  | { kind: "BLOCKED" };

async function claimBillingChargeAttempt(
  expected: BillingChargeClaimExpected,
): Promise<BillingChargeClaimResult> {
  return prisma
    .$transaction(async (tx) => {
      // prepare 이후 실제 외부 호출 직전에도 같은 순서로 잠그고 모든 결박값을
      // 다시 읽는다. 저장된 charge의 paymentMethodId를 잠금 키로 먼저 신뢰하지 않는다.
      await acquireTransactionLock(tx, `billing-checkout-user:${expected.userId}`);
      await acquireTransactionLock(tx, `order:${expected.orderId}`);
      await acquireTransactionLock(tx, `billing-method:${expected.paymentMethodId}`);
      await acquireTransactionLock(tx, `billing-charge:${expected.chargeId}`);
      const [order, paymentMethod, charge] = await Promise.all([
        tx.shopOrder.findUnique({
          where: { id: expected.orderId },
          include: { items: true },
        }),
        tx.shopBillingPaymentMethod.findUnique({
          where: { id: expected.paymentMethodId },
        }),
        tx.shopBillingCharge.findUnique({
          where: { id: expected.chargeId },
        }),
      ]);
      if (
        !order ||
        !paymentMethod ||
        !charge ||
        order.userId !== expected.userId ||
        order.status !== "PENDING" ||
        order.approvalNo !== LAONPAY_BILLING_PROCESSING_MARKER ||
        order.items.length === 0 ||
        paymentMethod.userId !== expected.userId ||
        paymentMethod.status !== "ACTIVE" ||
        paymentMethod.laonpayPaymentMethodId !== expected.laonpayPaymentMethodId
      ) {
        return { kind: "BLOCKED" } as const;
      }

      const currentRequest = buildBillingChargeRequest(expected.user, order);
      const currentFingerprint = billingRequestFingerprint(currentRequest.requestBody);
      const ledgerDecision = decideBillingChargeLedger(charge, expected);
      const amountChanged =
        currentRequest.amount !== order.totalAmount ||
        currentRequest.amount !== expected.amount;
      const requestChanged = currentFingerprint !== expected.requestFingerprint;
      if (amountChanged || requestChanged) {
        if (
          ledgerDecision.kind !== "BLOCK" &&
          isProvablyLocalBillingCharge(charge)
        ) {
          await closeLocalBillingChargeAndOrder(
            tx,
            charge,
            expected,
            amountChanged ? "LOCAL_AMOUNT_CHANGED" : "LOCAL_REQUEST_CHANGED",
          );
          return { kind: "LOCAL_DECLINED" } as const;
        }
        return { kind: "BLOCKED" } as const;
      }
      if (ledgerDecision.kind === "CLOSE_LOCAL") {
        await closeLocalBillingChargeAndOrder(
          tx,
          charge,
          expected,
          ledgerDecision.failureCode,
        );
        return { kind: "LOCAL_DECLINED" } as const;
      }
      if (
        ledgerDecision.kind !== "READY" ||
        !canClaimBillingChargeAttempt(charge, expected, expected.expectedAttempt)
      ) {
        return { kind: "BLOCKED" } as const;
      }

      const claimed = await tx.shopBillingCharge.updateMany({
        where: {
          id: expected.chargeId,
          userId: expected.userId,
          orderId: expected.orderId,
          paymentMethodId: expected.paymentMethodId,
          amount: expected.amount,
          requestFingerprint: expected.requestFingerprint,
          status: charge.status,
          requestAttempts: expected.expectedAttempt,
          laonpayChargeId: null,
          providerPaymentId: null,
        },
        data: { requestAttempts: { increment: 1 } },
      });
      if (claimed.count !== 1) return { kind: "BLOCKED" } as const;
      return {
        kind: "CLAIMED",
        attempt: (expected.expectedAttempt + 1) as 1 | 2,
        idempotencyKey: charge.idempotencyKey,
        laonpayPaymentMethodId: paymentMethod.laonpayPaymentMethodId,
        requestBody: currentRequest.requestBody,
      } as const;
    }, TX_OPTIONS)
    .catch(() => ({ kind: "BLOCKED" as const }));
}

async function markFirstBillingAttemptUnknown(
  expected: Omit<BillingChargeClaimExpected, "expectedAttempt"> & {
    idempotencyKey: string;
  },
): Promise<boolean> {
  return prisma
    .$transaction(async (tx) => {
      // 첫 POST가 실제 UNKNOWN으로 끝난 뒤에만 같은 잠금 순서와 결박값으로
      // REQUESTING/1을 UNKNOWN/1로 바꾼다. 이 전이 전에는 2차 claim이 불가능하다.
      await acquireTransactionLock(tx, `billing-checkout-user:${expected.userId}`);
      await acquireTransactionLock(tx, `order:${expected.orderId}`);
      await acquireTransactionLock(tx, `billing-method:${expected.paymentMethodId}`);
      await acquireTransactionLock(tx, `billing-charge:${expected.chargeId}`);
      const [order, paymentMethod, charge] = await Promise.all([
        tx.shopOrder.findUnique({
          where: { id: expected.orderId },
          include: { items: true },
        }),
        tx.shopBillingPaymentMethod.findUnique({
          where: { id: expected.paymentMethodId },
        }),
        tx.shopBillingCharge.findUnique({
          where: { id: expected.chargeId },
        }),
      ]);
      if (
        !order ||
        !paymentMethod ||
        !charge ||
        order.userId !== expected.userId ||
        order.status !== "PENDING" ||
        order.approvalNo !== LAONPAY_BILLING_PROCESSING_MARKER ||
        order.items.length === 0 ||
        paymentMethod.userId !== expected.userId ||
        paymentMethod.status !== "ACTIVE" ||
        paymentMethod.laonpayPaymentMethodId !== expected.laonpayPaymentMethodId ||
        charge.userId !== expected.userId ||
        charge.orderId !== expected.orderId ||
        charge.paymentMethodId !== expected.paymentMethodId ||
        charge.amount !== expected.amount ||
        charge.requestFingerprint !== expected.requestFingerprint ||
        charge.idempotencyKey !== expected.idempotencyKey ||
        charge.status !== "REQUESTING" ||
        charge.requestAttempts !== 1 ||
        charge.laonpayChargeId !== null ||
        charge.providerPaymentId !== null
      ) {
        return false;
      }

      const currentRequest = buildBillingChargeRequest(expected.user, order);
      if (
        currentRequest.amount !== order.totalAmount ||
        currentRequest.amount !== expected.amount ||
        billingRequestFingerprint(currentRequest.requestBody) !==
          expected.requestFingerprint
      ) {
        return false;
      }

      const marked = await tx.shopBillingCharge.updateMany({
        where: {
          id: expected.chargeId,
          userId: expected.userId,
          orderId: expected.orderId,
          paymentMethodId: expected.paymentMethodId,
          amount: expected.amount,
          requestFingerprint: expected.requestFingerprint,
          idempotencyKey: expected.idempotencyKey,
          status: "REQUESTING",
          requestAttempts: 1,
          laonpayChargeId: null,
          providerPaymentId: null,
        },
        data: {
          status: "UNKNOWN",
          failureCode: "RESULT_UNCONFIRMED",
        },
      });
      return marked.count === 1;
    }, TX_OPTIONS)
    .catch(() => false);
}

export async function createOrderAction(input: CheckoutInput): Promise<CheckoutResult> {
  const user = await requireShopUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };
  const d = parsed.data;
  const manualPaymentMode = resolveManualPaymentMode(
    user.email,
    isKspayRestLiveEnabled(),
  );
  if (d.method === "oneclick") {
    if (!d.billingCardId || !isBillingIntegrationEnabled(user.email)) {
      return { ok: false, error: ONECLICK_PAYMENT_DISABLED_MESSAGE };
    }
  } else {
    const disabledBilling = getDisabledBillingResult(d.method);
    if (disabledBilling) return disabledBilling;
  }

  // 우편번호·상세주소는 주문 스냅샷 문자열로 합성 보관 (ShopOrder.address 단일 컬럼 유지)
  const fullAddress = [d.zipcode ? `[${d.zipcode}]` : "", d.address, d.addressDetail || ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (d.method === "manual") {
    if (!d.manualCard) return { ok: false, error: "카드 정보를 입력해 주세요." };
    if (manualPaymentMode !== "live") {
      return { ok: false, error: MANUAL_PAYMENT_DISABLED_MESSAGE };
    }
  }
  if (d.method === "manual_demo") {
    if (
      manualPaymentMode !== "review-demo" ||
      !d.demoIssuer ||
      getManualPaymentIssuerLabel(d.demoIssuer) === null
    ) {
      return { ok: false, error: MANUAL_PAYMENT_DISABLED_MESSAGE };
    }
  }

  // 동일 사용자·동일 체크아웃 요청은 같은 moid를 사용한다. DB advisory lock으로 다중 탭과
  // 네트워크 재전송을 직렬화하고, 상품 행 잠금 안에서 재고 확인과 주문 생성을 원자화한다.
  const prepared = await prisma.$transaction(async (tx) => {
    const billingIntegrationAccount = isBillingIntegrationAccount(user.email);
    if (billingIntegrationAccount) {
      // 등록카드 결과가 불명확한 동안 결제수단/카트 nonce를 바꿔 새 주문을 만드는
      // 교차 요청도 직렬화한다. 이 잠금·조회는 기존 ShopOrder만 사용하므로 LAONPAY
      // env나 신규 빌링 스키마가 미준비여도 일반 KSPAY 흐름을 깨뜨리지 않는다.
      await acquireTransactionLock(tx, `billing-checkout-user:${user.id}`);
    }
    await acquireTransactionLock(tx, `checkout:${user.id}:${d.idempotencyKey}`);
    const moid = createIdempotentMoid(user.id, d.idempotencyKey);
    if (billingIntegrationAccount) {
      const unresolvedOtherOrder = await tx.shopOrder.findFirst({
        where: {
          userId: user.id,
          status: "PENDING",
          approvalNo: LAONPAY_BILLING_PROCESSING_MARKER,
          moid: { not: moid },
        },
        select: { id: true },
      });
      if (unresolvedOtherOrder) {
        return {
          ok: false as const,
          error:
            "다른 주문의 등록카드 결제 결과를 확인 중입니다. 새로 결제하지 말고 주문내역에서 상태를 확인해 주세요.",
          recoveryOrderId: unresolvedOtherOrder.id,
        };
      }
    }
    let selectedBillingMethodId: string | null = null;
    if (d.method === "oneclick") {
      await acquireTransactionLock(tx, `billing-method:${d.billingCardId!}`);
      const selectedMethod = await tx.shopBillingPaymentMethod.findFirst({
        where: {
          id: d.billingCardId!,
          userId: user.id,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!selectedMethod) {
        return { ok: false as const, error: "사용 가능한 등록 카드를 찾을 수 없습니다." };
      }
      selectedBillingMethodId = selectedMethod.id;
    }
    const existing = await tx.shopOrder.findUnique({ where: { moid }, include: { items: true } });

    if (existing) {
      if (existing.userId !== user.id) return { ok: false as const, error: "주문 요청을 처리할 수 없습니다." };
      if (existing.status === "PAID") return { ok: true as const, order: existing };
      if (existing.status === "CANCELED" || existing.status === "CANCEL_REQUESTED") {
        return { ok: false as const, error: "이미 처리된 주문입니다. 주문내역을 확인해 주세요." };
      }
      if (d.method === "oneclick") {
        const existingCharge = await tx.shopBillingCharge.findUnique({
          where: { orderId: existing.id },
          select: {
            id: true,
            status: true,
            paymentMethodId: true,
            requestAttempts: true,
            laonpayChargeId: true,
            providerPaymentId: true,
          },
        });
        if (
          existingCharge &&
          (!["REQUESTING", "PENDING", "UNKNOWN"].includes(existingCharge.status) ||
            existingCharge.paymentMethodId !== selectedBillingMethodId ||
            existingCharge.laonpayChargeId !== null ||
            existingCharge.providerPaymentId !== null ||
            existingCharge.requestAttempts >= 2)
        ) {
          return {
            ok: false as const,
            error: "이미 처리 중이거나 완료된 등록카드 결제 요청입니다. 주문내역을 확인해 주세요.",
            recoveryOrderId: existing.id,
          };
        }
      }
      const recoveringUnclaimedBillingOrder =
        d.method === "oneclick" &&
        existing.approvalNo === LAONPAY_BILLING_PROCESSING_MARKER;
      if (isPaymentProcessingMarker(existing.approvalNo) && !recoveringUnclaimedBillingOrder) {
        return { ok: false as const, error: "결제 결과를 확인 중입니다. 잠시 후 주문내역을 확인해 주세요." };
      }
      const inventory = await lockAndValidateInventory(tx, existing.items, existing.id);
      if (!inventory.ok) {
        const localOnlyCharge = recoveringUnclaimedBillingOrder
          ? await tx.shopBillingCharge.findUnique({
              where: { orderId: existing.id },
              select: {
                id: true,
                userId: true,
                orderId: true,
                paymentMethodId: true,
                amount: true,
                requestFingerprint: true,
                status: true,
                requestAttempts: true,
                laonpayChargeId: true,
                providerPaymentId: true,
              },
            })
          : null;
        if (recoveringUnclaimedBillingOrder && !localOnlyCharge) {
          await closeBillingOrderWithoutCharge(tx, user.id, existing.id);
        } else if (
          localOnlyCharge &&
          localOnlyCharge.userId === user.id &&
          localOnlyCharge.orderId === existing.id &&
          localOnlyCharge.paymentMethodId === selectedBillingMethodId &&
          isProvablyLocalBillingCharge(localOnlyCharge)
        ) {
          await closeLocalBillingChargeAndOrder(
            tx,
            localOnlyCharge,
            {
              userId: user.id,
              orderId: existing.id,
              paymentMethodId: selectedBillingMethodId!,
              amount: localOnlyCharge.amount,
              requestFingerprint: localOnlyCharge.requestFingerprint,
            },
            "LOCAL_INVENTORY_REJECTED",
          );
        }
        return inventory;
      }
      const order = await tx.shopOrder.update({
        where: { id: existing.id },
        data: { status: "PENDING" },
        include: { items: true },
      });
      if (d.method === "oneclick") {
        const existingCharge = await tx.shopBillingCharge.findUnique({
          where: { orderId: order.id },
        });
        if (!existingCharge) {
          const { amount, requestBody } = buildBillingChargeRequest(user, order);
          if (amount !== order.totalAmount || amount !== inventory.total) {
            await tx.shopOrder.update({
              where: { id: order.id },
              data: { status: "FAILED", approvalNo: null },
            });
            return { ok: false as const, error: "주문 금액을 확인할 수 없습니다." };
          }
          await tx.shopBillingCharge.create({
            data: {
              userId: user.id,
              orderId: order.id,
              paymentMethodId: selectedBillingMethodId!,
              idempotencyKey: randomUUID(),
              requestFingerprint: billingRequestFingerprint(requestBody),
              amount,
              status: "REQUESTING",
            },
          });
        }
      }
      return { ok: true as const, order };
    }

    const inventory = await lockAndValidateInventory(tx, d.items);
    if (!inventory.ok) return inventory;
    const order = await tx.shopOrder.create({
      data: {
        userId: user.id,
        status: "PENDING",
        totalAmount: inventory.total,
        moid,
        receiverName: d.receiverName,
        receiverPhone: d.receiverPhone,
        address: fullAddress,
        ...(d.method === "oneclick"
          ? { approvalNo: LAONPAY_BILLING_PROCESSING_MARKER }
          : {}),
        items: { create: inventory.items },
      },
      include: { items: true },
    });
    if (d.method === "oneclick") {
      const { amount, requestBody } = buildBillingChargeRequest(user, order);
      if (amount !== order.totalAmount || amount !== inventory.total) {
        throw new Error("원클릭 주문 금액 불일치");
      }
      await tx.shopBillingCharge.create({
        data: {
          userId: user.id,
          orderId: order.id,
          paymentMethodId: selectedBillingMethodId!,
          idempotencyKey: randomUUID(),
          requestFingerprint: billingRequestFingerprint(requestBody),
          amount,
          status: "REQUESTING",
        },
      });
    }
    return { ok: true as const, order };
  }, TX_OPTIONS).catch(() => null);

  if (!prepared) return { ok: false, error: "주문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  if (!prepared.ok) {
    return {
      ok: false,
      error: prepared.error,
      ...("recoveryOrderId" in prepared &&
      typeof prepared.recoveryOrderId === "string"
        ? { recoveryOrderId: prepared.recoveryOrderId }
        : {}),
    };
  }
  const order = prepared.order;
  if (order.status === "PAID") return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  const goodsName = orderGoodsName(order.items);

  // ── 심사 계정 수기결제 시연 ────────────────────────────────────────────
  // 카드 원문이나 PG 자격정보를 받지 않고, 기존 서버 가격·재고·멱등 잠금만
  // 사용해 결제 완료 화면을 재현한다. 실제 WEBFEP/KSNET 호출과 TID 생성은 없다.
  if (d.method === "manual_demo") {
    const issuerName = getManualPaymentIssuerLabel(d.demoIssuer!);
    if (!issuerName) return { ok: false, error: MANUAL_PAYMENT_DISABLED_MESSAGE };

    const demoFinalized = await prisma
      .$transaction(async (tx) => {
        await acquireTransactionLock(tx, `order:${order.id}`);
        const current = await tx.shopOrder.findUnique({
          where: { id: order.id },
          include: { items: true },
        });
        if (!current || current.userId !== user.id) {
          return { ok: false as const, error: "주문을 찾을 수 없습니다." };
        }
        if (current.status === "PAID") return { ok: true as const };
        if (current.status !== "PENDING" || isPaymentProcessingMarker(current.approvalNo)) {
          return { ok: false as const, error: "이미 처리된 주문입니다." };
        }
        const inventory = await lockAndValidateInventory(tx, current.items, current.id);
        if (!inventory.ok || inventory.total !== current.totalAmount) {
          await tx.shopOrder.update({
            where: { id: current.id },
            data: { status: "FAILED", approvalNo: null },
          });
          return inventory.ok
            ? { ok: false as const, error: "주문 금액을 확인할 수 없습니다." }
            : inventory;
        }
        await tx.shopOrder.update({
          where: { id: current.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            approvalNo: createManualPaymentDemoApproval(current.id),
            pgTrno: null,
            cardName: `${issuerName} (수기결제 시연)`,
          },
        });
        return { ok: true as const };
      }, TX_OPTIONS)
      .catch(() => null);

    if (!demoFinalized) {
      return { ok: false, error: "시연 주문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
    if (!demoFinalized.ok) return { ok: false, error: demoFinalized.error };
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  // ── LAONPAY 등록카드 결제 ───────────────────────────────────────────────
  // 외부 호출 전에 주문·결제수단 소유권과 금액을 다시 검증하고, 주문당 하나인
  // 청구 원장과 처리 마커를 먼저 커밋한다. 이후 timeout/5xx가 발생해도 새 청구를
  // 만들거나 다른 결제수단으로 우회하지 않고 주문 상세의 상태조회만 허용한다.
  if (d.method === "oneclick") {
    const chargePrepared = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-checkout-user:${user.id}`);
      await acquireTransactionLock(tx, `order:${order.id}`);
      await acquireTransactionLock(tx, `billing-method:${d.billingCardId!}`);
      const current = await tx.shopOrder.findUnique({
        where: { id: order.id },
        include: { items: true, billingCharge: true },
      });
      if (!current || current.userId !== user.id) {
        return { ok: false as const, error: "주문을 찾을 수 없습니다." };
      }
      if (current.status === "PAID") {
        return { ok: true as const, paid: true as const, order: current };
      }
      if (current.status !== "PENDING" || current.items.length === 0) {
        return { ok: false as const, error: "결제를 진행할 수 없는 주문입니다." };
      }
      if (current.approvalNo !== LAONPAY_BILLING_PROCESSING_MARKER) {
        return {
          ok: false as const,
          error: "등록카드 결제 결과를 확인 중입니다. 새로 결제하지 말고 주문내역에서 상태를 확인해 주세요.",
        };
      }

      const inventory = await lockAndValidateInventory(tx, current.items, current.id);
      if (!inventory.ok) {
        if (!current.billingCharge) {
          await closeBillingOrderWithoutCharge(tx, user.id, current.id);
        } else if (
          current.billingCharge.userId === user.id &&
          current.billingCharge.orderId === current.id &&
          current.billingCharge.paymentMethodId === d.billingCardId &&
          isProvablyLocalBillingCharge(current.billingCharge)
        ) {
          await closeLocalBillingChargeAndOrder(
            tx,
            current.billingCharge,
            {
              userId: user.id,
              orderId: current.id,
              paymentMethodId: d.billingCardId!,
              amount: current.billingCharge.amount,
              requestFingerprint: current.billingCharge.requestFingerprint,
            },
            "LOCAL_INVENTORY_REJECTED",
          );
        }
        return inventory;
      }
      const { amount, requestBody } = buildBillingChargeRequest(user, current);
      if (amount !== current.totalAmount || amount !== inventory.total) {
        if (!current.billingCharge) {
          await closeBillingOrderWithoutCharge(tx, user.id, current.id);
        } else if (
          current.billingCharge.userId === user.id &&
          current.billingCharge.orderId === current.id &&
          current.billingCharge.paymentMethodId === d.billingCardId &&
          isProvablyLocalBillingCharge(current.billingCharge)
        ) {
          await closeLocalBillingChargeAndOrder(
            tx,
            current.billingCharge,
            {
              userId: user.id,
              orderId: current.id,
              paymentMethodId: d.billingCardId!,
              amount: current.billingCharge.amount,
              requestFingerprint: current.billingCharge.requestFingerprint,
            },
            "LOCAL_AMOUNT_CHANGED",
          );
        }
        return { ok: false as const, error: "주문 금액을 확인할 수 없습니다." };
      }
      const paymentMethod = await tx.shopBillingPaymentMethod.findFirst({
        where: {
          id: d.billingCardId!,
          userId: user.id,
          status: "ACTIVE",
        },
      });
      if (!paymentMethod) {
        if (!current.billingCharge) {
          await closeBillingOrderWithoutCharge(tx, user.id, current.id);
        } else if (
          current.billingCharge.userId === user.id &&
          current.billingCharge.orderId === current.id &&
          current.billingCharge.paymentMethodId === d.billingCardId &&
          isProvablyLocalBillingCharge(current.billingCharge)
        ) {
          await closeLocalBillingChargeAndOrder(
            tx,
            current.billingCharge,
            {
              userId: user.id,
              orderId: current.id,
              paymentMethodId: d.billingCardId!,
              amount: current.billingCharge.amount,
              requestFingerprint: current.billingCharge.requestFingerprint,
            },
            "PAYMENT_METHOD_UNAVAILABLE",
          );
        }
        return { ok: false as const, error: "사용 가능한 등록 카드를 찾을 수 없습니다." };
      }

      const requestFingerprint = billingRequestFingerprint(requestBody);
      const charge = current.billingCharge
        ? current.billingCharge
        : await tx.shopBillingCharge.create({
            data: {
              userId: user.id,
              orderId: current.id,
              paymentMethodId: paymentMethod.id,
              idempotencyKey: randomUUID(),
              requestFingerprint,
              amount,
              status: "REQUESTING",
            },
          });
      const chargeExpected = {
        userId: user.id,
        orderId: current.id,
        paymentMethodId: paymentMethod.id,
        amount,
        requestFingerprint,
      };
      const chargeDecision = decideBillingChargeLedger(charge, chargeExpected);
      if (chargeDecision.kind === "CLOSE_LOCAL") {
        await closeLocalBillingChargeAndOrder(
          tx,
          charge,
          chargeExpected,
          chargeDecision.failureCode,
        );
        return {
          ok: false as const,
          error: "주문 결제 정보가 변경되어 등록카드 결제를 종료했습니다. 주문내역을 확인해 주세요.",
        };
      }
      if (chargeDecision.kind !== "READY") {
        return {
          ok: false as const,
          error: "등록카드 결제 원장을 확인할 수 없습니다. 주문내역에서 상태를 확인해 주세요.",
        };
      }
      return {
        ok: true as const,
        paid: false as const,
        charge,
        paymentMethod,
      };
    }, TX_OPTIONS).catch(() => null);

    if (!chargePrepared) {
      return {
        ok: false,
        error: "등록카드 결제를 시작하지 못했습니다. 새로 결제하지 말고 주문내역을 확인해 주세요.",
        recoveryOrderId: order.id,
      };
    }
    if (!chargePrepared.ok) {
      return {
        ok: false,
        error: chargePrepared.error,
        recoveryOrderId: order.id,
      };
    }
    if (chargePrepared.paid) return { ok: true, redirect: `/order/${order.id}?receipt=1` };

    const claimExpected = {
      chargeId: chargePrepared.charge.id,
      orderId: order.id,
      userId: user.id,
      paymentMethodId: chargePrepared.paymentMethod.id,
      laonpayPaymentMethodId:
        chargePrepared.paymentMethod.laonpayPaymentMethodId,
      amount: chargePrepared.charge.amount,
      requestFingerprint: chargePrepared.charge.requestFingerprint,
      user: { id: user.id, name: user.name, email: user.email },
    };
    let claim = await claimBillingChargeAttempt({
      ...claimExpected,
      expectedAttempt: chargePrepared.charge.requestAttempts,
    });
    if (claim.kind !== "CLAIMED") {
      return {
        ok: false,
        error:
          claim.kind === "LOCAL_DECLINED"
            ? "주문 결제 정보가 변경되어 등록카드 결제를 종료했습니다. 주문내역을 확인해 주세요."
            : "등록카드 결제 요청 상태를 확인하지 못했습니다. 새로 결제하지 말고 주문내역을 확인해 주세요.",
        recoveryOrderId: order.id,
      };
    }
    const client = createLaonpayBillingClient();
    let chargeResult = await client.chargePaymentMethod(
      claim.laonpayPaymentMethodId,
      claim.requestBody,
      claim.idempotencyKey,
    );
    if (!chargeResult.ok && chargeResult.outcome === "UNKNOWN" && claim.attempt === 1) {
      // 계약 4: 같은 key와 바이트상 동일한 body의 두 번째 POST는 새 승인이 아니라
      // 기존 resource의 ID/상태 대사다. 최초 POST가 끝났음을 UNKNOWN으로 먼저
      // 원자 기록해야만 이 1회를 claim할 수 있다.
      const markedUnknown = await markFirstBillingAttemptUnknown({
        ...claimExpected,
        idempotencyKey: claim.idempotencyKey,
      });
      if (markedUnknown) {
        claim = await claimBillingChargeAttempt({
          ...claimExpected,
          expectedAttempt: 1,
        });
        if (claim.kind === "CLAIMED") {
          chargeResult = await client.chargePaymentMethod(
            claim.laonpayPaymentMethodId,
            claim.requestBody,
            claim.idempotencyKey,
          );
        }
      }
    }

    if (
      !chargeResult.ok ||
      chargeResult.data.charge.externalOrderId !== order.id ||
      chargeResult.data.charge.amount !== chargePrepared.charge.amount
    ) {
      await prisma.shopBillingCharge
        .updateMany({
          where: {
            id: chargePrepared.charge.id,
            status: { in: ["REQUESTING", "PENDING", "UNKNOWN"] },
          },
          data: {
            status: "UNKNOWN",
            failureCode:
              !chargeResult.ok && chargeResult.outcome === "REJECTED"
                ? chargeResult.errorCode?.slice(0, 64) ?? "PARTNER_REJECTED"
                : "RESULT_UNCONFIRMED",
            // 명시적 4xx/409는 응답 유실이 아니므로 같은 POST 대사 대상이 아니다.
            // 남은 시도 횟수를 소진해 주문 상세에서 후속 POST를 만들지 못하게 한다.
            ...(!chargeResult.ok && chargeResult.outcome === "REJECTED"
              ? { requestAttempts: 2 }
              : {}),
          },
        })
        .catch(() => undefined);
      return {
        ok: false,
        error: "결제 결과를 확인하지 못했습니다. 중복 결제를 피하려면 주문내역에서 상태를 확인해 주세요.",
        recoveryOrderId: order.id,
      };
    }

    const remoteCharge = chargeResult.data.charge;
    const remoteStatus =
      remoteCharge.status === "PAID" || remoteCharge.status === "DECLINED"
        ? remoteCharge.status
        : remoteCharge.status === "PENDING" || remoteCharge.status === "UNKNOWN"
          ? remoteCharge.status
          : "UNKNOWN";
    const finalized = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `order:${order.id}`);
      await acquireTransactionLock(tx, `billing-method:${chargePrepared.paymentMethod.id}`);
      await acquireTransactionLock(tx, `billing-charge:${chargePrepared.charge.id}`);
      const [currentOrder, currentCharge] = await Promise.all([
        tx.shopOrder.findUnique({ where: { id: order.id } }),
        tx.shopBillingCharge.findUnique({ where: { id: chargePrepared.charge.id } }),
      ]);
      if (
        !currentOrder ||
        !currentCharge ||
        currentOrder.userId !== user.id ||
        currentCharge.userId !== user.id ||
        currentCharge.orderId !== currentOrder.id
      ) {
        return { ok: false as const };
      }
      if (currentOrder.status === "PAID" && currentCharge.status === "PAID") {
        return { ok: true as const, paid: true as const };
      }
      if (
        currentOrder.status !== "PENDING" ||
        currentOrder.approvalNo !== LAONPAY_BILLING_PROCESSING_MARKER ||
        !["REQUESTING", "PENDING", "UNKNOWN"].includes(currentCharge.status)
      ) {
        return { ok: false as const };
      }
      const identifierMismatch =
        (currentCharge.laonpayChargeId !== null &&
          currentCharge.laonpayChargeId !== remoteCharge.id) ||
        (currentCharge.providerPaymentId !== null &&
          currentCharge.providerPaymentId !== remoteCharge.paymentId);
      if (identifierMismatch) {
        await tx.shopBillingCharge.update({
          where: { id: currentCharge.id },
          data: { status: "UNKNOWN", failureCode: "RESULT_ID_MISMATCH" },
        });
        return { ok: false as const };
      }

      const sharedChargeData = {
        laonpayChargeId: remoteCharge.id,
        providerPaymentId: remoteCharge.paymentId,
        failureCode: remoteCharge.error?.code?.slice(0, 64) ?? null,
      };
      if (remoteStatus === "PAID") {
        await tx.shopBillingCharge.update({
          where: { id: currentCharge.id },
          data: { ...sharedChargeData, status: "PAID" },
        });
        await tx.shopOrder.update({
          where: { id: currentOrder.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            approvalNo: null,
            pgTrno: null,
            cardName: `${chargePrepared.paymentMethod.cardName} (LAONPAY 원클릭)`,
          },
        });
        return { ok: true as const, paid: true as const };
      }
      if (remoteStatus === "DECLINED") {
        await tx.shopBillingCharge.update({
          where: { id: currentCharge.id },
          data: { ...sharedChargeData, status: "DECLINED" },
        });
        await tx.shopOrder.update({
          where: { id: currentOrder.id },
          data: { status: "FAILED", approvalNo: null },
        });
        return { ok: true as const, paid: false as const };
      }
      await tx.shopBillingCharge.update({
        where: { id: currentCharge.id },
        data: { ...sharedChargeData, status: remoteStatus },
      });
      return { ok: true as const, paid: false as const };
    }, TX_OPTIONS).catch(() => null);

    if (!finalized) {
      return {
        ok: false,
        error: "결제 상태 저장을 확인하지 못했습니다. 새로 결제하지 말고 주문내역을 확인해 주세요.",
        recoveryOrderId: order.id,
      };
    }
    if (!finalized.ok || !finalized.paid) {
      return {
        ok: false,
        error:
          remoteStatus === "DECLINED"
            ? "등록카드 결제가 거절되었습니다. 주문내역에서 다른 결제수단을 이용해 주세요."
            : "결제 결과를 확인 중입니다. 새로 결제하지 말고 주문내역에서 상태를 확인해 주세요.",
        recoveryOrderId: order.id,
      };
    }
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  // ── 수기결제(구인증) — KSNET WEBFEP /card/pay/oldcert. 카드정보는 즉시 폐기 ──
  if (d.method === "manual") {
    const mc = d.manualCard!;
    // 일반 KSPAY callback과 같은 2단계 처리: 외부 승인 전에 마커를 별도 트랜잭션으로
    // 먼저 커밋한다. timeout/503 또는 승인 후 DB 장애가 나도 같은 주문의 재호출을 막는다.
    const manualPrepared = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `order:${order.id}`);
      const current = await tx.shopOrder.findUnique({ where: { id: order.id }, include: { items: true } });
      if (!current || current.userId !== user.id) return { ok: false as const, error: "주문을 찾을 수 없습니다." };
      if (current.status === "PAID") return { ok: true as const, paid: true as const, order: current };
      if (current.status !== "PENDING") return { ok: false as const, error: "이미 처리된 주문입니다." };
      if (isPaymentProcessingMarker(current.approvalNo)) {
        return { ok: false as const, error: "결제 결과를 확인 중입니다. 잠시 후 주문내역을 확인해 주세요." };
      }
      const inventory = await lockAndValidateInventory(tx, current.items, current.id);
      if (!inventory.ok) {
        await tx.shopOrder.update({ where: { id: current.id }, data: { status: "FAILED" } });
        return inventory;
      }
      const marked = await tx.shopOrder.update({
        where: { id: current.id },
        data: { approvalNo: PAYMENT_PROCESSING_MARKER },
        include: { items: true },
      });
      return { ok: true as const, paid: false as const, order: marked };
    }, TX_OPTIONS).catch(() => null);

    if (!manualPrepared) {
      return { ok: false, error: "결제 상태를 확인하지 못했습니다. 주문내역을 확인해 주세요." };
    }
    if (!manualPrepared.ok) return { ok: false, error: manualPrepared.error };
    if (manualPrepared.paid) return { ok: true, redirect: `/order/${order.id}?receipt=1` };

    const markedOrder = manualPrepared.order;
    const result = await payOldCert({
      orderNumb: markedOrder.moid,
      userName: user.name,
      userEmail: user.email,
      productName: sanitizePgParam(goodsName),
      totalAmount: markedOrder.totalAmount,
      cardNumb: mc.cardNo,
      expiryDate: `${mc.expYy}${mc.expMm}`,
      password2: mc.pw2,
      userInfo: mc.birth6,
      payload: markedOrder.id,
    }).catch(() => ({
      ok: false as const,
      message: "결제 서버 응답을 확인하지 못했습니다. 중복 결제를 피하려면 잠시 후 주문내역을 확인해 주세요.",
      indeterminate: true,
    }));

    // 승인 성립 여부가 불명확하면 처리 마커와 PENDING을 그대로 둔다. 이후 동일 폼 제출과
    // 주문 재결제 모두 마커에서 차단되고 운영 확인 전까지 재고도 계속 예약된다.
    if (result && !result.ok && result.indeterminate) {
      return { ok: false, error: result.message };
    }

    const manualFinalized = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `order:${markedOrder.id}`);
      const current = await tx.shopOrder.findUnique({ where: { id: markedOrder.id } });
      if (!current || current.userId !== user.id) return { ok: false as const, error: "주문을 찾을 수 없습니다." };
      if (current.status === "PAID") return { ok: true as const };
      if (current.status !== "PENDING" || current.approvalNo !== PAYMENT_PROCESSING_MARKER) {
        return { ok: false as const, error: "결제 상태가 변경되었습니다. 주문내역을 확인해 주세요." };
      }

      if (result === null) {
        await tx.shopOrder.update({
          where: { id: current.id },
          data: { status: "FAILED", approvalNo: null },
        });
        return { ok: false as const, error: MANUAL_PAYMENT_DISABLED_MESSAGE };
      }
      if (!result.ok) {
        await tx.shopOrder.update({
          where: { id: current.id },
          data: { status: "FAILED", approvalNo: null },
        });
        return { ok: false as const, error: result.message };
      }
      await tx.shopOrder.update({
        where: { id: current.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          approvalNo: result.approvalNumb,
          pgTrno: result.tid,
          cardName: `${result.cardName} (수기)`,
        },
      });
      return { ok: true as const };
    }, TX_OPTIONS).catch(() => null);

    if (!manualFinalized) {
      return { ok: false, error: "결제 상태를 확인하지 못했습니다. 주문내역을 확인해 주세요." };
    }
    if (!manualFinalized.ok) return { ok: false, error: manualFinalized.error };
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  const base = process.env.SHOP_APP_URL ?? "http://localhost:3003";

  const res = await getPgProvider().createAuthOrder({
    paymentId: order.id, // 패스스루 a = orderId
    payMethod: d.method as "card" | "kakaopay" | "naverpay" | "bank",

    moid: order.moid,
    amount: order.totalAmount,
    goodsName: sanitizePgParam(goodsName),
    ordername: sanitizePgParam(user.name),
    buyerPhone: d.receiverPhone.replace(/\D/g, ""),
    buyerEmail: user.email,
    storeId: "2999199999", // 테스트 MID (실제 sndStoreid는 KSPAY_STORE_ID env 사용)
    returnUrl: `${base}/order/${order.id}`,
    callbackUrl: `${base}/api/pg/kspay/callback`,
    resultToken: createKspayResultToken(order),
  });

  if (res.formAction && res.formFields) {
    return { ok: true, formAction: res.formAction, formFields: res.formFields };
  }
  // 지원하지 않는 PG 응답 — shop은 kspay 폼 전제
  return { ok: false, error: "결제창을 열 수 없습니다. (PG 설정 확인)" };
}

/**
 * 브라우저가 Server Action 응답을 잃었을 때 같은 checkout 멱등키로 만들어진
 * 주문만 읽어 회수한다. 외부 승인·재승인·상태 변경은 수행하지 않는다.
 */
export async function findCheckoutOrderAction(input: {
  idempotencyKey: string;
}): Promise<CheckoutRecoveryResult> {
  const user = await requireShopUser();
  if (!/^[a-f0-9]{64}$/.test(input.idempotencyKey)) return { ok: false };
  const moid = createIdempotentMoid(user.id, input.idempotencyKey);
  const order = await prisma.shopOrder.findFirst({
    where: { moid, userId: user.id },
    select: { id: true },
  });
  return order ? { ok: true, orderId: order.id } : { ok: false };
}
