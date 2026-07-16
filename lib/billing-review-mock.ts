export const BILLING_REVIEW_ACCOUNT_EMAIL = "laontest@laontest.com";
export const BILLING_REVIEW_STORAGE_KEY = "laonshop:billing-review:v2";
export const BILLING_REVIEW_LEGACY_STORAGE_KEY = "laonshop:billing-review:v1";
export const BILLING_REVIEW_CHARGE_AMOUNT = 1_004;

const REVIEW_SNAPSHOT_VERSION = 2;
const REVIEW_CARD_ISSUER = "KSNET 개발계 카드";
const REVIEW_CARD_LAST4 = "1234";
const OPAQUE_ID_ATTEMPTS = 32;

export type BillingReviewCardStatus = "ACTIVE" | "DEREGISTERED";
export type BillingReviewQueryStatus = "NOT_REQUESTED" | "FOUND" | "NOT_FOUND";
export type BillingReviewChargeStatus = "NOT_REQUESTED" | "SUCCEEDED" | "DECLINED" | "PENDING_REVIEW";
export type BillingReviewChargeOutcome = "success" | "declined" | "indeterminate";

export type BillingReviewSnapshot = {
  version: 2;
  paymentMethodId: string;
  cardIssuer: string;
  cardLast4: string;
  registeredAt: string;
  cardStatus: BillingReviewCardStatus;
  queryStatus: BillingReviewQueryStatus;
  chargeStatus: BillingReviewChargeStatus;
  chargeAmount: number | null;
  chargeRequestId: string | null;
};

const SNAPSHOT_KEYS = [
  "cardIssuer",
  "cardLast4",
  "cardStatus",
  "chargeAmount",
  "chargeRequestId",
  "chargeStatus",
  "paymentMethodId",
  "queryStatus",
  "registeredAt",
  "version",
].sort();

/** 서버에서 인증된 계정 이메일과 정확히 일치할 때만 시연 UI를 연다. */
export function isBillingReviewAccount(email: string): boolean {
  return email === BILLING_REVIEW_ACCOUNT_EMAIL;
}

function opaqueId(prefix: "pm" | "req", candidate: string): string | null {
  const normalized = candidate.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 64);
  return normalized.length >= 16 ? `${prefix}_${normalized}` : null;
}

export function createBillingReviewPaymentMethodId(
  nextCandidate: () => string,
  existingIds: ReadonlySet<string> = new Set(),
): string {
  for (let attempt = 0; attempt < OPAQUE_ID_ATTEMPTS; attempt += 1) {
    const paymentMethodId = opaqueId("pm", nextCandidate());
    if (paymentMethodId && !existingIds.has(paymentMethodId)) return paymentMethodId;
  }
  throw new Error("시연용 결제수단 식별자를 안전하게 생성하지 못했습니다.");
}

export function createBillingReviewRequestId(nextCandidate: () => string): string {
  for (let attempt = 0; attempt < OPAQUE_ID_ATTEMPTS; attempt += 1) {
    const requestId = opaqueId("req", nextCandidate());
    if (requestId) return requestId;
  }
  throw new Error("시연용 요청 식별자를 안전하게 생성하지 못했습니다.");
}

export function createBillingReviewSnapshot(
  paymentMethodId: string,
  now = new Date(),
): BillingReviewSnapshot {
  if (!isPaymentMethodId(paymentMethodId)) throw new Error("시연용 결제수단 식별자가 올바르지 않습니다.");

  return {
    version: REVIEW_SNAPSHOT_VERSION,
    paymentMethodId,
    cardIssuer: REVIEW_CARD_ISSUER,
    cardLast4: REVIEW_CARD_LAST4,
    registeredAt: now.toISOString(),
    cardStatus: "ACTIVE",
    queryStatus: "NOT_REQUESTED",
    chargeStatus: "NOT_REQUESTED",
    chargeAmount: null,
    chargeRequestId: null,
  };
}

export function queryBillingReviewCard(snapshot: BillingReviewSnapshot): BillingReviewSnapshot {
  if (snapshot.queryStatus === "FOUND" || snapshot.queryStatus === "NOT_FOUND") return snapshot;
  return {
    ...snapshot,
    queryStatus: snapshot.cardStatus === "ACTIVE" ? "FOUND" : "NOT_FOUND",
  };
}

