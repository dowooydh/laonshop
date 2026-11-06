// Trusted harness fixtures only: no application, repository environment or DB is executed.
import assert from "node:assert/strict";
import test from "node:test";
import { runIsolatedProcess, stoppedProcessSucceeded } from "../../scripts/qa/isolated-process.mjs";
const env = { PATH: "/usr/bin:/bin", HOME: "/tmp", TMPDIR: "/tmp" };

test("finite deadline escalates SIGTERM-ignoring owned process to SIGKILL", async () => {
  const started = Date.now();
  const value = await runIsolatedProcess(process.execPath, ["-e", 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { env, timeoutMs: 200, graceMs: 50 });
  assert.equal(value.timedOut, true); assert.equal(value.signal, "SIGKILL"); assert.equal(value.groupCleanup.forcedKill, true);
  assert.ok(Date.now() - started < 2000); assert.equal(value.stdout, "");
  if (value.groupCleanup.status !== "PASS") { assert.equal(process.platform, "darwin"); assert.equal(value.groupCleanup.status, "FAIL"); assert.equal(value.groupCleanup.reason, "SIGNAL_DENIED"); }
});
test("successful finite process retains bounded output and cleanup evidence", async () => {
  const value = await runIsolatedProcess(process.execPath, ["-e", 'process.stdout.write("tool-only")'], { env, timeoutMs: 1000, graceMs: 50 });
  assert.equal(value.code, 0); assert.equal(value.stdout, "tool-only"); assert.equal(value.groupCleanup.status, "PASS");
  assert.equal(value.timedOut, false);
});
test("service start explicitly preserves intentional daemon children", async () => {
  const value = await runIsolatedProcess(process.execPath, ["-e", ""], { env, timeoutMs: 1000, preserveServiceChildren: true });
  assert.equal(value.code, 0); assert.equal(value.groupCleanup.intentionalServiceChildrenPreserved, true);
});
test("output overflow stops finite work and is never accepted as a passing stage", async () => {
  const value = await runIsolatedProcess(process.execPath, ["-e", 'process.stdout.write("x".repeat(10000));setInterval(()=>{},1000)'], { env, outputLimitBytes: 100, timeoutMs: 1000, graceMs: 50 });
  assert.equal(value.outputLimit, true); assert.ok(value.byteCounts.stdout > 100); assert.equal(value.stdout, "");
});

test("PG stop needs semantic success and actual pid-file absence", () => {
  const value = { code: 0, timedOut: false, aborted: false, outputLimit: false, spawnError: null, groupCleanup: { status: "PASS" } };
  assert.equal(stoppedProcessSucceeded(value, true), true);
  assert.equal(stoppedProcessSucceeded(value, false), false);
  for (const change of [{ code: null }, { code: 1 }, { timedOut: true }, { aborted: true }, { outputLimit: true }, { spawnError: "EAGAIN" }, { groupCleanup: { status: "FAIL" } }]) assert.equal(stoppedProcessSucceeded({ ...value, ...change }, true), false);
});

test("exit pipe-drain timer never leaves an older forced group-kill timer armed", async () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout, pending = new Set();
  globalThis.setTimeout = (callback, milliseconds, ...args) => {
    let handle; handle = originalSet(() => { pending.delete(handle); callback(...args); }, milliseconds);
    if (milliseconds === 1550) pending.add(handle);
    return handle;
  };
  globalThis.clearTimeout = handle => { pending.delete(handle); return originalClear(handle); };
  try {
    // This short-lived fixture deliberately keeps a pipe open in another session
    // so the exit-drain fallback runs after the finite parent's forced deadline.
    const heldPipe = 'setTimeout(()=>{},600)';
    const fixture = 'const cp=require("child_process");process.on("SIGTERM",()=>{});const c=cp.spawn(process.execPath,["-e",'+JSON.stringify(heldPipe)+'],{detached:true,stdio:["ignore",process.stdout,"ignore"],env:process.env});c.unref();setInterval(()=>{},1000)';
    const value = await runIsolatedProcess(process.execPath, ["-e", fixture], { env, timeoutMs: 150, graceMs: 50 });
    assert.equal(value.timedOut, true); assert.equal(value.signal, "SIGKILL");
    assert.equal(pending.size, 0);
  } finally {
    for (const handle of pending) originalClear(handle);
    globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear;
    await new Promise(resolve => originalSet(resolve, 650));
  }
});
