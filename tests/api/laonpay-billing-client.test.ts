import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  verify,
  type KeyObject,
} from "node:crypto";
import test from "node:test";

import {
  createLaonpayBillingClient,
  createPartnerCanonical,
  createPartnerSignature,
  getLaonpayBillingReadiness,
  type LaonpayBillingEnv,
} from "../../lib/laonpay/billing-client";

const API_ORIGIN = "https://billing.test.invalid";
const CUSTOMER_ID = "customer_123";
const REGISTRATION_ID = "registration_123";
const PAYMENT_METHOD_ID = "payment_method_123";
const ORDER_ID = "order_123";
const CHARGE_ID = "charge_123";
const REGISTRATION_IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";
const CHARGE_IDEMPOTENCY_KEY = "33333333-3333-4333-8333-333333333333";
const FIXED_NONCE = "22222222-2222-4222-8222-222222222222";
const FIXED_NOW_MS = 1_800_000_000_123;
const FIXED_TIMESTAMP = String(Math.floor(FIXED_NOW_MS / 1_000));
const ISO_DATE = "2027-01-15T08:00:00.000Z";

type CapturedRequest = {
  url: string;
  init: RequestInit;
};

function signingFixture(): {
  env: LaonpayBillingEnv;
  privateKey: KeyObject;
  publicKey: KeyObject;
} {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    env: {
      LAONPAY_PARTNER_KEY_ID: "test-partner-key",
      LAONPAY_PARTNER_PRIVATE_KEY: privateKey
        .export({ format: "pem", type: "pkcs8" })
        .toString(),
      LAONPAY_BILLING_API_BASE: API_ORIGIN,
    },
    privateKey,
    publicKey,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function registrationCreated(hostedUrl = `${API_ORIGIN}/billing/register/${REGISTRATION_ID}`) {
  return {
    registrationId: REGISTRATION_ID,
    hostedUrl,
    expiresAt: ISO_DATE,
    status: "PENDING",
  };
}

function chargeUnknown() {
  return {
    charge: {
      id: CHARGE_ID,
      externalOrderId: ORDER_ID,
      status: "UNKNOWN",
      amount: 1_004,
      paymentId: null,
      createdAt: ISO_DATE,
      updatedAt: ISO_DATE,
      error: {
        code: "RESULT_UNKNOWN",
        message: "결과 확인이 필요합니다.",
      },
    },
  };
}

function captureFetch(
  calls: CapturedRequest[],
  response: (url: URL, init: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), init });
    return response(url, init);
  }) as typeof fetch;
}

