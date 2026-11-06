import assert from "node:assert/strict";
import test from "node:test";

import { KspayProvider } from "../../lib/kspay/kspay-provider";
import { validateKspayApprovalBinding } from "../../lib/kspay/approval-validation";

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

test("공급사 성공 금액 누락·비정수·범위 초과는 요청 금액으로 채우지 않고 결과미상으로 둔다", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const amount of ["", " ", "1e3", "1000.0", "-1000", "0", "9007199254740992"]) {
      const fields = ["O", "TRNO-1", "20261106", "120000", amount, "APP-1", "", "", "ORDER-MOID", "01", "01", "", "0000", "00"];
      globalThis.fetch = (async () => new Response(["response", ...fields].join("`"))) as typeof fetch;
      await assert.rejects(new KspayProvider({ storeId: "test-mid" }).approveAuthCallback({ reCommConId: "synthetic-key", sndAmount: "1000" }), /amount missing or invalid/);
    }
    const fields = ["O", "TRNO-1", "20261106", "120000", "1001", "APP-1", "", "", "ORDER-MOID", "01", "01", "", "0000", "00"];
    globalThis.fetch = (async () => new Response(["response", ...fields].join("`"))) as typeof fetch;
    const result = await new KspayProvider({ storeId: "test-mid" }).approveAuthCallback({ reCommConId: "synthetic-key", sndAmount: "1000" });
    assert.equal(result.amount, 1001);
    assert.equal(validateKspayApprovalBinding({ moid: "ORDER-MOID", totalAmount: 1000 }, result).ok, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("공급사 응답도 실제 스트림 상한을 넘으면 승인 결과로 확정하지 않는다", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response("x".repeat(32 * 1024 + 1))) as typeof fetch;
    await assert.rejects(new KspayProvider({ storeId: "test-mid" }).approveAuthCallback({ reCommConId: "synthetic-key", sndAmount: "1000" }));
  } finally { globalThis.fetch = originalFetch; }
});

test("공급사의 정의되지 않은 승인 상태는 거절로 확정하지 않으며 정상 X 거절은 유지한다", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const status of ["", "?", "o", "UNKNOWN", "X"]) {
      const fields = [status, "TRNO-1", "20261106", "120000", "", "DECLINED", "", "", "ORDER-MOID", "01", "01", "", "0000", "00"];
      globalThis.fetch = (async () => new Response(["response", ...fields].join("`"))) as typeof fetch;
      const request = new KspayProvider({ storeId: "test-mid" }).approveAuthCallback({ reCommConId: "synthetic-key", sndAmount: "1000" });
      if (status === "X") {
        const result = await request;
        assert.equal(result.success, false);
        assert.equal(result.amount, 0);
        assert.equal(result.approvalNo, undefined);
      } else await assert.rejects(request, /approval status invalid/);
    }
  } finally { globalThis.fetch = originalFetch; }
});
