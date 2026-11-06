// Trusted controller in an offline, readonly-root, resource-bounded container.
// Only synthetic identities and data exist in its writable /scratch namespace.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { summarizeEvidence, validateEvidence } from "./isolated-evidence.mjs";

const source = "/scratch/source", output = `${source}/tests/.generated/isolated`;
const stateFile = "/scratch/state.json", pgdata = "/scratch/pgdata";
const env = {
  PATH: "/usr/local/bin:/usr/bin:/bin:/usr/lib/postgresql/15/bin", HOME: "/scratch/home", TMPDIR: "/scratch/tmp", XDG_CACHE_HOME: "/scratch/cache",
  CI: "1", NO_COLOR: "1", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--max-old-space-size=1024 --dns-result-order=ipv4first",
  DATABASE_URL: "postgresql://qa_owner@127.0.0.1:55432/laonshop_qa", DIRECT_URL: "postgresql://qa_owner@127.0.0.1:55432/laonshop_qa",
  SESSION_SECRET: randomBytes(48).toString("hex"), SHOP_APP_URL: "http://localhost:3104", VERCEL_ENV: "preview",
  PG_MODE: "kspay", KSPAY_STORE_ID: "2999199999", KSPAY_REST_LIVE: "0", LAONPAY_BILLING_FEATURE_ENABLED: "0", LAONPAY_BILLING_SCHEMA_READY: "0",
  QA_OUTPUT_DIR: output, QA_STATE_FILE: stateFile, QA_PLAYWRIGHT_MODULE: "/opt/qa/node_modules/playwright/index.mjs", QA_CHROME_EXECUTABLE: "/usr/bin/chromium", QA_BROWSER_EXECUTABLE: "/usr/bin/chromium",
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: "/opt/qa/fonts/responses.cjs",
};
const stages = [], apps = [];
let interrupted = false;
const stop = () => { interrupted = true; for (const app of apps) app.kill("SIGTERM"); };
process.once("SIGTERM", stop); process.once("SIGINT", stop);
const cleanError = e => ({ name: ["Error", "AssertionError", "TypeError", "RangeError"].includes(e.name) ? e.name : "Error", code: typeof e.code === "number" ? e.code : null });
function run(name, command, args, options = {}) {
  if (interrupted) throw new Error("INTERRUPTED");
  const at = new Date().toISOString();
  const result = spawnSync(command, args, { cwd: source, env, encoding: "utf8", timeout: 600000, maxBuffer: 16 * 1024 * 1024, ...options });
  const stdout = result.stdout ?? "", stderr = result.stderr ?? "";
  const hash = value => createHash("sha256").update(value).digest("hex");
  const stage = { name, startedAt: at, finishedAt: new Date().toISOString(), code: result.status, signal: result.signal, stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr), stdoutSha256: hash(stdout), stderrSha256: hash(stderr), rawOutputRetained: false };
  // Warnings/phase names only. Never retain command output containing fixture values.
  stage.warnings = [/prisma.*deprecat|deprecat.*prisma/i.test(stdout + stderr) ? "PRISMA_DEPRECATION" : null, /warn/i.test(stdout + stderr) ? "WARNING_PRESENT" : null].filter(Boolean);
  if (name === "unit-regression") stage.counts = Object.fromEntries(["tests", "pass", "fail", "skipped"].map(label => [label, Number(stdout.match(new RegExp(`# ${label} (\\d+)`))?.[1] ?? -1)]));
  stage.typeErrors = [...(stdout + stderr).matchAll(/^([^\n\r]+\.[cm]?[jt]sx?)\((\d+),(\d+)\): error (TS\d+):/gm)].map(match => ({ file: match[1], line: Number(match[2]), column: Number(match[3]), code: match[4] }));
  stage.failedTests = [...stdout.matchAll(/^not ok (\d+) - /gm)].map(match => Number(match[1]));
  if (name === "unit-regression" && result.status === 0 && !(stage.counts.tests > 0 && stage.counts.pass === stage.counts.tests && stage.counts.fail === 0 && stage.counts.skipped === 0)) { stage.code = 1; stage.reason = "UNIT_COUNTS_INVALID"; }
  stages.push(stage);
  if (stage.code !== 0) throw Object.assign(new Error(`Stage ${name} failed`), { code: result.status ?? result.error?.code, stage, diagnosticTail: (stdout + stderr).slice(-2000) });
  return result;
}
async function networkDenied(host, port) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1500); socket.once("connect", () => { socket.destroy(); resolve(false); });
    socket.once("error", error => resolve(["ENETUNREACH", "EHOSTUNREACH", "EACCES", "EPERM", "ECONNREFUSED"].includes(error.code)));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}
