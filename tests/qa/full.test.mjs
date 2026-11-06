import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { executeStage, fullPlan, isolatedEvidenceResult, isolatedRequiredStages, runFullStages, runVerifiedFullStages, stageCommand } from "../../scripts/qa/full.mjs";
import { cleanEnvironment } from "../../scripts/qa/runner-support.mjs";

const requiredStages = ["local-security", "qa-harness", "isolated"];

test("부모 실행기는 pnpm run/exec 자동 설치 없이 신뢰된 Node 제어기만 호출한다", () => {
  for (const stage of fullPlan()) assert.equal(stage.kind, "node");
  assert.deepEqual(fullPlan().find(stage => stage.name === "local-security").args, ["scripts/qa/local-security.mjs"]);
});
const expectedStages = ["security", ...requiredStages];
const sourceRef = "1".repeat(40);
const optionalPlan = () => fullPlan(["--security-evidence", "/tmp/synthetic-laonshop-evidence"]);
const isolatedReceipt = () => ({ kind: "isolated", status: "PASS", success: true, sourceRef, finalSourceRef: sourceRef, stages: isolatedRequiredStages.map((name) => ({ name, status: "passed" })), cleanup: { status: "PASS" } });

test("전체 QA는 보안·실행기·기존 회귀·정적·격리 빌드/동적 검사를 필수로 실행한다", () => {
  const plan = fullPlan(["--security-evidence", "/tmp/laonshop evidence"]);
  assert.deepEqual(plan.map((stage) => stage.name), expectedStages);
  assert.deepEqual(plan[0].args, ["scripts/qa/security.mjs", "--evidence-dir", path.resolve("/tmp/laonshop evidence")]);
  assert.deepEqual(plan.at(-1).args, ["scripts/qa/isolated.mjs"]);
  assert.equal(plan.at(-1).cleanupOwner, true);
  assert.deepEqual(fullPlan([]).map((stage) => stage.name), requiredStages);
  assert.equal(plan.some((stage) => ["test", "lint", "typecheck", "build"].includes(stage.script)), false);
  for (const args of [["--skip-security"], ["--security-evidence"], ["--security-evidence", " "], ["--security-evidence", "--skip-security"], ["--security-evidence", "/tmp/evidence", "--skip-security"]]) assert.throws(() => fullPlan(args), /사용법/);
});

test("기본 필수 QA는 추가 감사 미실행을 표시하며 clean SHA의 필수 검사만 통과할 수 있다", async () => {
  const invoked = [];
  const outcome = await runVerifiedFullStages(fullPlan(), async (stage) => { invoked.push(stage.name); return { code: 0, ...(stage.name === "isolated" ? { isolatedSourceRef: sourceRef } : {}) }; }, new AbortController().signal, () => sourceRef);
  assert.deepEqual(invoked, requiredStages); assert.equal(outcome.success, true);
  assert.equal(outcome.scope, "required-qa"); assert.equal(outcome.optionalEvidenceRequested, false);
  assert.equal(outcome.securityAuditRequested, false); assert.equal(outcome.securityAuditStatus, "not-run"); assert.equal(outcome.securityAuditComplete, false);
  assert.equal(outcome.securitySourceRef, null); assert.equal(outcome.securitySourceVerified, false);
});

test("기본 필수 QA도 보안·회귀 실패와 소스 변경을 거절한다", async () => {
  for (const failure of [...requiredStages, "source"]) {
    let reads = 0;
    const outcome = await runVerifiedFullStages(fullPlan(), async (stage) => ({ code: stage.name === failure ? 1 : 0, ...(stage.name === "isolated" ? { isolatedSourceRef: sourceRef } : {}) }), new AbortController().signal, () => { reads += 1; return failure === "source" && reads === 2 ? "2".repeat(40) : sourceRef; });
    assert.equal(outcome.success, false); assert.equal(outcome.securityAuditStatus, "not-run"); assert.equal(outcome.securityAuditComplete, false);
  }
});

