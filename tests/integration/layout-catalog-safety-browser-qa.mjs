// Preview example / prepared-catalog / production guard checks with local-only synthetic records.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const state = JSON.parse(readFileSync(process.env.QA_STATE_FILE, "utf8"));
assert.equal(new URL(state.databaseUrl).hostname, "127.0.0.1");
assert.equal(new URL(state.databaseUrl).pathname, "/laonshop_qa");
const require = createRequire(import.meta.url), { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: state.databaseUrl } } });
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
const checks = [], values = { productionTransport: [] }, externalWrites = [], pageErrors = [], operationalRequests = [];
const output = `${process.cwd()}/tests/reports/2026-11-04-layout-catalog-followup`;
async function check(name, fn) { await fn(); checks.push(name); }
page.on("pageerror", e => pageErrors.push(e.message));
page.on("request", req => { const u = new URL(req.url()); if (req.method() !== "GET" && !["localhost", "127.0.0.1"].includes(u.hostname)) externalWrites.push(u.hostname); });
async function go(path, port = state.appPort) { const response = await page.goto(`http://localhost:${port}${path}`, { waitUntil: "networkidle" }); const u = new URL(page.url()); assert.equal(u.hostname, "localhost"); assert.equal(u.port, String(port)); if (port === 3105) values.productionTransport.push({ path, status: response.status(), finalUrl: page.url(), redirected: Boolean(response.request().redirectedFrom()) }); await page.evaluate(() => document.fonts.ready); }
await page.route(/^https?:\/\/(?:www\.)?laonshop\.com(?:\/|$)/, route => { operationalRequests.push(new URL(route.request().url()).origin); return route.abort(); });
try {
  const before = { orders: await db.shopOrder.count(), products: await db.product.count(), reviews: await db.shopProductReview.count(), events: await db.shopShipmentEvent.count() };
  await check("preview examples are visibly labeled and separate from actual review count", async () => {
    await go(`/product/${state.fixtures.productId}`);
    const example = page.locator("[data-review-examples]");
    assert.equal(await example.count(), 1);
    assert.ok(await example.getByRole("heading", { name: "미리보기용 후기 예시" }).isVisible());
    assert.ok(await example.getByText(/실제 구매후기가 아니며/).isVisible());
    const title = await page.locator("#reviews-title").innerText();
    assert.match(title, /1/);
    const text = await example.innerText(); const match = text.match(/예시\s+(\d+)개\s*·\s*글 후기 예시\s+(\d+)개/);
    assert.ok(match); const total = Number(match[1]), written = Number(match[2]);
    assert.ok(total >= 30); assert.ok(written / total >= 0.1);
    values.exampleTotal = total; values.exampleTextCount = written;
  });
  await check("example pagination and text-only filter reveal their full declared counts", async () => {
    const example = page.locator("[data-review-examples]");
    while (await example.getByRole("button", { name: /후기 예시 더 보기/ }).count()) await example.getByRole("button", { name: /후기 예시 더 보기/ }).click();
    assert.equal(await example.locator("article").count(), values.exampleTotal);
    await example.getByRole("button", { name: /^글 후기 예시/ }).click();
    assert.equal(await example.locator("article").count(), values.exampleTextCount);
    await page.setViewportSize({ width: 390, height: 1000 });
    await example.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/review-examples-390.png`, fullPage: false });
  });
  const manifest = JSON.parse(readFileSync("data/new-product-images.json", "utf8"));
  assert.equal(manifest.products.length, 12);
  await check("prepared catalog has exactly 12 image-backed detail links and 32 disclosed drafts", async () => {
    await go("/catalog-preview");
    assert.match(await page.locator("main").innerText(), /신규 상품 32개/);
    const links = await page.locator('main a[href^="/catalog-preview/"]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute("href")))]);
    assert.equal(links.length, 12); values.preparedLinks = links;
  });
  for (const record of manifest.products) await check(`prepared detail ${record.key} is view-only with a reference size guide`, async () => {
    await go(`/catalog-preview/${record.key}`);
    assert.ok(await page.getByText("판매 준비 중", { exact: true }).isVisible());
    assert.ok(await page.getByText(/AI로 제작한 상품 이미지 시안/).isVisible());
    assert.equal(await page.locator("main").getByRole("button", { name: /장바구니 담기|바로 구매/ }).count(), 0);
    assert.ok(await page.locator("#size-guide-title").isVisible());
    assert.ok(await page.getByText("참고용 · 상품 실측 아님", { exact: true }).isVisible());
    assert.ok(await page.locator("main img").first().evaluate(img => img.complete && img.naturalWidth > 0));
  });
  await check("production public pages hide example reviews and all prepared links", async () => {
    for (const path of ["/", "/shop/men", "/shop/women", "/search?q=셔츠", `/product/${state.fixtures.productId}`]) {
      await go(path, 3105);
      assert.equal(await page.locator("[data-review-examples]").count(), 0, path);
      assert.equal(await page.locator('main a[href^="/catalog-preview/"]').count(), 0, path);
    }
  });
  await check("production direct prepared URLs return NotFound without draft content", async () => {
    for (const path of ["/catalog-preview", "/catalog-preview/men-top-01"]) {
      await go(path, 3105);
      assert.equal(await page.locator("[data-review-examples]").count(), 0);
      assert.equal(await page.getByText("AI로 준비한 새로운 셀렉션", { exact: true }).count(), 0);
      assert.equal(await page.getByText("AI로 제작한 상품 이미지 시안입니다.", { exact: false }).count(), 0);
      const text = await page.locator("main").innerText(); assert.match(text, /찾을 수 없|없는 페이지|404/);
    }
  });
  await check("preview and production display checks never change real ledgers", async () => {
    const after = { orders: await db.shopOrder.count(), products: await db.product.count(), reviews: await db.shopProductReview.count(), events: await db.shopShipmentEvent.count() };
    assert.deepEqual(after, before); values.ledgerBefore = before; values.ledgerAfter = after;
  });
  assert.equal(pageErrors.length, 0); assert.equal(externalWrites.length, 0); assert.equal(operationalRequests.length, 0);
  const result = { status: "PASS", count: checks.length, checks, values, pageErrors, externalWrites, operationalRequests };
  writeFileSync(`${output}/safety-browser-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, count: result.count }));
} finally { await page.close(); await browser.close(); await db.$disconnect(); }
