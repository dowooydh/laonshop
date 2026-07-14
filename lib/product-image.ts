const PRODUCT_DETAIL_IMAGE_PATH = /^\/products\/detail\/p-[a-z0-9]+\/0[1-5]\.webp$/;
const BRAND_IMAGE_PATH = /^\/brand\/[a-z0-9][a-z0-9/_-]*\.(?:avif|jpe?g|png|webp)$/i;
const PRODUCT_DETAIL_IMAGE_VERSION = "20260714-4x5";
const LOCAL_IMAGE_HOSTS = new Set(["laonshop.com", "www.laonshop.com"]);
const REMOTE_IMAGE_HOSTS = new Set(["images.unsplash.com", "picsum.photos"]);

function normalizeLocalImageUrl(url: URL): string | null {
  if (PRODUCT_DETAIL_IMAGE_PATH.test(url.pathname)) {
    url.search = "";
    url.hash = "";
    url.searchParams.set("v", PRODUCT_DETAIL_IMAGE_VERSION);
    return `${url.pathname}${url.search}`;
  }

  if (BRAND_IMAGE_PATH.test(url.pathname)) {
    return url.search || url.hash ? null : url.pathname;
  }

  return null;
}

/**
 * 저장된 상품 이미지가 브라우저에서 사용할 수 있는 HTTP(S) URL인지 확인한다.
 * 비율을 보존해 재생성한 로컬 상세 이미지도 장바구니·최근 본 상품에서 유지한다.
 * 기존 URL은 새 버전으로 올려 이미지 최적화 CDN의 왜곡본 캐시를 우회한다.
 */
export function safeProductImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  try {
    if (imageUrl.startsWith("//")) return null;
    const isLocalPath = imageUrl.startsWith("/") && !imageUrl.startsWith("//");
    const url = new URL(imageUrl, "https://laonshop.invalid");

    if (isLocalPath) {
      return normalizeLocalImageUrl(url);
    }

    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    if (LOCAL_IMAGE_HOSTS.has(url.hostname)) return normalizeLocalImageUrl(url);
    if (!REMOTE_IMAGE_HOSTS.has(url.hostname)) return null;

    return url.toString();
  } catch {
    return null;
  }
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

export type ProductImageResolution = Record<string, string | null>;

export function mergeResolvedProductImages<T extends { imageUrl: string | null }>(
  items: T[],
  getProductId: (item: T) => string,
  resolved: ProductImageResolution,
): { items: T[]; migrated: boolean } {
  let migrated = false;
  const merged = items.map((item) => {
    const current = safeProductImageUrl(item.imageUrl);
    const replacement = current ?? safeProductImageUrl(resolved[getProductId(item)]);
    if (replacement === item.imageUrl) return item;
    migrated = true;
    return { ...item, imageUrl: replacement };
  });

  return { items: merged, migrated };
}

/** 과거 배포에서 null로 저장된 이미지 참조만 공개 상품 API로 복구한다. */
export async function hydrateMissingProductImages<T extends { imageUrl: string | null }>(
  items: T[],
  getProductId: (item: T) => string,
): Promise<{ items: T[]; migrated: boolean }> {
  const missingIds = Array.from(
    new Set(
      items
        .filter((item) => !safeProductImageUrl(item.imageUrl))
        .map(getProductId)
        .filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64),
    ),
  ).slice(0, 50);

  if (missingIds.length === 0) return { items, migrated: false };

  try {
    const params = new URLSearchParams();
    for (const id of missingIds) params.append("id", id);
    const response = await fetch(`/api/products/images?${params}`, { cache: "no-store" });
    if (!response.ok) return { items, migrated: false };
    const body = (await response.json()) as { images?: unknown };
    if (!body.images || typeof body.images !== "object" || Array.isArray(body.images)) {
      return { items, migrated: false };
    }
    return mergeResolvedProductImages(items, getProductId, body.images as ProductImageResolution);
  } catch {
    return { items, migrated: false };
  }
}
