// Anonymous, GET-only checks of the approved LAONSHOP production release.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = "https://laonshop.com";
const output = join(process.cwd(), "tests/reports/2026-11-04-production-release");
const manifest = JSON.parse(readFileSync("data/new-product-images.json", "utf8"));
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
const checks = [], errors = [], blockedWrites = [], samples = [];
let activeCheck = "";
const page = await context.newPage();
const result = { checkedAt: new Date().toISOString(), target: "production", origin: base, checks, samples, errors, blockedWrites };
await context.route("**/*", route => {
  if (route.request().method() !== "GET") {
    blockedWrites.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
    return route.abort();
  }
  return route.continue();
});
page.on("pageerror", error => errors.push({ route: page.url(), check: activeCheck, message: error.message, stack: error.stack }));
async function check(name, callback) { activeCheck = name; await callback(); checks.push(name); }
async function visit(path) {
  const response = await page.goto(base + path, { waitUntil: "domcontentloaded" });
  assert.equal(response.status(), 200, path);
  assert.equal(new URL(page.url()).origin, base);
  await page.locator("main").waitFor({ state: "visible" });
  // The layout main wrapper can arrive before the streamed route content.
  await page.locator("main h1").first().waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator("[data-review-examples]").count(), 0);
}
try {
  await check("public home exposes approved prepared collection", async () => {
    await visit("/");
    assert.ok(await page.locator('main a[href="/catalog-preview"]').count());
    await page.screenshot({ path: join(output, "production-home-1280.png"), fullPage: false });
  });
  for (const [gender, count, selling] of [["men", 171, 155], ["women", 190, 174]]) {
    await check(`${gender} separates selling ${selling} and prepared 16`, async () => {
      await visit(`/shop/${gender}`);
      const text = await page.locator("main").innerText();
      assert.match(text, new RegExp(`전체\\s*${count}개`));
      assert.match(text, new RegExp(`판매 상품 ${selling}개`));
      assert.match(text, /판매 준비 16개/);
      await page.getByLabel("구매 가능 상품만").check();
      assert.equal(await page.locator('main a[href^="/catalog-preview/"]').count(), 0);
    });
  }
  await check("all 32 new product cards load real image files", async () => {
    await visit("/catalog-preview");
    const links = await page.locator('main a[href^="/catalog-preview/"]').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute("href")))]);
    assert.equal(links.length, 32);
    await page.locator("main img").evaluateAll(async images => {
      await Promise.all(images.map(image => {
        image.loading = "eager";
        return image.decode();
      }));
    });
    assert.equal(await page.locator("main img").count(), 32);
    assert.ok(await page.locator("main img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)));
    await page.screenshot({ path: join(output, "production-collection-1280.png"), fullPage: false });
  });
  for (const entry of manifest.products) {
    await check(`prepared ${entry.key} is public and cannot be purchased`, async () => {
      const response = await fetch(`${base}/catalog-preview/${entry.key}`, { redirect: "error" });
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(entry.name));
      assert.ok(html.includes("판매 준비 중"));
      assert.ok(html.includes("AI로 제작한 상품 이미지 시안"));
      assert.ok(!html.includes("장바구니 담기"));
      assert.ok(!html.includes("바로 구매"));
      assert.ok(!html.includes("data-review-examples"));
      const asset = await fetch(base + entry.path, { redirect: "error" });
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type"), /image\/webp/);
      const bytes = Buffer.from(await asset.arrayBuffer());
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    });
  }
  await check("original product has aligned buying information and a reference size guide", async () => {
    const id = process.env.QA_PUBLIC_PRODUCT_ID;
    assert.match(id, /^[a-zA-Z0-9_-]+$/);
    await visit(`/product/${id}`);
    assert.ok(await page.getByText("참고용 · 상품 실측 아님", { exact: true }).isVisible());
    assert.ok(await page.locator("#reviews-title").isVisible());
    assert.match(await page.locator("#reviews-title").innerText(), /구매후기\s+\d+/);
    assert.equal(await page.getByText("지금은 구매후기를 이용할 수 없습니다. 잠시 후 다시 확인해주세요.", { exact: true }).count(), 0);
    await page.screenshot({ path: join(output, "production-product-1280.png"), fullPage: false });
  });
  for (const width of [320, 390, 1280]) for (const scale of [1, 2]) {
    await check(`prepared detail ${width}px ${scale * 100}% has no horizontal overflow`, async () => {
      await page.setViewportSize({ width, height: 1000 });
      await visit("/catalog-preview/women-dress-02");
      await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, String(overflow));
      samples.push({ width, scale, overflow });
      assert.equal(await page.locator("main").getByRole("button", { name: /장바구니 담기|바로 구매/ }).count(), 0);
      if (width === 390 && scale === 1) await page.screenshot({ path: join(output, "production-prepared-390.png"), fullPage: true });
    });
  }
  assert.equal(errors.length, 0);
  assert.equal(blockedWrites.length, 0);
  result.status = "PASS";
} catch (error) {
  result.status = "FAIL";
  result.failure = error.message;
  process.exitCode = 1;
} finally {
  writeFileSync(join(output, "production-public-smoke-results.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, checks: checks.length, pageErrors: errors.length, blockedWrites: blockedWrites.length, failure: result.failure }));
  await browser.close();
}
