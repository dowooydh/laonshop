import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createCheckoutIdempotencyKey } from "../../lib/checkout-idempotency";
import {
  MANUAL_PAYMENT_DEMO_CARD,
  MANUAL_PAYMENT_ISSUERS,
  createManualPaymentDemoApproval,
  getManualPaymentIssuerLabel,
  isManualPaymentDemoInput,
  resolveManualPaymentMode,
} from "../../lib/manual-payment-demo";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function passesLuhn(value: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

test("심사 계정만 live 설정보다 우선하는 고정 수기결제 시연 모드를 사용한다", () => {
  assert.equal(resolveManualPaymentMode("laontest@laontest.com", false), "review-demo");
  assert.equal(resolveManualPaymentMode("LAONTEST@LAONTEST.COM", true), "review-demo");
  assert.equal(resolveManualPaymentMode("customer@example.com", false), "disabled");
  assert.equal(resolveManualPaymentMode("customer@example.com", true), "live");
});

test("시연 카드와 카드사 목록은 합성값·allowlist 계약을 지킨다", () => {
  assert.equal(passesLuhn(MANUAL_PAYMENT_DEMO_CARD.cardNo), false);
  assert.equal(isManualPaymentDemoInput(MANUAL_PAYMENT_DEMO_CARD), true);
  assert.equal(
    isManualPaymentDemoInput({ ...MANUAL_PAYMENT_DEMO_CARD, cardNo: "4111111111111111" }),
    false,
  );
  assert.equal(new Set(MANUAL_PAYMENT_ISSUERS.map((issuer) => issuer.code)).size, MANUAL_PAYMENT_ISSUERS.length);
  for (const issuer of MANUAL_PAYMENT_ISSUERS) {
    assert.equal(getManualPaymentIssuerLabel(issuer.code), issuer.label);
  }
  assert.match(createManualPaymentDemoApproval("order-1234567890"), /^DEMO-[A-Z0-9-]{1,10}$/);
});

test("시연 카드사는 체크아웃 멱등키에 포함되어 다른 카드사 주문과 충돌하지 않는다", async () => {
  const payload = {
    method: "manual_demo",
    items: [{ productId: "product-1", qty: 1, size: "M" }],
    receiverName: "테스트",
    receiverPhone: "01000000000",
    address: "테스트 주소",
    demoIssuer: "SHINHAN",
  };
  const first = await createCheckoutIdempotencyKey(payload, "fixed-nonce");
  const same = await createCheckoutIdempotencyKey(payload, "fixed-nonce");
  const otherIssuer = await createCheckoutIdempotencyKey(
    { ...payload, demoIssuer: "KB" },
    "fixed-nonce",
  );

  assert.equal(first, same);
  assert.notEqual(first, otherIssuer);
});

test("시연 제출은 카드 원문 없이 DB 이전 계정 가드와 PG 미호출 완료 경계를 둔다", () => {
  const form = source("app/checkout/checkout-form.tsx");
  const dialog = source("app/checkout/manual-payment-dialog.tsx");
  const action = source("app/checkout/actions.ts");
  const demoGuard = action.indexOf('if (d.method === "manual_demo") {');
  const firstTransaction = action.indexOf("const prepared = await prisma.$transaction");
  const demoFinalize = action.indexOf("// ── 심사 계정 수기결제 시연");
  const livePay = action.indexOf("const result = await payOldCert");
  const orderInput = form.slice(
    form.indexOf("const orderInput ="),
    form.indexOf("const idempotencyKey =", form.indexOf("const orderInput =")),
  );
  const demoSection = action.slice(demoFinalize, action.indexOf("// ── LAONPAY 등록카드 결제"));

  assert.ok(demoGuard >= 0 && demoGuard < firstTransaction);
  assert.ok(demoFinalize > firstTransaction && demoFinalize < livePay);
  assert.match(orderInput, /method === "manual_demo"[\s\S]*demoIssuer: manualCard\.issuerCode/);
  assert.doesNotMatch(orderInput.slice(orderInput.indexOf('method === "manual_demo"')), /manualCard:\s*\{/);
  assert.doesNotMatch(dialog, /name=["']/);
  assert.match(dialog, /aria-readonly="true"/);
  assert.match(dialog, /autoComplete="cc-number"/);
  assert.match(demoSection, /lockAndValidateInventory/);
  assert.match(demoSection, /status:\s*"PAID"/);
  assert.match(demoSection, /pgTrno:\s*null/);
  assert.match(demoSection, /\(수기결제 시연\)/);
  assert.doesNotMatch(demoSection, /payOldCert|createAuthOrder|fetch\(/);
});

test("주문 완료 화면은 시연 결제를 KSPAY 거래나 영수증으로 표시하지 않는다", () => {
  const page = source("app/order/[id]/page.tsx");
  const cancel = source("app/order/[id]/cancel-request.tsx");
  const inventory = source("lib/order-guard.ts");

  assert.match(page, /isManualPaymentDemoOrder/);
  assert.match(page, /실제 카드 승인·청구 및 PG 거래는/);
  assert.doesNotMatch(page, /isManualPaymentDemoOrder && paid/);
  assert.match(page, /실제 승인취소·환불 및 PG 거래는 발생하지 않습니다/);
  assert.match(page, /isManualPaymentDemoOrder \? "시연 식별번호" : "승인번호"/);
  assert.match(page, /isManualPaymentDemoOrder[\s\S]*\? order\.cardName/);
  assert.match(cancel, /시연 주문에는 실제 승인취소나 환불이 발생하지 않습니다/);
  assert.match(inventory, /MANUAL_PAYMENT_DEMO_APPROVAL_PREFIX/);
  assert.match(inventory, /COALESCE\(o\."approvalNo", ''\) NOT LIKE/);
});
