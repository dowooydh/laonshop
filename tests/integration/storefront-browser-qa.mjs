// Independent browser/HTTP QA. Requires a production build served only on loopback.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const state = JSON.parse(readFileSync(process.env.QA_STATE_FILE, "utf8"));
assert.equal(new URL(state.databaseUrl).hostname, "127.0.0.1");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: state.databaseUrl } } });
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME_EXECUTABLE, headless: true, args: ["--no-sandbox"] });
const base = `http://localhost:${state.appPort}`;
const f = state.fixtures;
const output = process.env.QA_OUTPUT_DIR || `${process.cwd()}/tests/reports/2026-11-04-shop-upgrade`;
const checks = [], consoleErrors = [], pageErrors = [], externalWrites = [], overlaps = [];
async function check(name, fn) { await fn(); checks.push(name); }
async function context(role) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 }, reducedMotion: "reduce" });
  if (role) await ctx.addCookies([{ name: "laonshop_session", value: f.cookies[role], url: base, httpOnly: true, sameSite: "Lax" }]);
  await ctx.route(/https?:\/\/.*(?:ksnet|laonpay|baum)/i, route => route.abort());
  ctx.on("request", req => { const u = new URL(req.url()); if (req.method() !== "GET" && !["localhost", "127.0.0.1"].includes(u.hostname)) externalWrites.push({ method: req.method(), host: u.hostname }); });
  return ctx;
}
function collect(page) { page.on("pageerror", e => pageErrors.push(e.message)); page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); }); }
async function go(page, path) { const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" }); assert.ok(response && response.status() < 400, `${path}: ${response?.status()}`); await page.evaluate(() => document.fonts.ready); }
async function replay(ctx, captured) {
  return ctx.request.post(captured.url, { headers: { "Next-Action": captured.action, "Content-Type": captured.contentType, Origin: base }, data: captured.body });
}
try {
  const guest = await context();
  const page = await guest.newPage(); collect(page);
  const routes = ["/", "/shop/men", "/shop/women", "/search?q=%EB%8B%88%ED%8A%B8", `/product/${f.productId}`, "/support"];
  if (!process.env.QA_SKIP_PUBLIC) for (const width of [320, 390, 1280]) for (const scale of [1, 2]) for (const path of routes) {
    await check(`public ${width}px ${scale * 100}% ${path.split("?")[0]}`, async () => {
      await page.setViewportSize({ width, height: 960 }); await go(page, path);
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${16 * scale}px`; }, scale);
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `overflow ${overflow}px at ${width}/${scale}/${path}`);
      assert.equal(await page.locator("main").count(), 1);
      if (path.startsWith("/product/")) {
        const link = page.locator('a[href="#reviews"]').first();
        if (await link.count()) {
          await link.click(); await page.waitForTimeout(150);
          const boxes = await page.evaluate(() => {
            const h = document.querySelector("header")?.getBoundingClientRect();
            const title = document.querySelector("#reviews-title")?.getBoundingClientRect();
            return { headerBottom: h?.bottom, targetTop: title?.top };
          });
          if (boxes.targetTop !== undefined && boxes.headerBottom !== undefined && boxes.targetTop < boxes.headerBottom - 1) overlaps.push({ width, scale, ...boxes });
        }
      }
      if (scale === 1 && path === "/" && [390, 1280].includes(width)) await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true });
      if (scale === 1 && width === 390 && path.startsWith("/product/")) { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400); await page.screenshot({ path: `${output}/product-390.png`, fullPage: true }); }
    });
  }
  await check("search and category filters work", async () => {
    await page.setViewportSize({ width: 390, height: 900 }); await go(page, "/shop/men");
    const category = page.getByRole("button", { name: "상의", exact: true });
    if (await category.count()) { await category.click(); assert.ok(await page.locator('a[href^="/product/"]').count() > 0); }
    await go(page, "/search?q=qa-no-such-product-20261104"); assert.ok(await page.getByText(/검색 결과가 없습니다/).count());
  });
  await check("product quantity and add-to-cart retain selected option", async () => {
    await go(page, `/product/${f.productId}`);
    await page.getByRole("button", { name: "수량 증가" }).click();
    await page.getByRole("button", { name: "장바구니 담기", exact: true }).click();
    await go(page, "/cart"); assert.ok(await page.getByText(f.productName, { exact: false }).count());
    assert.ok(await page.locator('input, button').count() > 0);
  });
  await check("anonymous protected routes redirect without private data", async () => {
    await page.goto(`${base}/order/${f.orders.delivered.id}/statement`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/login"); assert.equal(await page.getByText(f.orders.delivered.moid).count(), 0);
    await page.goto(`${base}/admin/orders`, { waitUntil: "networkidle" }); assert.equal(new URL(page.url()).pathname, "/login");
  });
  await guest.close();

  const buyer = await context("buyer"), other = await context("other"), admin = await context("admin");
  const buyerPage = await buyer.newPage(); collect(buyerPage);
  await check("customer statement ownership and print title", async () => {
    await go(buyerPage, `/order/${f.orders.delivered.id}/statement`);
    assert.ok(await buyerPage.getByRole("heading", { name: "주문·배송 내역", exact: true }).count());
    await buyerPage.emulateMedia({ media: "print" });
    assert.equal(await buyerPage.getByRole("heading", { name: "주문·배송 내역", exact: true }).isVisible(), true);
    assert.equal(await buyerPage.locator("body > header").count(), 0);
    await buyerPage.screenshot({ path: `${output}/statement-print.png`, fullPage: true });
    await buyerPage.emulateMedia({ media: "screen" });
    const foreign = await other.request.get(`${base}/order/${f.orders.delivered.id}/statement`); const foreignBody = await foreign.text();
    assert.ok(foreign.status() === 404 || foreignBody.includes("NEXT_HTTP_ERROR_FALLBACK;404")); assert.equal(foreignBody.includes(f.orders.delivered.moid), false);
    const deniedAdmin = await buyer.request.get(`${base}/admin/orders`); const deniedBody = await deniedAdmin.text(); assert.ok(deniedAdmin.status() === 404 || deniedBody.includes("NEXT_HTTP_ERROR_FALLBACK;404"));
  });
  for (const [key, delivered] of [["browserReview", true], ["browserShipping", false]]) {
    const id = `qa-browser-${key}-${Date.now()}`;
    const product = await db.product.findUnique({ where: { id: f.productId } });
    const order = await db.shopOrder.create({ data: { id, userId: f.users.buyer, status: "PAID", totalAmount: product.price, moid: id.toUpperCase(), approvalNo: "QA-SYNTHETIC", paidAt: new Date(), cardName: "QA카드", receiverName: "QA수령인", address: "서울특별시 테스트구 테스트로 1", items: { create: { id: `${id}-item`, productId: f.productId, name: product.name, price: product.price, qty: 1, size: "M" } } } });
    await db.shopShipment.create({ data: { orderId: id, userId: f.users.buyer, carrier: "CJ", trackingNumber: "111122223333", status: delivered ? "DELIVERED" : "SHIPPED", shippedAt: new Date(Date.now()-86400000), deliveredAt: delivered ? new Date() : null, events: { create: { actorUserId: f.users.admin, action: delivered ? "DELIVERED" : "SHIPPED", carrier: "CJ", trackingNumber: "111122223333", note: "브라우저 QA 합성 배송" } } } });
    f.orders[key] = { id, itemId: `${id}-item`, moid: order.moid };
  }
  let reviewRequest;
  await check("verified buyer submits review through real Server Action", async () => {
    await go(buyerPage, `/product/${f.productId}`);
    const form = buyerPage.locator("form").filter({ has: buyerPage.locator('[name="orderItemId"]') });
    await form.locator('[name="orderItemId"]').selectOption(f.orders.browserReview.itemId);
    const reviewContent = `상품 사이즈를 실제로 받아보니 편안합니다. ${f.orders.browserReview.moid} <img src=x onerror="window.qaInjected=true">`;
    await form.locator('[name="content"]').fill(reviewContent);
    buyerPage.on("request", req => { const h = req.headers(); if (req.method() === "POST" && h["next-action"]) reviewRequest = { url: req.url(), action: h["next-action"], contentType: h["content-type"], body: req.postDataBuffer() }; });
    const reviewResponse = buyerPage.waitForResponse(response => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]));
    await form.getByRole("button", { name: "후기 등록", exact: true }).click();
    const submitted = await reviewResponse;
    assert.equal(submitted.status(), 200);
    await submitted.finished();
    // A revalidated RSC response may replace the transient action message.
    // Assert the durable customer-visible result and the independently saved row.
    await buyerPage.locator("#reviews article").filter({ hasText: reviewContent }).waitFor();
    assert.equal(await db.shopProductReview.count({ where: { orderItemId: f.orders.browserReview.itemId } }), 1);
    await buyerPage.reload({ waitUntil: "networkidle" });
    assert.equal(await buyerPage.evaluate(() => window.qaInjected === true), false);
    assert.equal(await buyerPage.locator(`[name="orderItemId"] option[value="${f.orders.browserReview.itemId}"]`).count(), 0);
    assert.ok(await buyerPage.getByText(/상품 사이즈를 실제로 받아보니/).count()); assert.ok(reviewRequest);
  });
  await check("real review action refuses another customer and anonymous replay", async () => {
    const before = await db.shopProductReview.count();
    const response = await replay(other, reviewRequest); assert.ok((await response.text()).includes("배송 완료된 본인"));
    const anonymous = await context(); const r = await replay(anonymous, reviewRequest); assert.ok(r.status() < 500); await anonymous.close();
    assert.equal(await db.shopProductReview.count(), before);
  });
  const adminPage = await admin.newPage(); collect(adminPage);
  let shippingRequest;
  await check("admin corrects tracking through real Server Action", async () => {
    await go(adminPage, "/admin/orders");
    const article = adminPage.locator("article").filter({ hasText: f.orders.browserShipping.moid });
    const form = article.locator("form").filter({ has: adminPage.locator('[name="trackingNumber"]') });
    await form.locator('[name="trackingNumber"]').fill("222233334444");
    await form.locator('[name="note"]').fill("격리 QA 송장 오입력 정정 확인");
    adminPage.on("request", req => { const h = req.headers(); if (req.method() === "POST" && h["next-action"]) shippingRequest = { url: req.url(), action: h["next-action"], contentType: h["content-type"], body: req.postDataBuffer() }; });
    await form.getByRole("button", { name: "송장 수정", exact: true }).click();
    await article.getByText("송장 수정과 이력을 저장했습니다.", { exact: true }).waitFor();
    assert.equal((await db.shopShipment.findUnique({ where: { orderId: f.orders.browserShipping.id } })).trackingNumber, "222233334444");
    assert.ok(shippingRequest);
  });
  await check("real shipping action refuses customer and demoted admin", async () => {
    const before = await db.shopShipmentEvent.count();
    const customerReplay = await replay(buyer, shippingRequest); const customerBody = await customerReplay.text(); assert.ok(customerReplay.status() === 404 || customerBody.includes("NEXT_HTTP_ERROR_FALLBACK;404"));
    await db.shopUser.update({ where: { id: f.users.admin }, data: { role: "CUSTOMER" } });
    try { const demoted = await replay(admin, shippingRequest); const demotedBody = await demoted.text(); assert.ok(demoted.status() === 404 || demotedBody.includes("NEXT_HTTP_ERROR_FALLBACK;404")); }
    finally { await db.shopUser.update({ where: { id: f.users.admin }, data: { role: "ADMIN" } }); }
    assert.equal(await db.shopShipmentEvent.count(), before);
  });
  await check("admin delivery completion and order evidence show recorded result", async () => {
    await go(adminPage, "/admin/orders");
    const article = adminPage.locator("article").filter({ hasText: f.orders.browserShipping.moid });
    const form = article.locator("form").filter({ has: adminPage.getByRole("button", { name: "배송완료 처리", exact: true }) });
    await form.locator('[name="note"]').fill("택배사 배송완료 조회와 수령 확인");
    await form.getByRole("button", { name: "배송완료 처리", exact: true }).click();
    await article.getByText(/배송완료 ·/).waitFor();
    assert.equal((await db.shopShipment.findUnique({ where: { orderId: f.orders.browserShipping.id } })).status, "DELIVERED");
    await go(buyerPage, `/order/${f.orders.browserShipping.id}/statement`);
    assert.ok(await buyerPage.getByText("222233334444", { exact: true }).count());
    assert.ok(await buyerPage.getByText(/배송완료 확인/).count());
  });
  await check("schema protection absent keeps product/order readable and writes unavailable", async () => {
    await db.$executeRawUnsafe('ALTER TABLE "ShopShipmentEvent" DISABLE TRIGGER laonshop_shipment_event_immutable');
    try {
      await go(buyerPage, `/product/${f.productId}`); assert.ok(await buyerPage.getByText(/지금은 구매후기를 이용할 수 없습니다/).count());
      await go(buyerPage, `/order/${f.orders.delivered.id}`); assert.ok(await buyerPage.getByRole("heading", { name: "결제가 완료되었습니다", exact: true }).count());
      await go(adminPage, "/admin/orders"); assert.equal(await adminPage.locator('[name="trackingNumber"]').count(), 0);
    } finally { await db.$executeRawUnsafe('ALTER TABLE "ShopShipmentEvent" ENABLE TRIGGER laonshop_shipment_event_immutable'); }
  });
  await buyer.close(); await other.close(); await admin.close();
  assert.deepEqual(externalWrites, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(overlaps, [], `review anchor hidden: ${JSON.stringify(overlaps)}`);
  const report = { status: "PASS", count: checks.length, checks, pageErrors, consoleErrors, externalWrites, anchorOverlaps: overlaps };
  writeFileSync(`${output}/${process.env.QA_SKIP_PUBLIC ? "browser-auth-results" : "browser-results"}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: "PASS", count: checks.length, consoleErrors: consoleErrors.length }));
} catch (error) {
  writeFileSync(`${output}/browser-partial.json`, JSON.stringify({ status: "FAIL", checks, error: String(error), pageErrors, consoleErrors, externalWrites, anchorOverlaps: overlaps }, null, 2));
  throw error;
} finally { await browser.close(); await db.$disconnect(); }
