import { createHash } from "node:crypto";
import type {
  BillingCharge,
  BillingMethodStatus,
  BillingPaymentMethod,
  BillingRegistrationStatus,
} from "./billing-contract";
import { isLaonpayBillingReady, type LaonpayBillingEnv } from "./billing-client";

export const BILLING_REVIEW_ACCOUNT_EMAIL = "laontest@laontest.com";
export const BILLING_REGISTRATION_COOKIE = "laonshop_billing_registration";
export const BILLING_CHARGE_REQUEST_STALE_MS = 5 * 60 * 1_000;

export function isBillingIntegrationAccount(email: string): boolean {
  return email === BILLING_REVIEW_ACCOUNT_EMAIL;
}

export function isBillingIntegrationEnabled(
  email: string,
  env?: LaonpayBillingEnv,
): boolean {
  return isBillingIntegrationAccount(email) && isLaonpayBillingReady(env);
}

export function billingRequestFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function mapPaymentMethodStatus(status: BillingMethodStatus) {
  return status;
}

export function mapRegistrationStatus(status: BillingRegistrationStatus) {
  return status;
}

export type LocalBillingRegistrationStatus = BillingRegistrationStatus | "REQUESTING";

export function mergeRegistrationStatus(
  local: LocalBillingRegistrationStatus,
  remote: BillingRegistrationStatus,
): LocalBillingRegistrationStatus {
  if (local === "SUCCEEDED" || local === "DECLINED" || local === "EXPIRED") {
    return local;
  }
  // 병렬 상태조회에서 늦게 도착한 PENDING이 PROCESSING을 되돌리지 못하게 한다.
  if (local === "PROCESSING" && remote === "PENDING") return local;
  return remote;
}

export function mapChargeStatus(status: BillingCharge["status"]) {
  return status;
}

export function paymentMethodData(method: BillingPaymentMethod) {
  return {
    laonpayPaymentMethodId: method.id,
    cardName: method.cardName,
    cardLast4: method.cardLast4,
    cardType: method.cardType,
    status: mapPaymentMethodStatus(method.status),
    providerRegisteredAt: new Date(method.registeredAt),
    providerVerifiedAt: method.verifiedAt ? new Date(method.verifiedAt) : null,
    providerDeregisteredAt: method.deregisteredAt ? new Date(method.deregisteredAt) : null,
  } as const;
}

export function paymentMethodSyncData(
  method: BillingPaymentMethod,
  local:
    | {
        status: BillingMethodStatus;
        deregisterIdempotencyKey: string | null;
      }
    | null,
) {
  const remote = paymentMethodData(method);
  if (local?.status === "DEREGISTERED") return {};
  if (
    local?.deregisterIdempotencyKey &&
    method.status === "ACTIVE" &&
    (local.status === "DEREGISTERING" || local.status === "UNKNOWN")
  ) {
    // 해지 결과를 대사 중인 카드는 지연된 ACTIVE 목록/등록 응답만으로 재활성화하지 않는다.
    return { ...remote, status: local.status };
  }
  return remote;
}

export function orderGoodsName(items: Array<{ name: string }>): string {
  if (items.length === 0) throw new Error("주문 상품이 없습니다.");
  return (items.length === 1 ? items[0].name : `${items[0].name} 외 ${items.length - 1}건`).slice(0, 50);
}

