import {
  createHash,
  createPrivateKey,
  randomUUID,
  sign,
  type KeyObject,
} from "node:crypto";
import type { z } from "zod";
import {
  billingApiErrorResponseSchema,
  billingCancelRequestResponseSchema,
  billingCancelRequestStatusResponseSchema,
  billingChargeResponseSchema,
  billingDeregisterResponseSchema,
  billingPaymentMethodListSchema,
  billingRegistrationIntentCreatedSchema,
  billingRegistrationStatusResponseSchema,
  type BillingCharge,
  type BillingPaymentMethod,
  type BillingRegistrationStatus,
} from "./billing-contract";

const PARTNER_ID = "laonshop";
const RESPONSE_LIMIT_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const LAONPAY_SELLER_ORIGIN = "https://pay.laonpay.com";

export const BILLING_SETTINGS_RETURN_URL = "https://laonshop.com/mypage/settings/billing/return";

export type LaonpayBillingEnv = {
  LAONPAY_PARTNER_KEY_ID?: string;
  LAONPAY_PARTNER_PRIVATE_KEY?: string;
  LAONPAY_BILLING_API_BASE?: string;
  LAONPAY_BILLING_SCHEMA_READY?: string;
  LAONPAY_BILLING_FEATURE_ENABLED?: string;
};

export type LaonpayBillingReadiness =
  | { ready: true; apiOrigin: string }
  | {
      ready: false;
      reason:
        | "NOT_PRODUCTION_RUNTIME"
        | "NOT_CONFIGURED"
        | "INVALID_API_BASE"
        | "INVALID_KEY_ID"
        | "INVALID_SIGNING_KEY"
        | "SCHEMA_NOT_READY"
        | "FEATURE_DISABLED";
    };

type BillingClientConfig = {
  keyId: string;
  privateKey: KeyObject;
  apiOrigin: string;
};

type RequestDependencies = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  nonce?: () => string;
};

type PartnerCallFailure = {
  ok: false;
  outcome: "NOT_CONFIGURED" | "REJECTED" | "UNKNOWN";
  errorCode?: string;
  httpStatus?: number;
};

export type PartnerCallResult<T> = { ok: true; data: T } | PartnerCallFailure;

type BillingRequest =
  | {
      method: "GET";
      pathWithQuery: string;
      body?: never;
      idempotencyKey?: never;
    }
  | {
      method: "POST";
      pathWithQuery: string;
      body: unknown;
      idempotencyKey: string;
    };

function envSnapshot(): LaonpayBillingEnv {
  return {
    LAONPAY_PARTNER_KEY_ID: process.env.LAONPAY_PARTNER_KEY_ID,
    LAONPAY_PARTNER_PRIVATE_KEY: process.env.LAONPAY_PARTNER_PRIVATE_KEY,
    LAONPAY_BILLING_API_BASE: process.env.LAONPAY_BILLING_API_BASE,
    LAONPAY_BILLING_SCHEMA_READY: process.env.LAONPAY_BILLING_SCHEMA_READY,
    LAONPAY_BILLING_FEATURE_ENABLED:
      process.env.LAONPAY_BILLING_FEATURE_ENABLED,
  };
}

function parseApiOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.origin !== LAONPAY_SELLER_ORIGIN ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function parsePrivateKey(value: string | undefined): KeyObject | null {
  if (!value?.trim()) return null;
  try {
    const normalized = value.includes("BEGIN PRIVATE KEY") ? value.replace(/\\n/g, "\n").trim() : null;
    const key = normalized
      ? createPrivateKey(normalized)
      : createPrivateKey({
          key: Buffer.from(value.trim(), "base64"),
          format: "der",
          type: "pkcs8",
        });
    return key.type === "private" && key.asymmetricKeyType === "ed25519" ? key : null;
  } catch {
    return null;
  }
}

function loadConfig(env: LaonpayBillingEnv): BillingClientConfig | null {
  const keyId = env.LAONPAY_PARTNER_KEY_ID?.trim();
  const apiOrigin = parseApiOrigin(env.LAONPAY_BILLING_API_BASE);
  const privateKey = parsePrivateKey(env.LAONPAY_PARTNER_PRIVATE_KEY);
  if (!keyId || !KEY_ID_PATTERN.test(keyId) || !apiOrigin || !privateKey) {
    return null;
  }
  return { keyId, apiOrigin, privateKey };
}

