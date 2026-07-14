import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

import {
  getDisabledBillingResult,
  MANUAL_PAYMENT_DISABLED_MESSAGE,
  ONECLICK_PAYMENT_DISABLED_MESSAGE,
} from "../../lib/billing";

test("원클릭은 모든 요청에서 차단하고 다른 결제수단은 변경하지 않는다", () => {
  assert.deepEqual(getDisabledBillingResult("oneclick"), {
    ok: false,
    error: ONECLICK_PAYMENT_DISABLED_MESSAGE,
  });

  for (const method of ["card", "kakaopay", "naverpay", "bank", "manual"]) {
    assert.equal(getDisabledBillingResult(method), null, method);
  }
});

test("카드 설정 화면과 서버 액션은 카드 원문이나 mock 빌링키를 수집하지 않는다", () => {
  const settings = readFileSync(join(process.cwd(), "app/mypage/settings/billing-cards.tsx"), "utf8");
  const actions = readFileSync(join(process.cwd(), "app/mypage/actions.ts"), "utf8");

  assert.doesNotMatch(settings, /name=["'](?:cardNo|expMm|expYy|pw2|birth6)["']/);
  assert.match(settings, /카드 등록과 원클릭 결제는 현재 이용할 수 없습니다/);
  assert.doesNotMatch(actions, /registerBillingCardAction|formData\.get\(["']cardNo["']\)|const billingToken/);
});

test("기존 카드 삭제 실패는 행을 유지하고 오류 안내 후 재시도할 수 있다", () => {
  const settings = readFileSync(join(process.cwd(), "app/mypage/settings/billing-cards.tsx"), "utf8");

  assert.match(settings, /try\s*\{[\s\S]*deleteBillingCardAction\(id\)[\s\S]*catch\s*\{/);
  assert.match(settings, /role="alert"/);
  assert.match(settings, /네트워크 연결을 확인한 뒤 다시 시도해 주세요/);
  assert.match(settings, /setDeleteError\(null\)/);
  assert.match(settings, /disabled=\{deleting\}/);
  assert.doesNotMatch(settings, /setCards|cards\.filter/);
});

test("체크아웃과 재결제의 stale oneclick 요청은 주문 변경 전에 차단한다", () => {
  for (const file of ["app/checkout/actions.ts", "app/order/actions.ts"]) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const guardIndex = source.indexOf("getDisabledBillingResult(");
    const transactionIndex = source.indexOf("prisma.$transaction(");

    assert.ok(guardIndex >= 0, `${file}: 원클릭 차단 가드가 필요합니다.`);
    assert.ok(transactionIndex >= 0 && guardIndex < transactionIndex, `${file}: 주문 트랜잭션 전에 차단해야 합니다.`);
    assert.doesNotMatch(source, /cardName:\s*`등록카드|billingCard!|card!\.maskedCardNumb/);
  }
});

test("WEBFEP 키와 운영 스위치 전에는 수기결제 UI와 mock PAID 경로가 없다", () => {
  const page = readFileSync(join(process.cwd(), "app/checkout/page.tsx"), "utf8");
  const form = readFileSync(join(process.cwd(), "app/checkout/checkout-form.tsx"), "utf8");
  const actions = readFileSync(join(process.cwd(), "app/checkout/actions.ts"), "utf8");
  const billing = readFileSync(join(process.cwd(), "lib/billing.ts"), "utf8");

  assert.match(page, /manualPaymentEnabled=\{isKspayRestLiveEnabled\(\)\}/);
  assert.match(form, /manualPaymentEnabled\s*\?\s*\[\{ id: "manual"/);
  assert.match(actions, /!isKspayRestLiveEnabled\(\)[\s\S]*MANUAL_PAYMENT_DISABLED_MESSAGE/);
  assert.doesNotMatch(actions, /approvalNo:\s*`MB\$\{/);
  assert.doesNotMatch(actions, /result === null[\s\S]{0,300}status:\s*"PAID"/);
  assert.doesNotMatch(billing, /MANUAL_PAYMENT_TEST_EMAILS/);
  assert.match(MANUAL_PAYMENT_DISABLED_MESSAGE, /일반 카드결제/);
});
