// 원클릭(빌링) 결제 — NEEDS_PG_SPEC: KSNET 빌링키 등록·승인·해지 계약과 API 스펙 미확보.
// 카드 원문을 쇼핑몰 서버가 받거나 mock 승인으로 주문을 완료하지 않도록 운영 경로를 닫아 둔다.
export const ONECLICK_PAYMENT_DISABLED_MESSAGE =
  "원클릭 결제는 현재 이용할 수 없습니다. 일반 카드결제를 이용해 주세요.";
export const MANUAL_PAYMENT_DISABLED_MESSAGE =
  "수기결제는 현재 이용할 수 없습니다. 일반 카드결제를 이용해 주세요.";

export type DisabledBillingResult = { ok: false; error: string };

/**
 * 이전 화면이나 재전송 요청이 oneclick을 제출해도 주문 생성·상태 변경 전에 일관되게 거부한다.
 */
export function getDisabledBillingResult(method: string): DisabledBillingResult | null {
  return method === "oneclick" ? { ok: false, error: ONECLICK_PAYMENT_DISABLED_MESSAGE } : null;
}