async function preflight() {
  const interfaces = Object.keys((await import("node:os")).networkInterfaces());
  assert.deepEqual(interfaces, ["lo"]);
  assert.equal(process.getuid(), 1000);
  assert.equal(fs.existsSync("/var/run/docker.sock"), false);
  assert.equal(fs.existsSync("/run/containerd/containerd.sock"), false);
  assert.equal(fs.existsSync(`${source}/.env`), false);
  assert.equal(fs.existsSync("/Users/donghyuk"), false);
  let readonly = false; try { fs.writeFileSync("/opt/qa/write-probe", "x"); } catch (e) { readonly = ["EROFS", "EACCES"].includes(e.code); }
  assert.equal(readonly, true);
  let inputReadonly = false; try { fs.writeFileSync("/input/write-probe", "x"); } catch (e) { inputReadonly = ["EROFS", "EACCES"].includes(e.code); }
  assert.equal(inputReadonly, true);
  assert.equal(await networkDenied("192.0.2.1", 443), true);
  assert.equal(await networkDenied("127.0.0.1", 2375), true);
  const cgroup = name => fs.existsSync(`/sys/fs/cgroup/${name}`) ? fs.readFileSync(`/sys/fs/cgroup/${name}`, "utf8").trim() : null;
  assert.equal(cgroup("pids.max"), "256");
  assert.equal(cgroup("memory.max"), String(3584 * 1024 * 1024));
  assert.equal(cgroup("cpu.max"), "200000 100000");
  const scratchLine = fs.readFileSync("/proc/mounts", "utf8").split("\n").find(line => line.split(" ")[1] === "/scratch");
  const scratchOptions = new Set(scratchLine?.split(" ")[3]?.split(","));
  const scratchMount = { exec: !scratchOptions.has("noexec"), nosuid: scratchOptions.has("nosuid"), nodev: scratchOptions.has("nodev"), writable: scratchOptions.has("rw") };
  assert.ok(Object.values(scratchMount).every(Boolean));
  const disk = fs.statfsSync("/scratch"); const diskBytes = disk.bsize * disk.blocks; assert.ok(diskBytes <= 2147483648);
  return { status: "PASS", networkInterfaces: interfaces, networkMode: "none", externalDenied: true, managementLoopbackDenied: true, uid: 1000, readonlyRoot: readonly, readonlyInput: inputReadonly, writableScratchDiskBytes: diskBytes, scratchMount, dockerSocketAbsent: true, credentialsAbsent: true, cgroup: { memoryBytes: cgroup("memory.max"), pids: cgroup("pids.max"), cpu: cgroup("cpu.max") }, artifactPolicy: "ordinary-QA-only; not a Cloudflare promotion receipt" };
}
async function waitApp(port) {
  for (let n = 0; n < 120; n++) {
    if (interrupted) throw new Error("INTERRUPTED");
    try { const r = await fetch(`http://127.0.0.1:${port}/login`, { signal: AbortSignal.timeout(1000), redirect: "manual" }); if (r.status < 500) return; } catch { /* Wait only for this owned listener. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Owned application did not become ready");
}
const result = { kind: "isolated-runtime", sourceRef: process.argv[2], status: "FAIL", stages, startedAt: new Date().toISOString() };
function attempt(name, command, args, options) {
  try { run(name, command, args, options); return true; }
  catch (error) { if (error.message === "INTERRUPTED") throw error; return false; }
}
const dependent = (name, reason) => stages.push({ name, code: null, status: "blocked", reason });
try {
  for (const folder of ["home", "tmp", "cache", "source"]) fs.mkdirSync(`/scratch/${folder}`, { recursive: true, mode: 0o700 });
  run("snapshot-unpack", "tar", ["-xf", "/input/source.tar", "-C", source]);
  // One cp invocation preserves cross-directory store/node_modules hard links.
  run("linux-dependencies-and-store-copy", "cp", ["-a", "/opt/pnpm-store", "/opt/deps/node_modules", "/scratch/"]);
  run("linux-dependencies-relocate", "mv", ["/scratch/node_modules", `${source}/node_modules`]);
  run("registry-metadata-cache-copy", "cp", ["-a", "/opt/pnpm-cache", "/scratch/cache/pnpm"]);
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  result.isolation = await preflight();
  run("linux-dependencies-offline-prepare", "pnpm", ["install", "--offline", "--frozen-lockfile", "--ignore-scripts", "--store-dir", "/scratch/pnpm-store"], { env: { ...env, NODE_ENV: "development" } });
  let databaseReady = false;
  try {
    run("postgres-init", "initdb", ["-D", pgdata, "-U", "qa_owner", "--auth=trust", "--encoding=UTF8", "--locale=C.UTF-8"]);
    run("postgres-start", "pg_ctl", ["-D", pgdata, "-l", "/scratch/postgres.log", "-o", "-h 127.0.0.1 -p 55432 -k /scratch", "-w", "start"]);
    run("database-create", "createdb", ["-h", "127.0.0.1", "-p", "55432", "-U", "qa_owner", "laonshop_qa"]);
    run("schema", "pnpm", ["exec", "prisma", "db", "push", "--skip-generate"]);
    for (const file of ["ops/laonpay-billing/sql/001_additive.sql", "ops/storefront/001_additive.sql", "ops/storefront/002_post_verify.sql"])
      run(`sql:${path.basename(path.dirname(file))}/${path.basename(file)}`, "psql", [env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-f", file]);
    run("seed", "pnpm", ["exec", "tsx", "prisma/seed.ts"]);
    fs.writeFileSync(stateFile, JSON.stringify({ databaseUrl: env.DATABASE_URL, appPort: 3104, secret: env.SESSION_SECRET }), { mode: 0o600 });
    run("fixtures", "node", ["--import", "tsx", "tests/integration/storefront-fixtures.mjs"]);
    databaseReady = true;
  } catch (error) { result.databaseSetupError = cleanError(error); }
  attempt("unit-regression", "pnpm", ["test"]);
  attempt("lint", "pnpm", ["lint", "--max-warnings", "0"]);
  const buildReady = attempt("production-build", "pnpm", ["build"]);
  // Next writes next-env and route types into this disposable source copy.
  attempt("typecheck", "pnpm", ["typecheck"]);
  if (databaseReady) {
    attempt("commerce-service", "node", ["--import", "tsx", "tests/integration/storefront-database-qa.mjs"]);
    attempt("security-pg-route", "node", ["--import", "tsx", "tests/integration/security-pg-route-qa.mjs"]);
  } else { dependent("commerce-service", "ISOLATED_DATABASE_SETUP_FAILED"); dependent("security-pg-route", "ISOLATED_DATABASE_SETUP_FAILED"); }
  if (databaseReady && buildReady) {
    const app = spawn("pnpm", ["exec", "next", "start", "-H", "127.0.0.1", "-p", "3104"], { cwd: source, env, stdio: "ignore" }); apps.push(app);
    try {
      await waitApp(3104);
      attempt("commerce-browser-http", "node", ["tests/integration/storefront-browser-qa.mjs"]);
      attempt("security-browser-http", "node", ["--import", "tsx", "tests/integration/security-browser-qa.mjs"]);
    } catch (error) { result.applicationError = cleanError(error); dependent("commerce-browser-http", "ISOLATED_APPLICATION_UNAVAILABLE"); dependent("security-browser-http", "ISOLATED_APPLICATION_UNAVAILABLE"); }
  } else { dependent("commerce-browser-http", "BUILD_OR_DATABASE_NOT_READY"); dependent("security-browser-http", "BUILD_OR_DATABASE_NOT_READY"); }
  result.status = stages.every(stage => stage.code === 0) ? "PASS" : "FAIL";
} catch (error) {
  result.error = cleanError(error);
  // Diagnostic text stays in disposable scratch and is never promoted by the host runner.
  if (error.diagnosticTail) fs.writeFileSync("/scratch/diagnostic.txt", error.diagnosticTail, { mode: 0o600 });
  result.status = interrupted ? "INTERRUPTED" : "FAIL";
} finally {
  stop();
  try { spawnSync("pg_ctl", ["-D", pgdata, "-m", "immediate", "stop"], { env, stdio: "ignore", timeout: 10000 }); } catch { /* Cleanup is owned by container teardown as well. */ }
  result.finishedAt = new Date().toISOString();
  result.evidence = {};
  for (const [key, file] of Object.entries({ commerceService: "database-results.json", commerceBrowser: "browser-results.json", securityBrowser: "security-browser-results.json", securityPgRoute: "security-pg-route-results.json" })) {
    let fd;
    try {
      fd = fs.openSync(`${output}/${file}`, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 1048576) throw new Error("EVIDENCE_FILE_INVALID");
      result.evidence[key] = summarizeEvidence(JSON.parse(fs.readFileSync(fd, "utf8")), key);
    } catch { result.evidence[key] = { status: "NOT_RUN", count: 0 }; }
    finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  try { validateEvidence(result.evidence); } catch { if (result.status === "PASS") result.status = "FAIL"; result.evidenceError = "REQUIRED_EVIDENCE_INVALID"; }
  fs.writeFileSync("/scratch/result.json", JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "PASS" ? 0 : result.status === "INTERRUPTED" ? 130 : 1;
}
