import assert from "node:assert/strict";
import test from "node:test";

import { CHECKOUT_NONCE_KEY } from "../../lib/checkout-idempotency";
import { CART_STORAGE_KEY, getCart, saveCart } from "../../lib/cart";

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

test("기존 장바구니 내용과 nonce를 유지하며 왜곡 상세컷 참조만 제거한다", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const item = {
    productId: "p-legacy",
    name: "기존 상품",
    price: 39000,
    qty: 2,
    size: "M",
    imageUrl: "/products/detail/p-legacy/01.webp",
  };
  const nonce = "00000000-0000-4000-8000-000000000001";
  const values = new Map<string, string>([
    [CART_STORAGE_KEY, JSON.stringify([item])],
    [CHECKOUT_NONCE_KEY, nonce],
  ]);

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
    const cart = getCart();
    const persisted = JSON.parse(values.get(CART_STORAGE_KEY) ?? "[]") as typeof cart;

    assert.deepEqual(cart, [{ ...item, imageUrl: null }]);
    assert.deepEqual(persisted, cart);
    assert.equal(values.get(CHECKOUT_NONCE_KEY), nonce);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  }
});

test("localStorage 마이그레이션 쓰기가 실패해도 장바구니와 nonce를 반환한다", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const item = {
    productId: "p-readonly",
    name: "읽기 전용 저장 상품",
    price: 25000,
    qty: 1,
    size: "L",
    imageUrl: "/products/detail/p-readonly/01.webp",
  };
  const nonce = "00000000-0000-4000-8000-000000000002";
  const values = new Map<string, string>([
    [CART_STORAGE_KEY, JSON.stringify([item])],
    [CHECKOUT_NONCE_KEY, nonce],
  ]);

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: () => true },
  });

  try {
    assert.deepEqual(getCart(), [{ ...item, imageUrl: null }]);
    assert.equal(values.get(CHECKOUT_NONCE_KEY), nonce);
    assert.equal(values.get(CART_STORAGE_KEY), JSON.stringify([item]));
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  }
});
