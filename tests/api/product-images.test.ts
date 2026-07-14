import assert from "node:assert/strict";
import test from "node:test";

import { getProductDetailImages, productDetailSlug } from "../../lib/product-detail-images";
import { safeProductImageUrl, sanitizeStoredProductImages } from "../../lib/product-image";

test("비율을 보존한 로컬 상세컷 5장을 우선 사용한다", () => {
  const product = {
    name: "타탄 체크 오버셔츠",
    category: "상의",
    gender: "men",
    imageUrl: "https://images.unsplash.com/photo-safe?w=800",
  };

  assert.equal(productDetailSlug(product), "p-1dtc2le");
  assert.deepEqual(
    getProductDetailImages(product),
    Array.from({ length: 5 }, (_, index) => ({
      src: `/products/detail/p-1dtc2le/${String(index + 1).padStart(2, "0")}.webp?v=20260714-4x5`,
      alt: `타탄 체크 오버셔츠 상세 이미지 ${index + 1}`,
    })),
  );
});

test("상세컷이 없는 상품은 안전한 대표 이미지로 대체한다", () => {
  const product = {
    name: "갤러리 없는 테스트 상품",
    category: "상의",
    gender: "men",
    imageUrl: "https://images.unsplash.com/photo-safe?w=800",
  };

  assert.deepEqual(getProductDetailImages(product), [
    { src: product.imageUrl, alt: "갤러리 없는 테스트 상품 대표 이미지" },
  ]);
  assert.deepEqual(getProductDetailImages({ ...product, imageUrl: null }), []);
});

test("재생성된 로컬 상세컷 URL을 저장 이미지로 허용한다", () => {
  assert.equal(
    safeProductImageUrl("/products/detail/p-test/01.webp"),
    "/products/detail/p-test/01.webp?v=20260714-4x5",
  );
  assert.equal(
    safeProductImageUrl("https://laonshop.com/products/detail/p-test/01.webp"),
    "https://laonshop.com/products/detail/p-test/01.webp?v=20260714-4x5",
  );
  assert.equal(
    safeProductImageUrl("/products/detail/p-test/01.webp?v=20260714-4x5"),
    "/products/detail/p-test/01.webp?v=20260714-4x5",
  );
  assert.equal(safeProductImageUrl("https://images.unsplash.com/photo-safe?w=800"), "https://images.unsplash.com/photo-safe?w=800");
  assert.equal(safeProductImageUrl("/brand/lookbook.webp"), "/brand/lookbook.webp");
  assert.equal(safeProductImageUrl("javascript:alert(1)"), null);
  assert.equal(safeProductImageUrl(null), null);
});

test("정상 저장 이미지는 객체를 다시 만들지 않고 그대로 보존한다", () => {
  const stored = [
    { id: "detail", name: "상세컷 상품", imageUrl: "/products/detail/p-test/01.webp?v=20260714-4x5" },
    { id: "safe", name: "정상 상품", imageUrl: "https://images.unsplash.com/photo-safe" },
  ];

  const result = sanitizeStoredProductImages(stored);

  assert.equal(result.migrated, false);
  assert.equal(result.items[0], stored[0]);
  assert.equal(result.items[1], stored[1]);
});
