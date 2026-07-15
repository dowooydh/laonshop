import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(process.cwd(), "public", "products", "detail");
const GALLERY_ROOT = join(process.cwd(), "public", "products", "gallery");
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 1500;

async function assertIndependentSingleFrame(file) {
  const metadata = await sharp(file).metadata();
  if ((metadata.pages ?? 1) !== 1) throw new Error(`${file}: 애니메이션/다중 프레임 이미지는 허용하지 않습니다.`);

  const preview = await sharp(file).resize(120, 150, { fit: "fill" }).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { data: previewPixels, info: previewInfo } = preview;

  function neutralColumnRatio(x) {
    let neutral = 0;
    for (let y = 0; y < previewInfo.height; y++) {
      const offset = (y * previewInfo.width + x) * previewInfo.channels;
      if (
        Math.abs(previewPixels[offset] - 245) <= 5 &&
        Math.abs(previewPixels[offset + 1] - 245) <= 5 &&
        Math.abs(previewPixels[offset + 2] - 245) <= 5
      ) {
        neutral += 1;
      }
    }
    return neutral / previewInfo.height;
  }

  let left = 0;
  while (left < previewInfo.width && neutralColumnRatio(left) >= 0.98) left += 1;
  let right = 0;
  while (right < previewInfo.width && neutralColumnRatio(previewInfo.width - 1 - right) >= 0.98) right += 1;

  function hasHardBoundary(edgeWidth, direction) {
    if (edgeWidth / previewInfo.width <= 0.04) return false;
    const boundary = direction === 1 ? edgeWidth : previewInfo.width - 1 - edgeWidth;
    if (boundary < 0 || boundary >= previewInfo.width) return false;
    return neutralColumnRatio(boundary) < 0.94;
  }

  const artificialSidePadding =
    (left + right) / previewInfo.width > 0.12 &&
    (hasHardBoundary(left, 1) || hasHardBoundary(right, -1));
  if (artificialSidePadding) {
    throw new Error(`${file}: 좌우 인공 레터박스가 의심됩니다.`);
  }

  const raw = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: pixels, info } = raw;
  let uniformCenterColumns = 0;
  for (let x = 590; x <= 610; x++) {
    const sums = [0, 0, 0];
    const squares = [0, 0, 0];
    for (let y = 0; y < info.height; y++) {
      const offset = (y * info.width + x) * info.channels;
      for (let channel = 0; channel < 3; channel++) {
        const value = pixels[offset + channel];
        sums[channel] += value;
        squares[channel] += value * value;
      }
    }
    const maxVariance = Math.max(
      ...sums.map((sum, channel) => squares[channel] / info.height - (sum / info.height) ** 2),
    );
    if (maxVariance < 4) uniformCenterColumns += 1;
  }
  if (uniformCenterColumns >= 3) {
    throw new Error(`${file}: 중앙 분할선/패널 gutter가 의심됩니다.`);
  }
}

