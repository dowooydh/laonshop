import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("카드 관리 UI는 복귀 결과를 DB와 교차 확인하고 해지를 두 단계로 실행한다", () => {
  const cards = source("app/mypage/settings/billing-cards.tsx");
  const page = source("app/mypage/settings/page.tsx");
  const notice = source("app/mypage/settings/billing-return-notice.tsx");

  assert.match(cards, /activeAction === "registration"/);
  assert.match(cards, /activeAction === "refresh"/);
  assert.match(cards, /setConfirmingDeregisterId\(method\.id\)/);
  assert.match(cards, /해지 확인/);
  assert.match(cards, /loading=\{targetDeregistering\}/);
  assert.match(cards, /aria-expanded=\{confirming\}/);

  assert.match(page, /latestRegistration\?\.status === "SUCCEEDED"/);
  assert.match(page, /method\.status === "ACTIVE"/);
  assert.match(page, /registrationMessage = REGISTRATION_MESSAGES\.invalid/);

  assert.match(notice, /noticeRef\.current\?\.focus\(\)/);
  assert.match(notice, /router\.replace\("\/mypage\/settings#billing-card-management"/);
  assert.match(notice, /aria-live="polite"/);
});

test("취소 신청과 공용 오류 UI는 중복 입력·지속 상태·스크린리더 경계를 제공한다", () => {
  const cancelForm = source("app/order/[id]/cancel-request.tsx");
  const orderPage = source("app/order/[id]/page.tsx");
  const input = source("lib/ui/input.tsx");
  const button = source("lib/ui/button.tsx");

  assert.match(cancelForm, /<Label htmlFor=\{reasonId\}>/);
  assert.match(cancelForm, /submittingRef\.current/);
  assert.match(cancelForm, /min-h-11/);
  assert.match(cancelForm, /flex-wrap/);
  assert.match(cancelForm, /aria-describedby=\{error \? errorId : undefined\}/);

  for (const status of ["REQUESTING", "REQUESTED", "PROCESSING", "UNKNOWN", "REJECTED"]) {
    assert.match(orderPage, new RegExp(`billingCancelRequestStatus === "${status}"`));
  }
  assert.match(orderPage, /paid && !billingCancelRequestBlocked/);
  assert.match(orderPage, /billingCancelCanRefresh/);
  assert.match(orderPage, /refreshBillingCancelStatusFormAction/);
  assert.match(orderPage, />\s*취소 상태 조회\s*</);
  assert.match(orderPage, /billingCancelRefreshMessage\.role/);
  assert.match(input, /role = "alert"/);
  assert.match(input, /"aria-live": ariaLive = "assertive"/);
  assert.match(button, /aria-busy=\{loading \? true : ariaBusy\}/);
  assert.match(button, /aria-hidden="true"/);
});

test("주문·오류 제목은 최소 폭과 큰 글자에서도 부모 폭 안에서 줄바꿈한다", () => {
  for (const path of ["app/order/[id]/page.tsx", "app/error.tsx", "app/not-found.tsx"]) {
    const page = source(path);
    assert.match(
      page,
      /<h1 className="[^"]*min-w-0[^"]*max-w-full[^"]*\[overflow-wrap:anywhere\][^"]*">/,
      path,
    );
  }
});
