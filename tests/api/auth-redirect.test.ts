import assert from "node:assert/strict";
import test from "node:test";

import { safeLoginReturnTarget } from "../../lib/auth-redirect";

test("구매후기 로그인 복귀는 상품 상세의 고정 후기 앵커만 허용한다", () => {
  assert.equal(safeLoginReturnTarget("/product/product_123#reviews"), "/product/product_123#reviews");
  for (const target of ["/product/product_123#other", "/product/product_123?next=/admin#reviews", "/product/../admin#reviews", "/product/%2e%2e#reviews", "//attacker.invalid/product/item#reviews", "/product/item/extra#reviews"]) {
    assert.equal(safeLoginReturnTarget(target), null, target);
  }
});

test("로그인 후 복귀는 정확한 빌링 return 경로와 허용된 query만 유지한다", () => {
  const target =
    "/mypage/settings/billing/return?billingRegistrationId=registration_123&billingStatus=processing";
  assert.equal(safeLoginReturnTarget(target), target);
  assert.equal(
    safeLoginReturnTarget(
      "/mypage/settings/billing/return?billingRegistrationId=registration_123",
    ),
    "/mypage/settings/billing/return?billingRegistrationId=registration_123",
  );
});

test("외부·중복·추가 query 로그인 복귀는 fail-closed 처리한다", () => {
  for (const target of [
    "https://attacker.invalid/mypage/settings/billing/return?billingRegistrationId=registration_123",
    "//attacker.invalid/mypage/settings/billing/return?billingRegistrationId=registration_123",
    "/mypage/settings?billingRegistrationId=registration_123",
    "/mypage/settings/billing/return?billingRegistrationId=short",
    "/mypage/settings/billing/return?billingRegistrationId=registration_123&billingStatus=paid",
    "/mypage/settings/billing/return?billingRegistrationId=registration_123&next=%2Fadmin",
    "/mypage/settings/billing/return?billingRegistrationId=registration_123&billingRegistrationId=registration_456",
    "/mypage/settings/billing/return?billingRegistrationId=registration_123&billingStatus=pending&billingStatus=unknown",
    "/mypage/settings/billing/return?billingRegistrationId=registration_123#fragment",
  ]) {
    assert.equal(safeLoginReturnTarget(target), null, target);
  }
});
