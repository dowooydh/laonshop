import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cleanEnvironment, root } from "./runner-support.mjs";

export const cloudflareRevision = "c1c8a8c1471069fb0e188eeaff69b8e8db6564a8";
export const pentagiVersion = "v2.2.0";
export const dynamicRoles = ["public", "customer", "admin"];
export const skillFiles = {
  "validate-findings.cjs": "e85f232e36bfac0f866f244da50376692d6b45c690beadcb00608b0e6c8b5283",
  "validate-coverage-ledger.cjs": "2eb280bd2e33c002916f86db9b29f9edfedb6454e5db973c766290465b868ac8",
  "report-schema.json": "6575c9de4a62255699ea052ebf9a49ebfb373a32891bcd89af6f55cc84b35519",
};
const sha = (value, length) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const result = (status, reason) => ({ status, reason });
const digest = (data) => createHash("sha256").update(data).digest("hex");

export function pentagiResult(receipt, sourceRef) {
  if (!sha(sourceRef, 40) || receipt?.source_ref !== sourceRef || receipt.version !== pentagiVersion)
    return result("blocked", "PentAGI 소스 SHA 또는 고정 도구 버전 불일치");
  if (receipt.target !== "laonshop-isolated" || receipt.isolation !== "private-vm")
    return result("blocked", "PentAGI 격리 라온샵 대상 증거 필요");
  const flows = receipt.flows;
  if (!Array.isArray(flows) || flows.length !== dynamicRoles.length ||
      !dynamicRoles.every((role) => flows.some((flow) => flow?.app === role)) ||
      new Set(flows.map((flow) => flow?.id)).size !== dynamicRoles.length)
    return result("blocked", "공개·구매자·관리자 흐름 세 건 필요");
  if (!flows.every((flow) => typeof flow.id === "string" && /^\d+$/.test(flow.id) &&
      flow.status === "completed" && sha(flow.report_sha256, 64) &&
      Number.isSafeInteger(flow.observed_requests) && flow.observed_requests > 0 &&
      Number.isSafeInteger(flow.observed_requests_by_method?.GET) && flow.observed_requests_by_method.GET > 0 &&
      Number.isSafeInteger(flow.observed_requests_by_method?.POST) && flow.observed_requests_by_method.POST > 0 &&
      Object.values(flow.observed_requests_by_method).every((n) => Number.isSafeInteger(n) && n >= 0) &&
      Object.values(flow.observed_requests_by_method).reduce((total, n) => total + n, 0) === flow.observed_requests &&
      Number.isSafeInteger(flow.confirmed_high_critical) && flow.confirmed_high_critical >= 0 &&
      Number.isSafeInteger(flow.unresolved) && flow.unresolved >= 0))
    return result("blocked", "완료 흐름·GET/POST 관측·보고서 또는 독립 판정 누락");
  if (flows.some((flow) => flow.confirmed_high_critical > 0)) return result("fail", "PentAGI 확인 HIGH/CRITICAL 발견");
  if (flows.some((flow) => flow.unresolved > 0)) return result("blocked", "PentAGI 후보 독립 검증 미완료");
  return result("pass", "동일 SHA의 라온샵 세 역할 흐름과 관측 기록 확인");
}

