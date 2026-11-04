import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_ADDITIONS } from "../../prisma/catalog-additions";
import { PREPARED_PRODUCT_KEYS, resolvePreparedProducts } from "../../lib/prepared-products";

const image = (key = "men-top-01") => ({ key, path: `/products/new/20261104/${key}.webp`, width: 1200, height: 1500 });

test("출시 준비 카탈로그는 신규 32개 스타일을 누락·중복 없이 포함한다", () => {
  assert.equal(PREPARED_PRODUCT_KEYS.length, 32);
  assert.equal(new Set(PREPARED_PRODUCT_KEYS).size, 32);
  assert.deepEqual([...PREPARED_PRODUCT_KEYS].sort(), CATALOG_ADDITIONS.map((draft) => draft.key).sort());
  assert.equal(resolvePreparedProducts(PREPARED_PRODUCT_KEYS.map((key) => image(key))).length, 32);
});

test("공개 준비 상품은 명세와 대응하고 재고0·주문 불가 상태를 유지한다", () => {
  const out = resolvePreparedProducts([image()]);
  const draft = CATALOG_ADDITIONS.find((entry) => entry.key === "men-top-01")!;
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "prepared-men-top-01");
  assert.equal(out[0].name, draft.name);
  assert.equal(out[0].price, draft.proposedPrice);
  assert.equal(out[0].category, draft.category);
  assert.equal(out[0].sizes, draft.proposedSizes);
  assert.equal(out[0].prepared, true);
  assert.equal(out[0].soldOut, true);
  assert.equal(out[0].stock, 0);
});

test("임의 SKU·외부 URL·잘못된 크기·중복 manifest 항목은 공개하지 않는다", () => {
  assert.deepEqual(resolvePreparedProducts([image("men-top-99")]), []);
  assert.deepEqual(resolvePreparedProducts([{ ...image(), path: "https://attacker.invalid/item.webp" }]), []);
  assert.deepEqual(resolvePreparedProducts([{ ...image(), width: 1199 }]), []);
  assert.deepEqual(resolvePreparedProducts([image(), image()]), []);
  assert.deepEqual(resolvePreparedProducts([]), []);
});

test("production에서도 준비 상품은 동일한 명세와 재고0으로만 노출한다", () => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    const products = resolvePreparedProducts(PREPARED_PRODUCT_KEYS.map((key) => image(key)));
    assert.equal(products.length, 32);
    assert.ok(products.every((product) => product.prepared && product.soldOut && product.stock === 0));
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});
