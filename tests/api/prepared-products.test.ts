import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_ADDITIONS } from "../../prisma/catalog-additions";
import { PREPARED_PRODUCT_KEYS, preparedProductsAllowed, resolvePreparedProducts } from "../../lib/prepared-products";

const image = (key = "men-top-01") => ({ key, path: `/products/new/20261104/${key}.webp`, width: 1200, height: 1500 });

test("준비 상품은 production과 환경 미확인 상태에서 노출하지 않는다", () => {
  assert.deepEqual(resolvePreparedProducts([image()], { VERCEL_ENV: "production" }), []);
  assert.deepEqual(resolvePreparedProducts([image()], { NODE_ENV: "production" }), []);
  assert.equal(preparedProductsAllowed({}), false);
});

test("준비 상품은 미리보기·개발에서 완성된 명세 이미지가 있는 항목만 반환한다", () => {
  const out = resolvePreparedProducts([image()], { VERCEL_ENV: "preview", NODE_ENV: "production" });
  const draft = CATALOG_ADDITIONS.find((entry) => entry.key === "men-top-01")!;
  assert.equal(out.length, 1); assert.equal(out[0].id, "prepared-men-top-01");
  assert.equal(out[0].name, draft.name); assert.equal(out[0].price, draft.proposedPrice);
  assert.equal(out[0].category, draft.category); assert.equal(out[0].sizes, draft.proposedSizes);
  assert.equal(out[0].prepared, true); assert.equal(out[0].soldOut, true);
  assert.equal(resolvePreparedProducts([image()], { NODE_ENV: "development" }).length, 1);
});

test("임의 SKU·외부 URL·잘못된 크기·중복 manifest 항목은 준비 상품에 포함하지 않는다", () => {
  const env = { VERCEL_ENV: "preview" };
  assert.deepEqual(resolvePreparedProducts([image("men-top-05")], env), []);
  assert.deepEqual(resolvePreparedProducts([{ ...image(), path: "https://attacker.invalid/item.webp" }], env), []);
  assert.deepEqual(resolvePreparedProducts([{ ...image(), width: 1199 }], env), []);
  assert.deepEqual(resolvePreparedProducts([image(), image()], env), []);
  const valid = PREPARED_PRODUCT_KEYS.map((key) => image(key));
  assert.equal(resolvePreparedProducts(valid, env).length, 12);
});

test("운영 런타임은 호출자의 preview 환경 주입으로도 열리지 않는다", () => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    assert.deepEqual(resolvePreparedProducts([image()], { VERCEL_ENV: "preview" }), []);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});