export function chargeBillingReviewCard(
  snapshot: BillingReviewSnapshot,
  outcome: BillingReviewChargeOutcome,
  requestId: string,
): BillingReviewSnapshot {
  if (snapshot.cardStatus !== "ACTIVE") throw new Error("해지된 결제수단으로는 결제할 수 없습니다.");
  if (snapshot.queryStatus !== "FOUND") throw new Error("등록 조회가 완료된 결제수단만 사용할 수 있습니다.");
  if (snapshot.chargeStatus !== "NOT_REQUESTED") return snapshot;
  if (!isRequestId(requestId)) throw new Error("시연용 요청 식별자가 올바르지 않습니다.");
  if (!(["success", "declined", "indeterminate"] as const).includes(outcome)) {
    throw new Error("시연용 결제 결과가 올바르지 않습니다.");
  }

  const chargeStatus: BillingReviewChargeStatus =
    outcome === "success" ? "SUCCEEDED" : outcome === "declined" ? "DECLINED" : "PENDING_REVIEW";

  return {
    ...snapshot,
    chargeStatus,
    chargeAmount: BILLING_REVIEW_CHARGE_AMOUNT,
    chargeRequestId: requestId,
  };
}

export function deregisterBillingReviewCard(snapshot: BillingReviewSnapshot): BillingReviewSnapshot {
  if (snapshot.cardStatus === "DEREGISTERED") return snapshot;
  if (snapshot.chargeStatus === "PENDING_REVIEW") {
    throw new Error("결제 결과 확인 대기 중에는 등록을 해지할 수 없습니다.");
  }
  return {
    ...snapshot,
    cardStatus: "DEREGISTERED",
    queryStatus: "NOT_FOUND",
  };
}

function isPaymentMethodId(value: unknown): value is string {
  return typeof value === "string" && /^pm_[a-z0-9]{16,64}$/.test(value);
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^req_[a-z0-9]{16,64}$/.test(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isSnapshotStateConsistent(snapshot: BillingReviewSnapshot): boolean {
  if (snapshot.cardStatus === "DEREGISTERED" && snapshot.queryStatus !== "NOT_FOUND") return false;
  if (snapshot.cardStatus === "ACTIVE" && snapshot.queryStatus === "NOT_FOUND") return false;
  if (snapshot.chargeStatus === "PENDING_REVIEW" && snapshot.cardStatus !== "ACTIVE") return false;
  if (
    snapshot.chargeStatus !== "NOT_REQUESTED" &&
    snapshot.cardStatus === "ACTIVE" &&
    snapshot.queryStatus !== "FOUND"
  ) {
    return false;
  }

  if (snapshot.chargeStatus === "NOT_REQUESTED") {
    return snapshot.chargeAmount === null && snapshot.chargeRequestId === null;
  }
  return snapshot.chargeAmount === BILLING_REVIEW_CHARGE_AMOUNT && isRequestId(snapshot.chargeRequestId);
}

/** 변조되거나 과거 형식인 sessionStorage 값은 시연 상태로 사용하지 않는다. */
export function parseBillingReviewSnapshot(raw: string | null): BillingReviewSnapshot | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== SNAPSHOT_KEYS.join(",")) return null;
    if (record.version !== REVIEW_SNAPSHOT_VERSION) return null;
    if (!isPaymentMethodId(record.paymentMethodId)) return null;
    if (record.cardIssuer !== REVIEW_CARD_ISSUER || record.cardLast4 !== REVIEW_CARD_LAST4) return null;
    if (!isIsoDate(record.registeredAt)) return null;
    if (!(["ACTIVE", "DEREGISTERED"] as const).includes(record.cardStatus as BillingReviewCardStatus)) return null;
    if (!(["NOT_REQUESTED", "FOUND", "NOT_FOUND"] as const).includes(record.queryStatus as BillingReviewQueryStatus)) return null;
    if (!(["NOT_REQUESTED", "SUCCEEDED", "DECLINED", "PENDING_REVIEW"] as const).includes(record.chargeStatus as BillingReviewChargeStatus)) return null;
    if (record.chargeAmount !== null && record.chargeAmount !== BILLING_REVIEW_CHARGE_AMOUNT) return null;
    if (record.chargeRequestId !== null && !isRequestId(record.chargeRequestId)) return null;

    const snapshot = record as BillingReviewSnapshot;
    return isSnapshotStateConsistent(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

/** 직렬화 허용 목록에는 불투명 식별자·표시정보·Mock 상태만 포함한다. */
export function serializeBillingReviewSnapshot(snapshot: BillingReviewSnapshot): string {
  return JSON.stringify({
    version: snapshot.version,
    paymentMethodId: snapshot.paymentMethodId,
    cardIssuer: snapshot.cardIssuer,
    cardLast4: snapshot.cardLast4,
    registeredAt: snapshot.registeredAt,
    cardStatus: snapshot.cardStatus,
    queryStatus: snapshot.queryStatus,
    chargeStatus: snapshot.chargeStatus,
    chargeAmount: snapshot.chargeAmount,
    chargeRequestId: snapshot.chargeRequestId,
  });
}
