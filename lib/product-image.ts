const PRODUCT_DETAIL_IMAGE_PATH = /^\/products\/detail\/p-[a-z0-9]+\/0[1-5]\.webp$/;
const PRODUCT_DETAIL_IMAGE_VERSION = "20260714-4x5";

/**
 * 저장된 상품 이미지가 브라우저에서 사용할 수 있는 HTTP(S) URL인지 확인한다.
 * 비율을 보존해 재생성한 로컬 상세 이미지도 장바구니·최근 본 상품에서 유지한다.
 * 기존 URL은 새 버전으로 올려 이미지 최적화 CDN의 왜곡본 캐시를 우회한다.
 */
export function safeProductImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl, "https://laonshop.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    if (PRODUCT_DETAIL_IMAGE_PATH.test(url.pathname) && url.searchParams.get("v") !== PRODUCT_DETAIL_IMAGE_VERSION) {
      url.searchParams.set("v", PRODUCT_DETAIL_IMAGE_VERSION);
      if (imageUrl.startsWith("/")) return `${url.pathname}${url.search}${url.hash}`;
      return url.toString();
    }
  } catch {
    return null;
  }

  return imageUrl;
}

export function sanitizeStoredProductImages<T extends { imageUrl: string | null }>(items: T[]): {
  items: T[];
  migrated: boolean;
} {
  let migrated = false;
  const sanitized = items.map((item) => {
    const imageUrl = safeProductImageUrl(item.imageUrl);
    if (imageUrl === item.imageUrl) return item;
    migrated = true;
    return { ...item, imageUrl };
  });

  return { items: sanitized, migrated };
}
