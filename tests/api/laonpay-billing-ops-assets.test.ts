import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  evaluateLaonpayBillingReadiness,
  formatLaonpayBillingReadiness,
  runLaonpayBillingReadinessCli,
  type BillingReadinessEnv,
} from "../../scripts/check-laonpay-billing-readiness";

const ROOT = process.cwd();
const ADDITIVE_SQL = path.join(
  ROOT,
  "ops/laonpay-billing/sql/001_additive.sql",
);
const POST_VERIFY_SQL = path.join(
  ROOT,
  "ops/laonpay-billing/sql/002_post_verify.sql",
);
const RUNBOOK = path.join(ROOT, "docs/runbooks/laonpay-billing-rollout.md");

function readyEnv(): BillingReadinessEnv {
  const { privateKey } = generateKeyPairSync("ed25519");
  return {
    VERCEL_ENV: "production",
    SHOP_APP_URL: "https://laonshop.com",
    LAONPAY_BILLING_API_BASE: "https://pay.laonpay.com",
    LAONPAY_PARTNER_KEY_ID: "laonshop-key-v1",
    LAONPAY_PARTNER_PRIVATE_KEY: privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString(),
    LAONPAY_BILLING_SCHEMA_READY: "1",
    LAONPAY_BILLING_FEATURE_ENABLED: "1",
  };
}

test("readiness 검사는 값 노출 없이 이중 게이트와 계약 origin을 확인한다", () => {
  const env = readyEnv();
  const report = evaluateLaonpayBillingReadiness(env);
  const output = formatLaonpayBillingReadiness(report);

  assert.equal(report.status, "READY");
  assert.equal(report.checks.length, 7);
  assert.doesNotMatch(output, /BEGIN PRIVATE KEY/);
  assert.doesNotMatch(output, /laonshop-key-v1/);
  assert.doesNotMatch(output, /pay\.laonpay\.com/);
  assert.doesNotMatch(output, /https:\/\/laonshop\.com/);
  assert.match(output, /LAONPAY_BILLING_SCHEMA_READY/);
  assert.match(output, /LAONPAY_BILLING_FEATURE_ENABLED/);

  const wrongOrigin = evaluateLaonpayBillingReadiness({
    ...env,
    LAONPAY_BILLING_API_BASE: "https://pay.laonpay.com/partner",
  });
  assert.equal(wrongOrigin.status, "INVALID");
});

test("CLI는 closed를 기본 실패로 처리하고 allow-closed에서만 허용한다", () => {
  let output = "";
  const write = (message: string) => {
    output += message;
  };

  assert.equal(runLaonpayBillingReadinessCli([], {}, write), 1);
  assert.match(output, /readiness: CLOSED/);

  output = "";
  assert.equal(
    runLaonpayBillingReadinessCli(["--allow-closed"], {}, write),
    0,
  );
  assert.match(output, /readiness: CLOSED/);

  output = "";
  assert.equal(
    runLaonpayBillingReadinessCli(
      ["--allow-closed"],
      { LAONPAY_BILLING_SCHEMA_READY: "yes" },
      write,
    ),
    1,
  );
  assert.match(output, /readiness: INVALID/);

  output = "";
  assert.equal(
    runLaonpayBillingReadinessCli(
      ["--allow-closed"],
      { LAONPAY_BILLING_FEATURE_ENABLED: "1" },
      write,
    ),
    1,
  );
  assert.match(output, /LAONPAY_BILLING_GATE_ORDER/);
  assert.match(output, /readiness: INVALID/);
});

test("additive SQL은 원장·소유권·provider ID unique만 추가하고 파괴 작업을 하지 않는다", async () => {
  const sql = await readFile(ADDITIVE_SQL, "utf8");

  for (const table of [
    "ShopBillingPaymentMethod",
    "ShopBillingRegistration",
    "ShopBillingCharge",
    "ShopBillingCancelRequest",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
  }
  assert.match(sql, /ShopBillingCharge_providerPaymentId_key/);
  assert.match(sql, /ShopOrder_id_userId_key/);
  assert.match(sql, /ShopBillingPaymentMethod_id_userId_key/);
  assert.match(sql, /ShopBillingCharge_id_userId_key/);
  assert.match(sql, /ShopBillingCharge_orderId_userId_key/);
  assert.match(sql, /ShopBillingCancelRequest_chargeId_userId_key/);
  assert.match(sql, /ShopBillingCharge_orderId_userId_fkey/);
  assert.match(sql, /ShopBillingCancelRequest_chargeId_userId_fkey/);
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE)\b/im);
  assert.doesNotMatch(sql, /ShopBillingCard"\s+(?:DROP|ALTER)/i);
});

test("post-verify는 read-only metadata로 enum·컬럼·index·FK를 검증한다", async () => {
  const sql = await readFile(POST_VERIFY_SQL, "utf8");

  assert.match(sql, /BEGIN TRANSACTION READ ONLY/);
  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /column_default/);
  assert.match(sql, /prohibited sensitive column detected/);
  assert.match(sql, /unexpected column detected/);
  assert.match(sql, /billingtoken/);
  assert.match(sql, /pg_enum/);
  assert.match(sql, /pg_index/);
  assert.match(sql, /pg_constraint/);
  assert.match(sql, /ShopBillingCharge_providerPaymentId_key/);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.doesNotMatch(sql, /SELECT\s+\*\s+FROM\s+"ShopBilling/i);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/i);
});

test("런북은 baseline부터 이중 게이트와 비파괴 rollback까지 순서를 고정한다", async () => {
  const runbook = await readFile(RUNBOOK, "utf8");
  const baseline = runbook.indexOf("baseline resolve");
  const additive = runbook.indexOf("## 2. additive schema 적용");
  const verify = runbook.indexOf("## 3. read-only post-verify");
  const schemaGate = runbook.indexOf("## 4. schema gate만 열어 배포");
  const featureGate = runbook.indexOf("## 5. 격리 상호운용과 feature gate");

  assert.ok(baseline >= 0);
  assert.ok(baseline < additive);
  assert.ok(additive < verify);
  assert.ok(verify < schemaGate);
  assert.ok(schemaGate < featureGate);
  assert.match(runbook, /feature gate를 내려도[\s\S]*signed GET 대사는 유지/);
  assert.match(runbook, /pnpm billing:preflight --allow-closed/);
  assert.doesNotMatch(runbook, /pnpm billing:preflight -- --allow-closed/);
  assert.match(runbook, /mktemp \/private\/tmp\/laonshop-billing-production/);
  assert.match(runbook, /trap 'rm -f "\$tmp_env"' EXIT HUP INT TERM/);
  assert.match(runbook, /운영 seed는 실행하지 않습니다/);
  assert.match(runbook, /legacy token 정리: 별도 HOLD/);
  assert.match(runbook, /자동 down migration은 없습니다/);
});
