import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_PAYMENT_REVIEW_DELAY_MS,
  isPaymentReviewReady,
  isPaymentReviewRequired,
  preparePaymentResolution,
} from "../../lib/admin-order";
import { PAYMENT_PROCESSING_MARKER } from "../../lib/order-guard";

const markerAt = new Date("2026-07-11T03:04:05.000Z");
const reviewAt = new Date(markerAt.getTime() + ADMIN_PAYMENT_REVIEW_DELAY_MS);
const reviewOrder = {
  status: "PENDING",
  approvalNo: PAYMENT_PROCESSING_MARKER,
  totalAmount: 45_000,
  updatedAt: markerAt,
};

test("PENDING 처리 마커 주문만 관리자 결제 확인 대상이다", () => {
  assert.equal(isPaymentReviewRequired("PENDING", PAYMENT_PROCESSING_MARKER), true);
  assert.equal(isPaymentReviewRequired("PENDING", null), false);
  assert.equal(isPaymentReviewRequired("FAILED", PAYMENT_PROCESSING_MARKER), false);
  assert.equal(isPaymentReviewRequired("PAID", PAYMENT_PROCESSING_MARKER), false);
  assert.equal(isPaymentReviewRequired("CANCEL_REQUESTED", PAYMENT_PROCESSING_MARKER), false);
  assert.equal(isPaymentReviewRequired("CANCELED", PAYMENT_PROCESSING_MARKER), false);
});

test("PG 요청 후 5분 보호 구간이 끝나야 관리자 확정이 가능하다", () => {
  const justBefore = new Date(reviewAt.getTime() - 1);
  assert.equal(isPaymentReviewReady("PENDING", PAYMENT_PROCESSING_MARKER, markerAt, justBefore), false);
  assert.equal(isPaymentReviewReady("PENDING", PAYMENT_PROCESSING_MARKER, markerAt, reviewAt), true);

  const result = preparePaymentResolution(
    reviewOrder,
    { decision: "FAILED", reason: "KSTA 승인 내역 없음" },
    justBefore,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /자동 처리/);
});

test("KSTA 금액과 승인번호로 결제완료 확정 데이터를 만든다", () => {
  const result = preparePaymentResolution(
    reviewOrder,
    {
      decision: "PAID",
      confirmedAmount: 45_000,
      approvalNo: "12345678",
      pgTrno: "PG-TRANSACTION-1",
      cardName: "신한카드",
      reason: "KSTA에서 승인 내역 확인",
    },
    reviewAt,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.orderData, {
    status: "PAID",
    approvalNo: "12345678",
    pgTrno: "PG-TRANSACTION-1",
    cardName: "신한카드",
    paidAt: markerAt,
  });
  assert.equal(result.auditData.action, "PAYMENT_CONFIRMED_PAID");
  assert.equal(result.auditData.confirmedAmount, 45_000);
});

test("KSTA 승인 금액이 주문 금액과 다르면 결제완료 확정을 거부한다", () => {
  const result = preparePaymentResolution(
    reviewOrder,
    {
      decision: "PAID",
      confirmedAmount: 44_000,
      approvalNo: "12345678",
      pgTrno: "PG-TRANSACTION-2",
      cardName: null,
      reason: "KSTA에서 승인 내역 확인",
    },
    reviewAt,
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /금액/);
});

test("실제 승인번호와 충분한 확인 메모가 없으면 확정을 거부한다", () => {
  const markerApproval = preparePaymentResolution(
    reviewOrder,
    {
      decision: "PAID",
      confirmedAmount: 45_000,
      approvalNo: PAYMENT_PROCESSING_MARKER,
      pgTrno: "PG-TRANSACTION-3",
      cardName: null,
      reason: "KSTA 승인 확인",
    },
    reviewAt,
  );
  assert.equal(markerApproval.ok, false);

  const missingPgTransaction = preparePaymentResolution(
    reviewOrder,
    {
      decision: "PAID",
      confirmedAmount: 45_000,
      approvalNo: "12345678",
      pgTrno: "",
      cardName: null,
      reason: "KSTA 승인 확인",
    },
    reviewAt,
  );
  assert.equal(missingPgTransaction.ok, false);

  const shortReason = preparePaymentResolution(
    reviewOrder,
    { decision: "FAILED", reason: "없음" },
    reviewAt,
  );
  assert.equal(shortReason.ok, false);
});

test("미승인 확인은 결제 필드를 지우고 실패 상태로 전환한다", () => {
  const result = preparePaymentResolution(
    reviewOrder,
    { decision: "FAILED", reason: "KSTA에 승인 내역 없음" },
    reviewAt,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.orderData, {
    status: "FAILED",
    approvalNo: null,
    pgTrno: null,
    cardName: null,
    paidAt: null,
  });
  assert.equal(result.auditData.action, "PAYMENT_CONFIRMED_FAILED");
  assert.equal(result.auditData.confirmedAmount, null);
});

test("이미 확정된 주문과 일반 결제대기 주문은 재처리하지 않는다", () => {
  for (const order of [
    { ...reviewOrder, status: "PAID", approvalNo: "12345678" },
    { ...reviewOrder, status: "FAILED", approvalNo: null },
    { ...reviewOrder, status: "PENDING", approvalNo: null },
  ]) {
    const result = preparePaymentResolution(
      order,
      { decision: "FAILED", reason: "중복 처리 시도" },
      reviewAt,
    );
    assert.equal(result.ok, false);
  }
});
