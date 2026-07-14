import assert from "node:assert/strict";
import test from "node:test";

import { getProductDetailImages, productDetailSlug } from "../../lib/product-detail-images";
import { safeProductImageUrl, sanitizeStoredProductImages } from "../../lib/product-image";

test("운영 상품 상세는 왜곡된 로컬 갤러리 대신 원본 대표 이미지만 사용한다", () => {
  const product = {
    name: "테스트 상품",
    category: "상의",
    gender: "men",
    imageUrl: "https://images.unsplash.com/photo-safe?w=800",
  };

  assert.deepEqual(getProductDetailImages(product), [
    { src: product.imageUrl, alt: "테스트 상품 대표 이미지" },
  ]);
  assert.match(productDetailSlug(product), /^p-[a-z0-9]+$/);
  assert.deepEqual(getProductDetailImages({ ...product, imageUrl: null }), []);
  assert.deepEqual(getProductDetailImages({ ...product, imageUrl: "/products/detail/p-test/01.webp" }), []);
});

test("기존 비균등 리사이즈 상세컷 URL만 차단한다", () => {
  assert.equal(safeProductImageUrl("/products/detail/p-test/01.webp"), null);
  assert.equal(safeProductImageUrl("https://laonshop.com/products/detail/p-test/01.webp"), null);
  assert.equal(safeProductImageUrl("https://images.unsplash.com/photo-safe?w=800"), "https://images.unsplash.com/photo-safe?w=800");
  assert.equal(safeProductImageUrl("/brand/lookbook.webp"), "/brand/lookbook.webp");
  assert.equal(safeProductImageUrl(null), null);
});

test("저장 상품 데이터는 보존하고 왜곡 상세컷 필드만 제거한다", () => {
  const stored = [
    { id: "legacy", name: "기존 상품", imageUrl: "/products/detail/p-test/01.webp" },
    { id: "safe", name: "정상 상품", imageUrl: "https://images.unsplash.com/photo-safe" },
  ];

  const result = sanitizeStoredProductImages(stored);

  assert.equal(result.migrated, true);
  assert.deepEqual(result.items, [
    { id: "legacy", name: "기존 상품", imageUrl: null },
    stored[1],
  ]);
  assert.equal(result.items[1], stored[1]);
});
