import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fontCache } from "../../scripts/qa/isolated.mjs";
import { normalizeFontFaceCss, validateExtractedFonts } from "../../scripts/qa/isolated-fonts.mjs";
const require = createRequire(import.meta.url);
const { findFontFilesInCss } = require("next/dist/compiled/@next/font/dist/google/find-font-files-in-css.js");

test("actual Next extractor rejects minified src and accepts normalized cached font faces", () => {
  const css = '@font-face{font-family:Example;src:url(/opt/qa/fonts/font.woff2);unicode-range:u+00??}';
  assert.equal(findFontFilesInCss(css, ["latin"]).length, 0);
  const files = findFontFilesInCss(normalizeFontFaceCss(css), ["latin"]);
  assert.deepEqual(files, [{ googleFontFileUrl: "/opt/qa/fonts/font.woff2", preloadFontFile: true }]);
});
test("actual cache exposes exactly nine hashed font files and two Latin preloads", () => {
  const value = fontCache(null);
  assert.equal(value.assets.length, 9); assert.equal(value.extraction.count, 9); assert.equal(value.extraction.latinPreloadCount, 2);
  assert.equal(value.extraction.status, "PASS");
});
test("missing extracted font or preload cannot certify the prepared cache", () => {
  assert.throws(() => validateExtractedFonts({ "Space Grotesk": "", "JetBrains Mono": "" }, [], findFontFilesInCss), /FONT_EXTRACTED_COUNT/);
});
