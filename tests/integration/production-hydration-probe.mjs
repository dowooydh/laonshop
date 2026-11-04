// Public GET-only independent hydration probe. No cookies, sessions, database, or provider calls.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE });
const base = "https://laonshop.com";
const paths = ["/", "/shop/men", "/shop/women", "/catalog-preview", "/product/cmrdkh6ii00017iy8ayvhzuo1", "/catalog-preview/women-dress-02"];
const pages = [], blockedWrites = [], blockedProviders = [];
try {
  for (const path of paths) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== "GET") { blockedWrites.push({ path, host: url.hostname, method: request.method() }); return route.abort(); }
      if (/ksnet|kspay|laonpay|baum/.test(url.hostname)) { blockedProviders.push({ path, host: url.hostname }); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    const record = { path, pageErrors: [], consoleErrors: [], consoleWarnings: [], requestFailures: [], startedAt: new Date().toISOString() };
    page.on("pageerror", error => record.pageErrors.push({ url: page.url(), message: error.message, stack: error.stack, at: new Date().toISOString() }));
    page.on("console", message => { if (["error", "warning"].includes(message.type())) record[message.type() === "error" ? "consoleErrors" : "consoleWarnings"].push({ url: page.url(), message: message.text(), location: message.location() }); });
    page.on("requestfailed", request => record.requestFailures.push({ path: new URL(request.url()).pathname, resourceType: request.resourceType(), error: request.failure()?.errorText, at: new Date().toISOString() }));
    try {
      const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30000 });
      record.status = response.status(); record.finalUrl = page.url();
      const html = await response.body(); record.ssrSha256 = createHash("sha256").update(html).digest("hex");
      await page.locator("main h1").first().waitFor({ state: "visible", timeout: 20000 });
      try { await page.waitForLoadState("networkidle", { timeout: 20000 }); } catch (error) { record.idleWarning = String(error); }
      await page.waitForTimeout(1000);
      record.dom = await page.evaluate(() => ({ title: document.title, heading: document.querySelector("main h1")?.textContent, overflow: document.documentElement.scrollWidth - innerWidth, preparedLinks: [...document.querySelectorAll('main a[href^="/catalog-preview/"]')].length, exampleSections: document.querySelectorAll("[data-review-examples]").length, bodyHtmlLength: document.body.innerHTML.length, locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
      record.completedAt = new Date().toISOString();
    } catch (error) { record.failure = String(error); }
    pages.push(record); await context.close();
  }
  const result = { status: pages.some(p => p.failure || p.pageErrors.length || p.status !== 200) ? "FINDINGS" : "PASS", scope: "Hydration/page-load probe only; aborted fetch events are preserved separately and are not a claim of zero network failures.", mode: "independent-public-get-only-fresh-context-per-page", browser: browser.version(), pageErrorCount: pages.reduce((n, p) => n + p.pageErrors.length, 0), requestFailureCount: pages.reduce((n, p) => n + p.requestFailures.length, 0), pages, blockedWrites, blockedProviders };
  writeFileSync("tests/reports/2026-11-04-production-release/production-hydration-probe-independent.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, pages: pages.length, pageErrors: pages.reduce((n, p) => n + p.pageErrors.length, 0), blockedWrites: blockedWrites.length, blockedProviders: blockedProviders.length, findings: pages.filter(p => p.failure || p.pageErrors.length).map(p => ({ path: p.path, failure: p.failure, pageErrors: p.pageErrors })) }));
} finally { await browser.close(); }
