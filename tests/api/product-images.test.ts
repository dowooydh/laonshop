import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../../next.config";
import { getProductDetailImages, productDetailSlug } from "../../lib/product-detail-images";
import {
  hydrateMissingProductImages,
  mergeResolvedProductImages,
  safeProductImageUrl,
  sanitizeStoredProductImages,
} from "../../lib/product-image";

const PORTRAIT_REMOTE =
  "https://images.unsplash.com/photo-safe?w=1200&h=1500&q=85&auto=format&fit=crop&crop=faces%2Centropy";

test("상세컷 버전 URL은 Next 이미지 최적화 허용 목록과 일치한다", () => {
  assert.ok(
    nextConfig.images?.localPatterns?.some(
      (pattern) =>
        pattern.pathname === "/products/detail/**" && pattern.search === "?v=20260715-editorial",
    ),
  );
});

test("스마트 4:5 대표컷과 비율을 보존한 에디토리얼 상세컷 4장을 사용한다", () => {
  const product = {
    name: "타탄 체크 오버셔츠",
    category: "상의",
    gender: "men",
    imageUrl: "https://images.unsplash.com/photo-safe?w=800",
  };

  assert.equal(productDetailSlug(product), "p-1dtc2le");
  assert.deepEqual(
    getProductDetailImages(product),
    [
      { src: PORTRAIT_REMOTE, alt: "타탄 체크 오버셔츠 대표 이미지" },
      ...Array.from({ length: 4 }, (_, index) => ({
        src: `/products/detail/p-1dtc2le/${String(index + 1).padStart(2, "0")}.webp?v=20260715-editorial`,
        alt: `타탄 체크 오버셔츠 상세 이미지 ${index + 1}`,
      })),
    ],
  );
});

test("카탈로그 원본 사진이 같으면 상품명과 분류가 바뀌어도 상세컷 연결을 유지한다", () => {
  const original = {
    name: "타탄 체크 오버셔츠",
    category: "상의",
    gender: "men",
    imageUrl: "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=800&q=80&auto=format&fit=crop",
  };

  assert.equal(productDetailSlug(original), "p-1dtc2le");
  assert.equal(
    productDetailSlug({ ...original, name: "표시명 변경", category: "아우터", gender: "women" }),
    "p-1dtc2le",
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
    { src: PORTRAIT_REMOTE, alt: "갤러리 없는 테스트 상품 대표 이미지" },
  ]);
  assert.deepEqual(getProductDetailImages({ ...product, imageUrl: null }), []);
});

test("재생성된 로컬 상세컷 URL을 저장 이미지로 허용한다", () => {
  assert.equal(
    safeProductImageUrl("/products/detail/p-test/01.webp"),
    "/products/detail/p-test/01.webp?v=20260715-editorial",
  );
  assert.equal(
    safeProductImageUrl("https://laonshop.com/products/detail/p-test/01.webp"),
    "/products/detail/p-test/01.webp?v=20260715-editorial",
  );
  assert.equal(
    safeProductImageUrl("/products/detail/p-test/01.webp?v=20260714-4x5"),
    "/products/detail/p-test/01.webp?v=20260715-editorial",
  );
  assert.equal(safeProductImageUrl("https://images.unsplash.com/photo-safe?w=800"), PORTRAIT_REMOTE);
  assert.equal(safeProductImageUrl("https://picsum.photos/800/1000"), "https://picsum.photos/800/1000");
  assert.equal(safeProductImageUrl("/products/detail/p-test/05.webp"), null);
  assert.equal(safeProductImageUrl("/brand/lookbook.webp"), "/brand/lookbook.webp");
  assert.equal(safeProductImageUrl("http://images.unsplash.com/photo-unsafe"), null);
  assert.equal(safeProductImageUrl("https://evil.example/photo.webp"), null);
  assert.equal(safeProductImageUrl("https://user:pass@images.unsplash.com/photo-unsafe"), null);
  assert.equal(safeProductImageUrl("https://images.unsplash.com:444/photo-unsafe"), null);
  assert.equal(safeProductImageUrl("//images.unsplash.com/photo-unsafe"), null);
  assert.equal(safeProductImageUrl("foo"), null);
  assert.equal(safeProductImageUrl("#fragment"), null);
  assert.equal(safeProductImageUrl("/api/private-image"), null);
  assert.equal(safeProductImageUrl("javascript:alert(1)"), null);
  assert.equal(safeProductImageUrl(null), null);
});

test("정상 저장 이미지는 객체를 다시 만들지 않고 그대로 보존한다", () => {
  const stored = [
    { id: "detail", name: "상세컷 상품", imageUrl: "/products/detail/p-test/01.webp?v=20260715-editorial" },
    { id: "safe", name: "정상 상품", imageUrl: PORTRAIT_REMOTE },
  ];

  const result = sanitizeStoredProductImages(stored);

  assert.equal(result.migrated, false);
  assert.equal(result.items[0], stored[0]);
  assert.equal(result.items[1], stored[1]);
});

test("과거 null 이미지 참조는 허용된 서버 해석 결과로만 복구한다", () => {
  const stored = [
    { productId: "p1", imageUrl: null },
    { productId: "p2", imageUrl: PORTRAIT_REMOTE },
    { productId: "p3", imageUrl: null },
  ];
  const result = mergeResolvedProductImages(stored, (item) => item.productId, {
    p1: "/products/detail/p-test/01.webp",
    p2: "/products/detail/p-other/01.webp",
    p3: "https://evil.example/image.webp",
  });

  assert.equal(result.migrated, true);
  assert.equal(result.items[0].imageUrl, "/products/detail/p-test/01.webp?v=20260715-editorial");
  assert.equal(result.items[1], stored[1]);
  assert.equal(result.items[2], stored[2]);
});

test("누락 이미지 복구 API 실패는 저장 항목을 변경하지 않는다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const stored = [{ productId: "p1", imageUrl: null }];

  try {
    const result = await hydrateMissingProductImages(stored, (item) => item.productId);
    assert.equal(result.migrated, false);
    assert.equal(result.items, stored);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("누락 이미지 복구 API는 최대 허용된 로컬 상세컷만 병합한다", async () => {
  const originalFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return Response.json({ images: { p1: "/products/detail/p-test/02.webp" } });
  };
  const stored = [{ productId: "p1", imageUrl: null }];

  try {
    const result = await hydrateMissingProductImages(stored, (item) => item.productId);
    assert.match(requested, /^\/api\/products\/images\?id=p1$/);
    assert.equal(result.migrated, true);
    assert.equal(result.items[0].imageUrl, "/products/detail/p-test/02.webp?v=20260715-editorial");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
