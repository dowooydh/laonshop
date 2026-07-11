import assert from "node:assert/strict";
import test from "node:test";

import { KspayProvider } from "../../lib/kspay/kspay-provider";

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
