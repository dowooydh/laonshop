// Fixed expectations owned by the trusted QA controller. Target text is never promoted.
export const expectedChecks = {
  "securityPgRoute": ["missing-amount-pending-no-reapproval", "mismatched-amount-pending-no-reapproval", "unknown-authyn-pending-no-reapproval", "declined-x-failed-no-reapproval", "owned-fixtures-cleaned-ledgers-unchanged"],
  "commerceService": [
    "schema readiness",
    "completion requires evidence note on server",
    "own delivered item offered; foreign/canceled/demo/unshipped hidden",
    "concurrent duplicate reviews create one row",
    "public review aggregate and safe DTO",
    "non-admin shipping and completion denied",
    "completion requires shipment",
    "concurrent same tracking records one shipment and event",
    "tracking correction requires reason and appends previous snapshot",
    "concurrent completion is idempotent; delivered tracking immutable",
    "admin demotion is checked from current DB",
    "newly canceled order blocks stale shipping request",
    "DB event update and delete rejected",
    "DB mismatched review ownership rejected",
    "DB invalid rating and content rejected",
    "DB delivered timestamp cannot be null",
    "shipping mutations preserve all payment states and amounts",
    "missing table returns unavailable and blocks writes",
    "disabled audit protection is unavailable",
    "review refuses other",
    "review refuses canceled",
    "review refuses demo",
    "review refuses pending",
    "review refuses unshipped",
    "review refuses shipped",
    "review rejects rating0",
    "review rejects rating6",
    "review rejects fraction",
    "review rejects short",
    "review rejects long",
    "shipping rejects canceled",
    "shipping rejects pending",
    "shipping rejects demo",
    "shipping rejects carrier",
    "shipping rejects shortTracking",
    "shipping rejects trackingScript",
    "shipping rejects noteLength"
  ],
  "commerceBrowser": [
    "search and category filters work",
    "product quantity and add-to-cart retain selected option",
    "anonymous protected routes redirect without private data",
    "customer statement ownership and print title",
    "verified buyer submits review through real Server Action",
    "real review action refuses another customer and anonymous replay",
    "admin corrects tracking through real Server Action",
    "real shipping action refuses customer and demoted admin",
    "admin delivery completion and order evidence show recorded result",
    "schema protection absent keeps product/order readable and writes unavailable",
    "public 320px 100% /",
    "public 320px 100% /shop/men",
    "public 320px 100% /shop/women",
    "public 320px 100% /search",
    "public 320px 100% /product/:id",
    "public 320px 100% /support",
    "public 320px 200% /",
    "public 320px 200% /shop/men",
    "public 320px 200% /shop/women",
    "public 320px 200% /search",
    "public 320px 200% /product/:id",
    "public 320px 200% /support",
    "public 390px 100% /",
    "public 390px 100% /shop/men",
    "public 390px 100% /shop/women",
    "public 390px 100% /search",
    "public 390px 100% /product/:id",
    "public 390px 100% /support",
    "public 390px 200% /",
    "public 390px 200% /shop/men",
    "public 390px 200% /shop/women",
    "public 390px 200% /search",
    "public 390px 200% /product/:id",
    "public 390px 200% /support",
    "public 1280px 100% /",
    "public 1280px 100% /shop/men",
    "public 1280px 100% /shop/women",
    "public 1280px 100% /search",
    "public 1280px 100% /product/:id",
    "public 1280px 100% /support",
    "public 1280px 200% /",
    "public 1280px 200% /shop/men",
    "public 1280px 200% /shop/women",
    "public 1280px 200% /search",
    "public 1280px 200% /product/:id",
    "public 1280px 200% /support"
  ],
  "securityBrowser": [
    "actual login rejects previous password and binds new credential",
    "legacy unbound cookie is rejected",
    "bound current cookie reaches password settings",
    "real password action changes credential and reissues current session",
    "copied pre-change cookie and hosted return are rejected",
    "parallel password replays allow exactly one credential update",
    "omitted legal consent is rejected by actual register action",
    "invalid PG inputs and credential actions preserve order review and product ledgers",
    "PG callback oversized body rejected before any ledger effect",
    "PG callback chunked oversized body rejected without Content-Length",
    "PG callback duplicate scalar rejected",
    "PG callback file value rejected",
    "PG result oversized body rejected before any ledger effect",
    "PG result chunked oversized body rejected without Content-Length",
    "PG result duplicate scalar rejected",
    "PG result file value rejected"
  ]
};
const exactEmpty = value => Array.isArray(value) && value.length === 0;
export function summarizeEvidence(value, key) {
  const expected = expectedChecks[key];
  if (!expected) throw new Error("EVIDENCE_KIND_INVALID");
  const checks = Array.isArray(value.checks) ? value.checks.map(check => typeof check === "string" ? check.replace(/(public \d+px \d+% )\/product\/[a-zA-Z0-9-]+$/, "$1/product/:id") : null) : [];
  const matchedRequiredChecks = expected.filter(name => checks.includes(name)).length;
  const exactChecks = checks.length === expected.length && new Set(checks).size === expected.length && matchedRequiredChecks === expected.length;
  const invariants = key === "commerceBrowser" ? {
    noPageErrors: exactEmpty(value.pageErrors), noExternalWrites: exactEmpty(value.externalWrites), noAnchorOverlaps: exactEmpty(value.anchorOverlaps),
  } : key === "securityBrowser" ? {
    noExternalWrites: exactEmpty(value.deniedExternalWrites), noProviderRequests: exactEmpty(value.deniedProviders), ledgerCountsUnchanged: value.ledgerCountsUnchanged === true,
  } : key === "securityPgRoute" ? {
    exactProviderStubCalls: value.providerStubCalls === 4, noUnexpectedFetches: value.unexpectedFetches === 0, noRealProviderCalls: value.realProviderCalls === 0, ledgerCountsUnchanged: value.ledgerCountsUnchanged === true, ownFixturesCleaned: value.cleanup?.status === "PASS",
  } : { paymentLedgerInvariantChecked: checks.includes("shipping mutations preserve all payment states and amounts") };
  return { status: value.status === "PASS" ? "PASS" : "FAIL", count: Number.isInteger(value.count) ? value.count : 0, expectedCount: expected.length, matchedRequiredChecks, exactChecks, invariants,
    consoleErrorCount: key === "commerceBrowser" && Array.isArray(value.consoleErrors) ? value.consoleErrors.length : null,
    failureCheckIndex: expected.indexOf(value.failure?.check), failureKind: ["AssertionError", "Error", "TypeError", "TimeoutError"].includes(value.failure?.kind) ? value.failure.kind : null };
}
export function validateEvidence(evidence) {
  for (const [key, expected] of Object.entries(expectedChecks)) {
    const value = evidence?.[key];
    if (value?.status !== "PASS" || value.count !== expected.length || value.expectedCount !== expected.length || value.matchedRequiredChecks !== expected.length || value.exactChecks !== true || !value.invariants || Object.values(value.invariants).some(passed => passed !== true)) throw new Error("REQUIRED_EVIDENCE_INVALID");
    const required = key === "commerceBrowser" ? ["noPageErrors", "noExternalWrites", "noAnchorOverlaps"] : key === "securityBrowser" ? ["noExternalWrites", "noProviderRequests", "ledgerCountsUnchanged"] : key === "securityPgRoute" ? ["exactProviderStubCalls", "noUnexpectedFetches", "noRealProviderCalls", "ledgerCountsUnchanged", "ownFixturesCleaned"] : ["paymentLedgerInvariantChecked"];
    if (required.some(name => value.invariants[name] !== true)) throw new Error("REQUIRED_EVIDENCE_INVALID");
  }
  return true;
}
