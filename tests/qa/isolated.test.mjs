import assert from "node:assert/strict";
import test from "node:test";
import { expectedChecks, summarizeEvidence } from "../../scripts/qa/isolated-evidence.mjs";
import { assertCleanSource, containerArgs, dockerContext, requiredStages, validateRuntimeReceipt, executionSucceeded } from "../../scripts/qa/isolated.mjs";
const sourceRef = "a".repeat(40);
const identity = { name: "laonshop-qa-1234567890abcdef", image: "laonshop-qa-sandbox:" + "b".repeat(20), sourceRef, vmInput: "/var/tmp/laonshop-qa-1234567890abcdef/input" };
const inspect = () => ({ HostConfig: { Init: true, NetworkMode: "none", ReadonlyRootfs: true, Privileged: false, PidsLimit: 256, Memory: 3584 * 1024 * 1024, NanoCpus: 2000000000, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"] }, Config: { User: "1000:1000" }, Mounts: [{ Type: "bind", Destination: "/input", RW: false }] });
const receipt = () => ({ sourceRef, status: "PASS", servicesCleanup: { status: "PASS" }, isolation: { initReaper: true, status: "PASS", scratchMount: { exec: true, nosuid: true, nodev: true, writable: true } }, stages: requiredStages.map(name => ({ name, code: 0, commandExitCode: 0, processGroupCleanup: { status: "PASS", descendants: { status: "PASS", supported: true, remainingCount: 0 } }, ...(name === "unit-regression" ? { counts: { tests: 186, pass: 186, fail: 0, skipped: 0 } } : {}) })), evidence: Object.fromEntries(Object.entries(expectedChecks).map(([key, checks]) => [key, summarizeEvidence({ status: "PASS", count: checks.length, checks, pageErrors: [], consoleErrors: [], externalWrites: [], anchorOverlaps: [], deniedExternalWrites: [], deniedProviders: [], selfHostedFontsLoaded: true, ledgerCountsUnchanged: true, providerStubCalls: 4, unexpectedFetches: 0, realProviderCalls: 0, cleanup: { status: "PASS" } }, key)])) });
test("isolated runner refuses dirty and invalid source refs", () => {
  assert.throws(() => assertCleanSource(args => args.includes("status") ? " M lib/auth.ts\0" : sourceRef), /SOURCE_DIRTY/);
  assert.throws(() => assertCleanSource(args => args.includes("status") ? "" : "bad"), /SOURCE_REF_INVALID/);
  assert.equal(assertCleanSource(args => args.includes("status") ? "" : sourceRef), sourceRef);
});
test("container has no network or exposed daemon and hard resource constraints", () => {
  const args = containerArgs(identity); assert.equal(dockerContext, "colima-laonshop-security-20261106");
  for (const word of ["--init", "none", "--read-only", "ALL", "no-new-privileges", "1000:1000", "3584m", "256"]) assert.ok(args.includes(word));
  assert.equal(args.some(arg => arg.includes("docker.sock") || arg.includes("/Users/") || arg === "--privileged" || arg === "--publish"), false);
  assert.ok(args.includes(`type=bind,src=${identity.vmInput},dst=/input,readonly`));
  assert.ok(args.includes("/scratch:rw,exec,nosuid,nodev,size=2147483648,uid=1000,gid=1000,mode=0700"));
});
test("foreign container names and mount path traversal are rejected", () => {
  assert.throws(() => containerArgs({ ...identity, name: "production" }), /IDENTITY/);
  assert.throws(() => containerArgs({ ...identity, vmInput: "/var/tmp/../home" }), /IDENTITY/);
});
test("PASS requires every actual unit lint typecheck build and browser stage", () => {
  assert.equal(validateRuntimeReceipt(receipt(), sourceRef, inspect()).status, "PASS");
  const missing = receipt(); missing.stages.pop(); assert.throws(() => validateRuntimeReceipt(missing, sourceRef, inspect()), /REQUIRED_STAGE/);
  const failed = receipt(); failed.stages[0].code = 1; assert.throws(() => validateRuntimeReceipt(failed, sourceRef, inspect()), /REQUIRED_STAGE/);
});
test("wrong SHA, network, privileged mode or writable input cannot certify success", () => {
  assert.throws(() => validateRuntimeReceipt(receipt(), "c".repeat(40), inspect()), /RECEIPT/);
  for (const change of [{ Init: false }, { NetworkMode: "bridge" }, { Privileged: true }, { ReadonlyRootfs: false }, { Memory: 0 }]) {
    const value = inspect(); Object.assign(value.HostConfig, change); assert.throws(() => validateRuntimeReceipt(receipt(), sourceRef, value), /ISOLATION/);
  }
  const mount = inspect(); mount.Mounts[0].RW = true; assert.throws(() => validateRuntimeReceipt(receipt(), sourceRef, mount), /MOUNT/);
});

test("exit zero cannot bypass missing failed or incomplete evidence", () => {
  for (const key of Object.keys(expectedChecks)) {
    const missing = receipt(); delete missing.evidence[key]; assert.throws(() => validateRuntimeReceipt(missing, sourceRef, inspect()), /EVIDENCE/);
    for (const change of [{ status: "FAIL" }, { count: 0 }, { matchedRequiredChecks: 0 }, { exactChecks: false }, { invariants: {} }]) {
      const value = receipt(); Object.assign(value.evidence[key], change); assert.throws(() => validateRuntimeReceipt(value, sourceRef, inspect()), /EVIDENCE/);
    }
  }
});
test("unit skip and absent TAP counts cannot certify PASS", () => {
  for (const counts of [{}, { tests: 186, pass: 185, fail: 0, skipped: 1 }, { tests: 186, pass: 185, fail: 1, skipped: 0 }]) {
    const value = receipt(); value.stages[0].counts = counts; assert.throws(() => validateRuntimeReceipt(value, sourceRef, inspect()), /UNIT_COUNTS/);
  }
  const duplicate = receipt(); duplicate.stages.push({ name: requiredStages[0], code: 0 }); assert.throws(() => validateRuntimeReceipt(duplicate, sourceRef, inspect()), /REQUIRED_STAGE/);
});
test("evidence retains enums and counts rather than target supplied warning or secret text", () => {
  const value = summarizeEvidence({ status: "FAIL", count: 1, checks: ["secret=never-promote"], failure: { check: "token=never-promote", kind: "password=never-promote" } }, "securityBrowser");
  assert.equal(JSON.stringify(value).includes("never-promote"), false); assert.equal(value.exactChecks, false);
});

test("scratch execution never relaxes nosuid nodev or readonly input requirements", () => {
  for (const flag of ["exec", "nosuid", "nodev", "writable"]) {
    const value = receipt(); value.isolation.scratchMount[flag] = false; assert.throws(() => validateRuntimeReceipt(value, sourceRef, inspect()), /REQUIRED_STAGE/);
  }
});

test("PASS requires owned process and service cleanup receipts", () => {
  const value = receipt(); value.stages[0].processGroupCleanup.status = "FAIL"; assert.throws(() => validateRuntimeReceipt(value, sourceRef, inspect()), /REQUIRED_STAGE/);
  const service = receipt(); service.servicesCleanup.status = "FAIL"; assert.throws(() => validateRuntimeReceipt(service, sourceRef, inspect()), /REQUIRED_STAGE/);
});

test("parent exit zero and PASS text cannot bypass timeout or interruption", () => {
  assert.equal(executionSucceeded({ code: 0, interrupted: false, timedOut: false, hardDeadlineReached: false }), true);
  for (const change of [{ timedOut: true }, { hardDeadlineReached: true }, { interrupted: true }, { code: 1 }, { code: null }]) assert.equal(executionSucceeded({ code: 0, ...change }), false);
  const rawFailed = receipt(); rawFailed.stages[0].commandExitCode = 1; assert.throws(() => validateRuntimeReceipt(rawFailed, sourceRef, inspect()), /REQUIRED_STAGE/);
});

test("finite Linux stages require observed detached-descendant cleanup evidence", () => {
  for (const change of [{ status: "FAIL" }, { supported: false }, { remainingCount: 1 }]) {
    const value = receipt(); Object.assign(value.stages[0].processGroupCleanup.descendants, change); assert.throws(() => validateRuntimeReceipt(value, sourceRef, inspect()), /REQUIRED_STAGE/);
  }
});
