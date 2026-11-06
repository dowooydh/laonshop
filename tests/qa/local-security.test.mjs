import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { aggregateStatus, createAuditSnapshot, inventorySource, runLocalSecurity, scanTextSecrets, summarizePnpmAudit, summarizeSecretProbe, summarizeTrivy } from "../../scripts/qa/local-security.mjs";

const checkedAt = "2026-11-06T00:00:00.000Z";
const cleanAudit = () => ({ advisories: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: 10, devDependencies: 20, optionalDependencies: 3, totalDependencies: 33 } });
const advisory = severity => ({ module_name: "fixture-package", severity, vulnerable_versions: "<2", patched_versions: ">=2", url: "https://github.com/advisories/GHSA-abcd-1234-efgh", findings: [{ version: "1", dev: true }] });
const version = "Version: 0.74.0\nVulnerability DB:\n  UpdatedAt: 2026-11-06 00:00:00 +0000 UTC";
const trivy = () => ({ Results: [{ Target: "pnpm-lock.yaml", Packages: [{ Name: "fixture-package", Version: "1" }] }] });

test("실제 secret 양성 canary를 탐지하지 못한 엔진은 source finding0이어도 BLOCKED다", () => {
  const positive = { Results: [{ Secrets: [{ RuleID: "github-pat", Match: "must-not-be-retained" }] }] };
  assert.equal(summarizeSecretProbe(positive, 1).status, "PASS");
  for (const [raw, code] of [[{ Results: [] }, 0], [positive, 0], [null, 1], [{ Results: [{ Secrets: [{ RuleID: "other" }] }] }, 1]])
    assert.equal(summarizeSecretProbe(raw, code).status, "BLOCKED");
  assert.ok(!JSON.stringify(summarizeSecretProbe(positive, 1)).includes("must-not-be-retained"));
});

