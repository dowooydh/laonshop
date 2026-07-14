import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { validateKspayApprovalBinding } from "../../lib/kspay/approval-validation";
import { isKspayResultApprovalEnabled, KSPAY_REVIEW_STORE_ID } from "../../lib/kspay/approval-gate";
import { createKspayResultToken, verifyKspayResultToken } from "../../lib/kspay/result-token";

const secret = "test-only-secret-value-at-least-32-characters";
const order = { id: "order-1", moid: "LP-ORDER-1", totalAmount: 45_000 };

test("result 토큰은 주문 ID·주문번호·금액에 모두 결박된다", () => {
  const token = createKspayResultToken(order, secret);
  assert.equal(verifyKspayResultToken(order, token, secret), true);
  assert.equal(verifyKspayResultToken({ ...order, id: "order-2" }, token, secret), false);
  assert.equal(verifyKspayResultToken({ ...order, moid: "LP-ORDER-2" }, token, secret), false);
  assert.equal(verifyKspayResultToken({ ...order, totalAmount: 45_001 }, token, secret), false);
  assert.equal(verifyKspayResultToken(order, `${token.slice(0, -1)}x`, secret), false);
  assert.equal(verifyKspayResultToken(order, "", secret), false);
});

test("성공 승인은 PG 주문번호·금액·승인번호·거래번호가 모두 일치해야 한다", () => {
  const success = {
    success: true,
    moid: order.moid,
    amount: order.totalAmount,
    approvalNo: "APP-1",
    pgTrno: "TRNO-1",
  };
  assert.deepEqual(validateKspayApprovalBinding(order, success), { ok: true });
  assert.equal(validateKspayApprovalBinding(order, { ...success, moid: "OTHER" }).ok, false);
  assert.equal(validateKspayApprovalBinding(order, { ...success, amount: 1 }).ok, false);
  assert.equal(validateKspayApprovalBinding(order, { ...success, approvalNo: "" }).ok, false);
  assert.equal(validateKspayApprovalBinding(order, { ...success, pgTrno: "" }).ok, false);
});

test("거절 결과도 PG 주문번호가 일치할 때만 주문 실패로 확정할 수 있다", () => {
  assert.deepEqual(
    validateKspayApprovalBinding(order, { success: false, moid: order.moid, amount: order.totalAmount }),
    { ok: true },
  );
  assert.equal(validateKspayApprovalBinding(order, { success: false, moid: "OTHER", amount: 0 }).ok, false);
});

test("result route는 주문 상태를 표시하기 전에 HMAC 토큰을 검증한다", () => {
  const source = readFileSync(join(process.cwd(), "app/api/pg/kspay/result/route.ts"), "utf8");
  const verifyIndex = source.indexOf("verifyKspayResultToken(");
  const markerIndex = source.indexOf("approvalNo: PAYMENT_PROCESSING_MARKER");
  const storeGateIndex = source.indexOf("isKspayResultApprovalEnabled(");
  assert.ok(verifyIndex >= 0 && storeGateIndex > verifyIndex && markerIndex > storeGateIndex);
});

test("reHash 주문 결박 규격 전에는 카드사 심사용 테스트 MID만 서버승인한다", () => {
  assert.equal(isKspayResultApprovalEnabled(KSPAY_REVIEW_STORE_ID), true);
  assert.equal(isKspayResultApprovalEnabled("real-mid-not-enabled"), false);
  assert.equal(isKspayResultApprovalEnabled(undefined), false);
});
