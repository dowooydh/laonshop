import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  verify,
  type KeyObject,
} from "node:crypto";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createLaonpayBillingClient } from "../../lib/laonpay/billing-client";

const API_ORIGIN = "https://pay.laonpay.com";
const CUSTOMER_ID = "customer_http_123";
const OTHER_CUSTOMER_ID = "customer_http_456";
const REGISTRATION_ID = "registration_http_123";
const PAYMENT_METHOD_ID = "payment_method_http_123";
const ORDER_ID = "order_http_123";
const CHARGE_ID = "charge_http_123";
const CANCEL_REQUEST_ID = "cancel_request_http_123";
const PAYMENT_ID = "payment_http_123";
const ISO_DATE = "2027-02-01T09:00:00.000Z";
const PROCESSED_DATE = "2027-02-01T09:01:00.000Z";
const REGISTRATION_KEY = "11111111-1111-4111-8111-111111111111";
const CHARGE_KEY = "22222222-2222-4222-8222-222222222222";
const CANCEL_KEY = "33333333-3333-4333-8333-333333333333";
const DEREGISTER_KEY = "44444444-4444-4444-8444-444444444444";
const HOSTED_SIGNATURE = "h".repeat(43);

type FaultMode =
  | "NONE"
  | "CHARGE_503"
  | "CHARGE_TIMEOUT"
  | "CHARGE_UNKNOWN"
  | "CANCEL_503"
  | "DEREGISTER_503";

type CapturedPartnerRequest = {
  method: "GET" | "POST";
  pathWithQuery: string;
  bodyText: string;
  idempotencyKey: string | null;
  verified: boolean;
};

type IdempotencyRecord = {
  bodyText: string;
  response: unknown;
};

type HarnessState = {
  registrationStatus: "PENDING" | "SUCCEEDED";
  paymentMethodStatus: "ACTIVE" | "DEREGISTERED";
  chargeStatus: "PAID" | "UNKNOWN" | "CANCEL_REQUESTED" | "CANCELED";
  faultMode: FaultMode;
  registrationCreates: number;
  hostedCompletions: number;
  chargeProviderCalls: number;
  cancelProviderCalls: number;
  deregisterProviderCalls: number;
  registrationRecords: Map<string, IdempotencyRecord>;
  chargeRecords: Map<string, IdempotencyRecord>;
  cancelRecords: Map<string, IdempotencyRecord>;
  deregisterRecords: Map<string, IdempotencyRecord>;
  partnerRequests: CapturedPartnerRequest[];
  responseBodies: string[];
  handlerErrors: Error[];
};

type HttpHarness = {
  state: HarnessState;
  loopbackOrigin: string;
  fetchImpl: typeof fetch;
  completeHostedRegistration: () => Promise<void>;
  close: () => Promise<void>;
};

