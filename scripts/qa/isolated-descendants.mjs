// Numeric Linux /proc metadata only. Never read cmdline, environ, or /proc/*/comm.
// The stat record's parenthesized name is skipped and never retained or emitted.
import fs from "node:fs";

const exited = error => ["ENOENT", "ESRCH"].includes(error?.code);
const alive = record => record && !["Z", "X"].includes(record.state.toUpperCase());
const key = record => `${record.pid}:${record.starttime}`;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function identity(value) {
  if (!value || !Number.isSafeInteger(value.pid) || value.pid < 1 || !Number.isSafeInteger(value.ppid) || value.ppid < 0 || !Number.isSafeInteger(value.pgrp) || value.pgrp < 0 || typeof value.starttime !== "string" || !/^\d{1,30}$/.test(value.starttime) || typeof value.state !== "string" || !/^[a-z]$/i.test(value.state)) throw new Error("PROC_METADATA_INVALID");
  return { pid: value.pid, ppid: value.ppid, pgrp: value.pgrp, starttime: BigInt(value.starttime).toString(), state: value.state };
}

export function parseProcStatMetadata(record) {
  const boundary = record.lastIndexOf(") "), firstSpace = record.indexOf(" ");
  if (boundary < 0 || firstSpace < 1 || record[firstSpace + 1] !== "(") throw new Error("PROC_METADATA_INVALID");
  const fields = record.slice(boundary + 2).trim().split(/\s+/);
  if (![record.slice(0, firstSpace), fields[1], fields[2]].every(value => typeof value === "string" && /^\d+$/.test(value))) throw new Error("PROC_METADATA_INVALID");
  return identity({ pid: Number(record.slice(0, firstSpace)), state: fields[0], ppid: Number(fields[1]), pgrp: Number(fields[2]), starttime: fields[19] });
}

export function readProcMetadata() {
  const records = [];
  for (const pid of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try { records.push(parseProcStatMetadata(fs.readFileSync(`/proc/${pid}/stat`, "utf8"))); }
    catch (error) { if (!exited(error)) throw error; }
  }
  return records;
}

export function createDescendantTracker(rootPid, { platform = process.platform, readProc = readProcMetadata, signal = (pid, name) => process.kill(pid, name), sleep = wait } = {}) {
  if (!Number.isSafeInteger(rootPid) || rootPid < 2) throw new Error("ROOT_PID_INVALID");
  const supported = platform === "linux", tracked = new Map(), separateGroups = new Set();
  let snapshot = new Map(), rootIdentity = null, initialized = false, reason = null, forcedKill = false, termination = null;
  const fail = value => { reason ??= value; };
  const live = () => [...tracked.values()].filter(record => {
    const current = snapshot.get(record.pid);
    return alive(current) && key(current) === key(record);
  });
  const result = (final = false) => {
    const remainingCount = live().length;
    return { status: reason || final && remainingCount ? "FAIL" : "PASS", supported, observedCount: tracked.size, remainingCount, forcedKill, separateGroupObservedCount: separateGroups.size,
      rootObserved: rootIdentity !== null, ...(!supported ? { reason: "UNSUPPORTED_PLATFORM_GROUP_ONLY" } : reason ? { reason } : final && remainingCount ? { reason: "DESCENDANTS_REMAINING" } : {}) };
  };
  function sample() {
    if (!supported) return result();
    try {
      const values = readProc();
      if (!Array.isArray(values)) throw new Error("PROC_METADATA_INVALID");
      const next = new Map();
      for (const value of values) {
        const record = identity(value);
        if (next.has(record.pid)) throw new Error("PROC_METADATA_INVALID");
        next.set(record.pid, record);
      }
      snapshot = next;
      if (!initialized) { rootIdentity = next.get(rootPid) ?? null; initialized = true; }
      const owned = new Set();
      if (rootIdentity && next.get(rootPid)?.starttime === rootIdentity.starttime) owned.add(rootPid);
      for (const record of tracked.values()) if (next.get(record.pid)?.starttime === record.starttime) owned.add(record.pid);
      // Fixed point follows PPID chains even when records are not PID-sorted.
      let changed;
      do {
        changed = false;
        for (const record of next.values()) {
          if (record.pid === rootPid || owned.has(record.pid) || !owned.has(record.ppid)) continue;
          owned.add(record.pid); changed = true;
        }
      } while (changed);
      for (const pid of owned) {
        if (pid === rootPid) continue;
        const record = next.get(pid);
        tracked.set(key(record), record);
        if (record.pgrp !== rootPid) separateGroups.add(key(record));
      }
    } catch { fail("PROC_OBSERVATION_FAILED"); snapshot = new Map(); }
    return result();
  }
  function send(record, name) {
    sample(); // Never signal an identity checked only in an earlier polling interval.
    const current = snapshot.get(record.pid);
    if (record.pid === rootPid || !alive(current) || key(current) !== key(record)) return;
    try { signal(record.pid, name); if (name === "SIGKILL") forcedKill = true; }
    catch (error) { if (!exited(error)) fail("DESCENDANT_SIGNAL_FAILED"); }
  }
  async function terminateOwned(graceMs) {
    if (!supported) return result(true);
    if (!Number.isSafeInteger(graceMs) || graceMs < 0 || graceMs > 30000) throw new Error("GRACE_PERIOD_INVALID");
    const terminated = new Set();
    sample();
    const termNew = () => {
      for (const record of live()) if (!terminated.has(key(record))) { terminated.add(key(record)); send(record, "SIGTERM"); }
    };
    termNew();
    for (let elapsed = 0; elapsed < graceMs && live().length; elapsed += 25) {
      await sleep(Math.min(25, graceMs - elapsed)); sample(); termNew();
    }
    // Each scan can discover a child forked during termination. All such kills
    // are still limited to freshly verified descendants, never whole foreign groups.
    for (let attempt = 0; attempt < 41; attempt += 1) {
      sample();
      const remaining = live();
      if (!remaining.length) break;
      for (const record of remaining) send(record, "SIGKILL");
      await sleep(25);
    }
    sample();
    return result(true);
  }
  return {
    sample,
    // The caller owns its polling interval; this helper creates no timer to stop.
    stop() {},
    terminate(graceMs = 250) { termination ??= terminateOwned(graceMs); return termination; },
  };
}
