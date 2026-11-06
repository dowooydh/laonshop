// Narrow, repeatable tracked-source/secret/dependency checks; not a full source audit.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".md", ".sql", ".css", ".sh", ".svg", ".toml", ".ini", ".txt"]);
const TEXT_NAMES = new Set([".gitignore", ".npmrc", "Dockerfile", "Makefile", ".env.example"]);
const SEVERITIES = ["UNKNOWN", "INFO", "LOW", "MODERATE", "MEDIUM", "HIGH", "CRITICAL"];
const sha256 = value => createHash("sha256").update(value).digest("hex");
const secretRules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{64,}-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["credential-url", /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s/:@]+:[^\s/@]+@[^\s'"`]+/gi],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g],
  ["openai-key", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/g],
  ["live-payment-key", /\b(?:sk|rk)_live_[A-Za-z0-9]{24,}\b/g],
];
const riskRules = [
  ["raw-html", /dangerouslySetInnerHTML/g],
  ["raw-sql", /\$(?:queryRawUnsafe|executeRawUnsafe)\s*\(/g],
  ["external-fetch", /\bfetch\s*\(/g],
  ["dynamic-code", /\beval\s*\(|\bnew\s+Function\s*\(/g],
  ["process-execution", /\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\(/g],
  ["redirect", /\b(?:redirect|permanentRedirect)\s*\(|NextResponse\.redirect\s*\(/g],
  ["session-cookie", /\b(?:getIronSession|cookies)\s*\(/g],
  ["filesystem", /\b(?:readFile|writeFile|createReadStream|unlink|rm)(?:Sync)?\s*\(/g],
];

function matches(text, rules) {
  const found = [];
  for (const [rule, pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) found.push({ rule, line: text.slice(0, match.index).split("\n").length });
  }
  return found;
}

export function scanTextSecrets(text, file) {
  return matches(text, secretRules).map(finding => ({ file, ...finding }));
}

export function inventorySource(files) {
  const entries = [], reviewTargets = [];
  for (const { file, text } of files) {
    if (!/\.(?:[cm]?js|jsx|ts|tsx)$/.test(file)) continue;
    let kind;
    if (/(?:^|\/)route\.[cm]?[jt]sx?$/.test(file)) kind = "http-route";
    else if (/^app\/.*\/page\.tsx$|^app\/page\.tsx$/.test(file)) kind = "page";
    else if (/^[\s\r\n]*["']use server["']/.test(text)) kind = "server-action-module";
    else if (/^(?:middleware|next\.config)\.[jt]s$/.test(file)) kind = "deployment-boundary";
    if (kind) entries.push({ file, kind, exports: [...text.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(match => match[1]) });
    if (/^(?:app|lib|components|scripts)\//.test(file) || kind === "deployment-boundary") for (const match of matches(text, riskRules)) reviewTargets.push({ file, ...match });
  }
  return { entries, reviewTargets, scope: "Lexical entry-point and sensitive-operation inventory only. Matches require human review and are not confirmed vulnerabilities or completed source coverage." };
}

function publicAdvisoryUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (url.hostname === "github.com" && /^\/advisories\/GHSA-[\w-]+$/.test(url.pathname)) return url.href;
    if (["avd.aquasec.com", "nvd.nist.gov"].includes(url.hostname)) return url.href;
  } catch { /* Invalid or credential-bearing metadata is not emitted. */ }
  return null;
}

export function summarizePnpmAudit(raw, exitCode, checkedAt) {
  const base = { engine: "pnpm-audit", arguments: ["audit", "--json", "--audit-level", "low", "--registry=https://registry.npmjs.org"], checkedAt, includeDevDependencies: true, includeOptionalDependencies: true, advisoryService: "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk", databaseUpdatedAt: null, databaseTimestampNote: "The registry audit API does not expose its database update timestamp; checkedAt records the actual query time." };
  if (![0, 1].includes(exitCode) || !raw?.advisories || Array.isArray(raw.advisories) || typeof raw.advisories !== "object" || !raw.metadata || !(raw.metadata.totalDependencies > 0) || !["dependencies", "devDependencies", "optionalDependencies", "totalDependencies"].every(key => Number.isSafeInteger(raw.metadata[key]) && raw.metadata[key] >= 0) || !["info", "low", "moderate", "high", "critical"].every(key => Number.isSafeInteger(raw.metadata.vulnerabilities?.[key]) && raw.metadata.vulnerabilities[key] >= 0)) return { ...base, status: "BLOCKED", reason: "AUDIT_EXECUTION_OR_SCHEMA_ERROR", exitCode };
  const advisories = Object.values(raw.advisories).map(item => ({
    package: item.module_name, severity: String(item.severity).toUpperCase(), installedVersions: [...new Set((item.findings ?? []).map(finding => finding.version))], vulnerableVersions: item.vulnerable_versions,
    patchedVersions: item.patched_versions ?? null, advisory: publicAdvisoryUrl(item.url), devOnly: (item.findings ?? []).length > 0 && item.findings.every(finding => finding.dev === true),
  }));
  if (advisories.some(item => typeof item.package !== "string" || !SEVERITIES.includes(item.severity) || !item.advisory)) return { ...base, status: "BLOCKED", reason: "AUDIT_ADVISORY_METADATA_INVALID", exitCode };
  const declared = Object.values(raw.metadata.vulnerabilities ?? {}).reduce((total, count) => total + count, 0);
  if (!Number.isSafeInteger(declared) || declared < 0 || (declared === 0) !== (advisories.length === 0) || (exitCode === 0 && advisories.length)) return { ...base, status: "BLOCKED", reason: "AUDIT_COUNTS_OR_EXIT_INCONSISTENT", exitCode };
  return { ...base, status: advisories.length ? "FAIL" : "PASS", exitCode, packageCounts: { runtime: raw.metadata.dependencies, development: raw.metadata.devDependencies, optional: raw.metadata.optionalDependencies, total: raw.metadata.totalDependencies }, vulnerabilityCounts: raw.metadata.vulnerabilities, advisories };
}

export function summarizeTrivy(raw, exitCode, checkedAt, versionText = "") {
  const base = { engine: "trivy", checkedAt, includeDevDependencies: true, includeUnfixed: true, scanners: ["vuln", "secret"], version: versionText.match(/^Version:\s*(\S+)/m)?.[1] ?? null, databaseUpdatedAt: versionText.match(/^\s*UpdatedAt:\s*(.+)$/m)?.[1]?.trim() ?? null };
  if (![0, 1].includes(exitCode) || !Array.isArray(raw?.Results)) return { ...base, status: "BLOCKED", reason: "TRIVY_EXECUTION_OR_SCHEMA_ERROR", exitCode };
  const packageIds = new Set(), vulnerabilities = [], secrets = [];
  for (const result of raw.Results) {
    for (const item of result.Packages ?? []) {
      if (typeof item.Name !== "string" || !item.Name || typeof item.Version !== "string" || !item.Version) return { ...base, status: "BLOCKED", reason: "TRIVY_PACKAGE_METADATA_INVALID", exitCode };
      packageIds.add(`${item.Name}@${item.Version}`);
    }
    for (const item of result.Vulnerabilities ?? []) vulnerabilities.push({ package: item.PkgName, installedVersion: item.InstalledVersion, fixedVersion: item.FixedVersion || null, severity: item.Severity, id: item.VulnerabilityID, advisory: publicAdvisoryUrl(item.PrimaryURL) });
    for (const item of result.Secrets ?? []) secrets.push({ file: String(result.Target).replace(/^\.\//, ""), rule: item.RuleID, severity: item.Severity, line: item.StartLine, endLine: item.EndLine });
  }
  if (!base.version || !base.databaseUpdatedAt || !packageIds.size) return { ...base, status: "BLOCKED", reason: "TRIVY_VERSION_DATABASE_OR_PACKAGE_SCOPE_MISSING", exitCode };
  if (exitCode === 0 && (vulnerabilities.length || secrets.length)) return { ...base, status: "BLOCKED", reason: "TRIVY_COUNTS_OR_EXIT_INCONSISTENT", exitCode };
  return { ...base, status: vulnerabilities.length || secrets.length ? "FAIL" : "PASS", exitCode, packageCount: packageIds.size, vulnerabilities, secrets };
}

export function summarizeSecretProbe(raw, exitCode) {
  const findings = Array.isArray(raw?.Results) ? raw.Results.flatMap(result => result.Secrets ?? []) : [];
  const success = exitCode === 1 && findings.length === 1 && findings[0].RuleID === "github-pat";
  return { status: success ? "PASS" : "BLOCKED", detected: success, rule: success ? "github-pat" : null, exitCode,
    scope: "Nonfunctional random canary in a separate disposable directory; verifies built-in rules remain enabled. No token or matched source text is retained." };
}

export function aggregateStatus(parts, { interrupted = false, sourceChanged = false } = {}) {
  if (interrupted) return "INTERRUPTED";
  if (parts.some(part => part.status === "FAIL")) return "FAIL";
  if (sourceChanged || parts.some(part => part.status !== "PASS")) return "BLOCKED";
  return "PASS";
}

/** Audit metadata is separate from the text snapshot: no project hooks or npmrc are loaded. */
export function createAuditSnapshot(files, directory) {
  mkdirSync(directory, { mode: 0o700 });
  const original = JSON.parse(files.find(file => file.file === "package.json").text);
  const manifest = { name: "laonshop-security-audit-input", private: true, version: "0.0.0" };
  for (const key of ["dependencies", "devDependencies", "optionalDependencies", "packageManager"]) {
    if (original[key] !== undefined) manifest[key] = original[key];
  }
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest), { mode: 0o600 });
  for (const name of ["pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
    const file = files.find(file => file.file === name);
    if (file) writeFileSync(join(directory, name), file.text, { mode: 0o600 });
  }
  return directory;
}

export function runCommand(command, args, { cwd, env, signal, timeout = 180000 } = {}) {
  return new Promise(resolveResult => {
    let stdout = "", stderr = "", errorCode = null;
    const child = spawn(command, args, { cwd, env, signal, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { errorCode = "TIMEOUT"; child.kill("SIGTERM"); }, timeout);
    const append = (kind, chunk) => {
      if (kind === "stdout") stdout += chunk; else stderr += chunk;
      if (stdout.length + stderr.length > 32 * 1024 * 1024) { errorCode = "OUTPUT_LIMIT"; child.kill("SIGTERM"); }
    };
    child.stdout.on("data", chunk => append("stdout", chunk));
    child.stderr.on("data", chunk => append("stderr", chunk));
    child.on("error", error => { errorCode = error.code ?? "SPAWN_ERROR"; });
    child.on("close", (code, childSignal) => { clearTimeout(timer); resolveResult({ code, signal: childSignal, errorCode, stdout, stderr }); });
  });
}

function parseJson(value) { try { return JSON.parse(value); } catch { return null; } }
function thinEnvironment() {
  const result = {};
  for (const name of ["PATH", "TMPDIR", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR"]) if (process.env[name]) result[name] = process.env[name];
  return result;
}
function forbiddenFile(file) { return /(^|\/)\.env(?:\.|$)/.test(file) && !/(^|\/)\.env\.example$/.test(file) || /\.(?:pem|key|p12|pfx)$/.test(file); }

export async function runLocalSecurity({ root = process.cwd(), output, run = runCommand, signal } = {}) {
  root = realpathSync(root);
  const env = thinEnvironment(), startedAt = new Date().toISOString();
  const finish = summary => { writeFileSync(join(output, "summary.json"), JSON.stringify(summary, null, 2), { mode: 0o600 }); return summary; };
  if (signal?.aborted) return finish({ status: "INTERRUPTED", success: false, reason: "USER_INTERRUPTED", startedAt });
  const git = args => run("git", args, { cwd: root, env, signal, timeout: 15000 });
  const head = await git(["rev-parse", "HEAD"]), tracked = await git(["ls-files", "-z"]), dirty = await git(["status", "--porcelain", "--untracked-files=no"]);
  if (signal?.aborted) return finish({ status: "INTERRUPTED", success: false, reason: "USER_INTERRUPTED", startedAt });
  if (head.code !== 0 || !/^[a-f0-9]{40}$/.test(head.stdout.trim()) || tracked.code !== 0 || dirty.code !== 0) return finish({ status: "BLOCKED", success: false, reason: "SOURCE_IDENTITY_UNVERIFIED", startedAt });
  const sourceRef = head.stdout.trim(), paths = tracked.stdout.split("\0").filter(Boolean).sort();
  const files = [], unread = [], binary = [], secretFindings = [];
  for (const file of paths) {
    if (forbiddenFile(file)) { secretFindings.push({ file, rule: "forbidden-tracked-secret-file", line: null }); continue; }
    const path = resolve(root, file), rel = relative(root, path);
    if (isAbsolute(rel) || rel.startsWith(`..${sep}`) || !lstatSync(path).isFile() || !realpathSync(path).startsWith(root + sep)) { unread.push({ file, reason: "UNSAFE_PATH_OR_SYMLINK" }); continue; }
    if (!TEXT_EXTENSIONS.has(extname(file)) && !TEXT_NAMES.has(basename(file))) { binary.push(file); continue; }
    const data = readFileSync(path);
    if (data.includes(0)) { binary.push(file); continue; }
    const text = data.toString("utf8");
    files.push({ file, text, sha256: sha256(data), bytes: data.length });
    secretFindings.push(...scanTextSecrets(text, file));
  }
  const inventory = inventorySource(files), lock = files.find(file => file.file === "pnpm-lock.yaml"), manifest = files.find(file => file.file === "package.json");
  const sourceDigest = sha256(JSON.stringify(files.map(({ file, sha256: hash }) => ({ file, sha256: hash }))));
  const source = { sourceRef, dirty: Boolean(dirty.stdout.trim()), fingerprint: sourceDigest, trackedFiles: paths.length, scannedTextFiles: files.length, binaryFiles: binary.length, unread, manifest: files.map(({ file, sha256: hash, bytes }) => ({ file, sha256: hash, bytes })) };
  const patternSecrets = { status: secretFindings.length ? "FAIL" : unread.length ? "BLOCKED" : "PASS", findings: secretFindings, scope: "Tracked text plus forbidden tracked secret filenames; binary assets are inventoried but are not a complete binary secret analysis." };
  let pnpm = { status: "BLOCKED", reason: "NOT_EXECUTED" }, trivy = { status: "BLOCKED", reason: "NOT_EXECUTED" }, secretProbe = { status: "BLOCKED", reason: "NOT_EXECUTED" };
  const scratch = mkdtempSync(join(output, "snapshot-"));
  const trivyCache = process.env.QA_TRIVY_CACHE_DIR ? resolve(process.env.QA_TRIVY_CACHE_DIR) : join(root, "tests/.generated/.trivy-cache");
  try {
    for (const { file, text } of files) { const target = join(scratch, "source", file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text, { mode: 0o600 }); }
    const snapshot = join(scratch, "source");
    const policy = files.find(file => file.file === "pnpm-workspace.yaml")?.text ?? "";
    if (!lock || !manifest || /(?:^|\n)\s*(?:audit|auditConfig|ignoreGhsas|ignoreCves|ignoreUnfixable)\s*:/.test(policy)) {
      pnpm.reason = !lock || !manifest ? "LOCK_OR_MANIFEST_MISSING" : "AUDIT_IGNORE_POLICY_REQUIRES_REVIEW";
      trivy.reason = pnpm.reason;
    } else if (!signal?.aborted) {
      const empty = join(scratch, "empty-config"); writeFileSync(empty, "", { mode: 0o600 });
      // Empty YAML produces EOF in Trivy's secret decoder. An empty object keeps
      // all built-in rules; npm/ignore files must remain separate and empty.
      const scanConfig = join(scratch, "trivy.yaml"), secretConfig = join(scratch, "trivy-secret.yaml");
      writeFileSync(scanConfig, "{}\n", { mode: 0o600 }); writeFileSync(secretConfig, "{}\n", { mode: 0o600 });
      const toolEnv = { ...env, HOME: join(scratch, "home"), XDG_CACHE_HOME: join(scratch, "cache"), XDG_CONFIG_HOME: join(scratch, "config"), npm_config_cache: join(scratch, "npm-cache"), npm_config_userconfig: empty, npm_config_globalconfig: empty, npm_config_ignore_scripts: "true" };
      mkdirSync(toolEnv.HOME, { mode: 0o700 });
      const auditInput = createAuditSnapshot(files, join(scratch, "audit-input"));
      const audit = await run("pnpm", ["audit", "--json", "--audit-level", "low", "--registry=https://registry.npmjs.org"], { cwd: auditInput, env: toolEnv, signal });
      pnpm = summarizePnpmAudit(parseJson(audit.stdout), audit.errorCode ? null : audit.code, new Date().toISOString());
      if (audit.errorCode) pnpm.executionError = audit.errorCode;
      if (!signal?.aborted) {
        mkdirSync(trivyCache, { recursive: true, mode: 0o700 });
        const scan = await run("trivy", ["fs", "--cache-dir", trivyCache, "--scanners", "vuln,secret", "--include-dev-deps", "--list-all-pkgs", "--format", "json", "--exit-code", "1", "--no-progress", "--timeout", "2m", "--config", scanConfig, "--secret-config", secretConfig, "--ignorefile", empty, "."], { cwd: snapshot, env: toolEnv, signal });
        const version = !signal?.aborted ? await run("trivy", ["--cache-dir", trivyCache, "--version"], { cwd: scratch, env: toolEnv, signal, timeout: 15000 }) : { stdout: "" };
        trivy = summarizeTrivy(parseJson(scan.stdout), scan.errorCode ? null : scan.code, new Date().toISOString(), version.stdout);
        if (scan.errorCode) trivy.executionError = scan.errorCode;
        if (!signal?.aborted) {
          const canary = join(scratch, "rule-probe"); mkdirSync(canary, { mode: 0o700 });
          const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          const value = ["gh", "p_", [...randomBytes(36)].map(byte => alphabet[byte % alphabet.length]).join("")].join("");
          writeFileSync(join(canary, "synthetic.txt"), `credential=${value}\n`, { mode: 0o600 });
          const probe = await run("trivy", ["fs", "--scanners", "secret", "--format", "json", "--exit-code", "1", "--no-progress", "--timeout", "30s", "--config", scanConfig, "--secret-config", secretConfig, "--ignorefile", empty, "."], { cwd: canary, env: toolEnv, signal, timeout: 45000 });
          secretProbe = summarizeSecretProbe(parseJson(probe.stdout), probe.errorCode ? null : probe.code);
        }
      }
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  const endHead = !signal?.aborted ? await git(["rev-parse", "HEAD"]) : { code: null, stdout: "" };
  const endDirty = !signal?.aborted ? await git(["status", "--porcelain", "--untracked-files=no"]) : { code: null, stdout: "" };
  const changedDuringRun = endHead.code !== 0 || endDirty.code !== 0 || endHead.stdout.trim() !== sourceRef || endDirty.stdout !== dirty.stdout || files.some(file => { try { return sha256(readFileSync(join(root, file.file))) !== file.sha256; } catch { return true; } });
  const status = aggregateStatus([patternSecrets, pnpm, trivy, secretProbe], { interrupted: signal?.aborted, sourceChanged: changedDuringRun || source.dirty });
  const summary = { status, success: status === "PASS", startedAt, finishedAt: new Date().toISOString(), scope: "Known dependency advisories (runtime, development, optional), tracked-text secret candidates and lexical source inventory. Not a complete source audit, dynamic assessment, binary scan, ASVS conformance or deployment-image attestation.", source, sourceRef, sourceRefAtEnd: endHead.stdout.trim(), sourceChangedDuringRun: changedDuringRun, lockSha256: lock?.sha256 ?? null, sourceInventory: inventory, secretPatterns: patternSecrets, dependencies: { pnpm, trivy }, secretProbe, toolingExecution: "Trusted scanners inspect an isolated tracked-text copy; no product lifecycle scripts, application server, DB or PG call is executed by this checker." };
  return finish(summary);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--output-dir")) throw new Error("Usage: node scripts/qa/local-security.mjs [--output-dir <new-directory>]");
  let output;
  if (args.length) { output = resolve(args[1]); mkdirSync(output, { mode: 0o700 }); }
  else { const generated = resolve("tests/.generated"); mkdirSync(generated, { recursive: true }); output = mkdtempSync(join(generated, `${new Date().toISOString().replace(/[:.]/g, "-")}-local-security-`)); }
  const abort = new AbortController(), onStop = () => abort.abort();
  process.once("SIGINT", onStop); process.once("SIGTERM", onStop);
  try {
    let result;
    try { result = await runLocalSecurity({ output, signal: abort.signal }); }
    catch (error) { result = { status: abort.signal.aborted ? "INTERRUPTED" : "BLOCKED", success: false, reason: error.code ?? "LOCAL_SECURITY_EXECUTION_FAILED" }; writeFileSync(join(output, "summary.json"), JSON.stringify(result, null, 2), { mode: 0o600 }); }
    console.log(JSON.stringify({ status: result.status, success: result.success, sourceRef: result.sourceRef, report: relative(process.cwd(), join(output, "summary.json")), secretCandidates: result.secretPatterns?.findings.length, pnpm: result.dependencies?.pnpm.status, trivy: result.dependencies?.trivy.status }));
    process.exitCode = result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : result.status === "INTERRUPTED" ? 130 : 2;
  } finally { process.removeListener("SIGINT", onStop); process.removeListener("SIGTERM", onStop); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(JSON.stringify({ status: "BLOCKED", success: false, reason: error.code ?? "LOCAL_SECURITY_EXECUTION_FAILED" })); process.exitCode = 2; });
