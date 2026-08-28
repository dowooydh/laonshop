import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  createLaonpayBillingOrderCardName,
  isLaonpayBillingOrderCardName,
  normalizeLaonpayBillingOrderCardName,
} from "../../lib/billing";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("등록카드 UI는 간편결제 AUTH와 구분된 BILLING 용어를 사용한다", () => {
  const cards = source("app/mypage/settings/billing-cards.tsx");
  const settings = source("app/mypage/settings/page.tsx");
  const checkout = source("app/checkout/checkout-form.tsx");

  assert.match(cards, /LAONPAY 등록카드 결제/);
  assert.match(settings, /LAONPAY 등록카드 관리/);
  assert.match(checkout, /LAONPAY 등록카드\(정기결제\)/);
  assert.doesNotMatch(cards, /LAONPAY 간편결제|간편결제 연동|간편결제 원장/);
  assert.doesNotMatch(settings, /간편결제 카드 관리|간편결제 연동/);
  assert.doesNotMatch(checkout, /desc: "LAONPAY 간편결제"/);

  for (const method of ["카드결제", "카카오페이", "네이버페이", "실시간 계좌이체"]) {
    assert.match(checkout, new RegExp(method));
  }
  assert.match(checkout, /<KspayCheckout/);
});

test("기존 원클릭 주문 표식은 판별하되 화면에는 등록카드로 정규화한다", () => {
  const legacy = "테스트카드 (LAONPAY 원클릭)";
  const current = createLaonpayBillingOrderCardName("테스트카드");

  assert.equal(current, "테스트카드 (LAONPAY 등록카드)");
  assert.equal(isLaonpayBillingOrderCardName(legacy), true);
  assert.equal(isLaonpayBillingOrderCardName(current), true);
  assert.equal(
    normalizeLaonpayBillingOrderCardName(legacy),
    "테스트카드 (LAONPAY 등록카드)",
  );
});

test("공개 안내는 일반 KSPAY와 LAONPAY 등록카드 경로를 구분한다", () => {
  const layout = source("app/layout.tsx");
  const support = source("app/support/page.tsx");
  const terms = source("app/policy/terms/page.tsx");
  const privacy = source("app/policy/privacy/page.tsx");

  for (const page of [layout, support, terms, privacy]) {
    assert.match(page, /KSPAY\(KSNET\)|KSPAY 인증결제/);
    assert.match(page, /LAONPAY/);
    assert.match(page, /등록카드/);
    assert.doesNotMatch(page, /Baum|바움/);
  }
  assert.match(privacy, /불투명 결제수단 ID와 마스킹된 카드정보/);
  assert.match(support, /라온샵은 카드번호나 PG 결제 토큰을 저장하지 않습니다/);
});

test("기준 문서는 provider 중립 계약을 유지하고 LAONSHOP provider env를 추가하지 않는다", () => {
  const agents = source("AGENTS.md");
  const claude = source("CLAUDE.md");
  const envExample = source(".env.example");
  const schema = source("prisma/schema.prisma");

  assert.equal(agents, claude);
  assert.match(agents, /provider 중립적인 LAONPAY/);
  assert.match(schema, /LAONPAY가 보관한 provider token/);
  assert.doesNotMatch(schema, /LAONPAY가 보관한 KSNET billingToken/);
  assert.doesNotMatch(
    envExample,
    /^\s*(?:#\s*)?(?:BAUM_[A-Z0-9_]*|GID|RID|LAONPAY_.*MID)\s*=/im,
  );
});
