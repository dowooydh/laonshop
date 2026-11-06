import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { cleanSourceRef } from "./security.mjs";
import { cleanEnvironment, createOutput, interruptionController, root, saveJson } from "./runner-support.mjs";

const usage = "사용법: pnpm qa:full [--security-evidence <저장소 밖 증거 디렉터리>]";
const validRef = (ref) => typeof ref === "string" && /^[a-f0-9]{40}$/.test(ref);

export function fullPlan(args = []) {
  const security = ["scripts/qa/security.mjs"];
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--security-evidence" || !args[1]?.trim() || args[1].startsWith("-")) throw new Error(usage);
    security.push("--evidence-dir", path.resolve(args[1]));
  }
  return [
    ...(args.length ? [{ name: "security", kind: "node", args: security, blockedExitCodes: [2] }] : []),
    { name: "local-security", kind: "node", args: ["scripts/qa/local-security.mjs"], blockedExitCodes: [2] },
    { name: "qa-harness", kind: "node", args: ["--test", "tests/qa/*.test.mjs"] },
    // Product tests, lint, typecheck, build and browser execution belong to
    // this isolated snapshot runner, never to the host checkout with .env.
    { name: "isolated", kind: "node", args: ["scripts/qa/isolated.mjs"], blockedExitCodes: [2], cleanupOwner: true },
  ];
}

export async function runFullStages(plan, execute, signal) {
  const stages = [];
  let interrupted = false;
  for (const stage of plan) {
    if (signal.aborted || interrupted) {
      interrupted = true;
      stages.push({ name: stage.name, status: "not-run", reason: "INTERRUPTED" });
      continue;
    }
    let execution;
    try { execution = await execute(stage, signal); }
    catch { execution = { code: null, spawnError: "STAGE_EXECUTION_ERROR" }; }
    let status = "failed", reason = null;
    if (signal.aborted || execution.code === 130 || execution.signal === "SIGINT") { interrupted = true; reason = "INTERRUPTED"; }
    else if (execution.spawnError) reason = "STAGE_EXECUTION_ERROR";
    else if (execution.signal) reason = "STAGE_TERMINATED";
    else if (execution.evidenceBlocked) { status = "blocked"; reason = "ISOLATED_EVIDENCE_BLOCKED"; }
    else if (execution.code === 0) status = "passed";
    else if (stage.blockedExitCodes?.includes(execution.code)) { status = "blocked"; reason = "EVIDENCE_OR_ISOLATION_BLOCKED"; }
    else reason = "STAGE_FAILED";
    stages.push({ ...execution, name: stage.name, status, reason });
  }
  return { success: stages.every((stage) => stage.status === "passed"), interrupted, stages };
}

export async function runVerifiedFullStages(plan, execute, signal, readSourceRef = cleanSourceRef) {
  const securityAuditRequested = plan.some((stage) => stage.name === "security");
  const read = () => { try { const ref = readSourceRef(); return validRef(ref) ? ref : null; } catch { return null; } };
  const sourceRef = read();
  let securitySourceRef = null;
  let isolatedSourceRef = null;
  const summary = await runFullStages(plan, async (stage, stageSignal) => {
    const execution = await execute(stage, stageSignal);
    if (stage.name === "security" && execution.code === 0) securitySourceRef = execution.sourceRef ?? null;
    if (stage.name === "isolated" && execution.code === 0 && !execution.evidenceBlocked) isolatedSourceRef = execution.isolatedSourceRef ?? null;
    return execution;
  }, signal);
  const finalSourceRef = read();
  const sourceVerified = sourceRef !== null && finalSourceRef === sourceRef;
  const securitySourceVerified = sourceVerified && validRef(securitySourceRef) && securitySourceRef === sourceRef;
  const isolatedSourceVerified = sourceVerified && validRef(isolatedSourceRef) && isolatedSourceRef === sourceRef;
  const securityStage = summary.stages.find((stage) => stage.name === "security");
  return {
    ...summary,
    success: summary.success && sourceVerified && isolatedSourceVerified && (!securityAuditRequested || securitySourceVerified),
    scope: securityAuditRequested ? "required-qa-and-security-audit" : "required-qa",
    optionalEvidenceRequested: securityAuditRequested,
    securityAuditRequested,
    securityAuditStatus: securityStage?.status === "passed" && !securitySourceVerified ? "blocked" : securityStage?.status ?? "not-run",
    securityAuditComplete: securityStage?.status === "passed" && securitySourceVerified,
    sourceRef, finalSourceRef, sourceVerified,
    sourceChanged: sourceRef !== null && finalSourceRef !== sourceRef,
    securitySourceRef, securitySourceVerified, isolatedSourceRef, isolatedSourceVerified,
  };
}

