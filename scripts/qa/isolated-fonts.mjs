// Public font cache validation only. This module never loads application code.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function normalizeFontFaceCss(css) {
  // Next's Google-font extractor requires `src: url(...)` on a separate line
  // from the subset comment. Minified Next CSS contains `src:url(...)`.
  return [...css.matchAll(/@font-face\{[^}]+\}/g)].map(match => {
    const subset = /unicode-range:u\+00\?\?/i.test(match[0]) ? "latin" : "cached-other";
    return `/* ${subset} */\n${match[0].replace(/\bsrc:\s*url\(/g, "src: url(")}`;
  }).join("\n");
}

export function validateExtractedFonts(families, assets, findFontFilesInCss) {
  const extracted = Object.fromEntries(Object.entries(families).map(([family, css]) => [family, findFontFilesInCss(css, ["latin"])]));
  const paths = Object.values(extracted).flat().map(value => value.googleFontFileUrl);
  assert.equal(paths.length, 9, "FONT_EXTRACTED_COUNT_INVALID");
  assert.equal(extracted["Space Grotesk"]?.length, 3, "FONT_DISPLAY_COUNT_INVALID");
  assert.equal(extracted["JetBrains Mono"]?.length, 6, "FONT_MONO_COUNT_INVALID");
  assert.deepEqual([...paths].sort(), assets.map(asset => `/opt/qa/fonts/${asset.name}`).sort(), "FONT_EXTRACTED_ASSETS_MISMATCH");
  assert.ok(Object.values(extracted).every(files => files.filter(value => value.preloadFontFile).length === 1), "FONT_LATIN_PRELOAD_INVALID");
  return { status: "PASS", count: paths.length, displayCount: 3, monoCount: 6, latinPreloadCount: 2 };
}

export function validateImageFonts() {
  const require = createRequire(import.meta.url);
  const manifest = JSON.parse(fs.readFileSync("/opt/qa/fonts/cache-manifest.json", "utf8"));
  const responses = require("/opt/qa/fonts/responses.cjs");
  const families = Object.fromEntries(["Space Grotesk", "JetBrains Mono"].map(family => [family, responses[`https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@100..800&display=swap`]]));
  const extractor = "/opt/deps/node_modules/next/dist/compiled/@next/font/dist/google/find-font-files-in-css.js";
  const digest = value => createHash("sha256").update(value).digest("hex");
  assert.equal(digest(fs.readFileSync(extractor)), manifest.extractorSha256, "FONT_EXTRACTOR_VERSION_MISMATCH");
  for (const asset of manifest.assets) {
    assert.match(asset.name, /^[a-f0-9]{16}-s(?:\.p)?\.woff2$/);
    const bytes = fs.readFileSync(`/opt/qa/fonts/${asset.name}`);
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2", "FONT_MAGIC_INVALID");
    assert.equal(digest(bytes), asset.sha256, "FONT_HASH_MISMATCH");
  }
  return validateExtractedFonts(families, manifest.assets, require(extractor).findFontFilesInCss);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify({ kind: "isolated-font-cache", ...validateImageFonts() })); }
  catch { console.error(JSON.stringify({ status: "FAIL", reason: "FONT_CACHE_VALIDATION_FAILED" })); process.exitCode = 1; }
}
