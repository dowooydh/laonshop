import assert from "node:assert/strict";
import test from "node:test";
import { createDescendantTracker, parseProcStatMetadata } from "../../scripts/qa/isolated-descendants.mjs";

const record = (pid, ppid, pgrp = 10, starttime = String(pid), state = "S") => ({ pid, ppid, pgrp, starttime, state });
function fixture(records, options = {}) {
  const calls = [], state = { records, readError: false };
  const tracker = createDescendantTracker(10, { platform: "linux", readProc: () => { if (state.readError) throw Object.assign(new Error("redacted"), { code: "EACCES" }); return state.records; },
    signal: (pid, name) => { calls.push({ pid, name }); if (options.onSignal) options.onSignal(state, pid, name); else state.records = state.records.filter(value => value.pid !== pid); }, sleep: async () => {}, ...options });
  return { tracker, calls, state };
}
test("proc stat parser retains only numeric identities and state, including embedded name parentheses", () => {
  const suffix = ["S", "10", "50", ...Array(16).fill("0"), "1234", ...Array(20).fill("0")].join(" ");
  const parsed = parseProcStatMetadata(`20 (synthetic ) name) ${suffix}`);
  assert.deepEqual(parsed, record(20, 10, 50, "1234"));
  assert.equal(JSON.stringify(parsed).includes("synthetic"), false);
  assert.throws(() => parseProcStatMetadata("not-stat"));
});
test("detached process groups and unsorted PPID descendants are tracked and individually terminated", async () => {
  const { tracker, calls } = fixture([record(40, 30, 40), record(10, 1), record(20, 10, 20), record(30, 20, 30), record(90, 1, 90)]);
  const observed = tracker.sample(); assert.equal(observed.status, "PASS"); assert.equal(observed.observedCount, 3); assert.equal(observed.separateGroupObservedCount, 3);
  const result = await tracker.terminate(0);
  assert.equal(result.status, "PASS"); assert.equal(result.remainingCount, 0);
  assert.deepEqual(calls.map(value => value.pid).sort((a, b) => a - b), [20, 30, 40]);
  assert.equal(calls.some(value => value.pid === 10 || value.pid === 90), false);
});
test("previously observed descendants remain owned after parent exit and reparenting", async () => {
  const { tracker, calls, state } = fixture([record(10, 1), record(20, 10, 20)]);
  tracker.sample(); state.records = [record(20, 1, 20), record(30, 20, 30), record(80, 1, 80)];
  const result = await tracker.terminate(0);
  assert.equal(result.status, "PASS"); assert.equal(result.observedCount, 2);
  assert.deepEqual(calls.map(value => value.pid).sort((a, b) => a - b), [20, 30]);
});
test("PID reuse never adopts or signals unrelated replacement identities", async () => {
  const { tracker, calls, state } = fixture([record(10, 1), record(20, 10, 20)]);
  tracker.sample(); state.records = [record(10, 1, 10, "1000"), record(20, 1, 20, "2000"), record(30, 20, 30)];
  const result = await tracker.terminate(0);
  assert.equal(result.status, "PASS"); assert.equal(result.remainingCount, 0); assert.deepEqual(calls, []);
});
test("identity is resampled immediately before signal so a reused PID is not killed", async () => {
  let reads = 0;
  const calls = [];
  const tracker = createDescendantTracker(10, { platform: "linux", readProc: () => ++reads < 3 ? [record(10, 1), record(20, 10, 20)] : [record(10, 1), record(20, 1, 20, "2000")], signal: (pid, name) => calls.push({ pid, name }), sleep: async () => {} });
  tracker.sample(); assert.equal((await tracker.terminate(0)).status, "PASS"); assert.deepEqual(calls, []);
});
test("zombies and exited X states are not live and never receive a signal", async () => {
  const { tracker, calls } = fixture([record(10, 1), record(20, 10, 20, "20", "Z"), record(30, 10, 30, "30", "X")]);
  const result = await tracker.terminate(0);
  assert.equal(result.status, "PASS"); assert.equal(result.remainingCount, 0); assert.deepEqual(calls, []);
});
test("TERM resistance requires KILL and any remaining descendant prevents PASS", async () => {
  const { tracker, calls } = fixture([record(10, 1), record(20, 10, 20)], { onSignal: (state, pid, name) => { if (name === "SIGKILL") state.records = state.records.filter(value => value.pid !== pid); } });
  const result = await tracker.terminate(25);
  assert.equal(result.status, "PASS"); assert.equal(result.forcedKill, true); assert.deepEqual(calls.map(value => value.name), ["SIGTERM", "SIGKILL"]);
  const resistant = fixture([record(10, 1), record(20, 10, 20)], { onSignal: () => {} });
  assert.equal((await resistant.tracker.terminate(0)).status, "FAIL");
});
test("new descendants forked during TERM grace are collected before cleanup completes", async () => {
  const { tracker, calls } = fixture([record(10, 1), record(20, 10, 20)], { onSignal: (state, pid, name) => {
    if (pid === 20 && name === "SIGTERM") state.records.push(record(30, 20, 30));
    else state.records = state.records.filter(value => value.pid !== pid);
  } });
  const result = await tracker.terminate(25);
  assert.equal(result.status, "PASS"); assert.ok(calls.some(value => value.pid === 30));
});
test("proc observation and signal permission failures remain FAIL after recovery", async () => {
  const { tracker, calls, state } = fixture([record(10, 1), record(20, 10, 20)]);
  tracker.sample(); state.readError = true; tracker.sample(); state.readError = false;
  const result = await tracker.terminate(0);
  assert.equal(result.status, "FAIL"); assert.equal(result.reason, "PROC_OBSERVATION_FAILED"); assert.ok(calls.length > 0);
  const denied = fixture([record(10, 1), record(20, 10, 20)], { signal: () => { throw Object.assign(new Error("redacted"), { code: "EPERM" }); } });
  assert.equal((await denied.tracker.terminate(0)).reason, "DESCENDANT_SIGNAL_FAILED");
});
test("non Linux uses explicit unsupported group-only mode without proc or descendant signals", async () => {
  const tracker = createDescendantTracker(10, { platform: "darwin", readProc: () => { throw new Error("must not read"); }, signal: () => { throw new Error("must not signal"); } });
  assert.equal(tracker.sample().supported, false);
  assert.deepEqual(await tracker.terminate(0), { status: "PASS", supported: false, observedCount: 0, remainingCount: 0, forcedKill: false, separateGroupObservedCount: 0, rootObserved: false, reason: "UNSUPPORTED_PLATFORM_GROUP_ONLY" });
  tracker.stop();
});
test("an already exited root is not rebound to a later PID replacement", async () => {
  const { tracker, calls, state } = fixture([]);
  tracker.sample(); state.records = [record(10, 1, 10, "1000"), record(20, 10, 20)];
  const result = await tracker.terminate(0);
  assert.equal(result.supported, true); assert.equal(result.rootObserved, false); assert.equal(result.observedCount, 0); assert.deepEqual(calls, []);
});
