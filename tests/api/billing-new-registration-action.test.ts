import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute the production Server Action with isolated DB/HTTP boundaries. No env,
// production DB, credentials, card data or external provider are used.
const compiled = ts.transpileModule(
  readFileSync(resolve("app/mypage/settings/billing/actions.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const nativeRequire = createRequire(import.meta.url);
type Row = {
  id: string; userId: string; status: string; paymentMethodId: string | null;
  laonpayRegistrationId: string | null; requestFingerprint: string;
  requestAttempts: number; idempotencyKey: string; createdAt: Date; updatedAt: Date;
  expiresAt: Date | null;
};
type Options = { feature?: boolean; localStatus?: string; remoteStatus?: string;
  remoteFailure?: boolean; remoteWrongId?: boolean; remoteMethod?: boolean;
  denied?: boolean; lostCreate?: boolean; remoteMutation?: string;
  otherPending?: boolean; foreignOwner?: boolean; wrongFingerprint?: boolean };
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return (value as Record<string, unknown>[]).some(w => matches(row, w));
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const rule = value as { in?: unknown[]; not?: unknown };
      if (rule.in) return rule.in.includes(row[key]);
      if ("not" in rule) return row[key] !== rule.not;
    }
    return row[key] === value;
  });
}
function harness(options: Options = {}) {
  const previous: Row = {
    id: "old_local_001", userId: options.foreignOwner ? "other_user" : "shop_user_001",
    status: options.localStatus ?? "UNKNOWN", paymentMethodId: null,
    laonpayRegistrationId: "old_remote_001", requestFingerprint: options.wrongFingerprint ? "wrong" : "fingerprint",
    requestAttempts: 1, idempotencyKey: "old-key", createdAt: new Date(1), updatedAt: new Date(1), expiresAt: new Date(2),
  };
  const rows: Row[] = [previous];
  if (options.otherPending) rows.push({ ...previous, id: "pending_local_001", status: "PROCESSING", createdAt: new Date(0) });
  const original = JSON.stringify(previous);
  const calls: Array<{ customer: string; key: string }> = [];
  const cookies: unknown[] = [];
  let getCalls = 0;
  let lock = Promise.resolve();
  const registrations = {
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const candidates = rows.filter(row => matches(row, where));
      if (orderBy) candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return candidates[0] ? { ...candidates[0] } : null;
    },
    async findUnique({ where }: { where: { id: string } }) { return { ...rows.find(row => row.id === where.id)! }; },
    async create({ data }: { data: Partial<Row> }) {
      const row = { ...previous, ...data, id: `new_local_${rows.length}`, requestAttempts: 0,
        laonpayRegistrationId: null, createdAt: new Date(), updatedAt: new Date() };
      rows.push(row); return { ...row };
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = rows.find(r => r.id === where.id)!;
      for (const [key, value] of Object.entries(data)) {
        if (key === "requestAttempts" && typeof value === "object") row.requestAttempts += (value as {increment: number}).increment;
        else Object.assign(row, { [key]: value });
      }
      return { ...row };
    },
  };
  const tx = { shopBillingRegistration: registrations, shopUser: { async findFirst() { return { id: "shop_user_001" }; } } };
  const prisma = { ...tx, async $transaction<T>(fn: (t: typeof tx) => Promise<T>): Promise<T> {
    const prior = lock; let unlock!: () => void;
    lock = new Promise<void>(resolve => { unlock = resolve; });
    await prior; try { return await fn(tx); } finally { unlock(); }
  } };
  const client = {
    async getRegistrationIntent(id: string) {
      getCalls++;
      if (options.remoteMutation) previous.status = options.remoteMutation;
      await Promise.resolve();
      if (options.remoteFailure) return { ok: false, outcome: "UNKNOWN" };
      return { ok: true, data: { registrationId: options.remoteWrongId ? "different_remote" : id,
        status: options.remoteStatus ?? "UNKNOWN", paymentMethod: options.remoteMethod ? { id: "method_001" } : null,
        expiresAt: new Date().toISOString() } };
    },
    async createRegistrationIntent(customer: string, key: string) {
      calls.push({ customer, key });
      if (options.denied) return { ok: false, outcome: "REJECTED", httpStatus: 409, errorCode: "REGISTRATION_UNRESOLVED" };
      if (options.lostCreate) return { ok: false, outcome: "UNKNOWN" };
      return { ok: true, data: { registrationId: "new_remote_001", status: "PENDING",
        expiresAt: new Date(Date.now() + 600_000).toISOString(), hostedUrl: "https://pay.example.test/billing/register/synthetic" } };
    },
  };
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({ set: (...args: unknown[]) => cookies.push(args) }) },
    "next/navigation": { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } },
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/auth": { requireShopUser: async () => ({ id: "shop_user_001", email: "synthetic@example.test" }) },
    "@/lib/db": { prisma },
    "@/lib/order-guard": { acquireTransactionLock: async () => undefined },
    "@/lib/laonpay/billing-client": { createLaonpayBillingClient: () => client, BILLING_SETTINGS_RETURN_URL: "/mypage/settings/billing/return" },
    "@/lib/laonpay/billing-ledger": { upsertOwnedBillingPaymentMethod: () => { throw new Error("unexpected method write"); } },
    "@/lib/laonpay/billing-policy": {
      billingRequestFingerprint: () => "fingerprint", BILLING_REGISTRATION_COOKIE: "synthetic_registration",
      isBillingIntegrationEnabled: () => options.feature !== false, isBillingReconciliationEnabled: () => true,
      mergeRegistrationStatus: (local: string, remote: string) => ["SUCCEEDED", "DECLINED", "EXPIRED"].includes(local) ? local : remote,
    },
  };
  const exports: { startBillingRegistrationAction?: (state: object, data: FormData) => Promise<{error?: string}> } = {};
  runInNewContext(compiled, { exports, require: (name: string) => name in dependencies ? dependencies[name] : nativeRequire(name),
    process: { env: { NODE_ENV: "test" } }, Date, FormData, console });
  const run = (explicit = true, id = previous.id) => {
    const form = new FormData(); if (explicit) form.set("newRegistrationAfter", id);
    return exports.startBillingRegistrationAction!({}, form);
  };
  return { run, rows, previous, original, calls, cookies, getCalls: () => getCalls };
}

