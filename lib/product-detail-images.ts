import { existsSync } from "node:fs";
import { join } from "node:path";

import { safeProductImageUrl } from "@/lib/product-image";
import { CATALOG, type Category, type Gender } from "@/prisma/catalog";

export type DetailImageProduct = {
  name: string;
  category: string | null;
  gender: string | null;
  imageUrl: string | null;
};

export type DetailImage = {
  src: string;
  alt: string;
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function legacyProductDetailSlug(product: Pick<DetailImageProduct, "name" | "category" | "gender">) {
  const source = [product.gender, product.category, product.name].filter(Boolean).join("-");

  return `p-${hashString(source)}`;
}

const CATALOG_SLUG_BY_PHOTO_ID = new Map<string, string>();
const CATALOG_PHOTO_ID_PATTERN = /^\/photo-([^/]+)$/;

for (const gender of ["men", "women"] as Gender[]) {
  for (const [category, products] of Object.entries(CATALOG[gender]) as [Category, { name: string; id: string }[]][]) {
    for (const product of products) {
      const slug = legacyProductDetailSlug({ gender, category, name: product.name });
      if (CATALOG_SLUG_BY_PHOTO_ID.has(product.id)) {
        throw new Error(`Duplicate catalog photo id: ${product.id}`);
      }
      CATALOG_SLUG_BY_PHOTO_ID.set(product.id, slug);
    }
  }
}

function catalogPhotoId(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" || url.hostname !== "images.unsplash.com") return null;
    return url.pathname.match(CATALOG_PHOTO_ID_PATTERN)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * 기존 자산 경로는 보존하되, 카탈로그 원본 사진 ID를 안정 키로 사용한다.
 * 상품명·카테고리 표기가 바뀌어도 같은 SKU의 상세 갤러리가 끊기지 않는다.
 */
export function productDetailSlug(product: DetailImageProduct) {
  const photoId = catalogPhotoId(product.imageUrl);
  return (photoId && CATALOG_SLUG_BY_PHOTO_ID.get(photoId)) || legacyProductDetailSlug(product);
}

export function getProductDetailImages(product: DetailImageProduct): DetailImage[] {
  const slug = productDetailSlug(product);
  const detailDir = join(process.cwd(), "public", "products", "detail", slug);
  const generated = Array.from({ length: 5 }, (_, index) => {
    const fileName = `${String(index + 1).padStart(2, "0")}.webp`;
    return {
      path: join(detailDir, fileName),
      src: safeProductImageUrl(`/products/detail/${slug}/${fileName}`),
      alt: `${product.name} 상세 이미지 ${index + 1}`,
    };
  }).filter((image): image is { path: string; src: string; alt: string } => Boolean(image.src) && existsSync(image.path));

  // 상세컷이 최소 4장 갖춰졌을 때만 사용한다. 일부 파일만 배포된 경우에는
  // 대표 이미지로 대체해 사용자가 불완전한 갤러리를 보지 않도록 한다.
  if (generated.length >= 4) {
    return generated.map(({ src, alt }) => ({ src, alt }));
  }

  const imageUrl = safeProductImageUrl(product.imageUrl);
  return imageUrl ? [{ src: imageUrl, alt: `${product.name} 대표 이미지` }] : [];
}
