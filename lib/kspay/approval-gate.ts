/** 카드사 심사용 테스트 MID. 승인 후 수 분 내 자동취소되는 KSNET 개발계 전용 값이다. */
export const KSPAY_REVIEW_STORE_ID = "2999199999";

/**
 * NEEDS_PG_SPEC: reCommConId/reHash를 주문에 사전 결박하는 KSNET 검증 규격을 받기 전에는
 * 실 MID 서버승인을 열지 않는다. 사후 ordno 검증만으로는 교차 인증키의 orphan 승인을
 * 완전히 막을 수 없으므로 현재 심사용 테스트 MID만 허용한다.
 */
export function isKspayResultApprovalEnabled(storeId = process.env.KSPAY_STORE_ID): boolean {
  return storeId === KSPAY_REVIEW_STORE_ID;
}
