import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public", "products", "detail");
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 1500;

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
  execFileSync(process.execPath, ["scripts/detail-image-prompts.mjs", "--json"], { encoding: "utf8" }),
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
