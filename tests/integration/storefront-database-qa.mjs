// Independent integration checks against disposable loopback fixtures.
// Run with Node 22 --import tsx and QA_STATE_FILE pointing to a local-only QA state.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const statePath = process.env.QA_STATE_FILE;
assert.ok(statePath, "QA_STATE_FILE required");
const state = JSON.parse(readFileSync(statePath, "utf8"));
const url = new URL(state.databaseUrl);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
assert.equal(url.pathname, "/laonshop_qa");
process.env.DATABASE_URL = state.databaseUrl;
process.env.DIRECT_URL = state.databaseUrl;
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: state.databaseUrl } }, log: [] });
const { createVerifiedReview, recordShipment, markShipmentDelivered } = await import(pathToFileURL(`${process.cwd()}/lib/commerce/mutations.ts`).href);
const { getCommerceReadiness, getProductReviews, getReviewableItems, getOrderShipment } = await import(pathToFileURL(`${process.cwd()}/lib/commerce/queries.ts`).href);
const { prisma: applicationDb } = await import(pathToFileURL(`${process.cwd()}/lib/db.ts`).href);
const f = state.fixtures;
const result = [];
async function check(name, fn) { await fn(); result.push(name); }
const review = (itemId, overrides = {}) => ({ orderItemId: itemId, rating: 5, content: "격리 QA에서 확인하는 실제 구매후기 본문입니다.", ...overrides });
const shipment = (key, overrides = {}) => ({ orderId: f.orders[key].id, carrier: "CJ", trackingNumber: "999988887777", note: "격리 QA 발송 확인", ...overrides });
try {
  const beforePayments = await db.shopOrder.findMany({ where: { id: { startsWith: "qa-20261104-" } }, select: { id: true, status: true, totalAmount: true, approvalNo: true, pgTrno: true }, orderBy: { id: "asc" } });
  await check("schema readiness", async () => assert.deepEqual(await getCommerceReadiness(), { ready: true }));
  await check("completion requires evidence note on server", async () => {
    assert.equal((await markShipmentDelivered(f.users.admin, { orderId: f.orders.shipped.id, note: "" })).status, "error");
    assert.equal((await markShipmentDelivered(f.users.admin, { orderId: f.orders.shipped.id, note: "확인" })).status, "error");
  });
  await check("own delivered item offered; foreign/canceled/demo/unshipped hidden", async () => {
    const data = await getReviewableItems(f.users.buyer, f.productId);
    assert.deepEqual(data.items.map(x => x.id), [f.orders.delivered.itemId]);
  });
  for (const key of ["other", "canceled", "demo", "pending", "unshipped", "shipped"]) await check(`review refuses ${key}`, async () => {
    assert.equal((await createVerifiedReview(f.users.buyer, review(f.orders[key].itemId))).status, "error");
  });
  for (const [name, values] of [["rating0", { rating: 0 }], ["rating6", { rating: 6 }], ["fraction", { rating: 2.5 }], ["short", { content: "짧음" }], ["long", { content: "가".repeat(2001) }]]) await check(`review rejects ${name}`, async () => {
    assert.equal((await createVerifiedReview(f.users.buyer, review(f.orders.delivered.itemId, values))).status, "error");
  });
  await check("concurrent duplicate reviews create one row", async () => {
    const out = await Promise.all([createVerifiedReview(f.users.buyer, review(f.orders.delivered.itemId)), createVerifiedReview(f.users.buyer, review(f.orders.delivered.itemId))]);
    assert.equal(out.filter(x => x.status === "success").length, 1);
    assert.equal(out.filter(x => x.status === "error").length, 1);
    assert.equal(await db.shopProductReview.count({ where: { orderItemId: f.orders.delivered.itemId } }), 1);
  });
  await check("public review aggregate and safe DTO", async () => {
    const data = await getProductReviews(f.productId);
    assert.equal(data.total, 1); assert.equal(data.averageRating, 5); assert.equal(data.reviews.length, 1);
    assert.equal(data.reviews[0].authorLabel, "구**");
    assert.deepEqual(Object.keys(data.reviews[0]).sort(), ["id", "rating", "content", "createdAt", "authorLabel", "purchasedSize"].sort());
  });
  await check("non-admin shipping and completion denied", async () => {
    assert.equal((await recordShipment(f.users.buyer, shipment("unshipped"))).status, "error");
    assert.equal((await markShipmentDelivered(f.users.buyer, { orderId: f.orders.shipped.id, note: "택배사 배송완료 조회 확인" })).status, "error");
  });
  for (const key of ["canceled", "pending", "demo"]) await check(`shipping rejects ${key}`, async () => {
    assert.equal((await recordShipment(f.users.admin, shipment(key))).status, "error");
  });
  for (const [name, values] of [["carrier", { carrier: "https://evil.invalid" }], ["shortTracking", { trackingNumber: "123" }], ["trackingScript", { trackingNumber: "<script>" }], ["noteLength", { note: "가".repeat(501) }]]) await check(`shipping rejects ${name}`, async () => {
    assert.equal((await recordShipment(f.users.admin, shipment("unshipped", values))).status, "error");
  });
  await check("completion requires shipment", async () => assert.equal((await markShipmentDelivered(f.users.admin, { orderId: f.orders.unshipped.id, note: "택배사 배송완료 조회 확인" })).status, "error"));
  await check("concurrent same tracking records one shipment and event", async () => {
    const out = await Promise.all([recordShipment(f.users.admin, shipment("unshipped")), recordShipment(f.users.admin, shipment("unshipped"))]);
    assert.ok(out.every(x => x.status === "success"));
    const saved = await db.shopShipment.findUnique({ where: { orderId: f.orders.unshipped.id }, include: { events: true } });
    assert.equal(saved.events.length, 1); assert.equal(saved.status, "SHIPPED");
  });
  await check("tracking correction requires reason and appends previous snapshot", async () => {
    assert.equal((await recordShipment(f.users.admin, shipment("unshipped", { trackingNumber: "888877776666", note: "" }))).status, "error");
    assert.equal((await recordShipment(f.users.admin, shipment("unshipped", { trackingNumber: "888877776666", note: "송장번호 오입력 정정" }))).status, "success");
    const saved = await db.shopShipment.findUnique({ where: { orderId: f.orders.unshipped.id }, include: { events: { orderBy: { createdAt: "asc" } } } });
    assert.equal(saved.events.length, 2); assert.equal(saved.events[0].trackingNumber, "999988887777"); assert.equal(saved.events[1].trackingNumber, "888877776666");
  });
  await check("concurrent completion is idempotent; delivered tracking immutable", async () => {
    const out = await Promise.all([markShipmentDelivered(f.users.admin, { orderId: f.orders.unshipped.id, note: "택배사 배송완료 조회 확인" }), markShipmentDelivered(f.users.admin, { orderId: f.orders.unshipped.id, note: "택배사 배송완료 조회 확인" })]);
    assert.ok(out.every(x => x.status === "success"));
    const saved = await getOrderShipment(f.orders.unshipped.id);
    assert.equal(saved.shipment.status, "DELIVERED"); assert.equal(saved.shipment.events.filter(x => x.action === "DELIVERED").length, 1);
    assert.equal((await recordShipment(f.users.admin, shipment("unshipped", { trackingNumber: "777766665555", note: "완료 후 변경 시도" }))).status, "error");
  });
  await check("admin demotion is checked from current DB", async () => {
    await db.shopUser.update({ where: { id: f.users.admin }, data: { role: "CUSTOMER" } });
    try { assert.equal((await recordShipment(f.users.admin, shipment("shipped"))).status, "error"); }
    finally { await db.shopUser.update({ where: { id: f.users.admin }, data: { role: "ADMIN" } }); }
  });
  await check("newly canceled order blocks stale shipping request", async () => {
    await db.shopOrder.update({ where: { id: f.orders.shipped.id }, data: { status: "CANCELED" } });
    try { assert.equal((await recordShipment(f.users.admin, shipment("shipped"))).status, "error"); }
    finally { await db.shopOrder.update({ where: { id: f.orders.shipped.id }, data: { status: "PAID" } }); }
  });
  const event = await db.shopShipmentEvent.findFirst();
  await check("DB event update and delete rejected", async () => {
    await assert.rejects(db.shopShipmentEvent.update({ where: { id: event.id }, data: { note: "변조" } }));
    await assert.rejects(db.shopShipmentEvent.delete({ where: { id: event.id } }));
  });
  await check("DB mismatched review ownership rejected", async () => {
    await assert.rejects(db.shopProductReview.create({ data: { orderItemId: f.orders.other.itemId, orderId: f.orders.other.id, productId: f.productId, userId: f.users.buyer, rating: 5, content: "잘못된 소유권으로 작성하려는 후기" } }));
  });
  await check("DB invalid rating and content rejected", async () => {
    for (const data of [{ rating: 0, content: "정상 길이의 테스트 후기 본문" }, { rating: 6, content: "정상 길이의 테스트 후기 본문" }, { rating: 5, content: "짧음" }]) {
      await assert.rejects(db.shopProductReview.create({ data: { orderItemId: f.orders.other.itemId, orderId: f.orders.other.id, productId: f.productId, userId: f.users.other, ...data } }));
    }
  });
  await check("DB delivered timestamp cannot be null", async () => {
    const saved = await db.shopShipment.findUnique({ where: { orderId: f.orders.shipped.id } });
    await assert.rejects(db.shopShipment.update({ where: { id: saved.id }, data: { status: "DELIVERED", deliveredAt: null } }));
  });
  await check("shipping mutations preserve all payment states and amounts", async () => {
    const after = await db.shopOrder.findMany({ where: { id: { startsWith: "qa-20261104-" } }, select: { id: true, status: true, totalAmount: true, approvalNo: true, pgTrno: true }, orderBy: { id: "asc" } });
    assert.deepEqual(after, beforePayments);
  });
  await check("missing table returns unavailable and blocks writes", async () => {
    await db.$executeRawUnsafe('ALTER TABLE "ShopProductReview" RENAME TO "QA_Missing_ProductReview"');
    try {
      assert.equal((await getCommerceReadiness()).ready, false);
      assert.equal((await getProductReviews(f.productId)).available, false);
      assert.equal((await recordShipment(f.users.admin, shipment("shipped"))).status, "error");
    } finally { await db.$executeRawUnsafe('ALTER TABLE "QA_Missing_ProductReview" RENAME TO "ShopProductReview"'); }
  });
  await check("disabled audit protection is unavailable", async () => {
    await db.$executeRawUnsafe('ALTER TABLE "ShopShipmentEvent" DISABLE TRIGGER laonshop_shipment_event_immutable');
    try { assert.equal((await getCommerceReadiness()).ready, false); assert.equal((await getProductReviews(f.productId)).available, false); }
    finally { await db.$executeRawUnsafe('ALTER TABLE "ShopShipmentEvent" ENABLE TRIGGER laonshop_shipment_event_immutable'); }
  });
  const resultPath = `${process.env.QA_OUTPUT_DIR || `${process.cwd()}/tests/reports/2026-11-04-shop-upgrade`}/database-results.json`;
  writeFileSync(resultPath, JSON.stringify({ status: "PASS", count: result.length, checks: result }, null, 2));
  console.log(JSON.stringify({ status: "PASS", count: result.length, resultPath }));
} finally { await db.$disconnect(); await applicationDb.$disconnect(); }