function getConfiguredBillingReadiness(
  injectedEnv?: LaonpayBillingEnv,
): LaonpayBillingReadiness {
  // 고정 복귀 URL과 HttpOnly 등록 쿠키는 apex 운영 도메인을 전제로 한다.
  // 앱 런타임에서는 Vercel Production만 허용하고, 명시적으로 env를 주입하는 단위 테스트는
  // 네트워크가 대체된 상태에서 계약 검증을 계속할 수 있게 한다.
  if (injectedEnv === undefined && process.env.VERCEL_ENV !== "production") {
    return { ready: false, reason: "NOT_PRODUCTION_RUNTIME" };
  }

  const env = injectedEnv ?? envSnapshot();
  const partnerValues = [
    env.LAONPAY_PARTNER_KEY_ID,
    env.LAONPAY_PARTNER_PRIVATE_KEY,
    env.LAONPAY_BILLING_API_BASE,
  ];
  const hasAny = partnerValues.some((value) => Boolean(value?.trim()));
  const hasAll = partnerValues.every((value) => Boolean(value?.trim()));
  if (!hasAny || !hasAll) return { ready: false, reason: "NOT_CONFIGURED" };
  if (!parseApiOrigin(env.LAONPAY_BILLING_API_BASE)) {
    return { ready: false, reason: "INVALID_API_BASE" };
  }
  const keyId = env.LAONPAY_PARTNER_KEY_ID?.trim();
  if (!keyId || !KEY_ID_PATTERN.test(keyId)) {
    return { ready: false, reason: "INVALID_KEY_ID" };
  }
  if (!parsePrivateKey(env.LAONPAY_PARTNER_PRIVATE_KEY)) {
    return { ready: false, reason: "INVALID_SIGNING_KEY" };
  }
  if (env.LAONPAY_BILLING_SCHEMA_READY !== "1") {
    return { ready: false, reason: "SCHEMA_NOT_READY" };
  }
  return { ready: true, apiOrigin: parseApiOrigin(env.LAONPAY_BILLING_API_BASE)! };
}

export function getLaonpayBillingReconciliationReadiness(
  injectedEnv?: LaonpayBillingEnv,
): LaonpayBillingReadiness {
  return getConfiguredBillingReadiness(injectedEnv);
}

export function getLaonpayBillingReadiness(
  injectedEnv?: LaonpayBillingEnv,
): LaonpayBillingReadiness {
  const configured = getConfiguredBillingReadiness(injectedEnv);
  if (!configured.ready) return configured;
  const env = injectedEnv ?? envSnapshot();
  if (env.LAONPAY_BILLING_FEATURE_ENABLED !== "1") {
    return { ready: false, reason: "FEATURE_DISABLED" };
  }
  return configured;
}

export function isLaonpayBillingReady(env?: LaonpayBillingEnv): boolean {
  return getLaonpayBillingReadiness(env).ready;
}

export function isLaonpayBillingReconciliationReady(
  env?: LaonpayBillingEnv,
): boolean {
  return getLaonpayBillingReconciliationReadiness(env).ready;
}

function requireOpaqueId(value: string, label: string): string {
  if (!OPAQUE_ID_PATTERN.test(value)) throw new Error(`${label} 형식이 올바르지 않습니다.`);
  return value;
}

function requireUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error("멱등키 형식이 올바르지 않습니다.");
  return value.toLowerCase();
}

export function createPartnerCanonical(input: {
  method: "GET" | "POST";
  pathWithQuery: string;
  timestamp: string;
  nonce: string;
  idempotencyKey: string;
  bodyText: string;
}): string {
  const bodyHash = createHash("sha256").update(input.bodyText, "utf8").digest("hex");
  const canonicalIdempotencyKey =
    input.method === "POST"
      ? requireUuid(input.idempotencyKey)
      : input.idempotencyKey === ""
        ? ""
        : (() => {
            throw new Error("GET canonical에는 멱등키를 포함할 수 없습니다.");
          })();
  return [
    "v1",
    input.method,
    input.pathWithQuery,
    input.timestamp,
    input.nonce,
    canonicalIdempotencyKey,
    bodyHash,
  ].join("\n");
}

export function createPartnerSignature(canonical: string, privateKey: KeyObject): string {
  if (privateKey.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("파트너 서명키가 올바르지 않습니다.");
  }
  return sign(null, Buffer.from(canonical, "utf8"), privateKey).toString("base64url");
}

async function readJsonWithLimit(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > RESPONSE_LIMIT_BYTES) {
    throw new Error("응답 크기 초과");
  }
  if (!response.body) throw new Error("빈 응답");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > RESPONSE_LIMIT_BYTES) {
        await reader.cancel("응답 크기 초과");
        throw new Error("응답 크기 초과");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks, totalBytes).toString("utf8")) as unknown;
}