function jsonResponse(
  response: ServerResponse,
  payload: unknown,
  status = 200,
  state?: HarnessState,
) {
  const body = JSON.stringify(payload);
  state?.responseBodies.push(body);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function paymentMethod(status: "ACTIVE" | "DEREGISTERED") {
  return {
    id: PAYMENT_METHOD_ID,
    cardName: "개발계 테스트카드",
    cardLast4: "4242",
    cardType: "CREDIT",
    status,
    registeredAt: ISO_DATE,
    verifiedAt: ISO_DATE,
    deregisteredAt: status === "DEREGISTERED" ? PROCESSED_DATE : null,
  };
}

function fullCharge(status: HarnessState["chargeStatus"]) {
  return {
    id: CHARGE_ID,
    externalOrderId: ORDER_ID,
    status,
    amount: 1_004,
    paymentId: status === "UNKNOWN" ? null : PAYMENT_ID,
    createdAt: ISO_DATE,
    updatedAt: status === "PAID" || status === "UNKNOWN" ? ISO_DATE : PROCESSED_DATE,
    error:
      status === "UNKNOWN"
        ? { code: "RESULT_UNKNOWN", message: "결제 결과 확인이 필요합니다." }
        : null,
  };
}

function fullCancelRequest(
  status: "REQUESTED" | "DONE",
  chargeStatus: "CANCEL_REQUESTED" | "CANCELED",
  idempotent: boolean,
) {
  return {
    cancelRequest: {
      id: CANCEL_REQUEST_ID,
      status,
      reason: "구매자 전체취소 요청",
      rejectReason: null,
      createdAt: ISO_DATE,
      processedAt: status === "DONE" ? PROCESSED_DATE : null,
    },
    charge: fullCharge(chargeStatus),
    idempotent,
  };
}

function assertSafeObjectKeys(value: unknown, path = "payload") {
  const forbiddenKeys = new Set([
    "authorization",
    "apikey",
    "pgapi",
    "ekey",
    "hkey",
    "msalt",
    "privatekey",
    "providersecret",
    "billingtoken",
    "providertoken",
    "cardnumber",
    "cardno",
    "cardnumb",
    "pan",
    "cvc",
    "cvv",
    "expiry",
    "cardexpiry",
    "cardpassword",
    "tid",
    "transactionid",
  ]);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeObjectKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[-_]/g, "").toLowerCase();
    assert.equal(forbiddenKeys.has(normalized), false, `${path}.${key}는 허용되지 않습니다.`);
    assertSafeObjectKeys(child, `${path}.${key}`);
  }
}