export const isolatedRequiredStages = ["test", "lint", "typecheck", "build", "browser"];

export function isolatedEvidenceResult(receipt) {
  const blocked = (reason) => ({ status: "blocked", reason });
  if (receipt?.kind !== "isolated" || receipt.status !== "PASS" || receipt.success !== true ||
      !validRef(receipt.sourceRef) || receipt.finalSourceRef !== receipt.sourceRef)
    return blocked("격리 실행의 완료·현재 source SHA 증거 누락");
  if (!Array.isArray(receipt.stages) || new Set(receipt.stages.map((stage) => stage?.name)).size !== receipt.stages.length ||
      !receipt.stages.every((stage) => typeof stage?.name === "string" && stage.status === "passed") ||
      isolatedRequiredStages.some((name) => receipt.stages.filter((stage) => stage.name === name).length !== 1))
    return blocked("격리 test/lint/typecheck/build/browser 필수 검사 누락·중복·미완료");
  if (receipt.cleanup?.status !== "PASS") return blocked("격리 실행의 정리 완료 증거 누락");
  return { status: "pass", sourceRef: receipt.sourceRef, reason: "동일 SHA의 격리 필수 5검사와 정리 확인" };
}

function parseReceipt(bytes) {
  const text = Buffer.concat(bytes).toString("utf8").trim();
  try { return JSON.parse(text); } catch { /* Trusted runners may emit progress metadata before the final line. */ }
  for (const line of text.split("\n").reverse()) {
    try { return JSON.parse(line); } catch { /* Do not retain or echo unstructured child output. */ }
  }
  return null;
}

export function stageCommand(stage, packageRunner = process.env.npm_execpath) {
  if (stage.kind === "node") return { command: process.execPath, args: stage.args };
  if (typeof packageRunner === "string" && /(?:^|\/)pnpm(?:\.cjs|\.mjs|\.js)$/.test(packageRunner))
    return { command: process.execPath, args: [packageRunner, "run", stage.script] };
  return { command: "pnpm", args: ["run", stage.script] };
}

