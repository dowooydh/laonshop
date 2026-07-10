import assert from "node:assert/strict";
import test from "node:test";

import { isKspayRestLiveEnabled, payOldCert, type KspayRestEnv } from "../../lib/kspay/webfep";

test("WEBFEP 실승인은 API 키와 명시적 운영 스위치가 모두 필요하다", async () => {
  const cases: Array<{ name: string; env: KspayRestEnv; expected: boolean }> = [
    { name: "둘 다 없음", env: {}, expected: false },
    { name: "API 키만 있음", env: { KSPAY_API_KEY: "issued-key" }, expected: false },
    { name: "운영 스위치만 켜짐", env: { KSPAY_REST_LIVE: "1" }, expected: false },
    {
      name: "API 키가 공백",
      env: { KSPAY_API_KEY: "   ", KSPAY_REST_LIVE: "1" },
      expected: false,
    },
    {
      name: "운영 스위치가 0",
      env: { KSPAY_API_KEY: "issued-key", KSPAY_REST_LIVE: "0" },
      expected: false,
    },
    {
      name: "API 키와 운영 스위치 모두 활성",
      env: { KSPAY_API_KEY: "issued-key", KSPAY_REST_LIVE: "1" },
      expected: true,
    },
  ];

  for (const { name, env, expected } of cases) {
    assert.equal(isKspayRestLiveEnabled(env), expected, name);
  }

  const originalApiKey = process.env.KSPAY_API_KEY;
  const originalRestLive = process.env.KSPAY_REST_LIVE;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  try {
    process.env.KSPAY_API_KEY = "issued-key";
    delete process.env.KSPAY_REST_LIVE;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("운영 스위치 없이 fetch가 호출되면 안 됩니다.");
    }) as typeof fetch;

    const result = await payOldCert({
      orderNumb: "ORDER-NOT-SENT",
      userName: "테스트",
      productName: "전송되지 않는 테스트 상품",
      totalAmount: 1,
      cardNumb: "not-sent",
      expiryDate: "not-sent",
      password2: "not-sent",
      userInfo: "not-sent",
    });

    assert.equal(result, null);
    assert.equal(fetchCalled, false);
  } finally {
    if (originalApiKey === undefined) delete process.env.KSPAY_API_KEY;
    else process.env.KSPAY_API_KEY = originalApiKey;
    if (originalRestLive === undefined) delete process.env.KSPAY_REST_LIVE;
    else process.env.KSPAY_REST_LIVE = originalRestLive;
    globalThis.fetch = originalFetch;
  }
});