function validateHostedUrl(
  value: string,
  apiOrigin: string,
  registrationId: string,
): boolean {
  try {
    const hosted = new URL(value);
    const hostedToken = hosted.pathname.startsWith("/billing/register/")
      ? hosted.pathname.slice("/billing/register/".length)
      : "";
    if (hostedToken.length > 150) return false;
    // LAONPAY hosted token은 lpbr1.<intent id>.<HMAC-SHA256 base64url>이며
    // 응답 registrationId와 같은 intent에 결박되어야 한다.
    const pathMatch = hosted.pathname.match(
      /^\/billing\/register\/lpbr1\.([A-Za-z0-9_-]{8,128})\.([A-Za-z0-9_-]{43})$/,
    );
    return (
      hosted.protocol === "https:" &&
      hosted.origin === apiOrigin &&
      !hosted.username &&
      !hosted.password &&
      !hosted.search &&
      !hosted.hash &&
      pathMatch?.[1] === registrationId
    );
  } catch {
    return false;
  }
}

export function createLaonpayBillingClient(
  injectedEnv?: LaonpayBillingEnv,
  dependencies: RequestDependencies = {},
) {
  const env = injectedEnv ?? envSnapshot();
  // Client 자체는 기존 resource의 signed GET 대사를 위해 feature kill switch가
  // 내려간 뒤에도 schema+partner 설정이 준비돼 있으면 생성할 수 있다. 신규 POST
  // 허용 여부는 각 Server Action의 feature 정책에서 별도로 막는다.
  const readiness = getLaonpayBillingReconciliationReadiness(injectedEnv);
  const config = readiness.ready ? loadConfig(env) : null;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
  const nonce = dependencies.nonce ?? randomUUID;

  async function request<T>(
    input: BillingRequest,
    schema: z.ZodType<T>,
  ): Promise<PartnerCallResult<T>> {
    if (!config) return { ok: false, outcome: "NOT_CONFIGURED" };
    const idempotencyKey =
      input.method === "POST" ? requireUuid(input.idempotencyKey) : "";
    const url = new URL(input.pathWithQuery, config.apiOrigin);
    if (url.origin !== config.apiOrigin || `${url.pathname}${url.search}` !== input.pathWithQuery) {
      return { ok: false, outcome: "REJECTED" };
    }

    const bodyText = input.body === undefined ? "" : JSON.stringify(input.body);
    const timestamp = String(Math.floor(now() / 1_000));
    const requestNonce = nonce();
    if (!UUID_PATTERN.test(requestNonce)) return { ok: false, outcome: "REJECTED" };
    const canonical = createPartnerCanonical({
      method: input.method,
      pathWithQuery: input.pathWithQuery,
      timestamp,
      nonce: requestNonce,
      idempotencyKey,
      bodyText,
    });
    const signature = createPartnerSignature(canonical, config.privateKey);

    try {
      const response = await fetchImpl(url, {
        method: input.method,
        headers: {
          Accept: "application/json",
          ...(input.body === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" }),
          "Cache-Control": "no-store",
          "x-laonpay-partner-id": PARTNER_ID,
          "x-laonpay-key-id": config.keyId,
          "x-laonpay-timestamp": timestamp,
          "x-laonpay-nonce": requestNonce,
          "x-laonpay-signature": signature,
          ...(input.method === "POST" ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: input.body === undefined ? undefined : bodyText,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await readJsonWithLimit(response);
      if (!response.ok) {
        const parsedError = billingApiErrorResponseSchema.safeParse(payload);
        return {
          ok: false,
          outcome:
            response.status >= 500 ||
            response.status === 408 ||
            response.status === 425 ||
            response.status === 429
              ? "UNKNOWN"
              : "REJECTED",
          errorCode: parsedError.success ? parsedError.data.error.code : undefined,
          httpStatus: response.status,
        };
      }
      const parsed = schema.safeParse(payload);
      return parsed.success ? { ok: true, data: parsed.data } : { ok: false, outcome: "UNKNOWN" };
    } catch {
      return { ok: false, outcome: "UNKNOWN" };
    }
  }

  return {
    readiness,

    async createRegistrationIntent(
      externalCustomerId: string,
      idempotencyKey: string,
    ): Promise<
      PartnerCallResult<{
        registrationId: string;
        hostedUrl: string;
        expiresAt: string;
        status: BillingRegistrationStatus;
      }>
    > {
      const result = await request(
        {
          method: "POST",
          pathWithQuery: "/api/partner/v1/billing/registration-intents",
          body: { externalCustomerId: requireOpaqueId(externalCustomerId, "고객 식별자"), returnTargetCode: "settings" },
          idempotencyKey,
        },
        billingRegistrationIntentCreatedSchema,
      );
      if (
        result.ok &&
        config &&
        !validateHostedUrl(
          result.data.hostedUrl,
          config.apiOrigin,
          result.data.registrationId,
        )
      ) {
        return { ok: false, outcome: "UNKNOWN" };
      }
      return result;
    },

    getRegistrationIntent(registrationId: string) {
      const id = requireOpaqueId(registrationId, "등록 식별자");
      return request(
        {
          method: "GET",
          pathWithQuery: `/api/partner/v1/billing/registration-intents/${encodeURIComponent(id)}`,
        },
        billingRegistrationStatusResponseSchema,
      );
    },

    listPaymentMethods(externalCustomerId: string) {
      const query = new URLSearchParams({
        externalCustomerId: requireOpaqueId(externalCustomerId, "고객 식별자"),
      });
      return request(
        {
          method: "GET",
          pathWithQuery: `/api/partner/v1/billing/payment-methods?${query.toString()}`,
        },
        billingPaymentMethodListSchema,
      );
    },

    chargePaymentMethod(
      paymentMethodId: string,
      body: {
        externalCustomerId: string;
        externalOrderId: string;
        amount: number;
        goodsName: string;
        buyerName: string;
        buyerPhone?: string;
        buyerEmail?: string;
      },
      idempotencyKey: string,
    ): Promise<PartnerCallResult<{ charge: BillingCharge }>> {
      const id = requireOpaqueId(paymentMethodId, "결제수단 식별자");
      return request(
        {
          method: "POST",
          pathWithQuery: `/api/partner/v1/billing/payment-methods/${encodeURIComponent(id)}/charges`,
          body: {
            externalCustomerId: requireOpaqueId(body.externalCustomerId, "고객 식별자"),
            externalOrderId: requireOpaqueId(body.externalOrderId, "주문 식별자"),
            amount: body.amount,
            goodsName: body.goodsName,
            buyerName: body.buyerName,
            ...(body.buyerPhone ? { buyerPhone: body.buyerPhone } : {}),
            ...(body.buyerEmail ? { buyerEmail: body.buyerEmail } : {}),
          },
          idempotencyKey,
        },
        billingChargeResponseSchema,
      );
    },

    getCharge(chargeId: string) {
      const id = requireOpaqueId(chargeId, "결제 식별자");
      return request(
        {
          method: "GET",
          pathWithQuery: `/api/partner/v1/billing/charges/${encodeURIComponent(id)}`,
        },
        billingChargeResponseSchema,
      );
    },

    deregisterPaymentMethod(
      paymentMethodId: string,
      externalCustomerId: string,
      idempotencyKey: string,
    ) {
      const id = requireOpaqueId(paymentMethodId, "결제수단 식별자");
      return request(
        {
          method: "POST",
          pathWithQuery: `/api/partner/v1/billing/payment-methods/${encodeURIComponent(id)}/deregister`,
          body: { externalCustomerId: requireOpaqueId(externalCustomerId, "고객 식별자") },
          idempotencyKey,
        },
        billingDeregisterResponseSchema,
      );
    },

    createCancelRequest(
      chargeId: string,
      externalCustomerId: string,
      reason: string | undefined,
      idempotencyKey: string,
    ) {
      const id = requireOpaqueId(chargeId, "결제 식별자");
      return request(
        {
          method: "POST",
          pathWithQuery: `/api/partner/v1/billing/charges/${encodeURIComponent(id)}/cancel-requests`,
          body: {
            externalCustomerId: requireOpaqueId(externalCustomerId, "고객 식별자"),
            ...(reason?.trim() ? { reason: reason.trim().slice(0, 200) } : {}),
          },
          idempotencyKey,
        },
        billingCancelRequestResponseSchema,
      );
    },

    getCancelRequest(cancelRequestId: string) {
      const id = requireOpaqueId(cancelRequestId, "취소요청 식별자");
      return request(
        {
          method: "GET",
          pathWithQuery: `/api/partner/v1/billing/cancel-requests/${encodeURIComponent(id)}`,
        },
        billingCancelRequestStatusResponseSchema,
      );
    },
  };
}

export type LaonpayBillingClient = ReturnType<typeof createLaonpayBillingClient>;
export type LaonpayPaymentMethod = BillingPaymentMethod;
