import assert from "node:assert/strict";
import test from "node:test";

import { KspayProvider } from "../../lib/kspay/kspay-provider";

test("KSPAY 결제 폼은 주문에 결박된 result 토큰을 패스스루한다", async () => {
  const provider = new KspayProvider({ storeId: "test-mid" });
  const result = await provider.createAuthOrder({
    paymentId: "order-id",
    moid: "ORDER-MOID",
    amount: 1_000,
    goodsName: "상품",
    ordername: "구매자",
    storeId: "test-mid",
    returnUrl: "https://laonshop.com/order/order-id",
    callbackUrl: "https://laonshop.com/api/pg/kspay/callback",
    resultToken: "signed-result-token",
  });

  assert.equal(result.formFields?.a, "order-id");
  assert.equal(result.formFields?.c, "signed-result-token");
});

test("KSPAY 승인키를 HTTPS와 timeout signal로만 전송한다", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let calledInit: RequestInit | undefined;

  try {
    globalThis.fetch = (async (input, init) => {
      calledUrl = String(input);
      calledInit = init;
      return new Response("unavailable", { status: 503 });
    }) as typeof fetch;

    const provider = new KspayProvider({ storeId: "test-mid" });
    await assert.rejects(
      provider.approveAuthCallback({ reCommConId: "not-a-real-key", sndAmount: "1000" }),
      /KSPAY approval HTTP 503/,
    );

    assert.match(calledUrl, /^https:\/\//);
    assert.equal(calledInit?.method, "POST");
    assert.ok(calledInit?.signal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("KSPAY 승인 응답을 파싱할 수 없으면 실패 확정 대신 예외로 보류한다", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response("malformed-response", { status: 200 })) as typeof fetch;
    const provider = new KspayProvider({ storeId: "test-mid" });
    await assert.rejects(
      provider.approveAuthCallback({ reCommConId: "not-a-real-key", sndAmount: "1000" }),
      /response parse failed/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("KSPAY 승인 응답에서 PG 주문번호를 별도 필드로 반환한다", async () => {
  const originalFetch = globalThis.fetch;
  const fields = [
    "O", "TRNO-1", "20260715", "120000", "1000", "APP-1", "", "", "ORDER-MOID",
    "01", "01", "", "0000", "00",
  ];
  try {
    globalThis.fetch = (async () => new Response(["response", ...fields].join("`"), { status: 200 })) as typeof fetch;
    const provider = new KspayProvider({ storeId: "test-mid" });
    const result = await provider.approveAuthCallback({ reCommConId: "test-key", sndAmount: "1000" });

    assert.equal(result.success, true);
    assert.equal(result.moid, "ORDER-MOID");
    assert.equal(result.approvalNo, "APP-1");
    assert.equal(result.pgTrno, "TRNO-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