function assertPartnerSignature(
  request: IncomingMessage,
  body: Buffer,
  publicKey: KeyObject,
): CapturedPartnerRequest {
  const method = request.method;
  assert.ok(method === "GET" || method === "POST");
  const pathWithQuery = request.url ?? "";
  const timestamp = request.headers["x-laonpay-timestamp"];
  const nonce = request.headers["x-laonpay-nonce"];
  const signature = request.headers["x-laonpay-signature"];
  const idempotencyKey = request.headers["idempotency-key"];

  assert.equal(request.headers["x-laonpay-partner-id"], "laonshop");
  assert.equal(request.headers["x-laonpay-key-id"], "test-partner-key");
  assert.equal(request.headers.authorization, undefined);
  assert.equal(typeof timestamp, "string");
  assert.equal(typeof nonce, "string");
  assert.match(String(nonce), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(typeof signature, "string");

  const canonicalIdempotencyKey = method === "POST" ? String(idempotencyKey) : "";
  if (method === "POST") {
    assert.match(canonicalIdempotencyKey, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(canonicalIdempotencyKey, canonicalIdempotencyKey.toLowerCase());
  } else {
    assert.equal(idempotencyKey, undefined);
    assert.equal(body.byteLength, 0);
  }

  const canonical = [
    "v1",
    method,
    pathWithQuery,
    String(timestamp),
    String(nonce),
    canonicalIdempotencyKey,
    createHash("sha256").update(body).digest("hex"),
  ].join("\n");
  const verified = verify(
    null,
    Buffer.from(canonical, "utf8"),
    publicKey,
    Buffer.from(String(signature), "base64url"),
  );
  assert.equal(verified, true);

  return {
    method,
    pathWithQuery,
    bodyText: body.toString("utf8"),
    idempotencyKey: method === "POST" ? canonicalIdempotencyKey : null,
    verified,
  };
}

function parseJsonBody(bodyText: string): Record<string, unknown> {
  const value = JSON.parse(bodyText) as unknown;
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assertSafeObjectKeys(value);
  return value as Record<string, unknown>;
}

function checkIdempotency(
  records: Map<string, IdempotencyRecord>,
  key: string,
  bodyText: string,
): { kind: "NEW" } | { kind: "REPLAY"; response: unknown } | { kind: "CONFLICT" } {
  const previous = records.get(key);
  if (!previous) return { kind: "NEW" };
  if (previous.bodyText !== bodyText) return { kind: "CONFLICT" };
  return { kind: "REPLAY", response: previous.response };
}

async function startHarness(publicKey: KeyObject): Promise<HttpHarness> {
  const state: HarnessState = {
    registrationStatus: "PENDING",
    paymentMethodStatus: "ACTIVE",
    chargeStatus: "PAID",
    faultMode: "NONE",
    registrationCreates: 0,
    hostedCompletions: 0,
    chargeProviderCalls: 0,
    cancelProviderCalls: 0,
    deregisterProviderCalls: 0,
    registrationRecords: new Map(),
    chargeRecords: new Map(),
    cancelRecords: new Map(),
    deregisterRecords: new Map(),
    partnerRequests: [],
    responseBodies: [],
    handlerErrors: [],
  };

  const server = createServer(async (request, response) => {
    try {
      const body = await readRawBody(request);
      const pathWithQuery = request.url ?? "";

      if (pathWithQuery === "/__test__/hosted/complete") {
        const payload = parseJsonBody(body.toString("utf8"));
        assert.deepEqual(payload, {
          registrationId: REGISTRATION_ID,
          scenario: "SUCCEEDED",
        });
        state.registrationStatus = "SUCCEEDED";
        state.hostedCompletions += 1;
        response.writeHead(204, { "Cache-Control": "no-store" });
        response.end();
        return;
      }

      const captured = assertPartnerSignature(request, body, publicKey);
      state.partnerRequests.push(captured);
      const payload = captured.method === "POST" ? parseJsonBody(captured.bodyText) : null;
      const key = captured.idempotencyKey ?? "";

      if (
        captured.method === "POST" &&
        pathWithQuery === "/api/partner/v1/billing/registration-intents"
      ) {
        const idempotency = checkIdempotency(state.registrationRecords, key, captured.bodyText);
        if (idempotency.kind === "CONFLICT") {
          jsonResponse(response, { error: { code: "IDEMPOTENCY_CONFLICT", message: "동일 키의 요청 내용이 다릅니다." } }, 409, state);
          return;
        }
        if (idempotency.kind === "REPLAY") {
          jsonResponse(response, idempotency.response, 200, state);
          return;
        }
        assert.deepEqual(payload, {
          externalCustomerId: CUSTOMER_ID,
          returnTargetCode: "settings",
        });
        const created = {
          registrationId: REGISTRATION_ID,
          hostedUrl: `${API_ORIGIN}/billing/register/lpbr1.${REGISTRATION_ID}.${HOSTED_SIGNATURE}`,
          expiresAt: ISO_DATE,
          status: "PENDING",
        };
        state.registrationCreates += 1;
        state.registrationRecords.set(key, { bodyText: captured.bodyText, response: created });
        jsonResponse(response, created, 201, state);
        return;
      }

      if (
        captured.method === "GET" &&
        pathWithQuery === `/api/partner/v1/billing/registration-intents/${REGISTRATION_ID}`
      ) {
        jsonResponse(
          response,
          {
            registrationId: REGISTRATION_ID,
            status: state.registrationStatus,
            expiresAt: ISO_DATE,
            paymentMethod:
              state.registrationStatus === "SUCCEEDED"
                ? paymentMethod(state.paymentMethodStatus)
                : null,
            error: null,
          },
          200,
          state,
        );
        return;
      }

      if (
        captured.method === "GET" &&
        pathWithQuery ===
          `/api/partner/v1/billing/payment-methods?externalCustomerId=${CUSTOMER_ID}`
      ) {
        jsonResponse(response, { paymentMethods: [paymentMethod(state.paymentMethodStatus)] }, 200, state);
        return;
      }

      if (
        captured.method === "POST" &&
        pathWithQuery ===
          `/api/partner/v1/billing/payment-methods/${PAYMENT_METHOD_ID}/charges`
      ) {
        const idempotency = checkIdempotency(state.chargeRecords, key, captured.bodyText);
        if (idempotency.kind === "CONFLICT") {
          jsonResponse(response, { error: { code: "IDEMPOTENCY_CONFLICT", message: "동일 키의 요청 내용이 다릅니다." } }, 409, state);
          return;
        }
        if (idempotency.kind === "REPLAY") {
          jsonResponse(response, idempotency.response, 200, state);
          return;
        }
        state.chargeProviderCalls += 1;
        assert.equal(payload?.externalCustomerId, CUSTOMER_ID);
        assert.equal(payload?.externalOrderId, ORDER_ID);
        assert.equal(payload?.amount, 1_004);
        if (state.faultMode === "CHARGE_503") {
          jsonResponse(response, { error: { code: "UPSTREAM_UNAVAILABLE", message: "상태 확인이 필요합니다." } }, 503, state);
          return;
        }
        if (state.faultMode === "CHARGE_TIMEOUT") {
          await new Promise((resolve) => setTimeout(resolve, 150));
          if (!response.destroyed) {
            jsonResponse(response, { error: { code: "LATE_RESULT", message: "늦은 응답입니다." } }, 503, state);
          }
          return;
        }
        state.chargeStatus = state.faultMode === "CHARGE_UNKNOWN" ? "UNKNOWN" : "PAID";
        const charge = { charge: fullCharge(state.chargeStatus) };
        state.chargeRecords.set(key, { bodyText: captured.bodyText, response: charge });
        jsonResponse(response, charge, state.chargeProviderCalls === 1 ? 201 : 200, state);
        return;
      }

      if (
        captured.method === "GET" &&
        pathWithQuery === `/api/partner/v1/billing/charges/${CHARGE_ID}`
      ) {
        jsonResponse(response, { charge: fullCharge(state.chargeStatus) }, 200, state);
        return;
      }

      if (
        captured.method === "POST" &&
        pathWithQuery === `/api/partner/v1/billing/charges/${CHARGE_ID}/cancel-requests`
      ) {
        const idempotency = checkIdempotency(state.cancelRecords, key, captured.bodyText);
        if (idempotency.kind === "CONFLICT") {
          jsonResponse(response, { error: { code: "IDEMPOTENCY_CONFLICT", message: "동일 키의 요청 내용이 다릅니다." } }, 409, state);
          return;
        }
        if (idempotency.kind === "REPLAY") {
          jsonResponse(response, idempotency.response, 200, state);
          return;
        }
        state.cancelProviderCalls += 1;
        assert.deepEqual(payload, {
          externalCustomerId: CUSTOMER_ID,
          reason: "구매자 전체취소 요청",
        });
        if (state.faultMode === "CANCEL_503") {
          jsonResponse(response, { error: { code: "UPSTREAM_UNAVAILABLE", message: "취소요청 상태 확인이 필요합니다." } }, 503, state);
          return;
        }
        state.chargeStatus = "CANCEL_REQUESTED";
        const cancel = fullCancelRequest("REQUESTED", "CANCEL_REQUESTED", false);
        state.cancelRecords.set(key, { bodyText: captured.bodyText, response: cancel });
        jsonResponse(response, cancel, 201, state);
        return;
      }

      if (
        captured.method === "GET" &&
        pathWithQuery === `/api/partner/v1/billing/cancel-requests/${CANCEL_REQUEST_ID}`
      ) {
        state.chargeStatus = "CANCELED";
        const completed = fullCancelRequest("DONE", "CANCELED", true);
        jsonResponse(
          response,
          {
            cancelRequest: completed.cancelRequest,
            charge: completed.charge,
          },
          200,
          state,
        );
        return;
      }

      if (
        captured.method === "POST" &&
        pathWithQuery ===
          `/api/partner/v1/billing/payment-methods/${PAYMENT_METHOD_ID}/deregister`
      ) {
        const idempotency = checkIdempotency(state.deregisterRecords, key, captured.bodyText);
        if (idempotency.kind === "CONFLICT") {
          jsonResponse(response, { error: { code: "IDEMPOTENCY_CONFLICT", message: "동일 키의 요청 내용이 다릅니다." } }, 409, state);
          return;
        }
        if (idempotency.kind === "REPLAY") {
          jsonResponse(response, idempotency.response, 200, state);
          return;
        }
        state.deregisterProviderCalls += 1;
        assert.deepEqual(payload, { externalCustomerId: CUSTOMER_ID });
        if (state.faultMode === "DEREGISTER_503") {
          jsonResponse(response, { error: { code: "UPSTREAM_UNAVAILABLE", message: "해지 상태 확인이 필요합니다." } }, 503, state);
          return;
        }
        state.paymentMethodStatus = "DEREGISTERED";
        const deregistered = {
          paymentMethod: {
            id: PAYMENT_METHOD_ID,
            status: "DEREGISTERED",
            deregisteredAt: PROCESSED_DATE,
            updatedAt: PROCESSED_DATE,
          },
          idempotent: false,
        };
        state.deregisterRecords.set(key, { bodyText: captured.bodyText, response: deregistered });
        jsonResponse(response, deregistered, 200, state);
        return;
      }

      jsonResponse(response, { error: { code: "NOT_FOUND", message: "테스트 경로가 없습니다." } }, 404, state);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      state.handlerErrors.push(normalized);
      if (!response.headersSent && !response.destroyed) {
        jsonResponse(response, { error: { code: "HARNESS_ASSERTION", message: "계약 검증 실패" } }, 500, state);
      } else if (!response.destroyed) {
        response.destroy();
      }
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const loopbackOrigin = `http://127.0.0.1:${address.port}`;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const logicalUrl = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(logicalUrl.origin, API_ORIGIN);
    const target = `${loopbackOrigin}${logicalUrl.pathname}${logicalUrl.search}`;
    const timeoutSignal =
      state.faultMode === "CHARGE_TIMEOUT" && logicalUrl.pathname.endsWith("/charges")
        ? AbortSignal.timeout(35)
        : undefined;
    const signal =
      timeoutSignal && init?.signal
        ? AbortSignal.any([timeoutSignal, init.signal])
        : timeoutSignal ?? init?.signal;
    return fetch(target, { ...init, signal });
  }) as typeof fetch;

  return {
    state,
    loopbackOrigin,
    fetchImpl,
    async completeHostedRegistration() {
      const response = await fetch(`${loopbackOrigin}/__test__/hosted/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: REGISTRATION_ID,
          scenario: "SUCCEEDED",
        }),
      });
      assert.equal(response.status, 204);
    },
    async close() {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    },
  };
}

function createClientAndHarnessEnv(privateKey: KeyObject) {
  return {
    LAONPAY_PARTNER_KEY_ID: "test-partner-key",
    LAONPAY_PARTNER_PRIVATE_KEY: privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString(),
    LAONPAY_BILLING_API_BASE: API_ORIGIN,
    LAONPAY_BILLING_SCHEMA_READY: "1",
    LAONPAY_BILLING_FEATURE_ENABLED: "1",
  };
}

function chargeBody(orderId = ORDER_ID, amount = 1_004) {
  return {
    externalCustomerId: CUSTOMER_ID,
    externalOrderId: orderId,
    amount,
    goodsName: "격리 HTTP 테스트 상품",
    buyerName: "테스트 구매자",
    buyerEmail: "buyer@example.invalid",
  };
}

test("loopback HTTP에서 등록부터 전체취소요청·해지까지 서명된 생명주기를 검증한다", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const harness = await startHarness(publicKey);
  const client = createLaonpayBillingClient(createClientAndHarnessEnv(privateKey), {
    fetchImpl: harness.fetchImpl,
    now: () => 1_801_000_000_000,
    nonce: () => randomUUID(),
  });

  try {
    const registration = await client.createRegistrationIntent(CUSTOMER_ID, REGISTRATION_KEY);
    assert.equal(registration.ok, true);
    if (!registration.ok) return;
    assert.equal(registration.data.registrationId, REGISTRATION_ID);
    assert.equal(new URL(registration.data.hostedUrl).origin, API_ORIGIN);

    const registrationReplay = await client.createRegistrationIntent(CUSTOMER_ID, REGISTRATION_KEY);
    assert.deepEqual(registrationReplay, registration);
    assert.equal(harness.state.registrationCreates, 1);

    const registrationConflict = await client.createRegistrationIntent(
      OTHER_CUSTOMER_ID,
      REGISTRATION_KEY,
    );
    assert.deepEqual(registrationConflict, {
      ok: false,
      outcome: "REJECTED",
      errorCode: "IDEMPOTENCY_CONFLICT",
      httpStatus: 409,
    });
    assert.equal(harness.state.registrationCreates, 1);

    await harness.completeHostedRegistration();
    const registered = await client.getRegistrationIntent(REGISTRATION_ID);
    assert.equal(registered.ok, true);
    if (!registered.ok) return;
    assert.equal(registered.data.status, "SUCCEEDED");
    assert.deepEqual(registered.data.paymentMethod, paymentMethod("ACTIVE"));

    const listed = await client.listPaymentMethods(CUSTOMER_ID);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.deepEqual(listed.data.paymentMethods, [paymentMethod("ACTIVE")]);

    const charged = await client.chargePaymentMethod(
      PAYMENT_METHOD_ID,
      chargeBody(),
      CHARGE_KEY,
    );
    assert.equal(charged.ok, true);
    if (!charged.ok) return;
    assert.equal(charged.data.charge.status, "PAID");

    const chargeReplay = await client.chargePaymentMethod(
      PAYMENT_METHOD_ID,
      chargeBody(),
      CHARGE_KEY,
    );
    assert.deepEqual(chargeReplay, charged);
    assert.equal(harness.state.chargeProviderCalls, 1);

    const chargeConflict = await client.chargePaymentMethod(
      PAYMENT_METHOD_ID,
      chargeBody(ORDER_ID, 1_005),
      CHARGE_KEY,
    );
    assert.deepEqual(chargeConflict, {
      ok: false,
      outcome: "REJECTED",
      errorCode: "IDEMPOTENCY_CONFLICT",
      httpStatus: 409,
    });
    assert.equal(harness.state.chargeProviderCalls, 1);

    const chargeStatus = await client.getCharge(CHARGE_ID);
    assert.equal(chargeStatus.ok, true);
    if (!chargeStatus.ok) return;
    assert.equal(chargeStatus.data.charge.status, "PAID");

    const cancel = await client.createCancelRequest(
      CHARGE_ID,
      CUSTOMER_ID,
      "구매자 전체취소 요청",
      CANCEL_KEY,
    );
    assert.equal(cancel.ok, true);
    if (!cancel.ok) return;
    assert.deepEqual(
      cancel.data,
      fullCancelRequest("REQUESTED", "CANCEL_REQUESTED", false),
    );

    const canceled = await client.getCancelRequest(CANCEL_REQUEST_ID);
    assert.equal(canceled.ok, true);
    if (!canceled.ok) return;
    const expectedCanceled = fullCancelRequest("DONE", "CANCELED", true);
    assert.deepEqual(canceled.data, {
      cancelRequest: expectedCanceled.cancelRequest,
      charge: expectedCanceled.charge,
    });

    const deregistered = await client.deregisterPaymentMethod(
      PAYMENT_METHOD_ID,
      CUSTOMER_ID,
      DEREGISTER_KEY,
    );
    assert.equal(deregistered.ok, true);
    if (!deregistered.ok) return;
    assert.equal(deregistered.data.paymentMethod.status, "DEREGISTERED");

    const listedAfterDeregister = await client.listPaymentMethods(CUSTOMER_ID);
    assert.equal(listedAfterDeregister.ok, true);
    if (!listedAfterDeregister.ok) return;
    assert.deepEqual(listedAfterDeregister.data.paymentMethods, [paymentMethod("DEREGISTERED")]);

    assert.equal(harness.state.hostedCompletions, 1);
    assert.equal(harness.state.chargeProviderCalls, 1);
    assert.equal(harness.state.cancelProviderCalls, 1);
    assert.equal(harness.state.deregisterProviderCalls, 1);
    assert.equal(harness.state.handlerErrors.length, 0);
    assert.ok(harness.state.partnerRequests.length >= 10);
    assert.equal(harness.state.partnerRequests.every((request) => request.verified), true);
    assert.equal(
      harness.state.partnerRequests
        .filter((request) => request.method === "GET")
        .every((request) => request.idempotencyKey === null),
      true,
    );

    for (const request of harness.state.partnerRequests) {
      if (request.bodyText) assertSafeObjectKeys(JSON.parse(request.bodyText));
    }
    for (const responseBody of harness.state.responseBodies) {
      assertSafeObjectKeys(JSON.parse(responseBody));
    }
  } finally {
    await harness.close();
  }
});

test("503·timeout·UNKNOWN은 한 번만 전송하고 자동 재승인·재취소·재해지하지 않는다", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const harness = await startHarness(publicKey);
  const client = createLaonpayBillingClient(createClientAndHarnessEnv(privateKey), {
    fetchImpl: harness.fetchImpl,
    now: () => 1_801_000_000_000,
    nonce: () => randomUUID(),
  });

  try {
    assert.equal(
      (await client.createRegistrationIntent(CUSTOMER_ID, REGISTRATION_KEY)).ok,
      true,
    );
    await harness.completeHostedRegistration();

    harness.state.faultMode = "CHARGE_503";
    const unavailable = await client.chargePaymentMethod(
      PAYMENT_METHOD_ID,
      chargeBody(),
      "55555555-5555-4555-8555-555555555555",
    );
    assert.deepEqual(unavailable, {
      ok: false,
      outcome: "UNKNOWN",
      errorCode: "UPSTREAM_UNAVAILABLE",
      httpStatus: 503,
    });
    assert.equal(harness.state.chargeProviderCalls, 1);

    harness.state.faultMode = "CHARGE_TIMEOUT";
    const timedOut = await client.chargePaymentMethod(
      PAYMENT_METHOD_ID,
      chargeBody(),
      "66666666-6666-4666-8666-666666666666",
    );
    assert.deepEqual(timedOut, { ok: false, outcome: "UNKNOWN" });
    assert.equal(harness.state.chargeProviderCalls, 2);

    harness.state.faultMode = "CHARGE_UNKNOWN";
    const unknown = await client.chargePaymentMethod(
      PAYMENT_METHOD_ID,
      chargeBody(),
      "77777777-7777-4777-8777-777777777777",
    );
    assert.equal(unknown.ok, true);
    if (!unknown.ok) return;
    assert.equal(unknown.data.charge.status, "UNKNOWN");
    assert.equal(harness.state.chargeProviderCalls, 3);

    harness.state.faultMode = "NONE";
    const paid = await client.chargePaymentMethod(
      PAYMENT_METHOD_ID,
      chargeBody(),
      "88888888-8888-4888-8888-888888888888",
    );
    assert.equal(paid.ok, true);
    assert.equal(harness.state.chargeProviderCalls, 4);

    harness.state.faultMode = "CANCEL_503";
    const cancelUnknown = await client.createCancelRequest(
      CHARGE_ID,
      CUSTOMER_ID,
      "구매자 전체취소 요청",
      "99999999-9999-4999-8999-999999999999",
    );
    assert.deepEqual(cancelUnknown, {
      ok: false,
      outcome: "UNKNOWN",
      errorCode: "UPSTREAM_UNAVAILABLE",
      httpStatus: 503,
    });
    assert.equal(harness.state.cancelProviderCalls, 1);

    harness.state.faultMode = "DEREGISTER_503";
    const deregisterUnknown = await client.deregisterPaymentMethod(
      PAYMENT_METHOD_ID,
      CUSTOMER_ID,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    assert.deepEqual(deregisterUnknown, {
      ok: false,
      outcome: "UNKNOWN",
      errorCode: "UPSTREAM_UNAVAILABLE",
      httpStatus: 503,
    });
    assert.equal(harness.state.deregisterProviderCalls, 1);

    await new Promise((resolve) => setTimeout(resolve, 180));
    assert.equal(harness.state.chargeProviderCalls, 4);
    assert.equal(harness.state.cancelProviderCalls, 1);
    assert.equal(harness.state.deregisterProviderCalls, 1);
    assert.equal(harness.state.handlerErrors.length, 0);
  } finally {
    await harness.close();
  }
});