test("security BLOCKED여도 독립 가능한 나머지 검사를 계속하며 전체는 success false다", async () => {
  const invoked = [];
  const outcome = await runFullStages(optionalPlan(), async (stage) => { invoked.push(stage.name); return { code: stage.name === "security" ? 2 : 0 }; }, new AbortController().signal);
  assert.deepEqual(invoked, expectedStages); assert.equal(outcome.success, false);
  assert.deepEqual(outcome.stages.map((stage) => stage.status), ["blocked", "passed", "passed", "passed"]);
});

test("격리 조건/지역 증거 BLOCKED와 실제 회귀 실패를 구분하고 남은 검사를 유지한다", async () => {
  const outcome = await runFullStages(optionalPlan(), async () => ({ code: 2 }), new AbortController().signal);
  assert.equal(outcome.success, false);
  for (const name of ["security", "local-security", "isolated"]) assert.equal(outcome.stages.find((stage) => stage.name === name).status, "blocked");
  assert.equal(outcome.stages.find((stage) => stage.name === "qa-harness").status, "failed");
});

test("실행 실패·자식 signal 종료는 숨기지 않으며 다른 독립 검사를 실행한다", async () => {
  const invoked = [];
  const outcome = await runFullStages(optionalPlan(), async (stage) => {
    invoked.push(stage.name);
    if (stage.name === "security") return { code: 1 };
    if (stage.name === "qa-harness") throw new Error("synthetic");
    if (stage.name === "local-security") return { code: null, signal: "SIGTERM" };
    return { code: 0 };
  }, new AbortController().signal);
  assert.deepEqual(invoked, expectedStages); assert.equal(outcome.success, false);
  assert.equal(outcome.stages[2].reason, "STAGE_EXECUTION_ERROR"); assert.equal(outcome.stages[1].reason, "STAGE_TERMINATED"); assert.equal(outcome.stages.at(-1).status, "passed");
});

test("사용자 중단은 현재 단계도 PASS로 판정하지 않고 후속 실행을 멈춘다", async () => {
  const controller = new AbortController(), invoked = [];
  const outcome = await runFullStages(optionalPlan(), async (stage) => { invoked.push(stage.name); controller.abort(); return { code: 0 }; }, controller.signal);
  assert.deepEqual(invoked, ["security"]); assert.equal(outcome.success, false);
  assert.equal(outcome.stages[0].status, "failed"); assert.equal(outcome.stages[0].reason, "INTERRUPTED");
  assert.ok(outcome.stages.slice(1).every((stage) => stage.status === "not-run" && stage.reason === "INTERRUPTED"));
});

test("자식의 INTERRUPTED exit130도 후속 실행을 멈춘다", async () => {
  const invoked = [];
  const outcome = await runFullStages(optionalPlan(), async (stage) => { invoked.push(stage.name); return { code: stage.name === "local-security" ? 130 : 0 }; }, new AbortController().signal);
  assert.deepEqual(invoked, expectedStages.slice(0, 2)); assert.equal(outcome.interrupted, true); assert.equal(outcome.success, false);
  assert.equal(outcome.stages[1].reason, "INTERRUPTED"); assert.ok(outcome.stages.slice(2).every((stage) => stage.status === "not-run"));
});

test("시작·종료·보안 증거 SHA는 모두 같고 깨끗해야 전체 PASS다", async () => {
  for (const [first, last, evidence, success] of [
    [sourceRef, sourceRef, sourceRef, true], [sourceRef, "2".repeat(40), sourceRef, false],
    [sourceRef, null, sourceRef, false], [null, sourceRef, sourceRef, false], [null, null, sourceRef, false],
    [sourceRef, sourceRef, null, false], [sourceRef, sourceRef, "2".repeat(40), false], [sourceRef, sourceRef, "invalid", false],
    ["invalid", "invalid", "invalid", false],
  ]) {
    const refs = [first, last];
    const outcome = await runVerifiedFullStages(optionalPlan(), async (stage) => ({ code: 0, ...(stage.name === "security" ? { sourceRef: evidence } : {}), ...(stage.name === "isolated" ? { isolatedSourceRef: sourceRef } : {}) }), new AbortController().signal, () => { const ref = refs.shift(); if (ref === null) throw new Error("dirty"); return ref; });
    assert.equal(outcome.success, success); assert.equal(outcome.securitySourceVerified, success);
    assert.equal(outcome.optionalEvidenceRequested, true); assert.equal(outcome.scope, "required-qa-and-security-audit");
    assert.equal(outcome.securityAuditComplete, success); assert.equal(outcome.securityAuditStatus, success ? "passed" : "blocked");
  }
});

