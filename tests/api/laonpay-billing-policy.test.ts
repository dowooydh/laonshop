import assert from "node:assert/strict";
import test from "node:test";

import {
  BILLING_CHARGE_REQUEST_STALE_MS,
  canRecoverStaleBillingChargeRequest,
  canClaimBillingChargeAttempt,
  decideBillingChargeLedger,
  type BillingChargeLedgerSnapshot,
} from "../../lib/laonpay/billing-policy";

const expected = {
  userId: "user-1",
  orderId: "order-1",
  paymentMethodId: "method-1",
  amount: 39_000,
  requestFingerprint: "a".repeat(64),
} as const;

function charge(
  overrides: Partial<BillingChargeLedgerSnapshot> = {},
): BillingChargeLedgerSnapshot {
  return {
    ...expected,
    status: "REQUESTING",
    requestAttempts: 0,
    laonpayChargeId: null,
    providerPaymentId: null,
    ...overrides,
  };
}

test("빌링 청구 claim은 최초 요청과 명시적 UNKNOWN reconciliation만 허용한다", () => {
  const allowed: BillingChargeLedgerSnapshot[] = [
    charge({ status: "REQUESTING", requestAttempts: 0 }),
    charge({ status: "UNKNOWN", requestAttempts: 1 }),
  ];
  for (const snapshot of allowed) {
    assert.deepEqual(decideBillingChargeLedger(snapshot, expected), { kind: "READY" });
    assert.equal(
      canClaimBillingChargeAttempt(snapshot, expected, snapshot.requestAttempts),
      true,
    );
    assert.equal(
      canClaimBillingChargeAttempt(snapshot, expected, snapshot.requestAttempts === 0 ? 1 : 0),
      false,
    );
  }

  for (const snapshot of [
    charge({ requestAttempts: -1 }),
    charge({ requestAttempts: 2 }),
    charge({ status: "REQUESTING", requestAttempts: 1 }),
    charge({ status: "PENDING", requestAttempts: 0 }),
    charge({ status: "PENDING", requestAttempts: 1 }),
    charge({ status: "UNKNOWN", requestAttempts: 0 }),
    charge({ status: "PAID", requestAttempts: 1 }),
    charge({ status: "DECLINED", requestAttempts: 0 }),
    charge({ status: "CANCEL_REQUESTED", requestAttempts: 1 }),
    charge({ status: "CANCELED", requestAttempts: 1 }),
  ]) {
    assert.deepEqual(decideBillingChargeLedger(snapshot, expected), { kind: "BLOCK" });
    assert.equal(canClaimBillingChargeAttempt(snapshot, expected, 0), false);
    assert.equal(canClaimBillingChargeAttempt(snapshot, expected, 1), false);
  }
});

test("feature kill switch는 최초 청구만 막고 UNKNOWN 동일요청 대사는 유지한다", () => {
  assert.equal(
    canClaimBillingChargeAttempt(
      charge({ status: "REQUESTING", requestAttempts: 0 }),
      expected,
      0,
      false,
    ),
    false,
  );
  assert.equal(
    canClaimBillingChargeAttempt(
      charge({ status: "UNKNOWN", requestAttempts: 1 }),
      expected,
      1,
      false,
    ),
    true,
  );
});

test("진행 중 첫 청구는 5분이 지난 provider ID 없는 원장만 복구할 수 있다", () => {
  const nowMs = Date.UTC(2026, 6, 19, 12, 0, 0);
  const staleCharge = {
    status: "REQUESTING" as const,
    requestAttempts: 1,
    laonpayChargeId: null,
    providerPaymentId: null,
    updatedAt: new Date(nowMs - BILLING_CHARGE_REQUEST_STALE_MS),
  };

  assert.equal(canRecoverStaleBillingChargeRequest(staleCharge, nowMs), true);
  assert.equal(
    canRecoverStaleBillingChargeRequest(
      {
        ...staleCharge,
        updatedAt: new Date(
          nowMs - BILLING_CHARGE_REQUEST_STALE_MS + 1,
        ),
      },
      nowMs,
    ),
    false,
  );

  for (const snapshot of [
    { ...staleCharge, status: "UNKNOWN" as const },
    { ...staleCharge, requestAttempts: 0 },
    { ...staleCharge, requestAttempts: 2 },
    { ...staleCharge, laonpayChargeId: "charge-remote" },
    { ...staleCharge, providerPaymentId: "payment-remote" },
  ]) {
    assert.equal(canRecoverStaleBillingChargeRequest(snapshot, nowMs), false);
  }
});

test("소유권·주문·결제수단·provider 식별자가 달라지면 외부 POST를 차단한다", () => {
  const blocked: BillingChargeLedgerSnapshot[] = [
    charge({ userId: "user-2" }),
    charge({ orderId: "order-2" }),
    charge({ paymentMethodId: "method-2" }),
    charge({ laonpayChargeId: "charge-remote" }),
    charge({ providerPaymentId: "payment-remote" }),
  ];
  for (const snapshot of blocked) {
    assert.deepEqual(decideBillingChargeLedger(snapshot, expected), { kind: "BLOCK" });
    assert.equal(
      canClaimBillingChargeAttempt(snapshot, expected, snapshot.requestAttempts),
      false,
    );
  }
});

test("외부 미호출이 확실한 payload 불일치만 로컬 원장을 종료한다", () => {
  assert.deepEqual(
    decideBillingChargeLedger(charge({ amount: expected.amount + 1 }), expected),
    { kind: "CLOSE_LOCAL", failureCode: "LOCAL_AMOUNT_CHANGED" },
  );
  assert.deepEqual(
    decideBillingChargeLedger(
      charge({ requestFingerprint: "b".repeat(64) }),
      expected,
    ),
    { kind: "CLOSE_LOCAL", failureCode: "LOCAL_REQUEST_CHANGED" },
  );

  for (const snapshot of [
    charge({ amount: expected.amount + 1, requestAttempts: 1 }),
    charge({
      requestFingerprint: "b".repeat(64),
      laonpayChargeId: "charge-remote",
    }),
    charge({
      amount: expected.amount + 1,
      providerPaymentId: "payment-remote",
    }),
    charge({
      status: "UNKNOWN",
      requestAttempts: 1,
      requestFingerprint: "b".repeat(64),
    }),
  ]) {
    assert.deepEqual(decideBillingChargeLedger(snapshot, expected), { kind: "BLOCK" });
  }
});