test("canonical과 Ed25519 서명은 계약 문자열을 바이트 그대로 사용한다", () => {
  const { privateKey, publicKey } = signingFixture();
  const bodyText = JSON.stringify({
    externalCustomerId: CUSTOMER_ID,
    returnTargetCode: "settings",
  });
  const bodyHash = createHash("sha256").update(bodyText, "utf8").digest("hex");
  const canonical = createPartnerCanonical({
    method: "POST",
    pathWithQuery: "/api/partner/v1/billing/registration-intents",
    timestamp: FIXED_TIMESTAMP,
    nonce: FIXED_NONCE,
    bodyText,
  });

  assert.equal(
    canonical,
    [
      "v1",
      "POST",
      "/api/partner/v1/billing/registration-intents",
      FIXED_TIMESTAMP,
      FIXED_NONCE,
      bodyHash,
    ].join("\n"),
  );

  const signature = createPartnerSignature(canonical, privateKey);
  assert.equal(
    verify(
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
});

test("GET은 query를 canonical에 포함하고 빈 본문의 SHA-256으로 서명한다", async () => {
  const { env, publicKey } = signingFixture();
  const calls: CapturedRequest[] = [];
  const client = createLaonpayBillingClient(env, {
    fetchImpl: captureFetch(calls, () => jsonResponse({ paymentMethods: [] })),
    now: () => FIXED_NOW_MS,
    nonce: () => FIXED_NONCE,
  });

  const result = await client.listPaymentMethods(
    CUSTOMER_ID,
    REGISTRATION_IDEMPOTENCY_KEY,
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  const call = calls[0];
  const headers = new Headers(call.init.headers);
  const pathWithQuery = `/api/partner/v1/billing/payment-methods?externalCustomerId=${CUSTOMER_ID}`;
  const emptyBodyHash = createHash("sha256").update("", "utf8").digest("hex");
  const canonical = [
    "v1",
    "GET",
    pathWithQuery,
    FIXED_TIMESTAMP,
    FIXED_NONCE,
    emptyBodyHash,
  ].join("\n");

  assert.equal(new URL(call.url).pathname + new URL(call.url).search, pathWithQuery);
  assert.equal(call.init.method, "GET");
  assert.equal(call.init.body, undefined);
  assert.equal(headers.get("content-type"), null);
  assert.equal(headers.get("x-laonpay-timestamp"), FIXED_TIMESTAMP);
  assert.equal(headers.get("x-laonpay-nonce"), FIXED_NONCE);
  assert.equal(
    verify(
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      Buffer.from(headers.get("x-laonpay-signature")!, "base64url"),
    ),
    true,
  );
});

test("요청은 필수 파트너 헤더와 UUID 멱등키를 보내며 잘못된 키는 전송 전에 거부한다", async () => {
  const { env, publicKey } = signingFixture();
  const calls: CapturedRequest[] = [];
  const client = createLaonpayBillingClient(env, {
    fetchImpl: captureFetch(calls, () => jsonResponse(registrationCreated())),
    now: () => FIXED_NOW_MS,
    nonce: () => FIXED_NONCE,
  });

  const result = await client.createRegistrationIntent(
    CUSTOMER_ID,
    REGISTRATION_IDEMPOTENCY_KEY,
  );

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  const call = calls[0];
  const headers = new Headers(call.init.headers);
  const bodyText = String(call.init.body);
  const canonical = createPartnerCanonical({
    method: "POST",
    pathWithQuery: "/api/partner/v1/billing/registration-intents",
    timestamp: FIXED_TIMESTAMP,
    nonce: FIXED_NONCE,
    bodyText,
  });

  assert.equal(call.init.method, "POST");
  assert.equal(call.init.cache, "no-store");
  assert.equal(call.init.redirect, "error");
  assert.ok(call.init.signal instanceof AbortSignal);
  assert.equal(headers.get("accept"), "application/json");
  assert.equal(headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(headers.get("cache-control"), "no-store");
  assert.equal(headers.get("x-laonpay-partner-id"), "laonshop");
  assert.equal(headers.get("x-laonpay-key-id"), "test-partner-key");
  assert.equal(headers.get("x-laonpay-timestamp"), FIXED_TIMESTAMP);
  assert.equal(headers.get("x-laonpay-nonce"), FIXED_NONCE);
  assert.equal(headers.get("idempotency-key"), REGISTRATION_IDEMPOTENCY_KEY);
  assert.equal(
    verify(
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      Buffer.from(headers.get("x-laonpay-signature")!, "base64url"),
    ),
    true,
  );

  await assert.rejects(
    client.createRegistrationIntent(CUSTOMER_ID, "not-a-uuid"),
    /멱등키 형식이 올바르지 않습니다/,
  );
  assert.equal(calls.length, 1);
});

test("누락되거나 유효하지 않은 설정은 외부 요청 없이 fail-closed 처리한다", async (t) => {
  const fixture = signingFixture();
  const cases: Array<{
    name: string;
    env: LaonpayBillingEnv;
    reason: "NOT_CONFIGURED" | "INVALID_API_BASE" | "INVALID_SIGNING_KEY";
  }> = [
    {
      name: "전체 누락",
      env: {},
      reason: "NOT_CONFIGURED",
    },
    {
      name: "일부 누락",
      env: {
        LAONPAY_PARTNER_KEY_ID: "test-partner-key",
        LAONPAY_PARTNER_PRIVATE_KEY: undefined,
        LAONPAY_BILLING_API_BASE: API_ORIGIN,
      },
      reason: "NOT_CONFIGURED",
    },
    {
      name: "HTTPS가 아닌 API base",
      env: {
        ...fixture.env,
        LAONPAY_BILLING_API_BASE: "http://billing.test.invalid",
      },
      reason: "INVALID_API_BASE",
    },
    {
      name: "path가 포함된 API base",
      env: {
        ...fixture.env,
        LAONPAY_BILLING_API_BASE: `${API_ORIGIN}/api`,
      },
      reason: "INVALID_API_BASE",
    },
    {
      name: "Ed25519이 아닌 키",
      env: {
        ...fixture.env,
        LAONPAY_PARTNER_PRIVATE_KEY: "not-a-private-key",
      },
      reason: "INVALID_SIGNING_KEY",
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      let fetchCount = 0;
      const client = createLaonpayBillingClient(item.env, {
        fetchImpl: (async () => {
          fetchCount += 1;
          return jsonResponse(registrationCreated());
        }) as typeof fetch,
      });

      const readiness = getLaonpayBillingReadiness(item.env);
      assert.equal(readiness.ready, false);
      if (!readiness.ready) assert.equal(readiness.reason, item.reason);

      const result = await client.createRegistrationIntent(
        CUSTOMER_ID,
        REGISTRATION_IDEMPOTENCY_KEY,
      );
      assert.deepEqual(result, { ok: false, outcome: "NOT_CONFIGURED" });
      assert.equal(fetchCount, 0);
    });
  }
});

test("앱 기본 클라이언트는 Vercel Production 외 런타임에서 fail-closed 처리한다", async () => {
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    let fetchCount = 0;
    const client = createLaonpayBillingClient(undefined, {
      fetchImpl: (async () => {
        fetchCount += 1;
        return jsonResponse(registrationCreated());
      }) as typeof fetch,
    });

    assert.deepEqual(client.readiness, {
      ready: false,
      reason: "NOT_PRODUCTION_RUNTIME",
    });
    assert.deepEqual(
      await client.createRegistrationIntent(CUSTOMER_ID, REGISTRATION_IDEMPOTENCY_KEY),
      { ok: false, outcome: "NOT_CONFIGURED" },
    );
    assert.equal(fetchCount, 0);

    // 주입 env + 대체 fetch를 사용하는 계약 단위 테스트는 런타임 가드와 분리한다.
    assert.equal(getLaonpayBillingReadiness(signingFixture().env).ready, true);
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test("timeout, 503, malformed 응답은 성공이나 명시적 거절로 오인하지 않는다", async (t) => {
  await t.test("timeout", async () => {
    const { env } = signingFixture();
    const client = createLaonpayBillingClient(env, {
      fetchImpl: (async (_input, init) => {
        assert.ok(init?.signal instanceof AbortSignal);
        throw Object.assign(new Error("request timed out"), { name: "TimeoutError" });
      }) as typeof fetch,
      now: () => FIXED_NOW_MS,
      nonce: () => FIXED_NONCE,
    });

    const result = await client.createRegistrationIntent(
      CUSTOMER_ID,
      REGISTRATION_IDEMPOTENCY_KEY,
    );
    assert.deepEqual(result, { ok: false, outcome: "UNKNOWN" });
  });

  await t.test("503", async () => {
    const { env } = signingFixture();
    const client = createLaonpayBillingClient(env, {
      fetchImpl: (async () =>
        jsonResponse(
          {
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message: "상태 확인이 필요합니다.",
            },
          },
          503,
        )) as typeof fetch,
      now: () => FIXED_NOW_MS,
      nonce: () => FIXED_NONCE,
    });

    const result = await client.createRegistrationIntent(
      CUSTOMER_ID,
      REGISTRATION_IDEMPOTENCY_KEY,
    );
    assert.deepEqual(result, {
      ok: false,
      outcome: "UNKNOWN",
      errorCode: "UPSTREAM_UNAVAILABLE",
      httpStatus: 503,
    });
  });

  for (const status of [408, 425]) {
    await t.test(`${status}`, async () => {
      const { env } = signingFixture();
      const client = createLaonpayBillingClient(env, {
        fetchImpl: (async () =>
          jsonResponse(
            {
              error: {
                code: `HTTP_${status}`,
                message: "요청 결과 확인이 필요합니다.",
              },
            },
            status,
          )) as typeof fetch,
        now: () => FIXED_NOW_MS,
        nonce: () => FIXED_NONCE,
      });

      const result = await client.createRegistrationIntent(
        CUSTOMER_ID,
        REGISTRATION_IDEMPOTENCY_KEY,
      );
      assert.deepEqual(result, {
        ok: false,
        outcome: "UNKNOWN",
        errorCode: `HTTP_${status}`,
        httpStatus: status,
      });
    });
  }

  await t.test("malformed JSON", async () => {
    const { env } = signingFixture();
    const client = createLaonpayBillingClient(env, {
      fetchImpl: (async () =>
        new Response("{not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
      now: () => FIXED_NOW_MS,
      nonce: () => FIXED_NONCE,
    });

    const result = await client.createRegistrationIntent(
      CUSTOMER_ID,
      REGISTRATION_IDEMPOTENCY_KEY,
    );
    assert.deepEqual(result, { ok: false, outcome: "UNKNOWN" });
  });
});

test("민감 필드가 추가된 성공 응답은 strict parser가 UNKNOWN으로 보류한다", async () => {
  const { env } = signingFixture();
  const client = createLaonpayBillingClient(env, {
    fetchImpl: (async () =>
      jsonResponse({
        registrationId: REGISTRATION_ID,
        status: "SUCCEEDED",
        expiresAt: ISO_DATE,
        paymentMethod: {
          id: PAYMENT_METHOD_ID,
          cardName: "테스트카드",
          cardLast4: "1234",
          cardType: "CREDIT",
          status: "ACTIVE",
          registeredAt: ISO_DATE,
          verifiedAt: ISO_DATE,
          deregisteredAt: null,
          billingToken: "forbidden-provider-token",
        },
        error: null,
      })) as typeof fetch,
    now: () => FIXED_NOW_MS,
    nonce: () => FIXED_NONCE,
  });

  const result = await client.getRegistrationIntent(
    REGISTRATION_ID,
    REGISTRATION_IDEMPOTENCY_KEY,
  );

  assert.deepEqual(result, { ok: false, outcome: "UNKNOWN" });
});

test("chunked 대용량 응답은 64KiB를 넘는 즉시 stream을 취소하고 UNKNOWN으로 보류한다", async () => {
  const { env } = signingFixture();
  let cancelled = false;
  let chunksSent = 0;
  const oversized = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunksSent += 1;
      controller.enqueue(new Uint8Array(40 * 1024));
      if (chunksSent >= 4) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const client = createLaonpayBillingClient(env, {
    fetchImpl: (async () =>
      new Response(oversized, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
    now: () => FIXED_NOW_MS,
    nonce: () => FIXED_NONCE,
  });

  const result = await client.createRegistrationIntent(
    CUSTOMER_ID,
    REGISTRATION_IDEMPOTENCY_KEY,
  );

  assert.deepEqual(result, { ok: false, outcome: "UNKNOWN" });
  assert.equal(cancelled, true);
});

test("hosted registration URL은 계약된 same-origin exact 경로만 허용한다", async (t) => {
  const { env } = signingFixture();
  const invalidUrls = [
    `https://attacker.invalid/billing/register/${REGISTRATION_ID}`,
    `${API_ORIGIN}/hosted/registrations/${REGISTRATION_ID}`,
    `${API_ORIGIN}/billing/register/${REGISTRATION_ID}?next=https://attacker.invalid`,
    `${API_ORIGIN}/billing/register/${REGISTRATION_ID}#fragment`,
    `${API_ORIGIN}/billing/register/x`,
  ];

  for (const hostedUrl of invalidUrls) {
    await t.test(hostedUrl, async () => {
      const client = createLaonpayBillingClient(env, {
        fetchImpl: (async () =>
          jsonResponse(registrationCreated(hostedUrl))) as typeof fetch,
        now: () => FIXED_NOW_MS,
        nonce: () => FIXED_NONCE,
      });

      const result = await client.createRegistrationIntent(
        CUSTOMER_ID,
        REGISTRATION_IDEMPOTENCY_KEY,
      );

      assert.deepEqual(result, { ok: false, outcome: "UNKNOWN" });
    });
  }
});

test("reconciliation POST는 동일 key와 바이트상 동일한 body로 같은 resource를 회수할 수 있다", async () => {
  const { env } = signingFixture();
  const calls: CapturedRequest[] = [];
  const nonces = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  ];
  let nonceIndex = 0;
  const client = createLaonpayBillingClient(env, {
    fetchImpl: captureFetch(calls, (url) => {
      if (url.pathname === "/api/partner/v1/billing/registration-intents") {
        return jsonResponse(registrationCreated());
      }
      return jsonResponse(chargeUnknown());
    }),
    now: () => FIXED_NOW_MS,
    nonce: () => nonces[nonceIndex++]!,
  });

  const registrationFirst = await client.createRegistrationIntent(
    CUSTOMER_ID,
    REGISTRATION_IDEMPOTENCY_KEY,
  );
  const registrationReconciliation = await client.createRegistrationIntent(
    CUSTOMER_ID,
    REGISTRATION_IDEMPOTENCY_KEY,
  );
  const chargeBody = {
    externalCustomerId: CUSTOMER_ID,
    externalOrderId: ORDER_ID,
    amount: 1_004,
    goodsName: "테스트 상품",
    buyerName: "테스트 구매자",
    buyerEmail: "buyer@example.invalid",
  };
  const chargeFirst = await client.chargePaymentMethod(
    PAYMENT_METHOD_ID,
    chargeBody,
    CHARGE_IDEMPOTENCY_KEY,
  );
  const chargeReconciliation = await client.chargePaymentMethod(
    PAYMENT_METHOD_ID,
    chargeBody,
    CHARGE_IDEMPOTENCY_KEY,
  );

  assert.deepEqual(registrationFirst, registrationReconciliation);
  assert.deepEqual(chargeFirst, chargeReconciliation);
  assert.equal(calls.length, 4);

  const [registrationCall, registrationRetry, chargeCall, chargeRetry] = calls;
  const registrationHeaders = new Headers(registrationCall.init.headers);
  const registrationRetryHeaders = new Headers(registrationRetry.init.headers);
  const chargeHeaders = new Headers(chargeCall.init.headers);
  const chargeRetryHeaders = new Headers(chargeRetry.init.headers);

  assert.equal(registrationCall.init.body, registrationRetry.init.body);
  assert.equal(
    registrationHeaders.get("idempotency-key"),
    REGISTRATION_IDEMPOTENCY_KEY,
  );
  assert.equal(
    registrationRetryHeaders.get("idempotency-key"),
    REGISTRATION_IDEMPOTENCY_KEY,
  );
  assert.notEqual(
    registrationHeaders.get("x-laonpay-nonce"),
    registrationRetryHeaders.get("x-laonpay-nonce"),
  );

  assert.equal(chargeCall.init.body, chargeRetry.init.body);
  assert.equal(chargeHeaders.get("idempotency-key"), CHARGE_IDEMPOTENCY_KEY);
  assert.equal(chargeRetryHeaders.get("idempotency-key"), CHARGE_IDEMPOTENCY_KEY);
  assert.notEqual(
    chargeHeaders.get("x-laonpay-nonce"),
    chargeRetryHeaders.get("x-laonpay-nonce"),
  );
});
