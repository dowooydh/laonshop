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
  // 기존 로컬 상세컷은 5분할 시트에서 비균등 리사이즈되어 원본 비율이 훼손됐다.
  // 비율을 보존해 재생성·검수하기 전까지는 큐레이션된 원본 대표 이미지만 사용한다.
  const imageUrl = safeProductImageUrl(product.imageUrl);
  return imageUrl ? [{ src: imageUrl, alt: `${product.name} 대표 이미지` }] : [];
}