function webpDimensions(buffer, file) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP" ||
    buffer.readUInt32LE(4) + 8 !== buffer.length
  ) {
    throw new Error(`${file}: WebP RIFF 헤더 또는 파일 길이가 올바르지 않습니다.`);
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) throw new Error(`${file}: 손상된 WebP chunk입니다.`);

    if (type === "VP8X" && size >= 10) {
      return {
        width: 1 + buffer.readUIntLE(data + 4, 3),
        height: 1 + buffer.readUIntLE(data + 7, 3),
      };
    }
    if (type === "VP8 " && size >= 10 && buffer.subarray(data + 3, data + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    if (type === "VP8L" && size >= 5 && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    offset = data + size + (size % 2);
  }

  throw new Error(`${file}: WebP 이미지 크기 chunk를 찾지 못했습니다.`);
}

const products = JSON.parse(
  execFileSync(process.execPath, ["scripts/catalog-image-manifest.mjs", "--json"], { encoding: "utf8" }),
);
const slugs = products.map((product) => product.slug);
const photoIds = products.map((product) => product.photoId);
if (new Set(slugs).size !== slugs.length) throw new Error("상품 상세 이미지 slug 충돌이 있습니다.");
if (new Set(photoIds).size !== photoIds.length) throw new Error("카탈로그 원본 사진 ID가 중복되었습니다.");

const expectedSlugs = new Set(slugs);
const actualSlugs = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const missing = slugs.filter((slug) => !actualSlugs.includes(slug));
const unexpected = actualSlugs.filter((slug) => !expectedSlugs.has(slug));
if (missing.length || unexpected.length) {
  throw new Error(`상세 이미지 폴더 불일치: missing=${missing.join(",") || "-"}, unexpected=${unexpected.join(",") || "-"}`);
}

let imageCount = 0;
const digestToFile = new Map();
for (const slug of slugs) {
  const folder = join(ROOT, slug);
  const files = readdirSync(folder).sort();
  const expectedFiles = Array.from({ length: 4 }, (_, index) => `${String(index + 1).padStart(2, "0")}.webp`);
  if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
    throw new Error(`${slug}: 01.webp~04.webp 에디토리얼 2컷 정확히 4장이 필요합니다. actual=${files.join(",")}`);
  }
  for (const name of expectedFiles) {
    const file = join(folder, name);
    const bytes = readFileSync(file);
    const dimensions = webpDimensions(bytes, file);
    if (dimensions.width !== TARGET_WIDTH || dimensions.height !== TARGET_HEIGHT) {
      throw new Error(`${file}: ${TARGET_WIDTH}x${TARGET_HEIGHT}가 아니라 ${dimensions.width}x${dimensions.height}입니다.`);
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    const duplicate = digestToFile.get(digest);
    if (duplicate) throw new Error(`${file}: ${duplicate}와 완전히 동일한 이미지입니다.`);
    digestToFile.set(digest, file);
    imageCount += 1;
  }
}

console.log(`상세 이미지 무결성 PASS: 상품 ${products.length}개, WebP ${imageCount}장, ${TARGET_WIDTH}x${TARGET_HEIGHT}`);

const galleryManifest = JSON.parse(readFileSync(join(process.cwd(), "data", "product-galleries.json"), "utf8"));
const productBySlug = new Map(products.map((product) => [product.slug, product]));
const gallerySlugs = galleryManifest.products.map((product) => product.slug);
const galleryPhotoIds = galleryManifest.products.map((product) => product.photoId);
if (new Set(gallerySlugs).size !== gallerySlugs.length) throw new Error("큐레이션 갤러리 slug가 중복되었습니다.");
if (new Set(galleryPhotoIds).size !== galleryPhotoIds.length) throw new Error("큐레이션 갤러리 원본 사진 ID가 중복되었습니다.");

const expectedByBatch = new Map();
const expectedShotRoles = ["hero", "lifestyle", "silhouette", "product-only", "detail"];
let galleryImageCount = 0;
for (const gallery of galleryManifest.products) {
  const catalogProduct = productBySlug.get(gallery.slug);
  if (
    !catalogProduct ||
    catalogProduct.photoId !== gallery.photoId ||
    catalogProduct.name !== gallery.name ||
    catalogProduct.gender !== gallery.gender ||
    catalogProduct.category !== gallery.category
  ) {
    throw new Error(`${gallery.slug}: 큐레이션 manifest와 상품 카탈로그가 일치하지 않습니다.`);
  }
  if (
    !Array.isArray(gallery.shots) ||
    JSON.stringify(gallery.shots.map((shot) => shot.role)) !== JSON.stringify(expectedShotRoles)
  ) {
    throw new Error(`${gallery.slug}: hero·lifestyle·silhouette·product-only·detail 역할을 순서대로 1개씩 지정해야 합니다.`);
  }

  const expectedSlugsForBatch = expectedByBatch.get(gallery.batch) ?? new Set();
  expectedSlugsForBatch.add(gallery.slug);
  expectedByBatch.set(gallery.batch, expectedSlugsForBatch);

  const folder = join(GALLERY_ROOT, gallery.batch, gallery.slug);
  const files = readdirSync(folder).sort();
  const expectedFiles = Array.from({ length: 5 }, (_, index) => `${String(index + 1).padStart(2, "0")}.webp`);
  if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
    throw new Error(`${gallery.batch}/${gallery.slug}: 독립 단일 프레임 01.webp~05.webp가 필요합니다. actual=${files.join(",")}`);
  }

  for (const name of expectedFiles) {
    const file = join(folder, name);
    const bytes = readFileSync(file);
    const dimensions = webpDimensions(bytes, file);
    if (dimensions.width !== TARGET_WIDTH || dimensions.height !== TARGET_HEIGHT) {
      throw new Error(`${file}: ${TARGET_WIDTH}x${TARGET_HEIGHT}가 아니라 ${dimensions.width}x${dimensions.height}입니다.`);
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    const duplicate = digestToFile.get(digest);
    if (duplicate) throw new Error(`${file}: ${duplicate}와 완전히 동일한 이미지입니다.`);
    digestToFile.set(digest, file);
    await assertIndependentSingleFrame(file);
    galleryImageCount += 1;
  }
}

const actualBatches = readdirSync(GALLERY_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const expectedBatches = Array.from(expectedByBatch.keys()).sort();
if (JSON.stringify(actualBatches) !== JSON.stringify(expectedBatches)) {
  throw new Error(`큐레이션 갤러리 배치 불일치: expected=${expectedBatches.join(",")}, actual=${actualBatches.join(",")}`);
}

for (const [batch, expectedBatchSlugs] of expectedByBatch) {
  const actualBatchSlugs = readdirSync(join(GALLERY_ROOT, batch), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expected = Array.from(expectedBatchSlugs).sort();
  if (JSON.stringify(actualBatchSlugs) !== JSON.stringify(expected)) {
    throw new Error(`${batch}: 큐레이션 상품 폴더 불일치: expected=${expected.join(",")}, actual=${actualBatchSlugs.join(",")}`);
  }
}

console.log(
  `큐레이션 갤러리 무결성 PASS: 배치 ${expectedBatches.length}개, 상품 ${galleryManifest.products.length}개, 독립 WebP ${galleryImageCount}장, ${TARGET_WIDTH}x${TARGET_HEIGHT}`,
);
