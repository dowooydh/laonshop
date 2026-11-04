/** 검토용 AI 상품은 미리보기·개발 화면에만 노출한다. 실제 Product DB/후기/재고와 합치지 않는다. */
import imageManifest from "@/data/new-product-images.json";
import { CATALOG_ADDITIONS } from "@/prisma/catalog-additions";

export const PREPARED_PRODUCT_KEYS = [
  "men-top-01", "men-top-02", "men-top-03", "men-top-04",
  "men-bottom-01", "men-bottom-02", "men-bottom-03",
  "women-top-01", "women-top-02", "women-bottom-01", "women-bottom-02", "women-skirt-01",
] as const;

export type PreparedProductEnv = { VERCEL_ENV?: string; NODE_ENV?: string };
export type PreparedImage = { key: string; path: string; width: number; height: number };
export type PreparedProduct = {
  id: string; key: string; name: string; price: number; imageUrl: string; category: string;
  gender: "men" | "women"; sizes: string; soldOut: true; prepared: true; createdAt: string;
};

export function preparedProductsAllowed(env: PreparedProductEnv): boolean {
  // 호출자의 env 주입으로 운영 런타임의 경계를 덮어쓸 수 없게 한다.
  if (process.env.VERCEL_ENV === "production" || env.VERCEL_ENV === "production") return false;
  return env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development" ||
    (env.VERCEL_ENV === undefined && env.NODE_ENV === "development");
}

export function resolvePreparedProducts(records: readonly PreparedImage[], env: PreparedProductEnv): PreparedProduct[] {
  if (!preparedProductsAllowed(env)) return [];
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
      soldOut: true, prepared: true, createdAt: "2026-11-04T00:00:00.000Z" });
  }
  return result;
}

export function getPreparedProducts(env: PreparedProductEnv = {
  VERCEL_ENV: process.env.VERCEL_ENV, NODE_ENV: process.env.NODE_ENV,
}): PreparedProduct[] {
  const manifest = imageManifest as { version: string; products: PreparedImage[] };
  if (manifest.version !== "20261104" || !Array.isArray(manifest.products)) return [];
  return resolvePreparedProducts(manifest.products, env);
}