export function cloudflareResult(meta, ledger, findings, sourceRef, requiredPaths = []) {
  if (!sha(sourceRef, 40) || meta?.source_ref !== sourceRef || meta.skill_revision !== cloudflareRevision ||
      meta.profile !== "deep" || meta.run_status !== "complete" ||
      meta.execution_policy !== "sandboxed-source-and-local-only" ||
      !Array.isArray(meta.scope_paths) || meta.scope_paths.length !== 1 || meta.scope_paths[0] !== ".")
    return result("blocked", "현재 SHA의 저장소 전체 Cloudflare deep 감사 필요");
  if (!Array.isArray(ledger) || !Array.isArray(findings) || !ledger.length ||
      !ledger.every((unit) => unit && Array.isArray(unit.result_fingerprints) &&
        (unit.status === "not_applicable" ? Array.isArray(unit.starting_paths) : Array.isArray(unit.reviewed_paths))) ||
      !findings.every((item) => typeof item?.fingerprint === "string" && item.fingerprint.length > 0 && typeof item.verdict === "string"))
    return result("blocked", "감사 원장 또는 후보 형식 오류");
  if (findings.some((item) => item.verdict === "confirmed" && ["high", "critical"].includes(item.severity?.overall_severity)))
    return result("fail", "Cloudflare 확인 HIGH/CRITICAL 발견");
  const fingerprints = new Set(ledger.flatMap((unit) => unit.result_fingerprints));
  const reviewed = new Set(ledger.flatMap((unit) => unit.status === "not_applicable" ? unit.starting_paths : unit.reviewed_paths));
  if (!ledger.some((unit) => ["covered", "candidate"].includes(unit.status)) ||
      ledger.some((unit) => !["covered", "candidate", "not_applicable"].includes(unit.status)) ||
      findings.some((item) => item.verdict === "needs_validation" ||
        (item.verdict === "confirmed" && !item.severity?.overall_severity)) ||
      requiredPaths.some((entry) => !reviewed.has(entry)) ||
      fingerprints.size !== findings.length || findings.some((item) => !fingerprints.has(item.fingerprint)))
    return result("blocked", "미조사 소스·미완료 범위·미검증 후보 또는 원장 연결 누락");
  return result("pass", "전체 소스 범위와 Cloudflare 검증 산출물 확인");
}

function git(args, cwd = root, allowNoMatch = false) {
  try {
    return execFileSync("git", ["-c", "core.fsmonitor=false", ...args], {
      cwd, env: cleanEnvironment(), encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (allowNoMatch && error.status === 1) return "";
    throw new Error("Git 소스 상태를 확인할 수 없습니다.");
  }
}

export function cleanSourceRef(cwd = root) {
  const changed = git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ".", ":(exclude,top).codex-attachments/**"], cwd);
  if (changed.length) throw new Error("미커밋 소스가 있어 현재 커밋의 보안 통과를 검증할 수 없습니다.");
  const ref = git(["rev-parse", "HEAD"], cwd).trim();
  if (!sha(ref, 40)) throw new Error("Git SHA 형식 오류");
  return ref;
}

export function auditEntryPaths(cwd = root) {
  const files = git(["ls-files", "-z"], cwd).split("\0").filter(Boolean);
  const entries = files.filter((file) => /^app\/(?:.*\/)?route\.[jt]sx?$/.test(file) || /^middleware\.[jt]sx?$/.test(file));
  const actions = git(["grep", "--cached", "-lzE", "^[[:space:]]*['\"]use server['\"]", "--", "app", "lib"], cwd, true).split("\0").filter(Boolean);
  return [...new Set([...entries, ...actions])].sort();
}

export function auditScopePaths(cwd = root) {
  const files = git(["ls-files", "-z"], cwd).split("\0").filter(Boolean);
  const configurationNames = new Set([
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb",
    "tsconfig.json", ".gitignore", ".gitattributes", ".gitmodules", ".npmrc", ".yarnrc", ".yarnrc.yml", ".env.example", ".env.sample", ".env.template",
    ".node-version", ".nvmrc", ".tool-versions", "vercel.json", "vercel.jsonc", "Dockerfile", "Containerfile", ".dockerignore", "Procfile", "Caddyfile",
  ]);
  const sources = files.filter((file) => !file.startsWith("tests/reports/") && !file.startsWith(".codex-attachments/") &&
    (/\.(?:[cm]?js|[jt]sx?|sh|py|prisma|sql)$/.test(file) ||
      configurationNames.has(path.posix.basename(file)) ||
      /\.(?:jsonc?|ya?ml|toml|ini|conf)$/.test(file) ||
      /^\.env(?:\.|$)/.test(path.posix.basename(file)) ||
      /^(?:Dockerfile|Containerfile)(?:\.|$)/.test(path.posix.basename(file))));
  return [...new Set([...sources, ...auditEntryPaths(cwd)])].sort();
}

