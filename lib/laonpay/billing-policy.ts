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
