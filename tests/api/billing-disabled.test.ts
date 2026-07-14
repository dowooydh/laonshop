import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

import { getDisabledBillingResult, ONECLICK_PAYMENT_DISABLED_MESSAGE } from "../../lib/billing";

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