export function readEvidenceFile(directory, name, limit = 5 * 1024 * 1024) {
  const file = path.resolve(directory, name);
  if (!file.startsWith(path.resolve(directory) + path.sep)) throw new Error("보안 증거 경로 이탈");
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size <= 0 || stat.size > limit) throw new Error("보안 증거 파일 형식 또는 크기 오류");
    const bytes = Buffer.alloc(stat.size + 1);
    const count = fs.readSync(fd, bytes, 0, bytes.length);
    if (count !== stat.size) throw new Error("읽는 동안 보안 증거가 변경됨");
    return bytes.subarray(0, count);
  } finally { fs.closeSync(fd); }
}

function childDirectory(directory, name) {
  const child = path.join(directory, name);
  if (!fs.lstatSync(child).isDirectory() || fs.lstatSync(child).isSymbolicLink()) throw new Error("보안 증거 하위 경로 오류");
  return child;
}

function checkPentagi(directory, sourceRef) {
  const scan = childDirectory(directory, "pentagi");
  const receipt = JSON.parse(readEvidenceFile(scan, "run.json"));
  const outcome = pentagiResult(receipt, sourceRef);
  if (outcome.status === "blocked") return outcome;
  for (const flow of receipt.flows) {
    const report = readEvidenceFile(scan, `${flow.app}.md`);
    const access = JSON.parse(readEvidenceFile(scan, `${flow.app}-access.json`));
    if (digest(report) !== flow.report_sha256 || access?.source_ref !== sourceRef || access.app !== flow.app ||
        access.flow_id !== flow.id || access.observed_requests !== flow.observed_requests ||
        JSON.stringify(Object.entries(access.observed_requests_by_method ?? {}).sort()) !== JSON.stringify(Object.entries(flow.observed_requests_by_method).sort()))
      return result("blocked", "PentAGI 보고서·접근/메서드 관측 기록 불일치");
  }
  return outcome;
}