test("보안 BLOCKED 실행도 시작/종료 SHA를 기록하고 실행 중 변경을 검출한다", async () => {
  for (const last of [sourceRef, "2".repeat(40), null]) {
    const refs = [sourceRef, last];
    const outcome = await runVerifiedFullStages(optionalPlan(), async (stage) => ({ code: stage.name === "security" ? 2 : 0, ...(stage.name === "isolated" ? { isolatedSourceRef: sourceRef } : {}) }), new AbortController().signal, () => { const ref = refs.shift(); if (ref === null) throw new Error("dirty"); return ref; });
    assert.equal(outcome.sourceRef, sourceRef); assert.equal(outcome.finalSourceRef, last); assert.equal(outcome.sourceVerified, last === sourceRef);
    assert.equal(outcome.sourceChanged, last !== sourceRef); assert.equal(outcome.securitySourceRef, null); assert.equal(outcome.success, false); assert.equal(outcome.securityAuditStatus, "blocked");
  }
});

test("패키지 명령은 shell 보간 없이 현재 pnpm runner를 사용한다", () => {
  assert.deepEqual(stageCommand({ kind: "package", script: "lint" }, "/example/pnpm/bin/pnpm.mjs"), { command: process.execPath, args: ["/example/pnpm/bin/pnpm.mjs", "run", "lint"] });
  assert.deepEqual(stageCommand({ kind: "package", script: "lint" }, "unrelated"), { command: "pnpm", args: ["run", "lint"] });
});

test("격리 receipt는 필수 다섯 검사와 정리·동일 SHA를 모두 요구해 검사 축소를 막는다", () => {
  assert.equal(isolatedEvidenceResult(isolatedReceipt()).status, "pass");
  for (const change of [
    { kind: "target-child" }, { status: "BLOCKED" }, { success: false },
    { sourceRef: "invalid" }, { finalSourceRef: "2".repeat(40) }, { cleanup: { status: "not-run" } },
    { stages: [] }, { stages: isolatedReceipt().stages.slice(0, 4) },
    { stages: [...isolatedReceipt().stages, isolatedReceipt().stages[0]] },
    { stages: isolatedReceipt().stages.map((stage) => stage.name === "browser" ? { ...stage, status: "skipped" } : stage) },
    { stages: [...isolatedReceipt().stages, { name: "api", status: "failed" }] },
  ]) assert.equal(isolatedEvidenceResult({ ...isolatedReceipt(), ...change }).status, "blocked");
});

test("격리 실행 SHA 누락·불일치가 있으면 기본 모드도 전체 PASS가 아니다", async () => {
  for (const ref of [undefined, null, "invalid", "2".repeat(40), sourceRef]) {
    const outcome = await runVerifiedFullStages(fullPlan(), async (stage) => ({ code: 0, ...(stage.name === "isolated" ? { isolatedSourceRef: ref } : {}) }), new AbortController().signal, () => sourceRef);
    assert.equal(outcome.success, ref === sourceRef); assert.equal(outcome.isolatedSourceVerified, ref === sourceRef);
  }
});

