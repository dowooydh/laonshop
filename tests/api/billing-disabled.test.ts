import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  getDisabledBillingResult,
  MANUAL_PAYMENT_DISABLED_MESSAGE,
  ONECLICK_PAYMENT_DISABLED_MESSAGE,
} from "../../lib/billing";
import { BILLING_SETTINGS_RETURN_URL } from "../../lib/laonpay/billing-client";
import { mergeRegistrationStatus } from "../../lib/laonpay/billing-policy";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("재결제의 등록카드 요청은 계속 차단하고 일반 결제수단은 변경하지 않는다", () => {
  assert.deepEqual(getDisabledBillingResult("oneclick"), {
    ok: false,
    error: ONECLICK_PAYMENT_DISABLED_MESSAGE,
  });
  for (const method of ["card", "kakaopay", "naverpay", "bank", "manual"]) {
    assert.equal(getDisabledBillingResult(method), null, method);
  }

  const retry = source("app/order/actions.ts").slice(
    source("app/order/actions.ts").indexOf("export async function retryPaymentAction"),
  );
  const guardIndex = retry.indexOf("getDisabledBillingResult(method)");
  const transactionIndex = retry.indexOf("prisma.$transaction(");
  assert.ok(guardIndex >= 0 && guardIndex < transactionIndex);
});

