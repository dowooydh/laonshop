import assert from "node:assert/strict";
import test from "node:test";

import {
  createIdempotentMoid,
  mergeRequestedItems,
  PAYMENT_PROCESSING_MARKER,
  shouldStartKspayApproval,
  validateInventorySnapshot,
} from "../../lib/order-guard";

const product = {
  id: "product-1",
  name: "재고 한정 상품",
  price: 10_000,
  sizes: "S,M",
  stock: 1,
  active: true,
};

test("사이즈가 달라도 상품별 요청 수량을 합산해 재고를 검증한다", () => {
  const result = validateInventorySnapshot(
    [product],
    [],
    [
      { productId: product.id, size: "S", qty: 1 },
      { productId: product.id, size: "M", qty: 1 },
    ],
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /재고가 부족/);
});

test("동일 상품과 사이즈의 중복 행을 하나로 병합한다", () => {
  assert.deepEqual(
    mergeRequestedItems([
      { productId: product.id, size: "S", qty: 1 },
      { productId: product.id, size: "S", qty: 2 },
    ]),
    [{ productId: product.id, size: "S", qty: 3 }],
  );
});

test("예약된 수량과 새 주문 수량을 합산하고 허용되지 않은 사이즈를 거부한다", () => {
  const reserved = validateInventorySnapshot(
    [{ ...product, stock: 2 }],
    [{ productId: product.id, qty: 1 }],
    [{ productId: product.id, size: "M", qty: 2 }],
  );
  assert.equal(reserved.ok, false);

  const invalidSize = validateInventorySnapshot(
    [{ ...product, stock: 10 }],
    [],
    [{ productId: product.id, size: "XL", qty: 1 }],
  );
  assert.equal(invalidSize.ok, false);
  if (!invalidSize.ok) assert.match(invalidSize.error, /사이즈/);
});

test("같은 사용자와 멱등키는 같은 주문번호를 만들고 사용자 경계는 분리한다", () => {
  const key = "a".repeat(64);
  const first = createIdempotentMoid("user-1", key);
  assert.equal(first, createIdempotentMoid("user-1", key));
  assert.notEqual(first, createIdempotentMoid("user-2", key));
  assert.match(first, /^LP[A-F0-9]{30}$/);
});

test("처리 마커가 기록된 callback은 외부 승인을 다시 시작하지 않는다", () => {
  assert.equal(shouldStartKspayApproval("PENDING", null, true, false), true);
  assert.equal(shouldStartKspayApproval("PENDING", PAYMENT_PROCESSING_MARKER, true, false), false);
  assert.equal(shouldStartKspayApproval("PAID", null, true, false), false);
  assert.equal(shouldStartKspayApproval("PENDING", null, false, false), false);
  assert.equal(shouldStartKspayApproval("PENDING", null, false, true), false);
  assert.equal(shouldStartKspayApproval("PENDING", null, true, true), false);
});
