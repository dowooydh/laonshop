/** 출시 준비 상품은 공개하되 실제 Product DB·구매후기·판매 재고와 합치지 않는다. */
import imageManifest from "@/data/new-product-images.json";
import { CATALOG_ADDITIONS } from "@/prisma/catalog-additions";

export const PREPARED_PRODUCT_KEYS = CATALOG_ADDITIONS.map((product) => product.key);

export type PreparedImage = { key: string; path: string; width: number; height: number };
export type PreparedProduct = {
  id: string; key: string; name: string; price: number; imageUrl: string; category: string;
  gender: "men" | "women"; sizes: string; stock: 0; soldOut: true; prepared: true; createdAt: string;
};

export function resolvePreparedProducts(records: readonly PreparedImage[]): PreparedProduct[] {
  const result: PreparedProduct[] = [];
  for (const key of PREPARED_PRODUCT_KEYS) {
    const matches = records.filter((image) => image.key === key);
    if (matches.length !== 1) continue;
    const image = matches[0];
    // JSON의 임의 URL이나 미완성 크기는 노출하지 않는다. 실제 파일은 build gate에서 대조한다.
    if (image.path !== `/products/new/20261104/${key}.webp` || image.width !== 1200 || image.height !== 1500) continue;
    const draft = CATALOG_ADDITIONS.find((entry) => entry.key === key);
    if (!draft) continue;
    result.push({ id: `prepared-${key}`, key, name: draft.name, price: draft.proposedPrice,
      imageUrl: image.path, category: draft.category, gender: draft.gender, sizes: draft.proposedSizes,
      stock: 0, soldOut: true, prepared: true, createdAt: "2026-11-04T00:00:00.000Z" });
  }
  return result;
}

export function getPreparedProducts(): PreparedProduct[] {
  const manifest = imageManifest as { version: string; products: PreparedImage[] };
  if (manifest.version !== "20261104" || !Array.isArray(manifest.products)) return [];
  return resolvePreparedProducts(manifest.products);
}
