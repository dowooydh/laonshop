import { existsSync } from "node:fs";
import { join } from "node:path";

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
      fileName,
      path: join(detailDir, fileName),
      src: `/products/detail/${slug}/${fileName}`,
      alt: `${product.name} 상세 이미지 ${index + 1}`,
    };
  }).filter((image) => existsSync(image.path));

  if (generated.length >= 4) {
    return generated.map(({ src, alt }) => ({ src, alt }));
  }

  return product.imageUrl ? [{ src: product.imageUrl, alt: `${product.name} 대표 이미지` }] : [];
}