test("registry audit는 project npmrc·pnpmfile·scripts·package 감사 제외 설정을 반입하지 않는다", () => {
  const root = mkdtempSync(join(tmpdir(), "laonshop-audit-input-"));
  try {
    const files = [
      { file: "package.json", text: JSON.stringify({ dependencies: { example: "1.0.0" }, scripts: { postinstall: "must-not-run" }, pnpm: { auditConfig: { ignoreGhsas: ["fixture"] } } }) },
      { file: "pnpm-lock.yaml", text: "lockfileVersion: '9.0'" },
      { file: "pnpm-workspace.yaml", text: "overrides: {}" },
      { file: ".npmrc", text: "audit-level=critical" },
      { file: ".pnpmfile.cjs", text: "throw Error('must-not-load')" },
    ];
    const input = createAuditSnapshot(files, join(root, "input"));
    assert.deepEqual(readdirSync(input).sort(), ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]);
    const manifest = JSON.parse(readFileSync(join(input, "package.json")));
    assert.deepEqual(manifest.dependencies, { example: "1.0.0" });
    assert.equal(manifest.scripts, undefined); assert.equal(manifest.pnpm, undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("비밀 탐지는 실제 값이나 주변 원문을 결과에 보존하지 않는다", () => {
  const password = ["not", "a", "real", "credential", "fixture"].join("-");
  const protocol = ["postgre", "sql"].join("");
  const text = `line one\nconst url = "${protocol}://fixture:${password}@example.invalid/db";`;
  const result = scanTextSecrets(text, "lib/example.ts");
  assert.deepEqual(result, [{ file: "lib/example.ts", rule: "credential-url", line: 2 }]);
  assert.ok(!JSON.stringify(result).includes(password));
  assert.ok(!JSON.stringify(result).includes("example.invalid"));
});

test("암호 없는 QA 연결과 키 생성 코드 자체를 실제 키로 오인하지 않는다", () => {
  assert.deepEqual(scanTextSecrets('const u = "postgresql://qa_owner@127.0.0.1/laonshop_qa"; generateKeyPairSync("ed25519");', "tests/fixture.mjs"), []);
});

test("개인키와 provider형 토큰은 위치·유형으로만 기록한다", () => {
  const begin = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  const end = ["-----END", "PRIVATE KEY-----"].join(" ");
  const value = "A".repeat(80);
  const token = ["sk", "live", "x".repeat(30)].join("_");
  const result = scanTextSecrets(`${begin}\n${value}\n${end}\n${token}`, "example.txt");
  assert.deepEqual(result.map(item => item.rule), ["private-key", "live-payment-key"]);
  assert.ok(!JSON.stringify(result).includes(value));
  assert.ok(!JSON.stringify(result).includes(token));
});

test("진입점·민감 연산 목록은 검토 후보이며 취약점 완료 판정을 만들지 않는다", () => {
  const result = inventorySource([
    { file: "app/api/example/route.ts", text: "export async function POST() { return fetch(url); }" },
    { file: "app/order/actions.ts", text: '"use server";\nexport async function saveOrder() { return db.$queryRawUnsafe(sql); }' },
    { file: "middleware.ts", text: "export function middleware() { return NextResponse.redirect(url); }" },
  ]);
  assert.equal(result.entries.length, 3);
  assert.deepEqual(result.entries[0].exports, ["POST"]);
  assert.deepEqual(result.reviewTargets.map(item => item.rule), ["external-fetch", "raw-sql", "redirect"]);
  assert.match(result.scope, /not confirmed vulnerabilities/);
  assert.equal(result.success, undefined);
});

test("pnpm 결과는 개발·선택 의존성 범위와 조회 시각을 명시한다", () => {
  const result = summarizePnpmAudit(cleanAudit(), 0, checkedAt);
  assert.equal(result.status, "PASS");
  assert.equal(result.includeDevDependencies, true);
  assert.equal(result.packageCounts.development, 20);
  assert.equal(result.packageCounts.optional, 3);
  assert.equal(result.databaseUpdatedAt, null);
  assert.equal(result.checkedAt, checkedAt);
  assert.ok(!result.arguments.includes("--prod"));
  assert.ok(!result.arguments.includes("--ignore-registry-errors"));
});

for (const severity of ["low", "moderate", "high", "critical"]) test(`pnpm ${severity} 후보는 실패로 유지한다`, () => {
  const input = cleanAudit(); input.advisories.a = advisory(severity); input.metadata.vulnerabilities[severity] = 1;
  const result = summarizePnpmAudit(input, 1, checkedAt);
  assert.equal(result.status, "FAIL"); assert.equal(result.advisories.length, 1); assert.equal(result.advisories[0].devOnly, true);
});

for (const [name, input, code] of [["네트워크 오류", null, 2], ["잘못된 JSON 스키마", {}, 0], ["범위 없는 결과", { advisories: {}, metadata: { totalDependencies: 0 } }, 0]]) test(`pnpm ${name}를 0건으로 처리하지 않는다`, () => {
  assert.equal(summarizePnpmAudit(input, code, checkedAt).status, "BLOCKED");
});

test("pnpm 탐지가 있는데 종료코드0이거나 advisory URL에 자격정보가 있으면 차단한다", () => {
  const input = cleanAudit(); input.advisories.a = advisory("high"); input.metadata.vulnerabilities.high = 1;
  assert.equal(summarizePnpmAudit(input, 0, checkedAt).status, "BLOCKED");
  input.advisories.a.url = ["https://user:", "fixture", "@github.com/advisories/GHSA-abcd-1234-efgh"].join("");
  const result = summarizePnpmAudit(input, 1, checkedAt);
  assert.equal(result.status, "BLOCKED"); assert.ok(!JSON.stringify(result).includes("fixture@"));
});

test("Trivy에는 개발 의존성·미수정 취약점 포함과 DB/도구 시각이 필요하다", () => {
  const result = summarizeTrivy(trivy(), 0, checkedAt, version);
  assert.equal(result.status, "PASS"); assert.equal(result.packageCount, 1); assert.equal(result.includeDevDependencies, true); assert.equal(result.includeUnfixed, true);
  assert.equal(summarizeTrivy(trivy(), 0, checkedAt, "").status, "BLOCKED");
  assert.equal(summarizeTrivy({ Results: [] }, 0, checkedAt, version).status, "BLOCKED");
});

test("Trivy 비밀 원문과 코드 스니펫은 출력 증거에서 제거한다", () => {
  const input = trivy();
  input.Results[0].Secrets = [{ RuleID: "fixture", Severity: "HIGH", StartLine: 4, EndLine: 4, Match: "must-never-be-emitted", Code: { Lines: [{ Content: "private-fixture-contents" }] } }];
  const result = summarizeTrivy(input, 1, checkedAt, version);
  assert.equal(result.status, "FAIL"); assert.equal(result.secrets[0].line, 4);
  assert.ok(!JSON.stringify(result).includes("must-never-be-emitted")); assert.ok(!JSON.stringify(result).includes("private-fixture-contents"));
  assert.equal(summarizeTrivy(input, 0, checkedAt, version).status, "BLOCKED");
});

test("Trivy 낮은 심각도도 무시하지 않으며 실행 오류는 차단한다", () => {
  const input = trivy(); input.Results[0].Vulnerabilities = [{ PkgName: "fixture-package", InstalledVersion: "1", FixedVersion: "2", Severity: "LOW", VulnerabilityID: "CVE-fixture", PrimaryURL: "https://avd.aquasec.com/nvd/cve-fixture" }];
  assert.equal(summarizeTrivy(input, 1, checkedAt, version).status, "FAIL");
  assert.equal(summarizeTrivy(input, null, checkedAt, version).status, "BLOCKED");
});

test("BLOCKED·실패·소스 변경·사용자 중단은 PASS로 합산되지 않는다", () => {
  assert.equal(aggregateStatus([{ status: "PASS" }]), "PASS");
  assert.equal(aggregateStatus([{ status: "PASS" }, { status: "BLOCKED" }]), "BLOCKED");
  assert.equal(aggregateStatus([{ status: "PASS" }], { sourceChanged: true }), "BLOCKED");
  assert.equal(aggregateStatus([{ status: "FAIL" }]), "FAIL");
  assert.equal(aggregateStatus([{ status: "FAIL" }], { interrupted: true }), "INTERRUPTED");
});

test("Git 소스 확인 실패도 별도 BLOCKED 보고서를 남긴다", async () => {
  const output = mkdtempSync(join(tmpdir(), "laonshop-local-security-unit-"));
  try {
    const result = await runLocalSecurity({ root: output, output, run: async () => ({ code: 1, stdout: "", stderr: "private-error-text" }) });
    assert.equal(result.status, "BLOCKED");
    assert.equal(JSON.parse(readFileSync(join(output, "summary.json"))).reason, "SOURCE_IDENTITY_UNVERIFIED");
    assert.ok(!readFileSync(join(output, "summary.json"), "utf8").includes("private-error-text"));
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test("이미 중단된 실행은 다음 도구를 호출하지 않는다", async () => {
  const output = mkdtempSync(join(tmpdir(), "laonshop-local-security-abort-"));
  try {
    const controller = new AbortController(); controller.abort(); let calls = 0;
    const result = await runLocalSecurity({ root: output, output, signal: controller.signal, run: async () => { calls++; throw new Error("must not run"); } });
    assert.equal(result.status, "INTERRUPTED"); assert.equal(calls, 0);
  } finally { rmSync(output, { recursive: true, force: true }); }
});
