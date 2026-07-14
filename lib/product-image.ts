const LEGACY_DISTORTED_DETAIL_PATH = "/products/detail/";

/**
 * 5분할 원본을 비균등 리사이즈해 만든 기존 상세 이미지는 운영에 노출하지 않는다.
 * 상품/장바구니 데이터는 유지하고 이미지 URL만 제거해 원본 비율 왜곡을 막는다.
 */
export function safeProductImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  try {
    const pathname = new URL(imageUrl, "https://laonshop.invalid").pathname;
    if (pathname.startsWith(LEGACY_DISTORTED_DETAIL_PATH)) return null;
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
