import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  auditEntryPaths, auditScopePaths, cleanSourceRef, cloudflareResult, cloudflareRevision,
  dynamicRoles, independentReviewResult, pentagiResult, pentagiVersion, readEvidenceFile,
} from "../../scripts/qa/security.mjs";
import { cleanEnvironment } from "../../scripts/qa/runner-support.mjs";

const sourceRef = "1".repeat(40);
const pentagi = () => ({
  source_ref: sourceRef, version: pentagiVersion, target: "laonshop-isolated", isolation: "private-vm",
  flows: dynamicRoles.map((app, index) => ({ app, id: String(index + 1), status: "completed", observed_requests: 3,
    observed_requests_by_method: { GET: 2, POST: 1 }, report_sha256: "1".repeat(64), confirmed_high_critical: 0, unresolved: 0 })),
});
const meta = () => ({ source_ref: sourceRef, skill_revision: cloudflareRevision, profile: "deep", run_status: "complete", scope_paths: ["."], execution_policy: "sandboxed-source-and-local-only" });
const ledger = () => [{ status: "covered", result_fingerprints: [], reviewed_paths: ["app/api/example/route.ts"] }];
const requiredArtifacts = ["pentagi/run.json", "cloudflare/findings.json"];
const review = () => ({ source_ref: sourceRef, status: "complete", independent: true, reviewer: "independent-reviewer", operator: "scan-operator", report_sha256: "2".repeat(64), confirmed_high_critical: 0, unresolved: 0, artifacts: requiredArtifacts.map((file) => ({ path: file, sha256: "3".repeat(64) })) });

test("진입점·전체 감사 인벤토리는 라온샵 API·Server Action·설정·라이브러리·SQL을 포함한다", () => {
  const entries = auditEntryPaths();
  for (const file of ["middleware.ts", "app/api/pg/kspay/callback/route.ts", "app/api/pg/kspay/result/route.ts", "app/reviews/actions.ts", "app/admin/shipping-actions.ts"]) assert.ok(entries.includes(file), file);
  const scope = auditScopePaths();
  for (const file of ["next.config.ts", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".env.example", "vercel.json", "lib/auth.ts", "lib/commerce/mutations.ts", "components/product-reviews.tsx", "ops/storefront/001_additive.sql"]) assert.ok(scope.includes(file), file);
  assert.ok(!scope.some((file) => file.startsWith("tests/reports/") || file.startsWith(".codex-attachments/")));
});