export function executeStage(stage, signal, output, environment) {
  const startedAt = new Date().toISOString();
  const { command, args } = stageCommand(stage, environment.npm_execpath);
  const detached = process.platform !== "win32" && !stage.cleanupOwner;
  const child = spawn(command, args, { cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"], detached });
  const hashes = { stdout: createHash("sha256"), stderr: createHash("sha256") };
  const byteCounts = { stdout: 0, stderr: 0 };
  const receiptChunks = [];
  for (const name of ["stdout", "stderr"]) child[name].on("data", (bytes) => {
    byteCounts[name] += bytes.length;
    hashes[name].update(bytes);
    // Only this repository's small, metadata-only evidence result is parsed.
    // General child output (which may contain test input) is never retained.
    if (["security", "isolated"].includes(stage.name) && name === "stdout" && byteCounts.stdout <= 256 * 1024) receiptChunks.push(bytes);
  });
  return new Promise((resolve) => {
    let spawnError = null;
    const interrupt = () => {
      try {
        if (detached && child.pid) process.kill(-child.pid, "SIGTERM");
        else child.kill("SIGTERM");
      } catch { /* The owned process may already have finished. */ }
    };
    child.on("error", () => { spawnError = "SPAWN_ERROR"; });
    child.once("close", (code, childSignal) => {
      signal.removeEventListener("abort", interrupt);
      const execution = {
        code, signal: childSignal, spawnError, startedAt, finishedAt: new Date().toISOString(),
        stdout: { bytes: byteCounts.stdout, sha256: hashes.stdout.digest("hex") },
        stderr: { bytes: byteCounts.stderr, sha256: hashes.stderr.digest("hex") },
        rawOutputRetained: false,
      };
      if (stage.name === "security" && byteCounts.stdout <= 256 * 1024) {
        try {
          const receipt = parseReceipt(receiptChunks);
          if (["PASS", "FAIL", "BLOCKED"].includes(receipt.status)) {
            execution.securityEvidence = {
              status: receipt.status,
              sourceRef: validRef(receipt.source_ref) ? receipt.source_ref : null,
              stages: Object.fromEntries(Object.entries(receipt.stages ?? {}).filter(([name, outcome]) =>
                ["source", "evidence", "pentagi", "cloudflare", "independentReview"].includes(name) &&
                ["pass", "fail", "blocked"].includes(outcome?.status)).map(([name, outcome]) =>
                [name, { status: outcome.status, reason: typeof outcome.reason === "string" ? outcome.reason.slice(0, 240) : null }])),
            };
          }
          if (code === 0 && receipt.success === true && receipt.status === "PASS" && validRef(receipt.source_ref)) execution.sourceRef = receipt.source_ref;
        } catch { /* Missing/invalid evidence identity prevents a full PASS. */ }
      }
      if (stage.name === "isolated" && code === 0) {
        const receipt = byteCounts.stdout <= 256 * 1024 ? parseReceipt(receiptChunks) : null;
        const outcome = isolatedEvidenceResult(receipt);
        execution.isolatedEvidence = { ...outcome, requiredStages: isolatedRequiredStages };
        if (outcome.status === "pass") execution.isolatedSourceRef = outcome.sourceRef;
        else execution.evidenceBlocked = true;
      }
      const metadataFile = path.join(output, `${stage.name}.json`);
      try {
        saveJson(metadataFile, { name: stage.name, ...execution });
        resolve({ ...execution, metadataFile });
      } catch {
        resolve({ ...execution, spawnError: "ARTIFACT_WRITE_ERROR", metadataFile: null });
      }
    });
    signal.addEventListener("abort", interrupt, { once: true });
    if (signal.aborted) interrupt();
  });
}

export async function main(args = process.argv.slice(2)) {
  const plan = fullPlan(args);
  const output = createOutput("full");
  const environment = { ...cleanEnvironment(), QA_FULL_OUTPUT_DIR: output };
  const control = interruptionController();
  try {
    console.log(JSON.stringify({ kind: "full-start", output, stages: plan.map((stage) => stage.name), optionalEvidenceRequested: plan.some((stage) => stage.name === "security") }));
    const summary = await runVerifiedFullStages(plan, (stage, signal) => executeStage(stage, signal, output, environment), control.signal);
    const status = summary.success ? "PASS" : control.signal.aborted || summary.interrupted ? "INTERRUPTED" : summary.stages.some((stage) => stage.status === "failed") ? "FAIL" : "BLOCKED";
    const final = { kind: "full", status, ...summary, finishedAt: new Date().toISOString() };
    const summaryFile = path.join(output, "summary.json");
    saveJson(summaryFile, final);
    console.log(JSON.stringify({ ...final, summaryFile }));
    return status === "PASS" ? 0 : status === "INTERRUPTED" ? 130 : status === "BLOCKED" ? 2 : 1;
  } finally { control.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", reason: error.message === usage ? usage : "전체 QA 실행기 오류; 원문 출력은 보존하지 않습니다." }));
    process.exitCode = 1;
  });
}