function checkCloudflare(directory, sourceRef) {
  const audit = childDirectory(directory, "cloudflare");
  const skill = childDirectory(directory, "cloudflare-skill");
  const metadata = JSON.parse(readEvidenceFile(audit, "run-metadata.json"));
  for (const name of ["architecture.md", "REPORT.md", "FINDINGS-DETAIL.md", "NEEDS-VALIDATION.md"]) readEvidenceFile(audit, name);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-audit-validators-"));
  try {
    for (const [name, checksum] of Object.entries(skillFiles)) {
      const bytes = readEvidenceFile(skill, name, 256 * 1024);
      if (digest(bytes) !== checksum) throw new Error("공식 Cloudflare 검증기 체크섬 불일치");
      fs.writeFileSync(path.join(scratch, name), bytes, { mode: 0o600, flag: "wx" });
    }
    const documents = ["coverage-ledger", "findings"].map((name) => {
      const bytes = readEvidenceFile(audit, `${name}.json`);
      fs.writeFileSync(path.join(scratch, `${name}.json`), bytes, { mode: 0o600, flag: "wx" });
      const checked = spawnSync(process.execPath, [path.join(scratch, `validate-${name}.cjs`), path.join(scratch, `${name}.json`)], {
        cwd: scratch, env: {}, stdio: "ignore", timeout: 15000,
      });
      if (checked.status !== 0) throw new Error(`Cloudflare ${name} 공식 검증 실패`);
      return JSON.parse(bytes);
    });
    return cloudflareResult(metadata, ...documents, sourceRef, auditScopePaths());
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

export function independentReviewResult(receipt, sourceRef, requiredArtifacts) {
  if (!sha(sourceRef, 40) || receipt?.source_ref !== sourceRef || receipt.status !== "complete" ||
      receipt.independent !== true || typeof receipt.reviewer !== "string" || !receipt.reviewer.trim() ||
      typeof receipt.operator !== "string" || !receipt.operator.trim() || receipt.reviewer.trim().toLowerCase() === receipt.operator.trim().toLowerCase() ||
      !sha(receipt.report_sha256, 64) || !Array.isArray(receipt.artifacts))
    return result("blocked", "현재 SHA의 별도 검토자·독립 검토 보고서 필요");
  const records = new Map(receipt.artifacts.map((artifact) => [artifact?.path, artifact?.sha256]));
  if (records.size !== receipt.artifacts.length || requiredArtifacts.some((name) => !sha(records.get(name), 64)))
    return result("blocked", "독립 검토의 산출물 SHA 연결 누락");
  if (receipt.confirmed_high_critical > 0) return result("fail", "독립 검토에서 확인 HIGH/CRITICAL 발견");
  if (receipt.unresolved !== 0 || receipt.confirmed_high_critical !== 0) return result("blocked", "독립 검토 미검증 후보 또는 판정 누락");
  return result("pass", "별도 검토자와 현재 산출물의 독립 검토 확인");
}

const independentArtifacts = [
  "pentagi/run.json", ...dynamicRoles.flatMap((role) => [`pentagi/${role}.md`, `pentagi/${role}-access.json`]),
  "cloudflare/run-metadata.json", "cloudflare/architecture.md", "cloudflare/coverage-ledger.json", "cloudflare/findings.json",
  "cloudflare/REPORT.md", "cloudflare/FINDINGS-DETAIL.md", "cloudflare/NEEDS-VALIDATION.md",
];

function checkIndependentReview(directory, sourceRef) {
  const receipt = JSON.parse(readEvidenceFile(directory, "independent-review.json"));
  const outcome = independentReviewResult(receipt, sourceRef, independentArtifacts);
  if (outcome.status === "blocked") return outcome;
  if (digest(readEvidenceFile(directory, "independent-review.md")) !== receipt.report_sha256)
    return result("blocked", "독립 검토 보고서 SHA 불일치");
  for (const name of independentArtifacts) {
    const slash = name.indexOf("/");
    const child = childDirectory(directory, name.slice(0, slash));
    if (digest(readEvidenceFile(child, name.slice(slash + 1))) !== receipt.artifacts.find((item) => item.path === name).sha256)
      return result("blocked", "독립 검토 시점의 산출물과 현재 파일 불일치");
  }
  return outcome;
}

export function main(args = process.argv.slice(2)) {
  let sourceRef = null;
  const stages = {};
  try { sourceRef = cleanSourceRef(); } catch { stages.source = result("blocked", "깨끗한 현재 커밋 확인 불가"); }
  let directory = null;
  if (args.length === 2 && args[0] === "--evidence-dir" && args[1]?.trim() && !args[1].startsWith("-")) {
    try {
      directory = fs.realpathSync(args[1]);
      if (!fs.statSync(directory).isDirectory() || directory === root || directory.startsWith(root + path.sep)) directory = null;
    } catch { /* Report metadata only; never print a path or evidence contents. */ }
  }
  if (!directory) stages.evidence = result("blocked", "사용법: pnpm qa:security --evidence-dir <저장소 밖 증거 디렉터리>");
  if (directory && sourceRef) {
    for (const [name, check] of [["pentagi", checkPentagi], ["cloudflare", checkCloudflare], ["independentReview", checkIndependentReview]]) {
      try { stages[name] = check(directory, sourceRef); }
      catch { stages[name] = result("blocked", "증거 누락·형식/체크섬·공식 검증 또는 읽기 실패"); }
    }
    try { if (cleanSourceRef() !== sourceRef) stages.source = result("blocked", "검증 중 소스 상태 변경"); }
    catch { stages.source = result("blocked", "검증 중 소스 상태 확인 불가"); }
  }
  const outcomes = Object.values(stages);
  const status = outcomes.some((stage) => stage.status === "fail") ? "FAIL" : outcomes.length && outcomes.every((stage) => stage.status === "pass") ? "PASS" : "BLOCKED";
  console.log(JSON.stringify({ kind: "security-evidence", source_ref: sourceRef, status, success: status === "PASS", stages }, null, 2));
  return status === "PASS" ? 0 : status === "FAIL" ? 1 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main();
