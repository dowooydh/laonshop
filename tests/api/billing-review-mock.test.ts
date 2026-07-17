import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  BILLING_REVIEW_ACCOUNT_EMAIL,
  BILLING_REVIEW_CHARGE_AMOUNT,
  chargeBillingReviewCard,
  createBillingReviewPaymentMethodId,
  createBillingReviewRequestId,
  createBillingReviewSnapshot,
  deregisterBillingReviewCard,
  isBillingReviewAccount,
  parseBillingReviewSnapshot,
  queryBillingReviewCard,
  serializeBillingReviewSnapshot,
  type BillingReviewChargeOutcome,
} from "../../lib/billing-review-mock";

const PAYMENT_METHOD_ID = "pm_11111111111141118111111111111111";
const REQUEST_ID = "req_22222222222242228222222222222222";

test("카드 등록 시연은 지정 계정과 정확히 일치할 때만 연다", () => {
  assert.equal(isBillingReviewAccount(BILLING_REVIEW_ACCOUNT_EMAIL), true);
  assert.equal(isBillingReviewAccount("LAONTEST@LAONTEST.COM"), false);
  assert.equal(isBillingReviewAccount(" laontest@laontest.com"), false);
  assert.equal(isBillingReviewAccount("laontest@laontest.com.evil"), false);
  assert.equal(isBillingReviewAccount("laontest@laonshop.com"), false);
});

