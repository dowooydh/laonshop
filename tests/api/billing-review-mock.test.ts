import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  BILLING_REVIEW_ACCOUNT_EMAIL,
  createBillingReviewSnapshot,
  isBillingReviewAccount,
  parseBillingReviewSnapshot,
  serializeBillingReviewSnapshot,
} from "../../lib/billing-review-mock";

test("카드 등록 시연은 지정 계정과 정확히 일치할 때만 연다", () => {
  assert.equal(isBillingReviewAccount(BILLING_REVIEW_ACCOUNT_EMAIL), true);
  assert.equal(isBillingReviewAccount("LAONTEST@LAONTEST.COM"), false);
  assert.equal(isBillingReviewAccount(" laontest@laontest.com"), false);
  assert.equal(isBillingReviewAccount("laontest@laontest.com.evil"), false);
  assert.equal(isBillingReviewAccount("laontest@laonshop.com"), false);
});

test("시연 스냅샷에는 고정 마스킹 번호와 등록일만 직렬화한다", () => {
  const snapshot = createBillingReviewSnapshot(new Date(2026, 6, 16, 12, 0, 0));

  assert.deepEqual(snapshot, {
    version: 1,
    maskedCardNumb: "•••• •••• •••• 1234",
    dateLabel: "2026. 07. 16.",
  });
  assert.deepEqual(Object.keys(snapshot).sort(), ["dateLabel", "maskedCardNumb", "version"]);
  assert.deepEqual(parseBillingReviewSnapshot(serializeBillingReviewSnapshot(snapshot)), snapshot);
});

test("깨지거나 변조된 브라우저 시연 데이터는 모두 폐기한다", () => {
  assert.equal(parseBillingReviewSnapshot(null), null);
  assert.equal(parseBillingReviewSnapshot("{"), null);
  assert.equal(parseBillingReviewSnapshot("[]"), null);
  assert.equal(parseBillingReviewSnapshot(JSON.stringify({ version: 1 })), null);
  assert.equal(
    parseBillingReviewSnapshot(
      JSON.stringify({ version: 1, maskedCardNumb: "•••• •••• •••• 9999", dateLabel: "2026. 07. 16." }),
    ),
    null,
  );
  assert.equal(
    parseBillingReviewSnapshot(
      JSON.stringify({
        version: 1,
        maskedCardNumb: "•••• •••• •••• 1234",
        dateLabel: "2026. 07. 16.",
        extra: true,
      }),
    ),
    null,
  );
});

test("시연 컴포넌트는 클라이언트 표시만 바꾸고 결제·저장 서버 경계를 건드리지 않는다", () => {
  const component = readFileSync(join(process.cwd(), "app/mypage/settings/billing-card-review-mock.tsx"), "utf8");
  const page = readFileSync(join(process.cwd(), "app/mypage/settings/page.tsx"), "utf8");
  const actions = readFileSync(join(process.cwd(), "app/mypage/actions.ts"), "utf8");

  assert.match(page, /const reviewMockupEnabled = isBillingReviewAccount\(user\.email\)/);
  assert.match(page, /reviewMockupEnabled=\{reviewMockupEnabled\}/);
  assert.match(component, /window\.sessionStorage/);
  assert.match(component, /readOnly/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.doesNotMatch(component, /\bfetch\s*\(|\bFormData\b|\blocalStorage\b|document\.cookie|console\./);
  assert.doesNotMatch(component, /billingToken|paymentMethodId|registerBillingCardAction|action\s*=/);
  assert.doesNotMatch(component, /name=["'](?:cardNo|expMm|expYy|pw2|birth6)["']/);
  assert.doesNotMatch(actions, /registerBillingCardAction|formData\.get\(["']cardNo["']\)|const billingToken/);
});
