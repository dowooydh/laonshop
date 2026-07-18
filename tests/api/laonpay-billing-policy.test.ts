import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("빌링 청구 claim은 최초 요청과 동일 본문 reconciliation 한 번만 허용한다", () => {
  const allowed: BillingChargeLedgerSnapshot[] = [
    charge({ status: "REQUESTING", requestAttempts: 0 }),
    charge({ status: "REQUESTING", requestAttempts: 1 }),
    charge({ status: "PENDING", requestAttempts: 1 }),
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
    charge({ status: "PENDING", requestAttempts: 0 }),
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