test("카드 등록은 hosted Action만 사용하며 라온샵에 카드 원문 입력·provider token 저장 경로가 없다", () => {
  const settings = source("app/mypage/settings/billing-cards.tsx");
  const billingActions = source("app/mypage/settings/billing/actions.ts");
  const returnRoute = source("app/mypage/settings/billing/return/route.ts");
  const schema = source("prisma/schema.prisma");

  assert.match(settings, /LAONPAY에서 카드 등록/);
  assert.match(settings, /startBillingRegistrationAction/);
  assert.doesNotMatch(settings, /name=["'](?:cardNo|expMm|expYy|pw2|birth6)["']/);
  assert.doesNotMatch(settings, /sessionStorage|localStorage|billing-card-review-mock/);
  assert.match(billingActions, /createRegistrationIntent/);
  assert.match(billingActions, /redirect\(registration\.hostedUrl\)/);
  assert.match(returnRoute, /getRegistrationIntent/);
  assert.match(returnRoute, /queryRegistrationId !== cookieRegistration\.providerId/);
  assert.doesNotMatch(returnRoute, /billingStatus[^;]*===\s*["']succeeded/);

  const newModels = schema.slice(schema.indexOf("model ShopBillingPaymentMethod"), schema.indexOf("model Wishlist"));
  assert.match(newModels, /laonpayPaymentMethodId/);
  assert.match(newModels, /cardLast4/);
  assert.doesNotMatch(newModels, /\b(?:billingToken|cardNo|cardNumb|expiry|password2|pgapi)\b/i);
  assert.equal(
    BILLING_SETTINGS_RETURN_URL,
    "https://laonshop.com/mypage/settings/billing/return",
  );
});

test("www 요청은 hosted 복귀 세션과 같은 apex origin으로 정규화한다", () => {
  const middleware = source("middleware.ts");

  assert.match(middleware, /hostname === "www\.laonshop\.com"/);
  assert.match(
    middleware,
    /process\.env\.VERCEL_ENV === "production" && hostname !== "laonshop\.com"/,
  );
  assert.match(middleware, /target\.hostname = "laonshop\.com"/);
  assert.match(middleware, /NextResponse\.redirect\(target, 308\)/);
});

test("checkout 등록카드 결제는 계정·환경·소유권·서버 금액·주문별 청구 원장으로 보호한다", () => {
  const action = source("app/checkout/actions.ts");

  assert.match(action, /isBillingIntegrationEnabled\(user\.email\)/);
  assert.match(action, /shopBillingPaymentMethod\.findFirst/);
  assert.match(action, /userId:\s*user\.id,[\s\S]*status:\s*"ACTIVE"/);
  assert.match(action, /buildBillingChargeRequest\(user,\s*current\)/);
  assert.match(action, /calculateOrderAmount\(order\.items\)/);
  assert.match(action, /amount !== current\.totalAmount/);
  assert.match(action, /shopBillingCharge\.create/);
  assert.match(action, /LAONPAY_BILLING_PROCESSING_MARKER/);
  assert.match(action, /billingRequestFingerprint\(requestBody\)/);
  assert.match(action, /requestAttempts:\s*\{\s*increment:\s*1\s*\}/);
  assert.match(action, /charge\.requestAttempts >= 2/);
  assert.match(action, /chargePrepared\.charge\.idempotencyKey/);
  assert.match(action, /chargeResult\.outcome === "UNKNOWN"/);
  assert.match(action, /chargeResult\.outcome === "REJECTED"[\s\S]*requestAttempts:\s*2/);
  assert.match(action, /externalOrderId !== order\.id/);
  assert.match(action, /chargeResult\.data\.charge\.amount !== chargePrepared\.charge\.amount/);
  assert.match(action, /billing-method:\$\{d\.billingCardId!\}/);
  assert.match(action, /billing-checkout-user:\$\{user\.id\}/);
  assert.match(
    action,
    /approvalNo:\s*LAONPAY_BILLING_PROCESSING_MARKER,\s*moid:\s*\{\s*not:\s*moid\s*\}/,
  );
  assert.match(
    action,
    /\.\.\.\(d\.method === "oneclick"[\s\S]*approvalNo:\s*LAONPAY_BILLING_PROCESSING_MARKER/,
  );
  assert.match(action, /current\.approvalNo !== LAONPAY_BILLING_PROCESSING_MARKER/);
  assert.ok(
    action.indexOf("shopBillingCharge.create") <
      action.indexOf("const order = prepared.order"),
    "oneclick 주문·마커와 청구 원장은 최초 주문 트랜잭션에서 함께 커밋해야 합니다.",
  );
  assert.match(
    action,
    /requestAttempts === 0[\s\S]*laonpayChargeId === null[\s\S]*LOCAL_AMOUNT_CHANGED[\s\S]*status:\s*"FAILED",\s*approvalNo:\s*null/,
  );
  assert.doesNotMatch(action, /cardName:\s*`등록카드|billingToken/);
});

test("두 원장 tx 사이 가격 변경은 외부 미호출 charge와 주문을 같은 tx에서 종료한다", () => {
  const action = source("app/checkout/actions.ts");
  const chargeTransaction = action.slice(
    action.indexOf("const chargePrepared = await prisma.$transaction"),
    action.indexOf("if (!chargePrepared)"),
  );
  const mismatchStart = chargeTransaction.indexOf(
    "if (amount !== current.totalAmount || amount !== inventory.total)",
  );
  const mismatchEnd = chargeTransaction.indexOf(
    "const paymentMethod = await tx.shopBillingPaymentMethod.findFirst",
    mismatchStart,
  );

  assert.ok(mismatchStart >= 0 && mismatchEnd > mismatchStart);
  const mismatchBranch = chargeTransaction.slice(mismatchStart, mismatchEnd);
  assert.match(
    mismatchBranch,
    /requestAttempts === 0[\s\S]*laonpayChargeId === null/,
  );
  assert.match(
    mismatchBranch,
    /shopBillingCharge\.update\([\s\S]*status:\s*"DECLINED"[\s\S]*failureCode:\s*"LOCAL_AMOUNT_CHANGED"/,
  );
  assert.match(
    mismatchBranch,
    /shopOrder\.update\([\s\S]*status:\s*"FAILED",\s*approvalNo:\s*null/,
  );
  assert.ok(
    mismatchBranch.indexOf("shopBillingCharge.update") <
      mismatchBranch.indexOf("shopOrder.update"),
    "외부 호출 전 로컬 charge와 주문은 같은 트랜잭션 콜백에서 함께 종료해야 합니다.",
  );
});

test("기존 주문 복구의 주문 단독 실패 분기는 청구 원장이 없을 때만 실행된다", () => {
  const action = source("app/checkout/actions.ts");
  const recoveryStart = action.indexOf("const existingCharge = await tx.shopBillingCharge.findUnique");
  const recoveryEnd = action.indexOf("return { ok: true as const, order };", recoveryStart);

  assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart);
  const recoveryBranch = action.slice(recoveryStart, recoveryEnd);
  const noChargeGuard = recoveryBranch.indexOf("if (!existingCharge)");
  const amountMismatch = recoveryBranch.indexOf(
    "if (amount !== order.totalAmount || amount !== inventory.total)",
  );
  const orderFailure = recoveryBranch.indexOf(
    'data: { status: "FAILED", approvalNo: null }',
    amountMismatch,
  );

  assert.ok(noChargeGuard >= 0);
  assert.ok(
    amountMismatch > noChargeGuard && orderFailure > amountMismatch,
    "기존 청구를 남긴 채 주문만 실패시키는 분기가 생기면 안 됩니다.",
  );
  assert.doesNotMatch(
    recoveryBranch.slice(noChargeGuard, recoveryEnd),
    /shopBillingCharge\.update/,
  );
});

test("UNKNOWN은 새 결제·재결제를 막고 재고 예약 마커를 무기한 유지한다", () => {
  const checkout = source("app/checkout/actions.ts");
  const retry = source("app/order/actions.ts");
  const guard = source("lib/order-guard.ts");

  assert.match(checkout, /status:\s*"UNKNOWN"[\s\S]*RESULT_UNCONFIRMED/);
  assert.match(checkout, /새로 결제하지 말고 주문내역에서 상태를 확인/);
  const manualSection = checkout.slice(checkout.indexOf('if (d.method === "manual")'));
  assert.match(manualSection, /isPaymentProcessingMarker\(current\.approvalNo\)/);
  assert.match(retry, /isPaymentProcessingMarker\(order\.approvalNo\)/);
  assert.match(retry, /billing-checkout-user:\$\{user\.id\}/);
  assert.match(
    retry,
    /id:\s*\{\s*not:\s*orderId\s*\},\s*status:\s*"PENDING",\s*approvalNo:\s*LAONPAY_BILLING_PROCESSING_MARKER/,
  );
  assert.match(guard, /LAONPAY_BILLING_PROCESSING_MARKER/);
  assert.match(
    guard,
    /o\."approvalNo" IN \(\$\{PAYMENT_PROCESSING_MARKER\}, \$\{LAONPAY_BILLING_PROCESSING_MARKER\}\)/,
  );
});

test("등록카드 주문 취소는 부분금액 없이 LAONPAY 관리자 취소 요청을 한 번만 생성한다", () => {
  const action = source("app/order/actions.ts");

  assert.match(action, /shopBillingCancelRequest\.create/);
  assert.match(action, /requestSentAt:\s*null/);
  assert.match(action, /data:\s*\{\s*requestSentAt:\s*new Date\(\)\s*\}/);
  assert.match(action, /createCancelRequest\(/);
  assert.doesNotMatch(action, /createCancelRequest\([\s\S]{0,300}\bamount\b/);
  assert.match(action, /result\.data\.charge\.status === "CANCEL_REQUESTED"/);
  assert.match(action, /status:\s*rejected \? "REJECTED" : "UNKNOWN"/);
  assert.match(action, /cancelReason:\s*cancelRequest\.reason/);
  assert.match(action, /billing-method:\$\{prepared\.charge\.paymentMethodId\}/);
});

test("등록카드 취소 상태는 전용 GET을 우선하고 CANCELED를 세 원장에 원자 반영한다", () => {
  const action = source("app/order/actions.ts");
  const section = action.slice(
    action.indexOf("export async function refreshBillingCancelStatusAction"),
    action.indexOf("// ── LAONPAY 등록카드 결제 상태 대사"),
  );

  assert.equal(section.match(/\.getCancelRequest\(/g)?.length, 1);
  assert.equal(section.match(/\.getCharge\(/g)?.length, 1);
  assert.equal(section.match(/\.createCancelRequest\(/g)?.length ?? 0, 0);
  assert.ok(
    section.indexOf("`order:${parsed.data.orderId}`") <
      section.indexOf("`billing-method:${chargeProbe.paymentMethodId}`"),
  );
  assert.match(section, /charge\.order\.userId !== user\.id/);
  assert.match(section, /charge\.paymentMethod\.userId !== user\.id/);
  assert.match(section, /result\.data\.cancelRequest\.id !== providerCancelRequestId/);
  assert.doesNotMatch(
    section,
    /result\.data\.cancelRequest\.reason !== prepared\.charge\.cancelRequest!\.reason/,
  );
  assert.match(section, /result\.data\.charge\.id !== prepared\.charge\.laonpayChargeId/);
  assert.match(
    section,
    /result\.data\.charge\.externalOrderId !== prepared\.charge\.order\.id/,
  );
  assert.match(section, /result\.data\.charge\.amount !== prepared\.amount/);
  assert.match(
    section,
    /result\.data\.charge\.paymentId !== prepared\.charge\.providerPaymentId/,
  );
  assert.match(section, /currentAmount !== charge\.order\.totalAmount/);
  assert.match(section, /currentAmount !== charge\.amount/);
  assert.match(
    section,
    /remote\.source === "cancel-request"[\s\S]*remote\.cancelRequest\.status === "DONE"/,
  );
  assert.match(
    section,
    /shopBillingCancelRequest\.update\([\s\S]*status:\s*"DONE"[\s\S]*shopBillingCharge\.update\([\s\S]*status:\s*"CANCELED"[\s\S]*shopOrder\.update\([\s\S]*status:\s*"CANCELED"/,
  );
  assert.match(
    section,
    /remote\.source === "charge-fallback"[\s\S]*cancelRequestedAt:\s*charge\.cancelRequest\.requestSentAt[\s\S]*cancelReason:\s*charge\.cancelRequest\.reason/,
  );
  assert.match(
    section,
    /reason:\s*remote\.cancelRequest\.reason[\s\S]*cancelReason:\s*remote\.cancelRequest\.reason/,
  );
});

test("취소 전용 GET은 반려를 확정하고 ID 유실 fallback은 PAID를 거절로 추론하지 않는다", () => {
  const action = source("app/order/actions.ts");
  const page = source("app/order/[id]/page.tsx");
  const section = action.slice(
    action.indexOf("export async function refreshBillingCancelStatusAction"),
    action.indexOf("// ── LAONPAY 등록카드 결제 상태 대사"),
  );

  assert.match(
    section,
    /charge\.order\.status === "PAID"[\s\S]*charge\.status === "PAID"[\s\S]*charge\.cancelRequest\.status === "UNKNOWN"[\s\S]*requestSentAt !== null/,
  );
  assert.match(
    section,
    /remote\.source === "cancel-request"[\s\S]*remote\.cancelRequest\.status === "REJECTED"/,
  );
  assert.match(
    section,
    /status:\s*"REJECTED"[\s\S]*rejectReason:\s*remote\.cancelRequest\.rejectReason[\s\S]*status:\s*"PAID"/,
  );
  assert.match(section, /charge fallback의 PAID를 취소 거절로 해석할 수 없다/);
  assert.doesNotMatch(
    section,
    /remote\.source === "charge-fallback"[\s\S]{0,500}status:\s*"REJECTED"/,
  );
  assert.match(page, /billingCancelCanRefresh/);
  assert.match(page, /billingCancelRejectReason/);
  assert.match(page, /billingCancelHasProviderRequest/);
  assert.match(
    page,
    /billingCancelRequestStatus === "REJECTED"[\s\S]*billingCancelHasProviderRequest/,
  );
  assert.match(page, /refreshBillingCancelStatusFormAction/);
  assert.match(page, /취소 상태 조회/);
});

test("seller-first 취소요청의 원격 사유를 채택하되 소유권과 결제 결박은 유지한다", () => {
  const action = source("app/order/actions.ts");
  const section = action.slice(
    action.indexOf("export async function refreshBillingCancelStatusAction"),
    action.indexOf("// ── LAONPAY 등록카드 결제 상태 대사"),
  );

  assert.match(section, /rejectedRequestToRefresh/);
  assert.match(section, /charge\.cancelRequest\.laonpayCancelRequestId !== null/);
  assert.doesNotMatch(
    section,
    /charge\.cancelRequest\.reason !== remote\.cancelRequest\.reason/,
  );
  assert.match(section, /charge\.cancelRequest\.userId !== user\.id/);
  assert.match(section, /charge\.cancelRequest\.chargeId !== charge\.id/);
  assert.match(section, /charge\.laonpayChargeId !== remote\.charge\.id/);
  assert.match(section, /charge\.providerPaymentId !== remote\.charge\.paymentId/);
  assert.match(section, /currentAmount !== remote\.charge\.amount/);
  assert.match(
    section,
    /remote\.cancelRequest\.status !== "REJECTED"[\s\S]*reason:\s*remote\.cancelRequest\.reason[\s\S]*rejectReason:\s*remote\.cancelRequest\.rejectReason/,
  );
});

test("카드 해지는 불명확 응답을 자동 재호출하지 않고 상태 조회로만 확정한다", () => {
  const action = source("app/mypage/settings/billing/actions.ts");
  const deregisterSection = action.slice(
    action.indexOf("export async function deregisterBillingPaymentMethodAction"),
  );

  assert.equal(
    deregisterSection.match(/\.deregisterPaymentMethod\(/g)?.length,
    1,
  );
  assert.match(deregisterSection, /method\.status !== "ACTIVE"/);
  assert.match(
    deregisterSection,
    /result\.data\.paymentMethod\.id === prepared\.method\.laonpayPaymentMethodId/,
  );
  assert.match(
    deregisterSection,
    /result\.data\.paymentMethod\.status !== "DEREGISTERED"/,
  );
  assert.match(deregisterSection, /cancelRequest:[\s\S]*REQUESTED[\s\S]*PROCESSING/);
  assert.match(deregisterSection, /목록 상태 조회로만 확정한다/);
});

test("빌링 계정 탈퇴와 등록 시작은 같은 생명주기 잠금 및 로컬 원장으로 직렬화한다", () => {
  const settings = source("app/mypage/actions.ts");
  const billing = source("app/mypage/settings/billing/actions.ts");
  const returnRoute = source("app/mypage/settings/billing/return/route.ts");

  assert.match(settings, /isBillingIntegrationAccount\(user\.email\)/);
  assert.doesNotMatch(settings, /isBillingIntegrationEnabled\(user\.email\)/);
  assert.match(settings, /billing-user-lifecycle:\$\{user\.id\}/);
  assert.match(settings, /shopBillingRegistration\.count/);
  assert.match(settings, /status:\s*"SUCCEEDED",\s*paymentMethodId:\s*null/);
  assert.match(settings, /shopBillingPaymentMethod\.count/);
  assert.match(settings, /shopBillingCharge\.count/);
  assert.match(settings, /shopBillingCancelRequest\.count/);
  assert.match(billing, /billing-user-lifecycle:\$\{user\.id\}/);
  assert.match(billing, /deletedAt:\s*null/);
  assert.match(returnRoute, /billing-user-lifecycle:\$\{user\.id\}/);
  assert.match(returnRoute, /deletedAt:\s*null/);
});

test("등록 대사는 hosted URL을 같은 key로 한 번만 회수하고 terminal 상태를 되돌리지 않는다", () => {
  const action = source("app/mypage/settings/billing/actions.ts");
  const returnRoute = source("app/mypage/settings/billing/return/route.ts");
  const policy = source("lib/laonpay/billing-policy.ts");

  assert.match(action, /status:\s*"SUCCEEDED",\s*paymentMethodId:\s*null/);
  assert.match(
    action,
    /prepared\.registration\.laonpayRegistrationId[\s\S]*createRegistrationIntent\([\s\S]*prepared\.registration\.idempotencyKey/,
  );
  assert.match(action, /rejected:\s*result\.outcome === "REJECTED"/);
  assert.match(action, /billing-registration:\$\{registrationId\}/);
  assert.match(action, /persistCreatedRegistration/);
  assert.match(action, /paymentMethodSyncData\(remote\.paymentMethod, lockedExisting\)/);
  assert.match(returnRoute, /paymentMethodSyncData\(remote\.paymentMethod, lockedExisting\)/);
  assert.match(policy, /local\?\.status === "DEREGISTERED"/);
});

test("등록 상태는 terminal 및 PROCESSING 진행도를 늦은 응답으로 되돌리지 않는다", () => {
  assert.equal(mergeRegistrationStatus("SUCCEEDED", "PENDING"), "SUCCEEDED");
  assert.equal(mergeRegistrationStatus("DECLINED", "SUCCEEDED"), "DECLINED");
  assert.equal(mergeRegistrationStatus("EXPIRED", "PROCESSING"), "EXPIRED");
  assert.equal(mergeRegistrationStatus("PROCESSING", "PENDING"), "PROCESSING");
  assert.equal(mergeRegistrationStatus("PENDING", "PROCESSING"), "PROCESSING");
  assert.equal(mergeRegistrationStatus("UNKNOWN", "SUCCEEDED"), "SUCCEEDED");
});

test("등록카드 결제 상태조회는 provider ID가 있으면 GET, 없으면 남은 동일-body 대사 POST만 사용한다", () => {
  const action = source("app/order/actions.ts");

  assert.match(action, /charge\.laonpayChargeId\s*\?\s*await client\.getCharge/);
  assert.match(action, /:\s*await client\.chargePaymentMethod/);
  assert.match(action, /latestCharge\.requestAttempts >= 2/);
  assert.match(action, /billingRequestFingerprint\(requestBody\) !== charge\.requestFingerprint/);
  assert.match(action, /LAONPAY_BILLING_PROCESSING_MARKER/);
  assert.match(action, /RESULT_ID_MISMATCH/);
});

test("과거 mock 카드 삭제 실패는 행을 유지하고 오류 안내 후 재시도할 수 있다", () => {
  const settings = source("app/mypage/settings/billing-cards.tsx");

  assert.match(settings, /try\s*\{[\s\S]*deleteBillingCardAction\(id\)[\s\S]*catch\s*\{/);
  assert.match(settings, /role="alert"/);
  assert.match(settings, /네트워크 연결을 확인한 뒤 다시 시도해 주세요/);
  assert.match(settings, /setDeleteError\(null\)/);
  assert.match(settings, /disabled=\{deletingLegacy\}/);
  assert.doesNotMatch(settings, /setCards|cards\.filter/);
});

test("상품 시드 초기화는 Restrict 관계의 빌링 원장을 주문보다 먼저 정리한다", () => {
  const seed = source("prisma/seed.ts");
  const cancelIndex = seed.indexOf("shopBillingCancelRequest.deleteMany");
  const chargeIndex = seed.indexOf("shopBillingCharge.deleteMany");
  const registrationIndex = seed.indexOf("shopBillingRegistration.deleteMany");
  const methodIndex = seed.indexOf("shopBillingPaymentMethod.deleteMany");
  const orderIndex = seed.indexOf("shopOrder.deleteMany");

  assert.ok(cancelIndex >= 0 && cancelIndex < chargeIndex);
  assert.ok(chargeIndex < methodIndex);
  assert.ok(registrationIndex < methodIndex);
  assert.ok(methodIndex < orderIndex);
});

test("WEBFEP 키와 운영 스위치 전에는 수기결제 UI와 mock PAID 경로가 없다", () => {
  const page = source("app/checkout/page.tsx");
  const form = source("app/checkout/checkout-form.tsx");
  const actions = source("app/checkout/actions.ts");
  const billing = source("lib/billing.ts");

  assert.match(page, /manualPaymentEnabled=\{isKspayRestLiveEnabled\(\)\}/);
  assert.match(form, /manualPaymentEnabled\s*\?\s*\[\{ id: "manual"/);
  assert.match(actions, /!isKspayRestLiveEnabled\(\)[\s\S]*MANUAL_PAYMENT_DISABLED_MESSAGE/);
  assert.doesNotMatch(actions, /approvalNo:\s*`MB\$\{/);
  assert.doesNotMatch(actions, /result === null[\s\S]{0,300}status:\s*"PAID"/);
  assert.doesNotMatch(billing, /MANUAL_PAYMENT_TEST_EMAILS/);
  assert.match(MANUAL_PAYMENT_DISABLED_MESSAGE, /일반 카드결제/);
});
