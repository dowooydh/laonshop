"use client";

export type DocumentRefreshScope = "product" | "admin-orders";
const POSITION_TTL_MS = 30_000;
const MAX_SCROLL_Y = 10_000_000;

function currentUrl(scope: DocumentRefreshScope): URL | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== window.location.origin) return null;
    const allowed = scope === "product"
      ? /^\/product\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname)
      : scope === "admin-orders" && url.pathname === "/admin/orders";
    return allowed ? url : null;
  } catch { return null; }
}

function positionKey(scope: DocumentRefreshScope, path: string): string {
  return `laonshop:document-refresh:${scope}:${path}`;
}

/** A new GET follows a completed action; never reload a possible POST document. */
export function refreshDocument(scope: DocumentRefreshScope): void {
  const url = currentUrl(scope);
  if (!url) return;
  try {
    const key = positionKey(scope, url.pathname);
    window.sessionStorage.removeItem(key);
    const scrollY = Math.round(window.scrollY);
    if (Number.isSafeInteger(scrollY) && scrollY >= 0 && scrollY <= MAX_SCROLL_Y) {
      window.sessionStorage.setItem(key, JSON.stringify({
        version: 1, scope, path: url.pathname, createdAt: Date.now(), scrollY,
        reviews: scope === "product" && url.hash === "#reviews",
      }));
    }
  } catch { /* Storage denial must not prevent the fresh GET. */ }
  // A URL with its existing fragment may stay in the same document.
  url.hash = "";
  window.location.replace(url.href);
}

/** Called on mount. Consume first so Strict Mode or repeated mounts cannot replay it. */
export function restoreDocumentPosition(scope: DocumentRefreshScope): void {
  const url = currentUrl(scope);
  if (!url) return;
  let raw: string | null;
  try {
    const key = positionKey(scope, url.pathname);
    raw = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
  } catch { return; }
  if (!raw || raw.length > 512) return;
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    value = parsed as Record<string, unknown>;
  } catch { return; }
  const fields = ["version", "scope", "path", "createdAt", "scrollY", "reviews"];
  if (Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key))) return;
  if (value.version !== 1 || value.scope !== scope || value.path !== url.pathname) return;
  if (typeof value.createdAt !== "number" || !Number.isSafeInteger(value.createdAt)) return;
  const age = Date.now() - value.createdAt;
  if (age < 0 || age > POSITION_TTL_MS) return;
  if (typeof value.scrollY !== "number" || !Number.isSafeInteger(value.scrollY) || value.scrollY < 0 || value.scrollY > MAX_SCROLL_Y) return;
  if (typeof value.reviews !== "boolean" || scope !== "product" && value.reviews) return;
  const scrollY = value.scrollY;
  url.hash = value.reviews ? "#reviews" : "";
  try { window.history.replaceState(window.history.state, "", url.href); }
  catch { return; }
  window.requestAnimationFrame(() => {
    const current = currentUrl(scope);
    if (current?.origin === url.origin && current.pathname === url.pathname) window.scrollTo(0, scrollY);
  });
}
