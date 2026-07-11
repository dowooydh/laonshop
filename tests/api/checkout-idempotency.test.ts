import assert from "node:assert/strict";
import test from "node:test";

import { createCheckoutIdempotencyKey } from "../../lib/checkout-idempotency";

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
