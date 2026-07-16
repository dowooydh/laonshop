export const BILLING_REVIEW_ACCOUNT_EMAIL = "laontest@laontest.com";
export const BILLING_REVIEW_STORAGE_KEY = "laonshop:billing-review:v1";

const REVIEW_MASKED_CARD_NUMBER = "•••• •••• •••• 1234";
const REVIEW_SNAPSHOT_VERSION = 1;

export type BillingReviewSnapshot = {
  version: 1;
  maskedCardNumb: string;
  dateLabel: string;
};

/**
 * 서버에서 인증된 계정 이메일을 정확히 비교한다.
 * 비슷한 주소나 클라이언트 쿼리로 시연 UI가 열리지 않도록 정규화하지 않는다.
 */
export function isBillingReviewAccount(email: string): boolean {
  return email === BILLING_REVIEW_ACCOUNT_EMAIL;
}

export function createBillingReviewSnapshot(now = new Date()): BillingReviewSnapshot {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return {
    version: REVIEW_SNAPSHOT_VERSION,
    maskedCardNumb: REVIEW_MASKED_CARD_NUMBER,
    dateLabel: `${year}. ${month}. ${day}.`,
  };
}

/**
 * sessionStorage가 변조되거나 이전 형식이어도 표시 데이터로 사용하지 않는다.
 * 허용하는 값은 버전·고정 마스킹 번호·등록일뿐이다.
 */
export function parseBillingReviewSnapshot(raw: string | null): BillingReviewSnapshot | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.join(",") !== "dateLabel,maskedCardNumb,version") return null;
    if (record.version !== REVIEW_SNAPSHOT_VERSION) return null;
    if (record.maskedCardNumb !== REVIEW_MASKED_CARD_NUMBER) return null;
    if (typeof record.dateLabel !== "string" || !/^\d{4}\. \d{2}\. \d{2}\.$/.test(record.dateLabel)) return null;

    return {
      version: REVIEW_SNAPSHOT_VERSION,
      maskedCardNumb: REVIEW_MASKED_CARD_NUMBER,
      dateLabel: record.dateLabel,
    };
  } catch {
    return null;
  }
}

export function serializeBillingReviewSnapshot(snapshot: BillingReviewSnapshot): string {
  return JSON.stringify({
    version: snapshot.version,
    maskedCardNumb: snapshot.maskedCardNumb,
    dateLabel: snapshot.dateLabel,
  });
}
