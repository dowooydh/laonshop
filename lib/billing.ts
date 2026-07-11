// 원클릭(빌링) 결제 — NEEDS_PG_SPEC: KSNET 빌링 승인 API(사업부 계약 + KSPAY_API_KEY) 미확보.
// 실연동 시 라온페이 pg-adapter 빌링 이식 후 allowlist·mock 승인을 제거한다.
// 실고객이 mock 승인으로 무결제 주문을 만드는 것을 차단하는 가드
export const BILLING_TEST_EMAILS = ["test@laonshop.com", "laontest@laontest.com"];
