import { existsSync } from "node:fs";
import { join } from "node:path";

import { safeProductImageUrl } from "@/lib/product-image";

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

export function productDetailSlug(product: Pick<DetailImageProduct, "name" | "category" | "gender">) {
  const source = [product.gender, product.category, product.name].filter(Boolean).join("-");

  return `p-${hashString(source)}`;
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
