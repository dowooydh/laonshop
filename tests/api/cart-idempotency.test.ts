import assert from "node:assert/strict";
import test from "node:test";

import { CHECKOUT_NONCE_KEY } from "../../lib/checkout-idempotency";
import { saveCart } from "../../lib/cart";

test("같은 카트 재저장은 nonce를 유지하고 내용이 바뀔 때만 새 nonce를 발급한다", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: () => true },
  });

  try {
    const item = { productId: "p-1", name: "상품", price: 1000, qty: 1, size: "M", imageUrl: null };
    saveCart([item]);
    const first = values.get(CHECKOUT_NONCE_KEY);
    saveCart([{ ...item }]);
    const sameCart = values.get(CHECKOUT_NONCE_KEY);
    saveCart([{ ...item, qty: 2 }]);
    const changedCart = values.get(CHECKOUT_NONCE_KEY);

    assert.match(first ?? "", /^[0-9a-f-]{36}$/i);
    assert.equal(first, sameCart);
    assert.match(changedCart ?? "", /^[0-9a-f-]{36}$/i);
    assert.notEqual(first, changedCart);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  }
});
