// Independent release QA: disposable loopback DB and local production/preview renderers only.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const state = JSON.parse(readFileSync(process.env.QA_STATE_FILE, "utf8"));
assert.equal(new URL(state.databaseUrl).hostname, "127.0.0.1");
assert.equal(new URL(state.databaseUrl).pathname, "/laonshop_qa");
process.env.DATABASE_URL = state.databaseUrl;
process.env.DIRECT_URL = state.databaseUrl;
const output = process.env.QA_OUTPUT_DIR || `${process.cwd()}/tests/reports/2026-11-04-production-release`;
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: state.databaseUrl } } });
const moduleAt = file => import(pathToFileURL(`${process.cwd()}/${file}`).href);
const { getPreparedProducts } = await moduleAt("lib/prepared-products.ts");
const { getReviewExamples, showReviewExamples } = await moduleAt("lib/review-examples.ts");
const { getProductSizeGuide } = await moduleAt("lib/product-size-guide.ts");
const manifest = JSON.parse(readFileSync("data/new-product-images.json", "utf8"));
const checks = [], layouts = [], transports = [], loadedImages = [], errors = [], failedImages = [], forbiddenRequests = [], negativeRequests = [];
const engineName = process.env.QA_BROWSER_ENGINE || "chromium";
const negativeOnly = process.env.QA_NEGATIVE_ONLY === "1";
const engine = (await import(process.env.QA_PLAYWRIGHT_MODULE))[engineName];
const browser = await engine.launch({ executablePath: process.env.QA_BROWSER_EXECUTABLE || undefined, headless: true });
const prepared = getPreparedProducts();
let context, page, runtime;
async function check(name, fn) { await fn(); checks.push(name); }
async function ledger() {
  return { products: await db.product.count(), orders: await db.shopOrder.count(), reviews: await db.shopProductReview.count(), shipments: await db.shopShipment.count(), events: await db.shopShipmentEvent.count() };
}
async function newContext(mode, role) {
  if (context) await context.close();
  runtime = mode;
  const port = mode === "production" ? state.productionPort : state.appPort;
  const base = `http://localhost:${port}`;
  context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
  if (role) await context.addCookies([{ name: "laonshop_session", value: state.fixtures.cookies[role], url: base, httpOnly: true, sameSite: "Lax" }]);
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (["localhost", "127.0.0.1"].includes(url.hostname)) return route.continue();
    if (/laonshop\.com$|ksnet|kspay|laonpay|baum/.test(url.hostname) || request.method() !== "GET") {
      forbiddenRequests.push({ host: url.hostname, method: request.method() });
      return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage();
  page.on("pageerror", error => errors.push({ runtime, message: error.message }));
  page.on("response", response => { if (response.request().resourceType() === "image" && response.status() >= 400) failedImages.push({ runtime, path: new URL(response.url()).pathname, status: response.status() }); });
  return base;
}
async function go(path) {
  const port = runtime === "production" ? state.productionPort : state.appPort;
  const response = await page.goto(`http://localhost:${port}${path}`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).hostname, "localhost");
  assert.equal(new URL(page.url()).port, String(port));
  assert.equal(new URL(page.url()).pathname, path.split("?")[0]);
  assert.ok(response && response.status() < 400, path);
  assert.equal(Boolean(response.request().redirectedFrom()), false, "Local production must never follow operational canonical redirects");
  await page.locator("main").waitFor();
  await page.locator("main h1").first().waitFor({ state: "visible" });
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 2000))]));
  if (engineName === "webkit") await page.waitForLoadState("networkidle", { timeout: 20000 });
  transports.push({ runtime, path, status: response.status(), host: new URL(page.url()).host, redirected: false });
}
async function inspect(path, width, scale) {
  await page.setViewportSize({ width, height: 1000 });
  await go(path);
  await page.evaluate(s => { document.documentElement.style.fontSize = `${16 * s}px`; }, scale);
  await page.waitForTimeout(80);
  const result = await page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      clippedFields: [...document.querySelectorAll("main input:not([type=hidden]), main textarea, main select")].filter(visible).filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.getAttribute("name")),
      exampleSections: document.querySelectorAll("[data-review-examples]").length,
    };
  });
  layouts.push({ runtime, path, width, scale, ...result });
  assert.ok(result.overflow <= 1, `${runtime} ${path} ${width}/${scale} overflow ${result.overflow}`);
  assert.deepEqual(result.clippedFields, []);
  if (runtime === "production") assert.equal(result.exampleSections, 0);
}
try {
  const initialLedger = await ledger();
  const products = await db.product.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  const productHash = createHash("sha256").update(JSON.stringify(products)).digest("hex");
  await check("32 unique prepared records and 329 real products remain separate in the database", async () => {
    assert.equal(products.length, 329); assert.equal(initialLedger.products, 329);
    assert.equal(manifest.products.length, 32); assert.equal(prepared.length, 32);
    assert.equal(new Set(prepared.map(p => p.id)).size, 32);
    for (const p of prepared) { assert.equal(p.stock, 0); assert.equal(p.soldOut, true); assert.equal(p.prepared, true); assert.equal(await db.product.count({ where: { id: p.id } }), 0); }
    for (const gender of ["men", "women"]) assert.equal(prepared.filter(p => p.gender === gender).length, 16);
  });
  await check("all real products retain option-correct reference guides and preview-only illustrative reviews", () => {
    assert.equal(showReviewExamples({ VERCEL_ENV: "production", NODE_ENV: "production" }), false);
    assert.equal(showReviewExamples({ NODE_ENV: "production" }), false);
    for (const p of products) {
      const guide = getProductSizeGuide({ name: p.name, category: p.category, gender: p.gender, sizes: p.sizes.split(",").filter(Boolean) });
      assert.ok(guide.rows.length); const examples = getReviewExamples(`${p.name}:${p.imageUrl ?? ""}`);
      assert.ok(examples.total >= 30); assert.ok(examples.textCount / examples.total >= 0.1);
    }
  });
  const modes = negativeOnly ? [] : engineName === "chromium" ? ["production", "preview"] : ["production"];
  for (const mode of modes) {
    await newContext(mode);
    if (mode === "production" && engineName === "chromium") await check("all 32 original local image responses are HTTP 200, 1200x1500 WebP, and byte-distinct", async () => {
      const sharp = require("sharp"); const hashes = new Set();
      for (const image of manifest.products) {
        const response = await context.request.get(`http://localhost:${state.productionPort}${image.path}`, { maxRedirects: 0 });
        assert.equal(response.status(), 200); const bytes = await response.body();
        const metadata = await sharp(bytes).metadata();
        assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 1200); assert.equal(metadata.height, 1500);
        const hash = createHash("sha256").update(bytes).digest("hex");
        assert.equal(hash, image.sha256); hashes.add(hash);
      }
      assert.equal(hashes.size, 32);
    });
    await check(`${mode} catalog contains exactly 32 disclosed, AI labeled view-only product cards`, async () => {
      await go("/catalog-preview");
      assert.match(await page.locator("main").innerText(), /판매 준비 상품 32개/);
      const cards = page.locator('main a[href^="/catalog-preview/"]');
      assert.equal(await cards.count(), 32);
      for (const card of await cards.all()) { assert.match(await card.innerText(), /판매 준비 중/); assert.match(await card.innerText(), /AI 이미지/); assert.match(await card.innerText(), /예상 가격/); }
    });
    const detailProducts = engineName === "webkit" ? prepared.filter(p => ["men-top-01", "women-dress-01"].includes(p.key)) : prepared;
    for (const p of detailProducts) await check(`${mode} ${p.key} loads its independent image and cannot be purchased`, async () => {
      await go(`/catalog-preview/${p.key}`);
      assert.ok(await page.getByText("판매 준비 중", { exact: true }).isVisible());
      assert.ok(await page.getByText(/AI로 제작한 상품 이미지 시안/).isVisible());
      assert.equal(await page.locator("main").getByRole("button", { name: /장바구니 담기|바로 구매|결제하기/ }).count(), 0);
      assert.ok(await page.getByText("참고용 · 상품 실측 아님", { exact: true }).isVisible());
      if (mode === "production") assert.equal(await page.locator("[data-review-examples]").count(), 0);
      else assert.equal(await page.locator("[data-review-examples]").count(), 1);
      const img = page.locator("main img").first();
      await img.evaluate(image => image.scrollIntoView());
      await page.waitForFunction(() => { const img = document.querySelector("main img"); return img?.complete && img.naturalWidth > 0; }, null, { timeout: 10000 });
      const image = await img.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight, source: new URL(image.currentSrc).pathname }));
      assert.ok(image.width > 0 && image.height > 0);
      loadedImages.push({ mode, key: p.key, ...image });
    });
    if (engineName === "chromium") await check(`${mode} men and women show real and prepared counts separately and available-only filter excludes prepared`, async () => {
      for (const [gender, total, actual] of [["men", 171, 155], ["women", 190, 174]]) {
        await go(`/shop/${gender}`);
        const main = page.locator("main"); const text = await main.innerText();
        assert.match(text, new RegExp(`전체\\s*${total}개\\s*·\\s*판매 상품 ${actual}개\\s*·\\s*판매 준비 16개`));
        assert.equal(await main.locator('a[href^="/product/"]').count(), actual);
        assert.equal(await main.locator('a[href^="/catalog-preview/"]').count(), 16);
        await page.getByLabel("구매 가능 상품만", { exact: true }).check();
        assert.equal(await main.locator('a[href^="/catalog-preview/"]').count(), 0);
      }
    });
    const layoutProducts = mode === "production" && engineName === "chromium" ? prepared : prepared.filter(p => ["men-top-01", "men-bag-01", "women-dress-01", "women-inner-01"].includes(p.key));
    for (const width of engineName === "webkit" ? [390, 1280] : [320, 390, 1280]) for (const scale of [1, 2]) {
      const paths = engineName === "webkit" ? ["/catalog-preview", "/catalog-preview/men-top-01"] : ["/", "/shop/men", "/shop/women", "/search?q=셔츠", "/catalog-preview", `/product/${state.fixtures.productId}`, ...layoutProducts.map(p => `/catalog-preview/${p.key}`)];
      for (const path of paths) await inspect(path, width, scale);
    }
    if (engineName === "chromium") await check(`${mode} real review aggregate is available and never includes illustrative reviews`, async () => {
      await go(`/product/${state.fixtures.productId}`);
      const real = await db.shopProductReview.count({ where: { productId: state.fixtures.productId } });
      assert.match(await page.locator("#reviews-title").innerText(), new RegExp(String(real)));
      if (mode === "production") assert.equal(await page.locator("[data-review-examples]").count(), 0);
      else assert.equal(await page.locator("[data-review-examples]").count(), 1);
    });
    if (mode === "production" && engineName === "chromium") {
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.locator("dl[aria-label='구매 안내']").screenshot({ path: `${output}/production-purchase-info-1280.png` });
      await page.locator("#size-guide").screenshot({ path: `${output}/production-size-guide-1280.png` });
      await go("/catalog-preview"); await page.screenshot({ path: `${output}/production-prepared-grid-1280.png` });
    }
    console.log(JSON.stringify({ runtime: mode, completedLayoutCombinations: layouts.length }));
  }
  if (engineName === "chromium") {
    await newContext("preview", "buyer");
    for (const fakeId of ["prepared-men-top-01", "catalog-draft-20261104-selection-01-men-top-01"]) await check(`forged cart ${fakeId} is rejected by actual order Server Action without creating an order`, async () => {
      await go("/");
      await page.evaluate(id => { localStorage.setItem("laonshop-cart", JSON.stringify([{ productId: id, name: "격리 QA 준비 상품", price: 1, qty: 1, size: "M", imageUrl: null }])); }, fakeId);
      await go("/checkout");
      const before = await ledger();
      await page.locator('input[type="checkbox"]').check();
      const responsePromise = page.waitForResponse(response => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]));
      await page.getByRole("button", { name: /결제하기/ }).click();
      const response = await responsePromise;
      assert.ok(response.status() < 500);
      await page.getByText(/판매가 종료된 상품이 장바구니에 있습니다/).waitFor();
      assert.deepEqual(await ledger(), before);
      negativeRequests.push({ fakeId, localServerAction: true, status: response.status(), orderDelta: 0 });
    });
  }
  await check("all display and forged purchase checks preserve real product and transaction ledgers", async () => {
    assert.deepEqual(await ledger(), initialLedger);
    assert.equal(createHash("sha256").update(JSON.stringify(await db.product.findMany({ where: { active: true }, orderBy: { id: "asc" } }))).digest("hex"), productHash);
  });
  assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(failedImages.length, 0); assert.equal(forbiddenRequests.length, 0, JSON.stringify(forbiddenRequests));
  const result = { status: "PASS", engine: engineName, checks: checks.length, checkNames: checks, layoutCombinations: layouts.length, layouts, loadedImages, transports, negativeRequests, errors, failedImages, forbiddenRequests, ledger: initialLedger, productHash };
  writeFileSync(`${output}/independent-${engineName}${negativeOnly ? "-negative" : ""}-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, checks: checks.length, layoutCombinations: layouts.length, images: loadedImages.length, negativeRequests: negativeRequests.length }));
} catch (error) {
  writeFileSync(`${output}/independent-${engineName}-partial.json`, JSON.stringify({ status: "ERROR", message: String(error), checks, layouts, loadedImages, transports, negativeRequests, errors, failedImages, forbiddenRequests }, null, 2));
  throw error;
} finally { if (context) await context.close(); await browser.close(); await db.$disconnect(); }
