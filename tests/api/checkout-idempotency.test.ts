import assert from "node:assert/strict";
import test from "node:test";

import { createCheckoutIdempotencyKey, createCheckoutNonce } from "../../lib/checkout-idempotency";

const payload = {
  method: "card",
  items: [
    { productId: "b", qty: 1, size: "M" },
    { productId: "a", qty: 2, size: "S" },
  ],
  receiverName: "홍길동",
  receiverPhone: "010-0000-0000",
  address: "테스트 주소",
};

test("동일 체크아웃 요청은 탭과 항목 순서가 달라도 같은 멱등키를 사용한다", async () => {
  const now = 1_800_000_000_000;
  const first = await createCheckoutIdempotencyKey(payload, "browser-nonce", now);
  const reordered = await createCheckoutIdempotencyKey(
    { ...payload, items: [...payload.items].reverse() },
    "browser-nonce",
    now + 1_000,
  );

  assert.equal(first, reordered);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("시간 버킷 경계를 넘어도 같은 요청과 nonce는 같은 키를 유지한다", async () => {
  const now = 1_800_000_000_000;
  const first = await createCheckoutIdempotencyKey(payload, "nonce-1", now);
  assert.equal(first, await createCheckoutIdempotencyKey(payload, "nonce-1", now + 30 * 60 * 1_000));
  assert.equal(first, await createCheckoutIdempotencyKey(payload, "nonce-1", now + 24 * 60 * 60 * 1_000));
});

test("장바구니 nonce가 바뀌면 새 주문 요청으로 분리한다", async () => {
  const first = await createCheckoutIdempotencyKey(payload, "nonce-1");
  assert.notEqual(first, await createCheckoutIdempotencyKey(payload, "nonce-2"));
});

test("randomUUID를 지원하면 브라우저 기본 UUID를 nonce로 사용한다", () => {
  const nonce = createCheckoutNonce({ randomUUID: () => "browser-native-uuid" });
  assert.equal(nonce, "browser-native-uuid");
});

test("randomUUID가 없는 HTTP 환경은 getRandomValues로 UUID nonce를 만든다", () => {
  const nonce = createCheckoutNonce({
    getRandomValues(values) {
      values.forEach((_, index) => {
        values[index] = index;
      });
      return values;
    },
  });

  assert.match(nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("Crypto API가 없는 오래된 환경도 nonce 생성에 실패하지 않는다", () => {
  assert.match(createCheckoutNonce(null), /^.+-.+-.+$/);
});
