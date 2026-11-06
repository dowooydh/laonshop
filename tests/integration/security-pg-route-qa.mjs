// Actual result-route + disposable PostgreSQL regression with an in-process PG transport stub.
// This does not exercise a real payment gateway or the HTTP adapter of the route.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

assert.equal(process.platform, "linux");
assert.equal(process.getuid(), 1000);
assert.equal(process.cwd(), "/scratch/source");
assert.deepEqual(Object.keys(os.networkInterfaces()), ["lo"]);
assert.equal(fs.existsSync(".env"), false);
assert.equal(process.env.QA_STATE_FILE, "/scratch/state.json");
const state = JSON.parse(fs.readFileSync(process.env.QA_STATE_FILE, "utf8"));
const database = new URL(state.databaseUrl);
assert.equal(database.protocol, "postgresql:");
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.port, "55432");
assert.equal(database.pathname, "/laonshop_qa");
assert.equal(database.username, "qa_owner");
assert.equal(database.password, "");
assert.equal(process.env.DATABASE_URL, state.databaseUrl);
assert.equal(process.env.DIRECT_URL, state.databaseUrl);
assert.equal(process.env.SESSION_SECRET, state.secret);
assert.ok(state.secret.length >= 32);
assert.equal(process.env.PG_MODE, "kspay");
assert.equal(process.env.KSPAY_STORE_ID, "2999199999");
assert.equal(process.env.KSPAY_REST_LIVE, "0");
assert.equal(process.env.LAONPAY_BILLING_FEATURE_ENABLED, "0");
assert.equal(process.env.KSPAY_STORE_KEY, undefined);
const output = path.resolve(process.env.QA_OUTPUT_DIR);
assert.ok(output.startsWith("/scratch/source/tests/.generated/"));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });

const { prisma: db } = await import(pathToFileURL(`${process.cwd()}/lib/db.ts`).href);
const { POST } = await import(pathToFileURL(`${process.cwd()}/app/api/pg/kspay/result/route.ts`).href);
const { createKspayResultToken } = await import(pathToFileURL(`${process.cwd()}/lib/kspay/result-token.ts`).href);
const { PAYMENT_PROCESSING_MARKER } = await import(pathToFileURL(`${process.cwd()}/lib/order-guard.ts`).href);
const { NextRequest } = await import("next/server.js");
const endpoint = "https://kspay.ksnet.to/store/KSPayWebV1.4/web_host/recv_post.jsp";
const prefix = `qa-pg-route-${randomBytes(8).toString("hex")}`;
const userId = `${prefix}-user`, productId = `${prefix}-product`;
const checks = [], orderIds = [];
let providerStubCalls = 0, unexpectedFetches = 0, activeCase = null, currentCheck = "fixture-setup", failure = null;
let cleanup = { status: "FAIL" }, ledgerCountsUnchanged = false;
const originalFetch = globalThis.fetch;
// No fallthrough to originalFetch is permitted, including on an unexpected URL.
globalThis.fetch = async (input, init) => {
  if (String(input) !== endpoint || init?.method !== "POST" || !activeCase) {
    unexpectedFetches += 1;
    throw new Error("UNEXPECTED_FETCH_BLOCKED");
  }
  const body = new URLSearchParams(init.body);
  assert.equal(body.get("sndActionType"), "1");
  assert.equal(body.get("sndAmount"), "1000");
  assert.equal(body.get("sndCommConId"), "synthetic-route-key");
  assert.ok(init.signal instanceof AbortSignal);
  providerStubCalls += 1;
  activeCase.calls += 1;
  const fields = [activeCase.authyn, "SYNTHETIC-TRNO", "20261106", "120000", activeCase.amount,
    activeCase.authyn === "X" ? "SYNTHETIC-DECLINE" : "SYNTHETIC-APPROVAL", "", "", activeCase.order.moid,
    "01", "01", "", "0000", "00"];
  await new Promise(resolve => setTimeout(resolve, 20));
  return new Response(["response", ...fields].join("`"), { status: 200 });
};
const ledgerSelection = { id: true, userId: true, status: true, totalAmount: true, approvalNo: true, pgTrno: true, paidAt: true };
let beforeLedger = null, beforeCounts = null;
try {
  beforeLedger = await db.shopOrder.findMany({ select: ledgerSelection, orderBy: { id: "asc" } });
  beforeCounts = { users: await db.shopUser.count(), products: await db.product.count(), orders: await db.shopOrder.count(), orderItems: await db.shopOrderItem.count() };
  await db.shopUser.create({ data: { id: userId, email: `${prefix}@example.test`, name: "격리 PG 사용자", passwordHash: "synthetic-unused-no-login" } });
  await db.product.create({ data: { id: productId, name: "격리 PG 재고 상품", price: 1000, stock: 100, active: true, sizes: "M" } });
  const cases = [
    { name: "missing-amount-pending-no-reapproval", authyn: "O", amount: "", status: "PENDING" },
    { name: "mismatched-amount-pending-no-reapproval", authyn: "O", amount: "1001", status: "PENDING" },
    { name: "unknown-authyn-pending-no-reapproval", authyn: "?", amount: "1000", status: "PENDING" },
    { name: "declined-x-failed-no-reapproval", authyn: "X", amount: "1000", status: "FAILED" },
  ];
  for (const [index, scenario] of cases.entries()) {
    currentCheck = scenario.name;
    const order = await db.shopOrder.create({ data: { id: `${prefix}-${index}`, userId, totalAmount: 1000, moid: `QA-PG-${prefix}-${index}`,
      items: { create: { productId, name: "격리 PG 재고 상품", price: 1000, qty: 1, size: "M" } } } });
    orderIds.push(order.id);
    activeCase = { ...scenario, order, calls: 0 };
    const form = new URLSearchParams({ a: order.id, c: createKspayResultToken(order), reCommConId: "synthetic-route-key" });
    const request = () => new NextRequest(`${process.env.SHOP_APP_URL}/api/pg/kspay/result`, { method: "POST", body: form.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    const responses = await Promise.allSettled([POST(request()), POST(request())]);
    assert.ok(responses.every(response => response.status === "fulfilled" && response.value.status === 303));
    assert.equal(activeCase.calls, 1);
    const saved = await db.shopOrder.findUnique({ where: { id: order.id }, include: { items: true } });
    assert.equal(saved.status, scenario.status);
    assert.equal(saved.approvalNo, scenario.status === "PENDING" ? PAYMENT_PROCESSING_MARKER : null);
    assert.equal(saved.totalAmount, 1000);
    assert.equal(saved.userId, userId);
    assert.equal(saved.pgTrno, null);
    assert.equal(saved.cardName, null);
    assert.equal(saved.paidAt, null);
    assert.deepEqual(saved.items.map(({ productId: id, price, qty, size }) => ({ id, price, qty, size })), [{ id: productId, price: 1000, qty: 1, size: "M" }]);
    const replay = await POST(request());
    assert.equal(replay.status, 303);
    assert.equal(activeCase.calls, 1);
    const afterReplay = await db.shopOrder.findUnique({ where: { id: order.id }, select: ledgerSelection });
    assert.deepEqual(afterReplay, Object.fromEntries(Object.keys(ledgerSelection).map(key => [key, saved[key]])));
    assert.equal((await db.product.findUnique({ where: { id: productId } })).stock, 100);
    checks.push(scenario.name);
    activeCase = null;
  }
  assert.equal(providerStubCalls, 4);
  assert.equal(unexpectedFetches, 0);
} catch (error) {
  failure = { check: currentCheck, kind: error.name === "AssertionError" ? "AssertionError" : "Error" };
} finally {
  globalThis.fetch = originalFetch;
  try {
    // Delete only exact identities created by this invocation; no wildcard cleanup.
    await db.shopOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.shopOrder.deleteMany({ where: { id: { in: orderIds }, userId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.shopUser.deleteMany({ where: { id: userId } });
    assert.equal(await db.shopOrder.count({ where: { id: { in: orderIds } } }), 0);
    assert.equal(await db.product.count({ where: { id: productId } }), 0);
    assert.equal(await db.shopUser.count({ where: { id: userId } }), 0);
    if (beforeLedger && beforeCounts) {
      assert.deepEqual(await db.shopOrder.findMany({ select: ledgerSelection, orderBy: { id: "asc" } }), beforeLedger);
      assert.deepEqual({ users: await db.shopUser.count(), products: await db.product.count(), orders: await db.shopOrder.count(), orderItems: await db.shopOrderItem.count() }, beforeCounts);
      ledgerCountsUnchanged = true;
    }
    cleanup = { status: "PASS" };
    if (!failure && ledgerCountsUnchanged) checks.push("owned-fixtures-cleaned-ledgers-unchanged");
  } catch { failure ??= { check: "owned-fixtures-cleaned-ledgers-unchanged", kind: "Error" }; }
  await db.$disconnect();
}
const status = !failure && checks.length === 5 && cleanup.status === "PASS" && ledgerCountsUnchanged && providerStubCalls === 4 && unexpectedFetches === 0 ? "PASS" : "FAIL";
const summary = { status, count: checks.length, checks, providerStubCalls, unexpectedFetches, realProviderCalls: 0, ledgerCountsUnchanged, cleanup, ...(failure ? { failure } : {}) };
fs.writeFileSync(path.join(output, "security-pg-route-results.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
console.log(JSON.stringify(summary));
process.exitCode = status === "PASS" ? 0 : 1;
