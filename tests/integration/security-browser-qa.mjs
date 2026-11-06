// Real local HTTP/Server Action security regression; no production credentials or calls.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { createSessionCredentialTag } from "../../lib/session-security.ts";
import { createBrowserHarness, requestDisposition } from "./browser-qa-support.mjs";
const state = JSON.parse(fs.readFileSync(process.env.QA_STATE_FILE, "utf8"));
const target = new URL(state.databaseUrl);
assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.pathname, "/laonshop_qa");
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client"), bcrypt = require("bcryptjs"), { sealData, unsealData } = require("iron-session");
const db = new PrismaClient({ datasources: { db: { url: state.databaseUrl } } });
const output = process.env.QA_OUTPUT_DIR;
const harness = createBrowserHarness({ suite: "security", output });
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE);
const browser = harness.wrap(await harness.operation("setup", () => chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_EXECUTABLE, timeout: 15000, args: ["--no-sandbox", "--disable-dev-shm-usage"] })));
const base = `http://localhost:${state.appPort}`, checks = [], deniedExternalWrites = [], deniedProviders = [];
const contexts = new Set();
let externalRequests = 0;
const originalPassword = "Synthetic-current-20261106!", nextPassword = "Synthetic-next-20261106!";
const user = await db.shopUser.create({ data: { id: "qa-security-credential-user", email: "credential-user@example.test", name: "격리 보안 사용자", passwordHash: await bcrypt.hash(originalPassword, 10) } });
const sessionValue = async (data = {}, account = user) => sealData({ userId: account.id, email: account.email, name: account.name, credentialTag: createSessionCredentialTag(account, state.secret), ...data }, { password: state.secret, ttl: 3600 });
const oldCookie = await sessionValue();
async function context(cookie) {
  const context = await harness.configure(await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" }));
  contexts.add(context);
  if (cookie) await context.addCookies([{ name: "laonshop_session", value: cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
  await context.route("**/*", route => {
    const request = route.request(), disposition = requestDisposition(request.url(), request.method());
    if (!disposition.local) {
      externalRequests += 1;
      if (disposition.provider) deniedProviders.push("provider");
      if (disposition.externalWrite) deniedExternalWrites.push("external-write");
      return route.abort();
    }
    return route.continue();
  });
  return context;
}
let activeCheck = "";
async function check(name, action) { activeCheck = name; return harness.check(name, action, checks); }
const current = await context(oldCookie), stale = await context(oldCookie), legacy = await context(await sealData({ userId: user.id }, { password: state.secret, ttl: 3600 }));
const page = await current.newPage(); let captured;
try {
  const before = { orders: await db.shopOrder.count(), reviews: await db.shopProductReview.count(), products: await db.product.count() };
  await check("legacy unbound cookie is rejected", async () => {
    const p = await legacy.newPage(); await p.goto(`${base}/mypage`, { waitUntil: "networkidle" }); assert.equal(new URL(p.url()).pathname, "/login"); await p.close();
  });
  await check("bound current cookie reaches password settings", async () => {
    await page.goto(`${base}/mypage/settings`, { waitUntil: "networkidle" }); assert.equal(new URL(page.url()).pathname, "/mypage/settings"); await page.locator('[name="current"]').waitFor();
  });
  await check("real password action changes credential and reissues current session", async () => {
    page.on("request", request => { if (request.method() === "POST" && request.headers()["next-action"]) captured = { url: request.url(), action: request.headers()["next-action"], type: request.headers()["content-type"], body: request.postDataBuffer() }; });
    await page.locator('[name="current"]').fill(originalPassword); await page.locator('[name="next"]').fill(nextPassword);
    const response = page.waitForResponse(r => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
    await page.getByRole("button", { name: "비밀번호 변경", exact: true }).click(); const r = await response; assert.equal(r.status(), 200); await r.finished();
    const updated = await db.shopUser.findUnique({ where: { id: user.id } }); assert.ok(await bcrypt.compare(nextPassword, updated.passwordHash)); assert.notEqual(updated.passwordHash, user.passwordHash);
    const cookie = (await current.cookies()).find(c => c.name === "laonshop_session"); assert.ok(cookie); const payload = await unsealData(cookie.value, { password: state.secret });
    assert.equal(payload.credentialTag, createSessionCredentialTag(updated, state.secret)); assert.equal(payload.passwordHash, undefined);
    await page.goto(`${base}/mypage`, { waitUntil: "networkidle" }); assert.equal(new URL(page.url()).pathname, "/mypage"); assert.ok(captured);
  });
  await check("copied pre-change cookie and hosted return are rejected", async () => {
    const p = await stale.newPage(); await p.goto(`${base}/mypage`, { waitUntil: "networkidle" }); assert.equal(new URL(p.url()).pathname, "/login");
    const hosted = await context(oldCookie);
    try {
      assert.equal((await hosted.cookies()).find(cookie => cookie.name === "laonshop_session")?.value, oldCookie);
      const result = await hosted.request.get(`${base}/mypage/settings/billing/return`, { maxRedirects: 0 }); assert.equal(result.status(), 303); assert.equal(new URL(result.headers().location, base).pathname, "/login");
    } finally { await hosted.close(); }
    await p.close();
  });
  await check("parallel password replays allow exactly one credential update", async () => {
    // Reset only this owned synthetic credential to the original snapshot for the race.
    await db.shopUser.update({ where: { id: user.id }, data: { passwordHash: user.passwordHash } });
    const one = await context(oldCookie), two = await context(oldCookie);
    try {
      const send = ctx => ctx.request.post(captured.url, { headers: { "Next-Action": captured.action, "Content-Type": captured.type, Origin: base }, data: captured.body, maxRedirects: 0 });
      const responses = await Promise.all([send(one), send(two)]); const bodies = await Promise.all(responses.map(r => r.text()));
      assert.equal(bodies.filter(body => body.includes('"ok":true')).length, 1);
      const updated = await db.shopUser.findUnique({ where: { id: user.id } }); assert.ok(await bcrypt.compare(nextPassword, updated.passwordHash));
    } finally { await one.close(); await two.close(); }
  });
  await check("actual login rejects previous password and binds new credential", async () => {
    const guest = await context(); const p = await guest.newPage();
    try {
      await p.goto(`${base}/login?next=/mypage`, { waitUntil: "networkidle" });
      await p.locator('[name="email"]').fill(user.email); await p.locator('[name="password"]').fill(originalPassword);
      const rejected = p.waitForResponse(r => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
      await p.getByRole("button", { name: "로그인", exact: true }).click(); await (await rejected).finished();
      assert.equal(new URL(p.url()).pathname, "/login"); assert.equal((await guest.cookies()).some(cookie => cookie.name === "laonshop_session"), false);
      await p.getByText("이메일 또는 비밀번호가 올바르지 않습니다.", { exact: true }).waitFor();
      await p.locator('[name="password"]').fill(nextPassword);
      await p.getByRole("button", { name: "로그인", exact: true }).click(); await p.waitForURL(`${base}/mypage`);
      const cookie = (await guest.cookies()).find(cookie => cookie.name === "laonshop_session"); assert.ok(cookie);
      const payload = await unsealData(cookie.value, { password: state.secret });
      const account = await db.shopUser.findUnique({ where: { id: user.id } }); assert.equal(payload.credentialTag, createSessionCredentialTag(account, state.secret));
    } finally { await guest.close(); }
  });
  await check("omitted legal consent is rejected by actual register action", async () => {
    const guest = await context(); const p = await guest.newPage();
    try {
      await p.goto(`${base}/register`, { waitUntil: "networkidle" }); await p.locator('[name="name"]').fill("합성 동의 미선택"); await p.locator('[name="email"]').fill("no-consent@example.test"); await p.locator('[name="password"]').fill("Synthetic-register-20261106!"); await p.locator("main form").evaluate(form => { form.noValidate = true; });
      const response = p.waitForResponse(r => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"])); await p.getByRole("button", { name: "가입하기", exact: true }).click(); const r = await response; assert.equal(r.status(), 200); await r.finished();
      assert.equal(await db.shopUser.count({ where: { email: "no-consent@example.test" } }), 0); assert.equal(new URL(p.url()).pathname, "/register");
    } finally { await guest.close(); }
  });
  for (const endpoint of ["callback", "result"]) {
    await check(`PG ${endpoint} oversized body rejected before any ledger effect`, async () => {
      const r = await harness.nativeFetch(`${base}/api/pg/kspay/${endpoint}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "padding=" + "x".repeat(32769) }); assert.equal(r.status, 413);
    });
    await check(`PG ${endpoint} chunked oversized body rejected without Content-Length`, async () => {
      const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("padding=" + "x".repeat(32769))); controller.close(); } });
      const r = await harness.nativeFetch(`${base}/api/pg/kspay/${endpoint}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, duplex: "half" }); assert.equal(r.status, 413);
    });
    await check(`PG ${endpoint} duplicate scalar rejected`, async () => {
      const field = endpoint === "result" ? "a" : "reCommConId"; const body = new URLSearchParams([[field, "synthetic-one"], [field, "synthetic-two"]]);
      const r = await harness.nativeFetch(`${base}/api/pg/kspay/${endpoint}`, { method: "POST", body }); assert.equal(r.status, 400);
    });
    await check(`PG ${endpoint} file value rejected`, async () => {
      const body = new FormData(); body.set(endpoint === "result" ? "a" : "reCommConId", new Blob(["synthetic"]), "not-a-key.txt");
      const r = await harness.nativeFetch(`${base}/api/pg/kspay/${endpoint}`, { method: "POST", body }); assert.equal(r.status, 400);
    });
  }
  await check("invalid PG inputs and credential actions preserve order review and product ledgers", async () => {
    assert.deepEqual({ orders: await db.shopOrder.count(), reviews: await db.shopProductReview.count(), products: await db.product.count() }, before);
    assert.equal(deniedExternalWrites.length, 0); assert.equal(deniedProviders.length, 0);
  });
  fs.writeFileSync(`${output}/security-browser-results.json`, JSON.stringify({ status: "PASS", count: checks.length, checks, deniedExternalWrites, deniedProviders, externalRequests, ledgerCountsUnchanged: true }, null, 2));
  harness.progress("finish");
  console.log(JSON.stringify({ status: "PASS", count: checks.length, ledgerCountsUnchanged: true }));
} catch (error) {
  harness.progress("failed");
  fs.writeFileSync(`${output}/security-browser-results.json`, JSON.stringify({ status: "FAIL", count: checks.length, checks, failure: { check: activeCheck, kind: error.name, code: error.code ?? null }, deniedExternalWrites, deniedProviders }, null, 2));
  throw error;
} finally {
  const closed = await Promise.allSettled([...contexts].map(ctx => ctx.close()));
  const remaining = await Promise.allSettled([browser.close(), harness.operation("close", () => db.$disconnect())]);
  assert.ok([...closed, ...remaining].every(result => result.status === "fulfilled"), "QA_OWNED_RESOURCE_CLOSE_FAILED");
}