export function calculateOrderAmount(items: Array<{ price: number; qty: number }>): number {
  const amount = items.reduce((sum, item) => {
    const line = item.price * item.qty;
    if (!Number.isSafeInteger(line) || line <= 0) throw new Error("주문 금액을 계산할 수 없습니다.");
    return sum + line;
  }, 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("주문 금액을 계산할 수 없습니다.");
  return amount;
}

export function canSelectPaymentMethod(status: BillingMethodStatus): boolean {
  return status === "ACTIVE";
}

export function isBillingChargeInFlight(status: BillingCharge["status"] | "REQUESTING"): boolean {
  return status === "REQUESTING" || status === "PENDING" || status === "UNKNOWN";
}

export type LocalBillingChargeStatus =
  | "REQUESTING"
  | "PENDING"
  | "PAID"
  | "DECLINED"
  | "UNKNOWN"
  | "CANCEL_REQUESTED"
  | "CANCELED";

export type BillingChargeLedgerSnapshot = {
  userId: string;
  orderId: string;
  paymentMethodId: string;
  amount: number;
  requestFingerprint: string;
  status: LocalBillingChargeStatus;
  requestAttempts: number;
  laonpayChargeId: string | null;
  providerPaymentId: string | null;
};

export type BillingChargeLedgerExpectation = {
  userId: string;
  orderId: string;
  paymentMethodId: string;
  amount: number;
  requestFingerprint: string;
};

export type BillingChargeLedgerDecision =
  | { kind: "READY" }
  | {
      kind: "CLOSE_LOCAL";
      failureCode: "LOCAL_AMOUNT_CHANGED" | "LOCAL_REQUEST_CHANGED";
    }
  | { kind: "BLOCK" };

export function isProvablyLocalBillingCharge(
  charge: BillingChargeLedgerSnapshot,
): boolean {
  return (
    charge.status === "REQUESTING" &&
    charge.requestAttempts === 0 &&
    charge.laonpayChargeId === null &&
    charge.providerPaymentId === null
  );
}

export function decideBillingChargeLedger(
  charge: BillingChargeLedgerSnapshot,
  expected: BillingChargeLedgerExpectation,
): BillingChargeLedgerDecision {
  if (
    charge.userId !== expected.userId ||
    charge.orderId !== expected.orderId ||
    charge.paymentMethodId !== expected.paymentMethodId
  ) {
    return { kind: "BLOCK" };
  }
  if (!isBillingChargeInFlight(charge.status)) {
    return { kind: "BLOCK" };
  }

  const amountChanged = charge.amount !== expected.amount;
  const requestChanged = charge.requestFingerprint !== expected.requestFingerprint;
  if (amountChanged || requestChanged) {
    if (!isProvablyLocalBillingCharge(charge)) return { kind: "BLOCK" };
    return {
      kind: "CLOSE_LOCAL",
      failureCode: amountChanged ? "LOCAL_AMOUNT_CHANGED" : "LOCAL_REQUEST_CHANGED",
    };
  }

  if (charge.laonpayChargeId !== null || charge.providerPaymentId !== null) {
    return { kind: "BLOCK" };
  }
  if (!Number.isInteger(charge.requestAttempts) || charge.requestAttempts < 0) {
    return { kind: "BLOCK" };
  }
  if (charge.status === "REQUESTING") {
    // attempts=1은 최초 외부 POST가 아직 진행 중일 수 있다. 그 응답이 실제로
    // 불명확하다고 UNKNOWN으로 기록되기 전에는 reconciliation claim을 허용하지 않는다.
    return charge.requestAttempts === 0 ? { kind: "READY" } : { kind: "BLOCK" };
  }
  // 외부 ID를 받지 못한 명시적 UNKNOWN 상태에서만 같은 멱등키·동일 본문
  // reconciliation 1회를 허용한다. ID 없는 PENDING은 정상 계약 상태가 아니다.
  return charge.status === "UNKNOWN" && charge.requestAttempts === 1
    ? { kind: "READY" }
    : { kind: "BLOCK" };
}

export function canClaimBillingChargeAttempt(
  charge: BillingChargeLedgerSnapshot,
  expected: BillingChargeLedgerExpectation,
  expectedAttempt: number,
): boolean {
  return (
    (expectedAttempt === 0 || expectedAttempt === 1) &&
    charge.requestAttempts === expectedAttempt &&
    decideBillingChargeLedger(charge, expected).kind === "READY"
  );
}

export function canRecoverStaleBillingChargeRequest(
  charge: Pick<
    BillingChargeLedgerSnapshot,
    "status" | "requestAttempts" | "laonpayChargeId" | "providerPaymentId"
  > & { updatedAt: Date },
  nowMs = Date.now(),
): boolean {
  return (
    charge.status === "REQUESTING" &&
    charge.requestAttempts === 1 &&
    charge.laonpayChargeId === null &&
    charge.providerPaymentId === null &&
    Number.isFinite(nowMs) &&
    charge.updatedAt.getTime() <= nowMs - BILLING_CHARGE_REQUEST_STALE_MS
  );
}
