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
  assert.match(cancelForm, /aria-describedby=\{[\s\S]*error \? errorId : null/);

  for (const status of ["REQUESTING", "REQUESTED", "PROCESSING", "UNKNOWN", "REJECTED"]) {
    assert.match(orderPage, new RegExp(`billingCancelRequestStatus === "${status}"`));
  }
  assert.match(orderPage, /paid && !billingCancelRequestBlocked/);
  assert.match(orderPage, /billingCancelCanRefresh/);
  assert.match(orderPage, /refreshBillingCancelStatusFormAction/);
  assert.match(orderPage, /<BillingStatusSubmit label="취소 상태 조회" \/>/);
  assert.match(orderPage, /import \{ BillingStatusSubmit \} from "\.\/billing-status-submit"/);
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

test("체크아웃은 표시 장바구니와 제출 스냅샷이 다르면 결제를 중단하고 입력을 잠근다", () => {
  const checkout = source("app/checkout/checkout-form.tsx");
  const address = source("components/address-input.tsx");

  assert.match(checkout, /cartDisplayFingerprint\(currentItems\)/);
  assert.match(checkout, /cartDisplayFingerprint\(displayedItemsRef\.current\)/);
  assert.match(checkout, /setAgree\(false\)/);
  assert.match(
    checkout,
    /장바구니가 변경되어 결제를 시작하지 않았습니다/,
  );
  assert.match(checkout, /window\.addEventListener\("storage", refreshOnStorage\)/);
  assert.match(checkout, /window\.addEventListener\("laonshop-cart-change", synchronizeCart\)/);
  assert.match(checkout, /const interactionLocked = pending \|\| oneclickUncertain/);
  assert.match(checkout, /disabled=\{interactionLocked\}/);
  assert.match(address, /disabled\?: boolean/);
  assert.match(address, /if \(disabled\) return/);
});

test("심사 수기결제 dialog는 모바일·키보드·포커스 경계를 제공한다", () => {
  const checkout = source("app/checkout/checkout-form.tsx");
  const dialog = source("app/checkout/manual-payment-dialog.tsx");

  assert.match(checkout, /role="group"[\s\S]*aria-label="결제방식 선택"/);
  assert.match(checkout, /aria-pressed=\{!isManualSelected\}/);
  assert.match(checkout, /aria-pressed=\{isManualSelected\}/);
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /aria-labelledby="manual-payment-title"/);
  assert.match(dialog, /aria-describedby="manual-payment-description"/);
  assert.match(dialog, /dialog\.showModal\(\)/);
  assert.match(dialog, /onCancel=\{\(event\) =>/);
  assert.match(dialog, /issuerRef\.current\?\.focus\(\)/);
  assert.match(dialog, /returnFocusRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(dialog, /DISMISS_INPUT_GUARD_MS = 700/);
  assert.match(dialog, /data-manual-payment-dismiss-guard/);
  assert.match(dialog, /event\.stopImmediatePropagation\(\)/);
  assert.match(dialog, /document\.addEventListener\("keydown", trapDialogFocus, true\)/);
  assert.match(dialog, /dialog\.contains\(active\)/);
  assert.match(dialog, /event\.shiftKey \? last : first/);
  assert.match(dialog, /tabIndex=\{-1\}/);
  assert.match(dialog, /role="textbox"/);
  assert.match(dialog, /aria-readonly="true"/);
  assert.match(dialog, /grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,8rem\),1fr\)\)\]/);
  assert.match(checkout, /manualReturnFocusRef\.current = event\.currentTarget/);
  assert.match(dialog, /max-h-\[min\(92dvh,46rem\)\]/);
  assert.match(dialog, /w-\[calc\(100%-2rem\)\]/);
  assert.match(dialog, /min-h-11/);
  assert.match(dialog, /flex-col-reverse[\s\S]*sm:flex-row/);
  assert.doesNotMatch(dialog, /min-\[360px\]:flex-row/);
  assert.doesNotMatch(dialog, /onClick=\{close\}[^>]*className="absolute inset-0/);
});

test("빌링 결과 안내는 URL만 정리해 포커스를 유지하고 취소 미상은 전체 새로고침으로 복구한다", () => {
  const notice = source("app/order/[id]/billing-order-notice.tsx");
  const cancel = source("app/order/[id]/cancel-request.tsx");
  const cards = source("app/mypage/settings/billing-cards.tsx");

  assert.match(notice, /window\.history\.replaceState\(window\.history\.state/);
  assert.doesNotMatch(notice, /router\.replace/);
  assert.match(cancel, /disabled=\{pending \|\| uncertain\}/);
  assert.match(cancel, /disabled=\{pending\}[\s\S]*onClick=\{close\}/);
  assert.match(cancel, /id=\{uncertainId\}[\s\S]*role="status"/);
  assert.match(cancel, /uncertain \? uncertainId : null/);
  assert.match(cancel, /window\.location\.reload\(\)/);
  assert.match(cards, /const billingActionPending =/);
  assert.match(cards, /billingUiLockedRef\.current/);
  assert.match(cards, /event\.persisted[\s\S]*window\.location\.reload\(\)/);
  assert.match(cards, /visibleStatusLabel/);
});
