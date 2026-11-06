// Parent-side controller. Docker preparation is explicit; target execution is offline.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root, createOutput, saveJson } from "./runner-support.mjs";
import { validateEvidence } from "./isolated-evidence.mjs";

export const dockerContext = "colima-laonshop-security-20261106";
export const colimaProfile = "laonshop-security-20261106";
export const requiredStages = ["unit-regression", "lint", "typecheck", "production-build", "commerce-service", "commerce-browser-http", "security-browser-http", "security-pg-route"];
const parentEnv = () => ({ PATH: process.env.PATH || "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin", HOME: os.homedir(), LANG: "C.UTF-8", GIT_OPTIONAL_LOCKS: "0" });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function command(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, env: parentEnv(), stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024, timeout: 30000, ...options });
}
const docker = (args, options = {}) => command("docker", ["--context", dockerContext, ...args], options);

export function assertCleanSource(git = args => command("git", args).toString()) {
  const status = git(["-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ".", ":(exclude,top).codex-attachments/**"]);
  if (status.length) throw new Error("SOURCE_DIRTY");
  const ref = git(["rev-parse", "HEAD"]).trim();
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error("SOURCE_REF_INVALID");
  return ref;
}

export function containerArgs({ name, image, sourceRef, vmInput }) {
  if (!/^laonshop-qa-[a-f0-9]{16}$/.test(name) || !/^laonshop-qa-sandbox:[a-f0-9]{20}$/.test(image) || !/^[a-f0-9]{40}$/.test(sourceRef) || !/^\/var\/tmp\/laonshop-qa-[a-f0-9]{16}\/input$/.test(vmInput)) throw new Error("CONTAINER_IDENTITY_INVALID");
  return ["run", "--name", name, "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000", "--cpus", "2", "--memory", "3584m", "--memory-swap", "3584m", "--pids-limit", "256", "--ulimit", "nofile=4096:4096", "--ulimit", "nproc=256:256", "--ulimit", "fsize=268435456:268435456", "--ulimit", "cpu=1200:1200", "--tmpfs", "/scratch:rw,exec,nosuid,nodev,size=2147483648,uid=1000,gid=1000,mode=0700", "--mount", `type=bind,src=${vmInput},dst=/input,readonly`, "--label", "laonshop.qa.owner=isolated-runner", image, sourceRef];
}

export function validateRuntimeReceipt(value, sourceRef, inspect) {
  if (!value || value.sourceRef !== sourceRef || !["PASS", "FAIL", "INTERRUPTED"].includes(value.status) || !Array.isArray(value.stages)) throw new Error("RUNTIME_RECEIPT_INVALID");
  const host = inspect?.HostConfig;
  if (host?.NetworkMode !== "none" || host.ReadonlyRootfs !== true || host.Privileged || host.PidsLimit !== 256 || host.Memory !== 3584 * 1024 * 1024 || host.NanoCpus !== 2000000000 || inspect.Config?.User !== "1000:1000" || !host.CapDrop?.includes("ALL") || !host.SecurityOpt?.includes("no-new-privileges")) throw new Error("ISOLATION_INSPECT_INVALID");
  if (inspect.Mounts?.some(mount => mount.Type !== "tmpfs" && (mount.Destination !== "/input" || mount.RW !== false))) throw new Error("UNEXPECTED_MOUNT");
  if (value.status === "PASS" && (value.isolation?.status !== "PASS" || ["exec", "nosuid", "nodev", "writable"].some(flag => value.isolation?.scratchMount?.[flag] !== true) || value.stages.some(stage => stage.code !== 0) || requiredStages.some(name => value.stages.filter(stage => stage.name === name && stage.code === 0).length !== 1))) throw new Error("REQUIRED_STAGE_MISSING");
  if (value.status === "PASS") {
    const unit = value.stages.find(stage => stage.name === "unit-regression")?.counts;
    if (!(unit?.tests > 0 && unit.pass === unit.tests && unit.fail === 0 && unit.skipped === 0)) throw new Error("UNIT_COUNTS_INVALID");
    validateEvidence(value.evidence);
  }
  return value;
}

export function imageIdentity(cwd = root) {
  const files = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "prisma/schema.prisma", "app/fonts.ts", "scripts/qa/Dockerfile.isolated", "scripts/qa/isolated-runtime.mjs", "scripts/qa/isolated-evidence.mjs"];
  const fontInputs = fontCache(null);
  const inputs = files.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(cwd, file))) }));
  const fingerprint = hash(JSON.stringify({ inputs, fontInputs }));
  return { image: `laonshop-qa-sandbox:${fingerprint.slice(0, 20)}`, fingerprint, inputs };
}

function fontCache(destination) {
  if (destination) fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const cssFolder = path.join(root, ".next/static/css");
  if (!fs.existsSync(cssFolder)) throw new Error("FONT_CACHE_MISSING");
  const families = { "Space Grotesk": [], "JetBrains Mono": [] }, fonts = new Map();
  for (const file of fs.readdirSync(cssFolder)) {
    if (!file.endsWith(".css")) continue;
    for (const match of fs.readFileSync(path.join(cssFolder, file), "utf8").matchAll(/@font-face\{[^}]+\}/g)) {
      for (const family of Object.keys(families)) if (match[0].includes(`font-family:${family};`) && match[0].includes("/_next/static/media/")) {
        const rewritten = match[0].replace(/\/_next\/static\/media\/([^\s)]+\.woff2)/g, (_, name) => {
          const bytes = fs.readFileSync(path.join(root, ".next/static/media", name));
          if (destination) fs.writeFileSync(path.join(destination, name), bytes, { mode: 0o600 }); fonts.set(name, { name, sha256: hash(bytes) });
          return `/opt/qa/fonts/${name}`;
        });
        families[family].push(rewritten);
      }
    }
  }
  if (!families["Space Grotesk"].length || !families["JetBrains Mono"].length) throw new Error("FONT_CACHE_INCOMPLETE");
  const responses = `const fonts=${JSON.stringify(Object.fromEntries(Object.entries(families).map(([name, rules]) => [name, rules.join("\n")])))};module.exports=new Proxy({}, {get(_target,url){if(typeof url!=="string")return undefined;if(url.startsWith("https://fonts.googleapis.com/css2?family=Space+Grotesk:"))return fonts["Space Grotesk"];if(url.startsWith("https://fonts.googleapis.com/css2?family=JetBrains+Mono:"))return fonts["JetBrains Mono"];return undefined;}});\n`;
  if (destination) fs.writeFileSync(path.join(destination, "responses.cjs"), responses, { mode: 0o600 });
  return { inputSha256: hash(fs.readFileSync(path.join(root, "app/fonts.ts"))), source: "existing-local-Next-build-cache; real-WOFF2; provenance-limited-to-current-cache", responseSha256: hash(responses), assets: [...fonts.values()] };
}

async function capture(commandName, args, options = {}) {
  const child = spawn(commandName, args, { cwd: root, env: parentEnv(), stdio: ["ignore", "pipe", "pipe"], ...options });
  const streams = { stdout: [], stderr: [] }, bytes = { stdout: 0, stderr: 0 }, digests = { stdout: createHash("sha256"), stderr: createHash("sha256") };
  for (const name of Object.keys(streams)) child[name].on("data", chunk => { bytes[name] += chunk.length; digests[name].update(chunk); if (bytes[name] <= 2 * 1024 * 1024) streams[name].push(chunk); });
  let interrupted = false;
  const stop = () => { interrupted = true; options.onStop?.(); child.kill("SIGTERM"); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
  const timer = setTimeout(() => { options.onStop?.(); child.kill("SIGTERM"); }, options.timeoutMs || 1200000);
  const execution = await new Promise(resolve => { child.once("error", () => resolve({ code: null, spawnError: true })); child.once("close", (code, signal) => resolve({ code, signal })); });
  clearTimeout(timer); process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
  return { ...execution, interrupted, stdout: Buffer.concat(streams.stdout).toString(), stderr: Buffer.concat(streams.stderr).toString(), byteCounts: bytes, hashes: Object.fromEntries(Object.keys(digests).map(name => [name, digests[name].digest("hex")])) };
}

async function prepare(output) {
  const identity = imageIdentity();
  const context = path.join(output, "prepare"); fs.mkdirSync(context, { mode: 0o700 }); fs.mkdirSync(path.join(context, "prisma")); fs.mkdirSync(path.join(context, "tools"));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
  fs.writeFileSync(path.join(context, "package.json"), JSON.stringify(manifest, null, 2));
  for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "prisma/schema.prisma"]) fs.copyFileSync(path.join(root, file), path.join(context, file));
  const schema = fs.readFileSync(path.join(context, "prisma/schema.prisma"), "utf8");
  if ((schema.match(/generator\s+/g) || []).length !== 1 || !/provider\s*=\s*"prisma-client-js"/.test(schema) || /\boutput\s*=/.test(schema)) throw new Error("UNEXPECTED_GENERATOR_PREPARATION");
  fs.copyFileSync(path.join(root, "scripts/qa/Dockerfile.isolated"), path.join(context, "Dockerfile"));
  fs.copyFileSync(path.join(root, "scripts/qa/isolated-runtime.mjs"), path.join(context, "tools/isolated-runtime.mjs"));
  fs.copyFileSync(path.join(root, "scripts/qa/isolated-evidence.mjs"), path.join(context, "tools/isolated-evidence.mjs"));
  const fonts = fontCache(path.join(context, "fonts"));
  const execution = await capture("docker", ["--context", dockerContext, "build", "--label", `laonshop.qa.inputs=${identity.fingerprint}`, "--tag", identity.image, context], { timeoutMs: 1200000 });
  const summary = { kind: "isolated-prepare", status: execution.code === 0 ? "PASS" : execution.interrupted ? "INTERRUPTED" : "BLOCKED", code: execution.code, dockerContext, ...identity, fonts, networkScope: "trusted tool/dependency preparation only; no application or operating credentials", outputHashes: execution.hashes, outputBytes: execution.byteCounts, rawOutputRetained: false };
  saveJson(path.join(output, "summary.json"), summary);
  console.log(JSON.stringify({ ...summary, output }));
  if (execution.code !== 0) {
    // Preparation has only dependency metadata and no source/user/secret input.
    console.error(JSON.stringify({ reason: "SANDBOX_IMAGE_PREPARATION_FAILED", diagnostic: execution.stderr.split("\n").filter(line => /ERROR|failed|not found/i.test(line)).map(line => line.replace(/(?:password|token|secret)=\S+/gi, "[redacted]")).slice(-8) }));
  }
  return execution.interrupted ? 130 : execution.code === 0 ? 0 : 2;
}

export async function main(args = process.argv.slice(2)) {
  const output = createOutput("isolated");
  const name = `laonshop-qa-${randomBytes(8).toString("hex")}`, vmBase = `/var/tmp/${name}`;
  let createdContainer = false, sourceRef = null, cleanupComplete = false, interrupted = false;
  const stop = () => { interrupted = true; if (createdContainer) { try { docker(["kill", name]); } catch { /* The owned container may not exist yet. */ } } };
  const checkInterrupted = () => { if (interrupted) throw new Error("INTERRUPTED"); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
  const cleanup = () => {
    let ownedContainerRemoved = !createdContainer, ownedVmInputRemoved = false;
    if (createdContainer) {
      try { docker(["rm", "--force", name]); } catch { /* Absence is verified independently below. */ }
      try { ownedContainerRemoved = docker(["container", "ls", "--all", "--filter", `name=^${name}$`, "--format", "{{.Names}}"] ).toString().trim() === ""; } catch { ownedContainerRemoved = false; }
    }
    try { command("colima", ["ssh", "--profile", colimaProfile, "--", "rm", "-rf", vmBase]); command("colima", ["ssh", "--profile", colimaProfile, "--", "test", "!", "-e", vmBase]); ownedVmInputRemoved = true; } catch { /* No other path may be cleaned. */ }
    const status = ownedContainerRemoved && ownedVmInputRemoved ? "PASS" : "FAIL";
    cleanupComplete = status === "PASS";
    return { status, ownedContainerRemoved, ownedVmInputRemoved, listenerNamespaceDestroyed: ownedContainerRemoved, unrelatedProfilesUntouched: true };
  };
  try {
    docker(["info", "--format", "{{.ServerVersion}}"]); checkInterrupted();
    if (args.length === 1 && args[0] === "--prepare") return await prepare(output);
    if (args.length) throw new Error("UNKNOWN_ARGUMENT");
    sourceRef = assertCleanSource(); checkInterrupted();
    if (/^(?:120000|160000) /m.test(command("git", ["ls-files", "--stage"]).toString())) throw new Error("SOURCE_LINK_OR_SUBMODULE_REQUIRES_REVIEW");
    const identity = imageIdentity();
    try { const label = docker(["image", "inspect", identity.image, "--format", '{{index .Config.Labels "laonshop.qa.inputs"}}']).toString().trim(); assert.equal(label, identity.fingerprint); } catch { throw new Error("SANDBOX_IMAGE_NOT_PREPARED"); }
    checkInterrupted();
    const archive = path.join(output, "source.tar"); command("git", ["archive", "--format=tar", `--output=${archive}`, sourceRef], { maxBuffer: 1024 * 1024 });
    command("colima", ["ssh", "--profile", colimaProfile, "--", "mkdir", "-p", `${vmBase}/input`]);
    checkInterrupted();
    const fd = fs.openSync(archive, "r");
    try { command("colima", ["ssh", "--profile", colimaProfile, "--", "sh", "-c", `cat > ${vmBase}/input/source.tar`], { stdio: [fd, "pipe", "pipe"], timeout: 120000 }); } finally { fs.closeSync(fd); }
    command("colima", ["ssh", "--profile", colimaProfile, "--", "chmod", "-R", "a+rX", vmBase]);
    fs.unlinkSync(archive); checkInterrupted();
    createdContainer = true;
    const execution = await capture("docker", ["--context", dockerContext, ...containerArgs({ name, image: identity.image, sourceRef, vmInput: `${vmBase}/input` })], { timeoutMs: 1200000, onStop: () => { try { docker(["kill", name]); } catch { /* May already be stopped. */ } } });
    checkInterrupted();
    const inspect = JSON.parse(docker(["inspect", name]).toString())[0];
    let receipt = null;
    for (const line of execution.stdout.trim().split("\n")) { try { const candidate = JSON.parse(line); if (candidate.kind === "isolated-runtime") receipt = candidate; } catch { /* No raw target output is retained. */ } }
    if (!receipt) throw new Error(execution.interrupted ? "INTERRUPTED" : "RUNTIME_RECEIPT_MISSING");
    validateRuntimeReceipt(receipt, sourceRef, inspect);
    const finalRef = assertCleanSource(); checkInterrupted();
    const cleanupResult = cleanup(); checkInterrupted();
    const passed = name => receipt.stages.some(stage => stage.name === name && stage.code === 0);
    const stages = [{ name: "test", status: passed("unit-regression") ? "passed" : "failed" }, { name: "lint", status: passed("lint") ? "passed" : "failed" }, { name: "typecheck", status: passed("typecheck") ? "passed" : "failed" }, { name: "build", status: passed("production-build") ? "passed" : "failed" }, { name: "browser", status: ["commerce-service", "commerce-browser-http", "security-browser-http", "security-pg-route"].every(passed) ? "passed" : "failed" }];
    const success = execution.code === 0 && receipt.status === "PASS" && finalRef === sourceRef && cleanupResult.status === "PASS" && stages.every(stage => stage.status === "passed");
    const summary = { kind: "isolated", status: execution.interrupted ? "INTERRUPTED" : success ? "PASS" : "FAIL", success, sourceRef, finalSourceRef: finalRef, stages, dockerContext, image: identity.image, imageId: inspect.Image, imageFingerprint: identity.fingerprint, execution: { code: execution.code, signal: execution.signal, outputBytes: execution.byteCounts, outputHashes: execution.hashes, rawOutputRetained: false }, runtime: receipt, cleanup: cleanupResult, artifactScope: "ordinary isolated QA; not PentAGI or Cloudflare audit completion" };
    const summaryFile = path.join(output, "summary.json"); saveJson(summaryFile, summary); console.log(JSON.stringify({ ...summary, output, summaryFile }));
    return summary.status === "PASS" ? 0 : summary.status === "INTERRUPTED" ? 130 : 1;
  } catch (error) {
    const summary = { kind: "isolated", status: error.message === "INTERRUPTED" ? "INTERRUPTED" : "BLOCKED", success: false, sourceRef, reason: /^[A-Z_]+$/.test(error.message) ? error.message : "ISOLATED_RUNNER_PRECONDITION_FAILED", cleanup: cleanup(), output, rawOutputRetained: false };
    saveJson(path.join(output, "summary.json"), summary); console.log(JSON.stringify(summary));
    return summary.status === "INTERRUPTED" ? 130 : 2;
  } finally {
    if (!cleanupComplete && args[0] !== "--prepare") cleanup();
    process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().then(code => { process.exitCode = code; }).catch(() => { console.error(JSON.stringify({ status: "FAIL", reason: "ISOLATED_PARENT_CONTROLLER_ERROR" })); process.exitCode = 1; });
