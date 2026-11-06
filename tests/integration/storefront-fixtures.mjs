// Disposable local QA fixtures only. Refuses any non-loopback or non-QA database.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { createSessionCredentialTag } from "../../lib/session-security.ts";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { sealData } = require("iron-session");
const statePath = process.env.QA_STATE_FILE;
assert.ok(statePath, "QA_STATE_FILE is required");
const state = JSON.parse(readFileSync(statePath, "utf8"));
const url = new URL(state.databaseUrl);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
assert.match(url.pathname, /^\/laonshop_qa$/);
const db = new PrismaClient({ datasources: { db: { url: state.databaseUrl } } });
try {
  const product = await db.product.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  assert.ok(product, "Seed the disposable catalog first");
  const users = {};
  for (const [key, role, name] of [["buyer", "CUSTOMER", "구매자테스트"], ["other", "CUSTOMER", "다른구매자"], ["admin", "ADMIN", "배송관리자"]]) {
    users[key] = await db.shopUser.upsert({
      where: { id: `qa-20261104-${key}` }, update: {},
      create: { id: `qa-20261104-${key}`, email: `qa+20261104-${key}@example.test`, name, role, passwordHash: "qa-disposable-not-a-login-password", phone: "01000000000" },
    });
  }
  const orders = {};
  for (const [key, status, owner, mode] of [["unshipped", "PAID", "buyer", null], ["shipped", "PAID", "buyer", "SHIPPED"], ["delivered", "PAID", "buyer", "DELIVERED"], ["canceled", "CANCELED", "buyer", "DELIVERED"], ["pending", "PENDING", "buyer", null], ["demo", "PAID", "buyer", "DELIVERED"], ["other", "PAID", "other", "DELIVERED"]]) {
    const id = `qa-20261104-${key}`;
    const order = await db.shopOrder.create({ data: {
      id, userId: users[owner].id, status, totalAmount: product.price,
      moid: `QA20261104-${key.toUpperCase()}`, approvalNo: key === "demo" ? "DEMO-QA" : status === "PENDING" ? "__KSPAY_PROCESSING__" : "QA-SYNTHETIC",
      cardName: key === "demo" ? "QA (수기결제 시연)" : "QA카드", pgTrno: key === "demo" || status === "PENDING" ? null : `QA-SYNTH-${key}`,
      paidAt: status === "PENDING" ? null : new Date(), receiverName: "QA수령인", receiverPhone: "01000000000", address: "서울특별시 테스트구 테스트로 1",
      items: { create: { id: `${id}-item`, productId: product.id, name: product.name, price: product.price, qty: 1, size: "M" } },
    }, include: { items: true } });
    if (mode) await db.shopShipment.create({ data: {
      id: `${id}-shipment`, orderId: id, userId: users[owner].id, carrier: "CJ", trackingNumber: "111122223333", status: mode,
      shippedAt: new Date(Date.now() - 86400000), deliveredAt: mode === "DELIVERED" ? new Date() : null,
      events: { create: { actorUserId: users.admin.id, action: mode, carrier: "CJ", trackingNumber: "111122223333", note: "격리 QA 합성 배송 이력" } },
    } });
    orders[key] = { id, itemId: order.items[0].id, moid: order.moid };
  }
  const cookies = {};
  for (const [key, user] of Object.entries(users)) {
    cookies[key] = await sealData({ userId: user.id, email: user.email, name: user.name, credentialTag: createSessionCredentialTag(user, state.secret) }, { password: state.secret, ttl: 3600 });
  }
  state.fixtures = { productId: product.id, productName: product.name, users: Object.fromEntries(Object.entries(users).map(([key,u]) => [key, u.id])), orders, cookies };
  writeFileSync(statePath, JSON.stringify(state));
  console.log(JSON.stringify({ fixtures: "created", users: 3, orders: 7, shipments: 5, database: "disposable-loopback-only" }));
} finally { await db.$disconnect(); }
