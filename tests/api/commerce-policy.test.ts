import assert from "node:assert/strict";
import test from "node:test";
import { canFulfilOrder, isMissingCommerceTable, maskReviewAuthor, validShipmentInput } from "../../lib/commerce/policy";

test("배송은 실제 결제 완료 후에만 기록하며 시연·미확정 주문을 제외한다", () => {
  const paid = { status: "PAID", approvalNo: null, paidAt: new Date() };
  assert.equal(canFulfilOrder(paid), true); // 등록카드는 PG 승인번호를 라온샵에 저장하지 않는다.
  for (const status of ["PENDING", "FAILED", "CANCEL_REQUESTED", "CANCELED"]) {
    assert.equal(canFulfilOrder({ ...paid, status }), false, status);
  }
  for (const approvalNo of ["DEMO-123", "__KSPAY_PROCESSING__", "__LAONPAY_BILLING_PROCESSING__"]) {
    assert.equal(canFulfilOrder({ ...paid, approvalNo }), false, approvalNo);
  }
  assert.equal(canFulfilOrder({ ...paid, paidAt: null }), false);
});

test("송장은 허용된 택배사와 숫자만 허용하고 링크·주입값을 거절한다", () => {
  assert.equal(validShipmentInput("CJ", "123456789012"), true);
  for (const tracking of ["", "1234567", "1".repeat(21), "https://example.com", "javascript:alert(1)", "12345678/evil", "12345678\n"]) {
    assert.equal(validShipmentInput("CJ", tracking), false, tracking);
  }
  assert.equal(validShipmentInput("CUSTOM_URL", "123456789012"), false);
});

test("공개 후기 작성자명은 첫 글자만 노출한다", () => {
  assert.equal(maskReviewAuthor("유동혁"), "유**");
  assert.equal(maskReviewAuthor("  김  "), "김**");
  assert.equal(maskReviewAuthor(""), "구매자");
  assert.equal(maskReviewAuthor("🧵Buyer"), "🧵**");
});

test("테이블 부재만 준비 중으로 분류하며 권한·연결·컬럼 오류는 숨기지 않는다", () => {
  assert.equal(isMissingCommerceTable({ code: "P2021" }), true);
  assert.equal(isMissingCommerceTable({ code: "42P01" }), true);
  assert.equal(isMissingCommerceTable({ code: "P2010", meta: { code: "42P01" } }), true);
  assert.equal(isMissingCommerceTable({ code: "P2010", meta: { code: "42501" } }), false);
  for (const code of ["P2022", "P1001", "42501", "P2002"]) {
    assert.equal(isMissingCommerceTable({ code }), false, code);
  }
  assert.equal(isMissingCommerceTable(new Error("schema unavailable")), false);
});