test("같은 계정의 이전 미상 원장은 보존하고 명시적 새 등록을 hosted 화면으로 연결한다", async () => {
  const h = harness();
  await assert.rejects(h.run(), /REDIRECT:https:\/\/pay.example.test\/billing\/register/);
  assert.equal(JSON.stringify(h.previous), h.original);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].customer, "shop_user_001");
  assert.notEqual(h.calls[0].key, "old-key"); assert.equal(h.rows[1].status, "PENDING");
  assert.equal(h.rows[1].laonpayRegistrationId, "new_remote_001"); assert.equal(h.cookies.length, 1);
});

test("기존 이어서 확인 버튼은 새 요청을 자동 생성하지 않는다", async () => {
  const h = harness(); const result = await h.run(false);
  assert.ok(result.error); assert.equal(h.calls.length, 0); assert.equal(h.rows.length, 1);
});

for (const [name, options] of Object.entries({
  "기능 OFF": { feature: false }, "다른 계정": { foreignOwner: true }, "요청 본문 불일치": { wrongFingerprint: true },
  "원격 조회 실패": { remoteFailure: true }, "원격 ID 불일치": { remoteWrongId: true },
  "원격 등록 진행 중": { remoteStatus: "PROCESSING" }, "원격 성공": { remoteStatus: "SUCCEEDED" },
  "원격 카드 존재": { remoteMethod: true }, "조회 도중 로컬 변경": { remoteMutation: "PROCESSING" },
  "다른 요청 진행 중": { otherPending: true }, "로컬 진행 중": { localStatus: "PROCESSING" },
})) {
  test(`새 등록 거절: ${name}`, async () => {
    const h = harness(options); assert.ok((await h.run()).error);
    assert.equal(h.calls.length, 0); assert.equal(h.cookies.length, 0);
  });
}

test("동시 두 요청은 새 등록 한 건만 만들고 나머지는 상태 확인으로 돌린다", async () => {
  const h = harness(); const result = await Promise.allSettled([h.run(), h.run()]);
  assert.equal(h.calls.length, 1); assert.equal(h.rows.length, 2);
  assert.equal(result.filter(r => r.status === "rejected").length, 1);
  assert.equal(JSON.stringify(h.previous), h.original);
});

test("LAONPAY의 미확정 차단을 존중하고 거절된 로컬 시작만 종료한다", async () => {
  const h = harness({ denied: true }); const result = await h.run();
  assert.match(result.error ?? "", /새 등록을 허용하지/);
  assert.equal(h.calls.length, 1); assert.equal(h.rows[1].status, "DECLINED");
  assert.equal(h.rows[1].laonpayRegistrationId, null); assert.equal(h.cookies.length, 0);
  assert.equal(JSON.stringify(h.previous), h.original);
});

test("새 intent 응답 유실은 같은 멱등키 한 번 대사 후 UNKNOWN을 유지한다", async () => {
  const h = harness({ lostCreate: true }); assert.ok((await h.run()).error);
  assert.equal(h.calls.length, 2); assert.equal(h.calls[0].key, h.calls[1].key);
  assert.equal(h.rows[1].status, "UNKNOWN"); assert.equal(h.cookies.length, 0);
  assert.equal(JSON.stringify(h.previous), h.original);
});

test("조작한 새 등록 ID는 원격 조회 전에 거절한다", async () => {
  const h = harness(); assert.ok((await h.run(true, "../other")).error);
  assert.equal(h.getCalls(), 0); assert.equal(h.calls.length, 0);
});