test("불투명 결제수단 ID는 충돌을 재생성하고 기존 ID를 덮어쓰지 않는다", () => {
  const candidates = [
    "11111111-1111-4111-8111-111111111111",
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  const existing = new Set([PAYMENT_METHOD_ID]);

  assert.equal(
    createBillingReviewPaymentMethodId(() => candidates.shift() ?? "", existing),
    "pm_22222222222242228222222222222222",
  );
  assert.throws(
    () => createBillingReviewPaymentMethodId(() => "11111111-1111-4111-8111-111111111111", existing),
    /안전하게 생성하지 못했습니다/,
  );
  assert.deepEqual([...existing], [PAYMENT_METHOD_ID]);
});

test("등록→조회→billing pay→해지는 한 결제수단 상태로 멱등 수렴한다", () => {
  const registered = createBillingReviewSnapshot(PAYMENT_METHOD_ID, new Date("2026-07-16T12:00:00.000Z"));
  assert.equal(registered.queryStatus, "NOT_REQUESTED");

  const queried = queryBillingReviewCard(registered);
  assert.equal(queried.queryStatus, "FOUND");
  assert.strictEqual(queryBillingReviewCard(queried), queried);

  const charged = chargeBillingReviewCard(queried, "success", REQUEST_ID);
  assert.equal(charged.chargeStatus, "SUCCEEDED");
  assert.equal(charged.chargeAmount, BILLING_REVIEW_CHARGE_AMOUNT);
  assert.equal(charged.chargeRequestId, REQUEST_ID);
  assert.strictEqual(chargeBillingReviewCard(charged, "success", "req_33333333333343338333333333333333"), charged);

  const deregistered = deregisterBillingReviewCard(charged);
  assert.equal(deregistered.cardStatus, "DEREGISTERED");
  assert.equal(deregistered.queryStatus, "NOT_FOUND");
  assert.strictEqual(deregisterBillingReviewCard(deregistered), deregistered);
  assert.strictEqual(queryBillingReviewCard(deregistered), deregistered);
  assert.throws(() => chargeBillingReviewCard(deregistered, "success", REQUEST_ID), /해지된 결제수단/);
});

test("명시적 거절과 결과미상을 구분하고 결과미상은 재결제·해지를 차단한다", () => {
  const queried = queryBillingReviewCard(createBillingReviewSnapshot(PAYMENT_METHOD_ID));
  assert.throws(
    () => chargeBillingReviewCard(queried, "unexpected" as BillingReviewChargeOutcome, REQUEST_ID),
    /결제 결과가 올바르지 않습니다/,
  );
  const declined = chargeBillingReviewCard(queried, "declined", REQUEST_ID);
  assert.equal(declined.chargeStatus, "DECLINED");
  assert.equal(deregisterBillingReviewCard(declined).cardStatus, "DEREGISTERED");

  const pending = chargeBillingReviewCard(queried, "indeterminate", REQUEST_ID);
  assert.equal(pending.chargeStatus, "PENDING_REVIEW");
  assert.strictEqual(
    chargeBillingReviewCard(pending, "success", "req_33333333333343338333333333333333"),
    pending,
  );
  assert.throws(() => deregisterBillingReviewCard(pending), /확인 대기 중/);
});

test("시연 스냅샷은 불투명 ID·카드사·끝 4자리와 비민감 상태만 직렬화한다", () => {
  const snapshot = chargeBillingReviewCard(
    queryBillingReviewCard(createBillingReviewSnapshot(PAYMENT_METHOD_ID, new Date("2026-07-16T12:00:00.000Z"))),
    "success",
    createBillingReviewRequestId(() => "22222222-2222-4222-8222-222222222222"),
  );
  const serialized = serializeBillingReviewSnapshot(snapshot);

  assert.deepEqual(parseBillingReviewSnapshot(serialized), snapshot);
  assert.deepEqual(Object.keys(JSON.parse(serialized)).sort(), [
    "cardIssuer",
    "cardLast4",
    "cardStatus",
    "chargeAmount",
    "chargeRequestId",
    "chargeStatus",
    "paymentMethodId",
    "queryStatus",
    "registeredAt",
    "version",
  ]);
  assert.doesNotMatch(serialized, /billingToken|cardNumb|expiry|password|userInfo|pgapi|authorization|\"tid\"/i);
});

test("깨지거나 변조된 브라우저 시연 데이터는 모두 폐기한다", () => {
  const valid = createBillingReviewSnapshot(PAYMENT_METHOD_ID);
  assert.equal(parseBillingReviewSnapshot(null), null);
  assert.equal(parseBillingReviewSnapshot("{"), null);
  assert.equal(parseBillingReviewSnapshot("[]"), null);
  assert.equal(parseBillingReviewSnapshot(JSON.stringify({ ...valid, version: 1 })), null);
  assert.equal(parseBillingReviewSnapshot(JSON.stringify({ ...valid, cardLast4: "9999" })), null);
  assert.equal(parseBillingReviewSnapshot(JSON.stringify({ ...valid, registeredAt: "0" })), null);
  assert.equal(parseBillingReviewSnapshot(JSON.stringify({ ...valid, queryStatus: "NOT_FOUND" })), null);
  assert.equal(
    parseBillingReviewSnapshot(
      JSON.stringify({
        ...valid,
        chargeStatus: "SUCCEEDED",
        chargeAmount: BILLING_REVIEW_CHARGE_AMOUNT,
        chargeRequestId: REQUEST_ID,
      }),
    ),
    null,
  );
  assert.equal(parseBillingReviewSnapshot(JSON.stringify({ ...valid, extra: true })), null);
});

test("시연 컴포넌트는 결제 생명주기 UI만 바꾸고 PG·DB·주문 경계를 건드리지 않는다", () => {
  const component = readFileSync(join(process.cwd(), "app/mypage/settings/billing-card-review-mock.tsx"), "utf8");
  const registrationHandler = component.slice(
    component.indexOf("const registerPreview"),
    component.indexOf("const queryPreview"),
  );
  const backdrop = component.slice(
    component.indexOf('<div\n            className="absolute inset-0 bg-void/80 backdrop-blur-sm"'),
    component.indexOf("<div\n            ref={dialogRef}"),
  );
  const dismissInputGuard = component.slice(
    component.indexOf("data-billing-dismiss-input-guard"),
    component.indexOf("{open ?"),
  );
  const escapeHandler = component.slice(
    component.indexOf('if (event.key === "Escape")'),
    component.indexOf('if (event.key !== "Tab"'),
  );
  const page = readFileSync(join(process.cwd(), "app/mypage/settings/page.tsx"), "utf8");
  const actions = readFileSync(join(process.cwd(), "app/mypage/actions.ts"), "utf8");

  assert.match(page, /const reviewMockupEnabled = isBillingReviewAccount\(user\.email\)/);
  assert.match(page, /reviewChargeAmount=\{BILLING_REVIEW_CHARGE_AMOUNT\}/);
  assert.match(component, /window\.sessionStorage/);
  assert.match(component, /readOnly/);
  assert.match(component, /billing\/pay 시연/);
  assert.match(component, /자동 재시도하지 않습니다/);
  assert.match(component, /LAONPAY 관리자 전체취소/);
  assert.match(component, /registrationLockedRef/);
  assert.match(component, /focusFlowAfterCloseRef/);
  assert.match(component, /focusFlowAfterCloseRef\.current \? flowRef\.current : fallback/);
  assert.match(component, /restoreFocusAfterClose\(previouslyFocused\)/);
  assert.match(component, /const DISMISS_INPUT_GUARD_MS = 700/);
  assert.match(component, /const closeWithInputGuard = useCallback/);
  assert.match(component, /type BillingReviewModalPhase = "closed" \| "open" \| "dismiss-input-guard"/);
  assert.match(component, /setModalPhase\("dismiss-input-guard"\)/);
  assert.match(component, /phase === "dismiss-input-guard" \? "closed" : phase/);
  assert.match(component, /window\.clearTimeout\(dismissInputGuardTimerRef\.current\)/);
  assert.match(component, /clearDismissInputGuardTimer\(\);\s*setActionError\(null\);\s*setModalPhase\("open"\)/);
  assert.match(component, /\(\) => \(\) => clearDismissInputGuardTimer\(\)/);
  assert.match(registrationHandler, /if \(snapshot\)[\s\S]*if \(registrationLockedRef\.current\)/);
  assert.match(registrationHandler, /if \(snapshot\) \{\s*closeWithInputGuard\(\);/);
  assert.match(registrationHandler, /persist\([\s\S]*false,[\s\S]*\);/);
  assert.doesNotMatch(registrationHandler, /persist\([\s\S]*\);\s*close\(\)/);
  assert.match(component, /카드 등록 시연을 완료했습니다\. 아래 버튼으로 등록 화면을 닫은 뒤 조회를 이어갈 수 있습니다\./);
  assert.match(component, /chargeLockedRef/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(escapeHandler, /close\(\)/);
  assert.doesNotMatch(escapeHandler, /closeWithInputGuard/);
  assert.match(backdrop, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(backdrop, /onClick=\{closeWithInputGuard\}/);
  assert.doesNotMatch(backdrop, /onMouseDown=\{close\}/);
  assert.equal(component.match(/onClick=\{closeWithInputGuard\}/g)?.length, 2);
  assert.match(dismissInputGuard, /className="fixed inset-0 z-\[120\] touch-none"/);
  assert.match(dismissInputGuard, /aria-hidden="true"/);
  assert.match(dismissInputGuard, /onPointerDown=\{absorbDismissInput\}/);
  assert.match(dismissInputGuard, /onPointerUp=\{absorbDismissInput\}/);
  assert.match(dismissInputGuard, /onMouseDown=\{absorbDismissInput\}/);
  assert.match(dismissInputGuard, /onClick=\{absorbDismissInput\}/);
  assert.match(dismissInputGuard, /onDoubleClick=\{absorbDismissInput\}/);
  assert.match(component, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*armDismissInputGuard\(\);/);
  assert.doesNotMatch(component, /\bfetch\s*\(|\bFormData\b|\blocalStorage\b|document\.cookie|console\./);
  assert.doesNotMatch(component, /billingToken|registerBillingCardAction|action\s*=/i);
  assert.doesNotMatch(component, /\btid\s*:|\.tid\b|\[\s*["']tid["']\s*\]/i);
  assert.doesNotMatch(component, /name=["'](?:cardNo|expMm|expYy|pw2|birth6)["']/);
  assert.doesNotMatch(actions, /registerBillingCardAction|formData\.get\(["']cardNo["']\)|const billingToken/);
});
