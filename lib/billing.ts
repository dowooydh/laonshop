// 원클릭(빌링) 결제의 비활성 경계. LAONPAY hosted 연동이 준비된 지정 계정의
// 신규 체크아웃만 별도 서버 검증을 거쳐 허용하며, 재결제·과거 화면 재전송은 계속 닫아 둔다.
export const ONECLICK_PAYMENT_DISABLED_MESSAGE =
  "이 주문에서는 등록카드 결제를 이용할 수 없습니다. 일반 카드결제를 이용해 주세요.";
export const MANUAL_PAYMENT_DISABLED_MESSAGE =
  "수기결제는 현재 이용할 수 없습니다. 일반 카드결제를 이용해 주세요.";

export type DisabledBillingResult = { ok: false; error: string };

/**
 * 재결제 화면이나 연동 비대상 경로가 oneclick을 제출해도 주문 상태 변경 전에 거부한다.
 */
export function getDisabledBillingResult(method: string): DisabledBillingResult | null {
  return method === "oneclick" ? { ok: false, error: ONECLICK_PAYMENT_DISABLED_MESSAGE } : null;
}
