// Finite jobs have owned POSIX process groups. Intentional services opt out.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createDescendantTracker } from "./isolated-descendants.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function signalGroup(child, signal) {
  if (!Number.isSafeInteger(child.pid) || child.pid <= 1) return false;
  try { process.kill(-child.pid, signal); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}
async function groupGone(child, duration) {
  const end = Date.now() + duration;
  do { if (!signalGroup(child, 0)) return true; await sleep(20); } while (Date.now() < end);
  return !signalGroup(child, 0);
}
export async function terminateOwnedGroup(child, graceMs = 1500) {
  if (!Number.isSafeInteger(child.pid) || child.pid <= 1) return { status: "PASS", termSent: false, forcedKill: false };
  let termSent = false, forcedKill = false;
  try {
    termSent = signalGroup(child, "SIGTERM");
    if (await groupGone(child, graceMs)) return { status: "PASS", termSent, forcedKill };
    forcedKill = signalGroup(child, "SIGKILL");
    return { status: await groupGone(child, 1000) ? "PASS" : "FAIL", termSent, forcedKill };
  } catch (error) {
    // Permission denial is never evidence of absence and must not become PASS.
    return { status: "FAIL", reason: error.code === "EPERM" ? "SIGNAL_DENIED" : "GROUP_PROBE_FAILED", termSent, forcedKill };
  }
}

export function processSucceeded(value) {
  return value?.code === 0 && value.timedOut !== true && value.aborted !== true && value.outputLimit !== true && !value.spawnError && value.groupCleanup?.status === "PASS";
}

export function stoppedProcessSucceeded(value, pidFileAbsent) {
  return processSucceeded(value) && pidFileAbsent === true;
}

export function runIsolatedProcess(command, args, { cwd, env, timeoutMs = 600000, graceMs = 1500, preserveServiceChildren = false, signal, outputLimitBytes = 16 * 1024 * 1024 } = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, env, detached: !preserveServiceChildren, stdio: ["ignore", "pipe", "pipe"] });
    const tracker = !preserveServiceChildren && Number.isSafeInteger(child.pid) ? createDescendantTracker(child.pid) : null;
    tracker?.sample();
    const samplingTimer = tracker ? setInterval(() => tracker.sample(), 100) : null;
    const data = { stdout: [], stderr: [] }, bytes = { stdout: 0, stderr: 0 }, digests = { stdout: createHash("sha256"), stderr: createHash("sha256") };
    let timedOut = false, aborted = false, outputLimit = false, settled = false, stopping = null, hardTimer, exitDrainTimer, exitCode = null, exitSignal = null, spawnError = null, cleanupPromise = null;
    for (const name of Object.keys(data)) child[name].on("data", chunk => {
      bytes[name] += chunk.length; digests[name].update(chunk);
      if (bytes[name] <= outputLimitBytes) data[name].push(chunk);
      else if (!outputLimit) { outputLimit = true; void stop(); }
    });
    const cleanup = () => cleanupPromise ??= (async () => {
      if (preserveServiceChildren) return { status: "PASS", intentionalServiceChildrenPreserved: true };
      const [group, descendants] = await Promise.all([terminateOwnedGroup(child, graceMs), tracker ? tracker.terminate(graceMs) : Promise.resolve({ status: "PASS", supported: false, observedCount: 0, remainingCount: 0 })]);
      const supported = process.platform !== "linux" || descendants.supported === true;
      return { status: group.status === "PASS" && descendants.status === "PASS" && supported ? "PASS" : "FAIL", termSent: group.termSent, forcedKill: group.forcedKill || descendants.forcedKill === true, ...(group.reason ? { reason: group.reason } : {}), descendants };
    })();
    async function finish(extra = {}) {
      if (settled) return; settled = true;
      clearTimeout(timer); clearTimeout(hardTimer); clearTimeout(exitDrainTimer); clearInterval(samplingTimer); signal?.removeEventListener("abort", onAbort);
      child.stdout.destroy(); child.stderr.destroy(); child.unref();
      const groupCleanup = extra.groupCleanup ?? await cleanup();
      tracker?.stop();
      resolve({ code: exitCode, signal: exitSignal, timedOut, aborted, outputLimit, spawnError, groupCleanup, stdout: Buffer.concat(data.stdout).toString(), stderr: Buffer.concat(data.stderr).toString(), byteCounts: bytes, hashes: Object.fromEntries(Object.entries(digests).map(([name, digest]) => [name, digest.digest("hex")])) });
    }
    async function stop() {
      if (stopping) return stopping;
      hardTimer = setTimeout(() => { try { preserveServiceChildren ? child.kill("SIGKILL") : signalGroup(child, "SIGKILL"); } catch { /* Final container teardown is independent. */ } void finish({ groupCleanup: { status: "FAIL", hardDeadlineReached: true } }); }, graceMs + 1500);
      stopping = (async () => {
        if (preserveServiceChildren) {
          child.kill("SIGTERM"); await sleep(graceMs);
          if (exitCode === null && exitSignal === null) child.kill("SIGKILL");
        } else await cleanup();
      })();
      return stopping;
    }
    const onAbort = () => { aborted = true; void stop(); };
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; void stop(); }, timeoutMs);
    if (signal?.aborted) onAbort();
    child.once("error", error => { spawnError = ["ENOENT", "EACCES", "EAGAIN"].includes(error.code) ? error.code : "SPAWN_ERROR"; void finish(); });
    child.once("exit", (code, childSignal) => {
      exitCode = code; exitSignal = childSignal;
      // A descendant holding a pipe cannot extend the stage deadline.
      void cleanup().then(groupCleanup => {
        if (!settled) { clearTimeout(exitDrainTimer); exitDrainTimer = setTimeout(() => void finish({ groupCleanup }), 100); }
      });
    });
    child.once("close", (code, childSignal) => { exitCode = code; exitSignal = childSignal; void finish(); });
  });
}
