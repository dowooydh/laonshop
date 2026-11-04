// Independent layout inspection. Isolated loopback app and disposable QA fixtures only.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const state = JSON.parse(readFileSync(process.env.QA_STATE_FILE, "utf8"));
assert.equal(new URL(state.databaseUrl).hostname, "127.0.0.1");
assert.equal(new URL(state.databaseUrl).pathname, "/laonshop_qa");
const output = `${process.cwd()}/tests/reports/2026-11-04-layout-catalog-followup`;
mkdirSync(output, { recursive: true });
const engines = await import(process.env.QA_PLAYWRIGHT_MODULE);
const engine = process.env.QA_BROWSER_ENGINE || "chromium";
const browser = await engines[engine].launch({ executablePath: process.env.QA_BROWSER_EXECUTABLE || process.env.QA_CHROME_EXECUTABLE || undefined, headless: true, args: engine === "chromium" ? ["--no-sandbox"] : [] });
const base = `http://localhost:${state.appPort}`;
const f = state.fixtures;
const checks = [], pages = [], findings = [], errors = [], externalWrites = [], imageFailures = [];
const routes = {
  guest: ["/", "/shop/men", "/shop/women", "/search", "/search?q=qa-no-match-layout", `/product/${f.productId}`, "/cart", "/support", "/policy/terms", "/policy/privacy", "/policy/refund", "/policy/shipping", "/login", "/register", "/design-system", "/catalog-preview", "/catalog-preview/men-top-01"],
  buyer: ["/cart", "/checkout", "/mypage", "/mypage/settings", `/order/${f.orders.delivered.id}`, `/order/${f.orders.delivered.id}/statement`, `/order/${f.orders.pending.id}`, `/order/${f.orders.canceled.id}`],
  admin: ["/admin", "/admin/orders", `/admin/orders/${f.orders.delivered.id}/statement`],
};
if (engine === "chromium") routes.guest.push(...state.representativeProducts.filter(p => p.id !== f.productId).map(p => `/product/${p.id}`));
if (engine === "webkit") { routes.guest = ["/", "/shop/men", `/product/${f.productId}`, "/login"]; routes.buyer = ["/checkout", "/mypage/settings", `/order/${f.orders.delivered.id}/statement`]; routes.admin = ["/admin/orders"]; }
if (process.env.QA_DESIGN_DELTA) { routes.guest = ["/design-system"]; routes.buyer = []; routes.admin = []; }
const outputSuffix = process.env.QA_DESIGN_DELTA ? "-design-delta" : "";
async function context(role) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
  if (role !== "guest") await ctx.addCookies([{ name: "laonshop_session", value: f.cookies[role], url: base, httpOnly: true, sameSite: "Lax" }]);
  await ctx.route(/https?:\/\/.*(?:ksnet|laonpay|baum)/i, r => r.abort());
  ctx.on("request", req => { const u = new URL(req.url()); if (req.method() !== "GET" && !["localhost", "127.0.0.1"].includes(u.hostname)) externalWrites.push({ method: req.method(), host: u.hostname }); });
  return ctx;
}
async function inspect(page) {
  return page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const textRect = el => { const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = walk.nextNode())) { if (!n.textContent.trim()) continue; const range = document.createRange(); range.selectNodeContents(n); const rects = range.getClientRects(); const r = rects[0]; if (r?.width && r?.height) return { lineCount: rects.length, top: r.top, bottom: r.bottom, center: (r.top + r.bottom) / 2, height: r.height }; } return null; };
    const pairs = [];
    for (const dt of document.querySelectorAll("main dt")) {
      const dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== "DD" || !visible(dt) || !visible(dd)) continue;
      const label = textRect(dt), value = textRect(dd);
      if (!label || !value) continue;
      const r = dt.getBoundingClientRect(), v = dd.getBoundingClientRect();
      if (r.right > v.left + 1) continue; // Mobile stacked definition lists intentionally use different rows.
      if (Math.abs(r.top - v.top) > Math.max(r.height, v.height) + 10) continue;
      pairs.push({ label: dt.textContent.trim().slice(0, 50), centerDelta: +Math.abs(label.center - value.center).toFixed(2), labelTop: +label.top.toFixed(2), valueTop: +value.top.toFixed(2), labelHeight: +label.height.toFixed(2), valueHeight: +value.height.toFixed(2), labelLines: label.lineCount, valueLines: value.lineCount });
    }
    const commands = Array.from(document.querySelectorAll("main a, main button, main summary, header a, header button")).filter(visible);
    const shortTargets = commands.map(el => { const r = el.getBoundingClientRect(); return { text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 60), tag: el.tagName, width: +r.width.toFixed(2), height: +r.height.toFixed(2), href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : undefined }; }).filter(x => x.height < 43.5 && x.width > 0);
    const clippedFields = Array.from(document.querySelectorAll("main input:not([type=hidden]), main select, main textarea")).filter(visible).map(el => { const r = el.getBoundingClientRect(); return { name: el.getAttribute("name"), right: r.right, left: r.left, width: r.width }; }).filter(r => r.left < -1 || r.right > innerWidth + 1);
    const overlap = [];
    const nav = Array.from(document.querySelectorAll("header a,header button,nav a,nav button")).filter(visible);
    for (let i = 0; i < nav.length; i++) for (let j = i + 1; j < nav.length; j++) {
      if (nav[i].contains(nav[j]) || nav[j].contains(nav[i])) continue;
      const a = nav[i].getBoundingClientRect(), b = nav[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlap.push([nav[i].textContent.trim().slice(0,30), nav[j].textContent.trim().slice(0,30)]);
    }
    const coloredButtons = Array.from(document.querySelectorAll("main button")).filter(visible).filter(el => el.className.includes("bg-accent") || el.className.includes("bg-danger")).map(el => { const s = getComputedStyle(el); return { text: el.textContent.trim().slice(0,60), color: s.color, background: s.backgroundColor, fontSize: s.fontSize, disabled: el.disabled, opacity: s.opacity }; });
    return { overflow: document.documentElement.scrollWidth - innerWidth, pairs, shortTargets, clippedFields, overlap, coloredButtons };
  });
}
try {
  for (const [role, routeList] of Object.entries(routes)) {
    if (!routeList.length) continue;
    const ctx = await context(role), page = await ctx.newPage();
    page.on("pageerror", e => errors.push({ role, message: e.message }));
    page.on("response", r => { if (r.request().resourceType() === "image" && r.status() >= 400) { const u = new URL(r.url()); imageFailures.push({ role, host: u.hostname, path: u.pathname, status: r.status() }); } });
    if (role === "buyer") {
      await page.goto(base, { waitUntil: "networkidle" });
      await page.evaluate(p => { localStorage.setItem("laonshop-cart", JSON.stringify([{ productId: p.id, name: p.name, price: p.price, qty: 1, size: p.size, imageUrl: p.imageUrl }])); window.dispatchEvent(new Event("laonshop-cart-change")); }, state.cartProduct);
    }
    for (const width of [320, 390, 768, 1280]) for (const scale of [1, 2]) for (const route of routeList) {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(base + route, { waitUntil: "domcontentloaded" });
      assert.ok(response && response.status() < 400, `${role}/${route}: ${response?.status()}`);
      assert.equal(new URL(page.url()).pathname, route.split("?")[0], "Protected-route inspection must not silently inspect the login page");
      await page.evaluate(s => { document.documentElement.style.fontSize = `${16 * s}px`; }, scale);
      await page.locator("main").waitFor({ state: "visible" });
      await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 2000))]));
      if (route === "/support") await page.locator("main details").evaluateAll(ds => ds.forEach(d => d.open = true));
      if (engine === "webkit") await page.waitForLoadState("networkidle", { timeout: 10000 });
      await page.waitForTimeout(40);
      const result = await inspect(page);
      pages.push({ role, route, width, scale, ...result });
      if (result.overflow > 1 || result.clippedFields.length || result.overlap.length || result.pairs.some(p => p.labelLines === 1 && p.valueLines === 1 && p.centerDelta > 3 && Math.abs(p.labelHeight - p.valueHeight) < 3)) findings.push({ role, route, width, scale, ...result });
      checks.push(`${role} ${route} ${width}px ${scale*100}%`);
      if (engine === "chromium" && width === 390 && scale === 1 && ["/", `/product/${f.productId}`, "/checkout", "/mypage/settings", "/admin/orders"].includes(route)) await page.screenshot({ path: `${output}/${role}-${route === "/" ? "home" : route.replaceAll("/", "-").replace(/^-/,'')}-390.png`, fullPage: true });
    }
    await ctx.close();
  }
  assert.equal(externalWrites.length, 0);
  assert.equal(errors.length, 0);
  const result = { status: findings.length ? "FINDINGS" : "PASS", count: checks.length, checks, errors, externalWrites, imageFailures, findings, pages };
  writeFileSync(`${output}/layout-${engine}${outputSuffix}-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, count: checks.length, findings: findings.length, errors: errors.length, externalWrites: externalWrites.length }));
} catch (error) {
  writeFileSync(`${output}/layout-${engine}${outputSuffix}-partial.json`, JSON.stringify({ status: "ERROR", checks, errors, externalWrites, imageFailures, findings, message: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
