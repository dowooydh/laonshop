import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { browserLimits, canonicalPlaywrightKind, createBrowserHarness, deadline, requestDisposition, validateFontProbe } from "../integration/browser-qa-support.mjs";

test("browser operations have explicit deadlines and preserve original rejection", async () => {
  await assert.rejects(deadline(() => new Promise(() => {}), 5), { code: "QA_OPERATION_TIMEOUT" });
  assert.equal(await deadline(() => Promise.resolve("ready"), 20), "ready");
  await assert.rejects(deadline(() => { throw new TypeError("synthetic"); }, 20), TypeError);
});
test("routing aborts all nonloopback requests and records only request classes", () => {
  assert.deepEqual(requestDisposition("https://cdn.example.test/font.woff2"), { local: false, provider: false, externalWrite: false });
  assert.deepEqual(requestDisposition("https://kspay.ksnet.to/", "POST"), { local: false, provider: true, externalWrite: true });
  assert.equal(requestDisposition("http://localhost:3104/mypage", "POST").local, true);
  assert.equal(requestDisposition("https://localhost.evil.test/", "POST").local, false);
});
test("Playwright wrappers bound navigation action evaluation response API and cleanup", async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-browser-helper-"));
  class Response { finished() { return new Promise(() => {}); } }
  class Locator { click() { return new Promise(() => {}); } }
  class APIRequestContext { get() { return new Promise(() => {}); } }
  class Page {
    constructor() { this.request = new APIRequestContext(); }
    locator() { return new Locator(); }
    goto() { return new Promise(() => {}); }
    evaluate() { return new Promise(() => {}); }
    waitForResponse() { return Promise.resolve(new Response()); }
    close() { return new Promise(() => {}); }
  }
  const limits = Object.fromEntries(Object.keys(browserLimits).map(key => [key, 5]));
  try {
    const harness = createBrowserHarness({ suite: "commerce", output, limits });
    const page = harness.wrap(new Page());
    for (const operation of [() => page.goto("http://localhost:3104/secret-url"), () => page.locator("secret-selector").click(), () => page.evaluate(() => "secret-eval"), async () => (await page.waitForResponse()).finished(), () => page.request.get("http://localhost:3104/secret-api-url"), () => page.close()])
      await assert.rejects(operation, { code: "QA_OPERATION_TIMEOUT" });
    const checks = [];
    await harness.check("secret-cookie-must-not-appear", async () => {}, checks);
    const progress = JSON.parse(fs.readFileSync(path.join(output, "commerce-progress.json")));
    assert.deepEqual(progress, { suite: "commerce", checkIndex: 1, phase: "check-complete" });
    assert.equal(JSON.stringify(progress).includes("secret"), false);
    assert.equal(fs.existsSync(path.join(output, "commerce-progress.json.tmp")), false);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
test("font proof needs loaded registered faces and actual same-origin WOFF2 HTTP 200", () => {
  const origin = "http://localhost:3104";
  const probe = () => ({ cssContainsPreparationPath: false, fonts: ["--font-display", "--font-mono"].map((variable, index) => ({ variable, family: `generated-${index}`, loadedCount: 1, loadedStatuses: ["loaded"], sources: [`${origin}/_next/static/media/font-${index}.woff2`] })) });
  const responses = probe().fonts.map(font => ({ url: font.sources[0], status: 200 }));
  assert.equal(validateFontProbe(probe(), responses, origin), true);
  for (const mutate of [value => { value.fonts[0].loadedCount = 0; }, value => { value.fonts[1].loadedStatuses = ["unloaded"]; }, value => { value.fonts[1].loadedStatuses = []; }, value => { value.fonts[1].family = value.fonts[0].family; }, value => { value.cssContainsPreparationPath = true; }, value => { value.fonts[1].sources = ["https://cdn.example.test/font.woff2"]; }]) {
    const value = probe(); mutate(value); assert.throws(() => validateFontProbe(value, responses, origin));
  }
  assert.throws(() => validateFontProbe(probe(), responses.slice(0, 1), origin));
  assert.throws(() => validateFontProbe(probe(), responses.map(value => ({ ...value, status: 404 })), origin));
});
test("wrappers keep Playwright receivers and apply API timeouts before any external dispatch", async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-browser-methods-"));
  let called = 0;
  class APIRequestContext {
    async get(url, options) { assert.ok(this instanceof APIRequestContext); assert.equal(options.timeout, 15000); called += 1; return url; }
  }
  class BrowserContext {
    constructor() { this.request = new APIRequestContext(); }
    setDefaultTimeout(value) { this.action = value; }
    setDefaultNavigationTimeout(value) { this.navigation = value; }
  }
  try {
    const harness = createBrowserHarness({ suite: "security", output });
    const original = new BrowserContext(), wrapped = await harness.configure(harness.wrap(original));
    assert.equal(original.action, 15000); assert.equal(original.navigation, 20000);
    assert.equal(await wrapped.request.get("http://localhost:3104/owned"), "http://localhost:3104/owned");
    assert.throws(() => wrapped.request.get("https://outside.example.test/"));
    assert.equal(called, 1);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
test("only standard Playwright names with one optional bundle prefix and numeric suffix normalize", () => {
  for (const [name, kind] of [["_Browser", "Browser"], ["_BrowserContext2", "BrowserContext"], ["_Page2", "Page"], ["_Locator", "Locator"], ["_APIRequestContext", "APIRequestContext"], ["_Request2", "Request"], ["_Response", "Response"], ["_ConsoleMessage", "ConsoleMessage"], ["DisposableStub", "DisposableStub"], ["Browser", "Browser"]])
    assert.equal(canonicalPlaywrightKind(name), kind);
  for (const name of ["__Browser", "BrowserExtra", "_Page2Extra", "_Unknown2", "Page-2", "_Browser2_", null]) assert.equal(canonicalPlaywrightKind(name), null);
});
test("bundled API aliases are wrapped while constructor and Locator private receiver identities survive", async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-browser-aliases-"));
  class _Frame {}
  const frame = new _Frame();
  class _Locator {
    constructor() { this._frame = frame; }
    filter(options) { assert.equal(options.has._frame, this._frame); return this; }
    click() { assert.ok(this instanceof _Locator); return new Promise(() => {}); }
  }
  class _Page2 {
    locator() { return new _Locator(); }
    evaluate() { assert.ok(this instanceof _Page2); return new Promise(() => {}); }
  }
  class _Response { finished() { assert.ok(this instanceof _Response); return new Promise(() => {}); } }
  class _Browser { close() { assert.ok(this instanceof _Browser); return new Promise(() => {}); } }
  try {
    const limits = Object.fromEntries(Object.keys(browserLimits).map(phase => [phase, 5]));
    const harness = createBrowserHarness({ suite: "commerce", output, limits });
    const original = new _Page2(), page = harness.wrap(original);
    assert.notEqual(page, original); assert.equal(harness.raw(page), original);
    assert.equal(page.constructor, _Page2); assert.equal(page.constructor.name, "_Page2");
    const locator = page.locator("synthetic"); assert.equal(locator._frame, frame);
    assert.equal(locator.filter({ has: page.locator("other") }), locator);
    await assert.rejects(() => locator.click(), { code: "QA_OPERATION_TIMEOUT" });
    await assert.rejects(() => page.evaluate(() => null), { code: "QA_OPERATION_TIMEOUT" });
    await assert.rejects(() => harness.wrap(new _Response()).finished(), { code: "QA_OPERATION_TIMEOUT" });
    await assert.rejects(() => harness.wrap(new _Browser()).close(), { code: "QA_OPERATION_TIMEOUT" });
    const evidence = harness.wrapperEvidence(); assert.equal(evidence.status, "PASS"); assert.equal(evidence.unknownConstructorCount, 0); assert.ok(evidence.normalizedAliasCount >= 4);
    for (const phase of ["action", "evaluate", "response", "close"]) assert.equal(evidence.operationCounts[phase], 1);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
test("unrecognized API constructors are counted and rejected without exposing their names", () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-browser-unknown-"));
  class _UnreviewedSecretObject2 {}
  class _Page2 { unfamiliar() { return new _UnreviewedSecretObject2(); } }
  try {
    const harness = createBrowserHarness({ suite: "security", output });
    assert.throws(() => harness.wrap(new _Page2()).unfamiliar(), { code: "QA_UNSUPPORTED_PLAYWRIGHT_OBJECT" });
    const evidence = harness.wrapperEvidence(); assert.equal(evidence.status, "FAIL"); assert.equal(evidence.unknownConstructorCount, 1);
    assert.equal(JSON.stringify(evidence).includes("UnreviewedSecretObject"), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, "security-wrappers.json"))), evidence);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
