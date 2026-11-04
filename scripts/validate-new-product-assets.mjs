import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "data/new-product-images.json"), "utf8"),
);
if (manifest.version !== "20261104" || !Array.isArray(manifest.products))
  throw new Error("Invalid new product manifest");
const folder = join(process.cwd(), "public/products/new/20261104");
const keys = new Set();
const hashes = new Set();
const expectedFiles = [];
for (const product of manifest.products) {
  if (
    !/^(?:men|women)-(?:top|bottom|skirt)-\d{2}$/.test(product.key) ||
    keys.has(product.key)
  )
    throw new Error("Duplicate/invalid prepared product key");
  keys.add(product.key);
  const expected = `/products/new/20261104/${product.key}.webp`;
  if (
    product.path !== expected ||
    product.width !== 1200 ||
    product.height !== 1500
  )
    throw new Error(`${product.key}: invalid path/dimensions`);
  const bytes = readFileSync(join(process.cwd(), "public", product.path));
  const metadata = await sharp(bytes).metadata();
  if (
    metadata.format !== "webp" ||
    metadata.width !== 1200 ||
    metadata.height !== 1500 ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error(`${product.key}: expected single frame 1200x1500 WebP`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hashes.has(hash)) throw new Error(`${product.key}: duplicate image`);
  hashes.add(hash);
  expectedFiles.push(basename(product.path));
}
const actualFiles = existsSync(folder)
  ? readdirSync(folder)
      .filter((name) => !name.startsWith("."))
      .sort()
  : [];
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles.sort()))
  throw new Error("Prepared product manifest/file list mismatch");
console.log(
  `신규 AI 상품 이미지 무결성 PASS: ${keys.size}개, 독립 WebP 1200x1500`,
);
