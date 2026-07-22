export const MANUAL_PAYMENT_REVIEW_EMAIL = "laontest@laontest.com";
export const MANUAL_PAYMENT_DEMO_APPROVAL_PREFIX = "DEMO-";

export const MANUAL_PAYMENT_ISSUERS = [
  { code: "SHINHAN", label: "신한카드" },
  { code: "KB", label: "KB국민카드" },
  { code: "SAMSUNG", label: "삼성카드" },
  { code: "HYUNDAI", label: "현대카드" },
  { code: "LOTTE", label: "롯데카드" },
  { code: "HANA", label: "하나카드" },
  { code: "WOORI", label: "우리카드" },
  { code: "NH", label: "NH농협카드" },
  { code: "BC", label: "BC카드" },
] as const;

export type ManualPaymentIssuerCode =
  (typeof MANUAL_PAYMENT_ISSUERS)[number]["code"];
export type ManualPaymentMode = "disabled" | "review-demo" | "live";

export type ManualPaymentCardInput = {
  issuerCode: string;
  cardNo: string;
  expMm: string;
  expYy: string;
  pw2: string;
  birth6: string;
};

// 실제 카드번호가 될 수 없도록 Luhn 검사를 통과하지 않는 고정 시연값만 허용한다.
export const MANUAL_PAYMENT_DEMO_CARD: ManualPaymentCardInput = {
  issuerCode: "SHINHAN",
  cardNo: "9999999999999999",
  expMm: "12",
  expYy: "30",
  pw2: "00",
  birth6: "900101",
};

export function isManualPaymentReviewAccount(email: string): boolean {
  return email.trim().toLowerCase() === MANUAL_PAYMENT_REVIEW_EMAIL;
}

export function resolveManualPaymentMode(
  email: string,
  liveEnabled: boolean,
): ManualPaymentMode {
  // 심사 계정은 운영 구인증 설정이 생겨도 실제 카드 승인 대신 시연 경로만 사용한다.
  if (isManualPaymentReviewAccount(email)) return "review-demo";
  return liveEnabled ? "live" : "disabled";
}

export function getManualPaymentIssuerLabel(code: string): string | null {
  return MANUAL_PAYMENT_ISSUERS.find((issuer) => issuer.code === code)?.label ?? null;
}

export function normalizeManualCardNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 16);
}

export function isManualPaymentFormComplete(
  input: ManualPaymentCardInput,
): boolean {
  return (
    getManualPaymentIssuerLabel(input.issuerCode) !== null &&
    /^\d{15,16}$/.test(normalizeManualCardNumber(input.cardNo)) &&
    /^(0[1-9]|1[0-2])$/.test(input.expMm) &&
    /^\d{2}$/.test(input.expYy) &&
    /^\d{2}$/.test(input.pw2) &&
    /^\d{6}(\d{4})?$/.test(input.birth6)
  );
}

export function isManualPaymentDemoInput(
  input: ManualPaymentCardInput,
): boolean {
  return (
    isManualPaymentFormComplete(input) &&
    normalizeManualCardNumber(input.cardNo) === MANUAL_PAYMENT_DEMO_CARD.cardNo &&
    input.expMm === MANUAL_PAYMENT_DEMO_CARD.expMm &&
    input.expYy === MANUAL_PAYMENT_DEMO_CARD.expYy &&
    input.pw2 === MANUAL_PAYMENT_DEMO_CARD.pw2 &&
    input.birth6 === MANUAL_PAYMENT_DEMO_CARD.birth6
  );
}

export function createManualPaymentDemoApproval(orderId: string): string {
  return `${MANUAL_PAYMENT_DEMO_APPROVAL_PREFIX}${orderId.slice(-10).toUpperCase()}`;
}
