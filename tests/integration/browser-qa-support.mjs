import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export const browserLimits = Object.freeze({ setup: 15000, navigate: 20000, action: 15000, api: 15000, "native-fetch": 15000, response: 15000, fonts: 15000, evaluate: 15000, close: 10000 });
const phases = new Set(["setup", "check-start", "check-complete", "navigate", "action", "api", "native-fetch", "response", "fonts", "evaluate", "close", "finish", "failed"]);
const playwrightKinds = new Set(["Browser", "BrowserContext", "Page", "Locator", "APIRequestContext", "APIResponse", "Response", "Request", "Route", "ElementHandle", "JSHandle"]);

export async function deadline(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("QA_OPERATION_TIMEOUT"), { code: "QA_OPERATION_TIMEOUT" })), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function requestDisposition(url, method = "GET") {
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) && ["http:", "https:"].includes(parsed.protocol);
  return { local, provider: !local && /ksnet|kspay|laonpay|baum/i.test(parsed.hostname), externalWrite: !local && method !== "GET" };
}

export function createBrowserHarness({ suite, output, limits = browserLimits }) {
  assert.ok(["commerce", "security"].includes(suite));
  const destination = path.join(output, `${suite}-progress.json`), temporary = `${destination}.tmp`;
  const wrappers = new WeakMap(), originals = new WeakMap();
  let checkIndex = 0;
  function progress(phase) {
    assert.ok(phases.has(phase));
    fs.writeFileSync(temporary, JSON.stringify({ suite, checkIndex, phase }), { mode: 0o600 });
    fs.renameSync(temporary, destination);
  }
  const operation = (phase, action, milliseconds = limits[phase]) => {
    assert.ok(Object.hasOwn(limits, phase));
    progress(phase);
    return deadline(action, milliseconds);
  };
  const raw = value => originals.get(value) ?? value;
  function wrap(value) {
    if (Array.isArray(value)) return value.map(wrap);
    if (!value || !playwrightKinds.has(value.constructor?.name)) return value;
    if (wrappers.has(value)) return wrappers.get(value);
    const kind = value.constructor.name;
    const wrapped = new Proxy(value, {
      get(target, property) {
        const member = Reflect.get(target, property, target);
        if (typeof member !== "function") return wrap(member);
        return (...args) => {
          const callbacks = ["route", "on", "once", "waitForResponse", "waitForRequest"].includes(property);
          const parameters = args.map(arg => callbacks && typeof arg === "function" ? (...values) => arg(...values.map(wrap)) : raw(arg));
          if (kind === "APIRequestContext" && ["get", "post", "put", "patch", "delete", "head", "fetch"].includes(property)) {
            assert.equal(requestDisposition(parameters[0], property === "fetch" ? parameters[1]?.method ?? "GET" : property.toUpperCase()).local, true);
            parameters[1] = { ...parameters[1], timeout: limits.api };
          }
          const result = member.apply(target, parameters);
          if (!result || typeof result.then !== "function") return wrap(result);
          const phase = ["close", "dispose"].includes(property) ? "close"
            : ["goto", "reload", "goBack", "goForward", "waitForURL"].includes(property) ? "navigate"
            : ["evaluate", "evaluateHandle"].includes(property) ? "evaluate"
            : kind === "APIRequestContext" || kind === "Route" ? "api"
            : ["Response", "APIResponse"].includes(kind) || ["waitForResponse", "waitForRequest"].includes(property) ? "response"
            : ["newContext", "newPage"].includes(property) ? "setup" : "action";
          const bounded = operation(phase, () => result).then(wrap);
          // A response waiter may be created before a separately awaited click.
          // Preserve rejection for its caller while allowing owned cleanup to run.
          bounded.catch(() => {});
          return bounded;
        };
      },
    });
    wrappers.set(value, wrapped); originals.set(wrapped, value);
    return wrapped;
  }
  async function check(name, action, checks) {
    checkIndex += 1; progress("check-start");
    try { await action(); checks.push(name); progress("check-complete"); }
    catch (error) { progress("failed"); throw error; }
  }
  async function configure(context) {
    const target = raw(context);
    target.setDefaultTimeout(limits.action);
    target.setDefaultNavigationTimeout(limits.navigate);
    return context;
  }
  const fontsReady = page => operation("fonts", () => raw(page).evaluate(() => document.fonts.ready.then(() => true)));
  async function nativeFetch(url, options = {}) {
    assert.equal(requestDisposition(url, options.method ?? "GET").local, true);
    return operation("native-fetch", () => fetch(url, { ...options, signal: AbortSignal.timeout(limits["native-fetch"]) }));
  }
  progress("setup");
  return { wrap, raw, progress, operation, configure, check, fontsReady, nativeFetch };
}

export function validateFontProbe(probe, responses, origin) {
  assert.equal(probe.cssContainsPreparationPath, false);
  assert.equal(probe.fonts.length, 2);
  assert.deepEqual(probe.fonts.map(font => font.variable).sort(), ["--font-display", "--font-mono"]);
  assert.equal(new Set(probe.fonts.map(font => font.family)).size, 2);
  for (const font of probe.fonts) {
    assert.ok(font.family.length > 0);
    assert.ok(Number.isInteger(font.loadedCount) && font.loadedCount > 0);
    assert.equal(font.loadedStatuses.length, font.loadedCount);
    assert.ok(font.loadedStatuses.every(status => status === "loaded"));
    assert.ok(font.sources.length > 0);
    assert.ok(font.sources.every(source => {
      const url = new URL(source);
      return url.origin === origin && /^\/_next\/static\/media\/[^/]+\.woff2$/.test(url.pathname);
    }));
    assert.ok(font.sources.some(source => responses.some(response => response.url === source && response.status === 200)));
  }
  return true;
}

export async function verifySelfHostedFonts(page, harness, responses, origin) {
  const probe = await harness.operation("fonts", () => harness.raw(page).evaluate(async () => {
    const rules = [], cssText = [];
    const visit = (sheet, base) => {
      let entries;
      try { entries = sheet.cssRules; } catch { return; }
      for (const rule of entries) {
        cssText.push(rule.cssText);
        if (rule.type === CSSRule.FONT_FACE_RULE) rules.push({ text: rule.cssText, family: rule.style.fontFamily.replace(/^['"]|['"]$/g, ""), src: rule.style.getPropertyValue("src"), base });
        else if (rule.cssRules) visit(rule, base);
      }
    };
    for (const sheet of document.styleSheets) visit(sheet, sheet.href || document.baseURI);
    const fonts = [];
    for (const variable of ["--font-display", "--font-mono"]) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      const family = value.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      const loaded = await document.fonts.load(`16px "${family}"`, "LAON SHOP 123");
      const sources = rules.filter(rule => rule.family === family).flatMap(rule => [...rule.src.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/g)].map(match => new URL(match[1] ?? match[2] ?? match[3].trim(), rule.base).href));
      fonts.push({ variable, family, loadedCount: loaded.length, loadedStatuses: loaded.map(font => font.status), sources });
    }
    await document.fonts.ready;
    return { fonts, cssContainsPreparationPath: cssText.some(text => text.includes("/opt/qa")) || [...document.styleSheets].some(sheet => String(sheet.href).includes("/opt/qa")) };
  }));
  return validateFontProbe(probe, responses, origin);
}