test("실제 격리 runner exit0도 receipt 하위 검사 누락이면 BLOCKED이며 종료값을 숨기지 않는다", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-full-isolated-test-"));
  try {
    const stage = (value) => ({ name: "isolated", kind: "node", cleanupOwner: true, args: ["-e", `console.log('progress metadata');console.log(${JSON.stringify(JSON.stringify(value))})`] });
    const good = await executeStage(stage(isolatedReceipt()), new AbortController().signal, directory, cleanEnvironment());
    assert.equal(good.code, 0); assert.equal(good.isolatedSourceRef, sourceRef); assert.equal(good.isolatedEvidence.status, "pass");
    fs.unlinkSync(good.metadataFile);
    const incomplete = { ...isolatedReceipt(), stages: isolatedReceipt().stages.slice(0, 4) };
    const result = await runFullStages([stage(incomplete)], (item, signal) => executeStage(item, signal, directory, cleanEnvironment()), new AbortController().signal);
    assert.equal(result.success, false); assert.equal(result.stages[0].code, 0); assert.equal(result.stages[0].status, "blocked"); assert.equal(result.stages[0].reason, "ISOLATED_EVIDENCE_BLOCKED");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("실제 자식 실행은 원문 대신 exit·시간·출력 bytecount/hash만 보존한다", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-full-output-test-"));
  try {
    const marker = "synthetic-sensitive-value-must-not-be-retained";
    const execution = await executeStage({ name: "synthetic", kind: "node", args: ["-e", `console.log(${JSON.stringify(marker)});console.error('synthetic-stderr');`] }, new AbortController().signal, directory, cleanEnvironment());
    assert.equal(execution.code, 0); assert.equal(execution.rawOutputRetained, false); assert.ok(execution.stdout.bytes > 0); assert.match(execution.stderr.sha256, /^[a-f0-9]{64}$/);
    const raw = fs.readFileSync(execution.metadataFile, "utf8"); assert.ok(!raw.includes(marker)); assert.equal(fs.statSync(execution.metadataFile).mode & 0o777, 0o600);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("자식 security 출력의 PASS·현재 SHA를 읽고 형식 누락은 전체 통과 근거로 쓰지 않는다", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-full-security-test-"));
  try {
    const stage = (value) => ({ name: "security", kind: "node", args: ["-e", `console.log(${JSON.stringify(JSON.stringify(value))})`] });
    const first = await executeStage(stage({ status: "PASS", success: true, source_ref: sourceRef }), new AbortController().signal, directory, cleanEnvironment());
    assert.equal(first.sourceRef, sourceRef);
    fs.unlinkSync(first.metadataFile);
    const second = await executeStage(stage({ status: "PASS", success: true }), new AbortController().signal, directory, cleanEnvironment());
    assert.equal(second.sourceRef, undefined);
    fs.unlinkSync(second.metadataFile);
    const blocked = await executeStage({ name: "security", kind: "node", args: ["-e", `console.log(${JSON.stringify(JSON.stringify({ status: "BLOCKED", success: false, source_ref: sourceRef, stages: { pentagi: { status: "blocked", reason: "실행 증거 미확보" } } }))});process.exitCode=2`] }, new AbortController().signal, directory, cleanEnvironment());
    assert.equal(blocked.code, 2); assert.equal(blocked.sourceRef, undefined); assert.equal(blocked.securityEvidence.stages.pentagi.status, "blocked");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("자체 cleanup 소유 runner에 TERM을 전달하고 사용자 중단을 보존한다", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "laonshop-full-interrupt-test-"));
  try {
    const controller = new AbortController();
    const marker = path.join(directory, "cleanup.json");
    const code = `const fs=require('node:fs');process.on('SIGTERM',()=>{fs.writeFileSync(${JSON.stringify(marker)},'{}');process.exit(0)});setInterval(()=>{},1000);`;
    const timer = setTimeout(() => controller.abort(), 300);
    try {
      const stage = { name: "isolated", kind: "node", args: ["-e", code], cleanupOwner: true };
      const outcome = await runFullStages([stage], (item, signal) => executeStage(item, signal, directory, cleanEnvironment()), controller.signal);
      assert.equal(outcome.success, false); assert.equal(outcome.stages[0].reason, "INTERRUPTED"); assert.ok(fs.existsSync(marker));
    } finally { clearTimeout(timer); }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