test("선택 전체 감사는 workspace·npm/env 예시·배포 설정 하나라도 누락되면 BLOCKED다", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-scope-config-test-"));
  const configurations = [
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc", ".env.example", "vercel.json", ".dockerignore", ".nvmrc",
    "packages/client/package.json", "packages/client/.npmrc", "packages/client/.env.production.example",
    "deploy/Dockerfile.production", "deploy/compose.yaml", "deploy/nginx.conf", "deploy/hosting.toml", ".github/workflows/check.yml",
  ];
  const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: directory, env: { ...cleanEnvironment(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" }, stdio: "ignore" });
  try {
    git("init", "-q");
    for (const file of [...configurations, "tests/reports/old-result.json"]) {
      fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      fs.writeFileSync(path.join(directory, file), "synthetic configuration fixture\n");
    }
    git("add", ".");
    const scope = auditScopePaths(directory);
    assert.deepEqual(scope, [...configurations].sort());
    const complete = [{ status: "covered", result_fingerprints: [], reviewed_paths: scope }];
    assert.equal(cloudflareResult(meta(), complete, [], sourceRef, scope).status, "pass");
    for (const omitted of configurations) {
      const partial = [{ status: "covered", result_fingerprints: [], reviewed_paths: scope.filter((file) => file !== omitted) }];
      assert.equal(cloudflareResult(meta(), partial, [], sourceRef, scope).status, "blocked", omitted);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("PentAGI는 현재 SHA의 라온샵 공개·구매자·관리자 완료 흐름을 요구한다", () => {
  assert.equal(pentagiResult(pentagi(), sourceRef).status, "pass");
  for (const changed of [
    { source_ref: "2".repeat(40) }, { version: "old" }, { target: "laonpay-isolated" }, { target: "fixture" }, { isolation: "host" }, { flows: [] },
  ]) assert.equal(pentagiResult({ ...pentagi(), ...changed }, sourceRef).status, "blocked");
  const duplicate = pentagi(); duplicate.flows[1].id = duplicate.flows[0].id;
  assert.equal(pentagiResult(duplicate, sourceRef).status, "blocked");
});

test("동적 완료 문자열만으로 통과하지 않고 실제 GET/POST 및 합계와 보고서 hash를 검사한다", () => {
  for (const change of [
    { observed_requests: 0 }, { status: "running" }, { report_sha256: "invalid" },
    { observed_requests_by_method: { GET: 3, POST: 0 } },
    { observed_requests_by_method: { GET: 1, POST: 1 } },
    { observed_requests_by_method: { GET: 2, POST: 1, DELETE: -1 } },
  ]) {
    const receipt = pentagi(); Object.assign(receipt.flows[0], change);
    assert.equal(pentagiResult(receipt, sourceRef).status, "blocked");
  }
});

test("동적 감사의 확인 고위험과 미검증 후보는 FAIL과 BLOCKED로 구분한다", () => {
  const receipt = pentagi(); receipt.flows[0].unresolved = 1;
  assert.equal(pentagiResult(receipt, sourceRef).status, "blocked");
  receipt.flows[1].confirmed_high_critical = 1;
  assert.equal(pentagiResult(receipt, sourceRef).status, "fail");
});

test("소스 감사는 같은 SHA·공식 리비전·전체 deep 범위·실행 제한을 요구한다", () => {
  assert.equal(cloudflareResult(meta(), ledger(), [], sourceRef, ["app/api/example/route.ts"]).status, "pass");
  for (const changed of [{ source_ref: "2".repeat(40) }, { skill_revision: "old" }, { profile: "quick" }, { run_status: "partial" }, { execution_policy: "unrestricted" }, { scope_paths: ["app"] }])
    assert.equal(cloudflareResult({ ...meta(), ...changed }, ledger(), [], sourceRef).status, "blocked");
  assert.equal(cloudflareResult(meta(), ledger(), [], sourceRef, ["lib/auth.ts"]).status, "blocked");
});

test("원장의 미조사·후보 누락·잘못된 형식은 전체 PASS가 아니다", () => {
  for (const value of [[], null, [{ status: "blocked", result_fingerprints: [], reviewed_paths: [] }], [{ status: "not_applicable", result_fingerprints: [], starting_paths: [] }]])
    assert.equal(cloudflareResult(meta(), value, [], sourceRef).status, "blocked");
  const candidate = [{ status: "candidate", result_fingerprints: ["finding"], reviewed_paths: [] }];
  assert.equal(cloudflareResult(meta(), candidate, [], sourceRef).status, "blocked");
  assert.equal(cloudflareResult(meta(), candidate, [{ fingerprint: "finding", verdict: "needs_validation" }], sourceRef).status, "blocked");
  assert.equal(cloudflareResult(meta(), candidate, [{ fingerprint: "finding", verdict: "confirmed", severity: { overall_severity: "high" } }], sourceRef).status, "fail");
});

test("독립 검토는 별도 검토자·현재 SHA·보고서·산출물 지문을 모두 연결한다", () => {
  assert.equal(independentReviewResult(review(), sourceRef, requiredArtifacts).status, "pass");
  for (const changed of [{ source_ref: "2".repeat(40) }, { independent: false }, { reviewer: "scan-operator" }, { reviewer: " SCAN-OPERATOR " }, { reviewer: "" }, { report_sha256: "missing" }, { artifacts: [] }, { unresolved: 1 }, { confirmed_high_critical: undefined }])
    assert.equal(independentReviewResult({ ...review(), ...changed }, sourceRef, requiredArtifacts).status, "blocked");
  assert.equal(independentReviewResult({ ...review(), confirmed_high_critical: 1 }, sourceRef, requiredArtifacts).status, "fail");
  const duplicate = review(); duplicate.artifacts.push(duplicate.artifacts[0]);
  assert.equal(independentReviewResult(duplicate, sourceRef, requiredArtifacts).status, "blocked");
});

test("증거는 일반 파일만 읽으며 symlink·경로 이탈·비어 있거나 과대한 파일을 거절한다", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-evidence-test-"));
  try {
    fs.writeFileSync(path.join(directory, "valid.json"), "{}");
    fs.writeFileSync(path.join(directory, "empty.json"), "");
    fs.symlinkSync(path.join(directory, "valid.json"), path.join(directory, "link.json"));
    assert.equal(readEvidenceFile(directory, "valid.json").toString(), "{}");
    for (const name of ["empty.json", "link.json", "../escape.json"]) assert.throws(() => readEvidenceFile(directory, name));
    assert.throws(() => readEvidenceFile(directory, "valid.json", 1));
    assert.throws(() => readEvidenceFile(directory, "."));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("clean source는 첨부·ignored generated만 분리하고 staged/unstaged/untracked 소스를 차단한다", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-git-state-test-"));
  const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], { cwd: directory, env: { ...cleanEnvironment(), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" }, stdio: "ignore" });
  try {
    git("init", "-q"); git("config", "user.email", "qa@example.test"); git("config", "user.name", "QA");
    fs.writeFileSync(path.join(directory, ".gitignore"), "tests/.generated/\n"); fs.writeFileSync(path.join(directory, "source.ts"), "export const example = 1;\n");
    git("add", "."); git("commit", "-qm", "fixture");
    const original = cleanSourceRef(directory); assert.match(original, /^[a-f0-9]{40}$/);
    fs.mkdirSync(path.join(directory, ".codex-attachments")); fs.writeFileSync(path.join(directory, ".codex-attachments/user.txt"), "preserved");
    fs.mkdirSync(path.join(directory, "tests/.generated"), { recursive: true }); fs.writeFileSync(path.join(directory, "tests/.generated/result.json"), "{}");
    assert.equal(cleanSourceRef(directory), original);
    fs.writeFileSync(path.join(directory, "source.ts"), "export const example = 2;\n"); assert.throws(() => cleanSourceRef(directory));
    git("add", "source.ts"); assert.throws(() => cleanSourceRef(directory));
    git("commit", "-qm", "next"); assert.match(cleanSourceRef(directory), /^[a-f0-9]{40}$/);
    fs.writeFileSync(path.join(directory, "new-source.ts"), "export {};\n"); assert.throws(() => cleanSourceRef(directory));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("QA 환경 허용 목록은 운영 DB·세션·키·PG·NODE_OPTIONS를 전달하지 않는다", () => {
  const env = cleanEnvironment({ PATH: "/example/bin", DATABASE_URL: "synthetic-not-a-real-url", DIRECT_URL: "synthetic", SESSION_SECRET: "synthetic", KSPAY_API_KEY: "synthetic", LAONPAY_PARTNER_PRIVATE_KEY: "synthetic", NODE_OPTIONS: "--require unwanted", QA_POSTGRES_BIN: "/example/postgres" });
  assert.equal(env.PATH, "/example/bin"); assert.equal(env.QA_POSTGRES_BIN, "/example/postgres");
  for (const key of ["DATABASE_URL", "DIRECT_URL", "SESSION_SECRET", "KSPAY_API_KEY", "LAONPAY_PARTNER_PRIVATE_KEY", "NODE_OPTIONS"]) assert.equal(key in env, false, key);
});

test("단독 추가 감사 CLI는 증거 없음을 실제 BLOCKED exit2로 표시한다", () => {
  const checked = spawnSync(process.execPath, ["scripts/qa/security.mjs"], { cwd: path.resolve(import.meta.dirname, "../.."), env: cleanEnvironment(), encoding: "utf8" });
  assert.equal(checked.status, 2);
  const result = JSON.parse(checked.stdout);
  assert.equal(result.status, "BLOCKED"); assert.equal(result.success, false); assert.equal(result.stages.evidence.status, "blocked");
});
