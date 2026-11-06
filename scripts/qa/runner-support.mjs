import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Operating credentials are never inherited by QA stage processes.
export function cleanEnvironment(environment = process.env) {
  const allowed = ["PATH", "TMPDIR", "LANG", "LC_ALL", "PNPM_HOME", "npm_execpath", "QA_POSTGRES_BIN", "QA_PLAYWRIGHT_MODULE", "QA_BROWSER_EXECUTABLE", "QA_TRIVY_CACHE_DIR"];
  const result = { CI: "1", NO_COLOR: "1", NODE_ENV: "test", GIT_OPTIONAL_LOCKS: "0" };
  for (const name of allowed) if (environment[name]) result[name] = environment[name];
  return result;
}

export function createOutput(kind) {
  const directory = path.join(root, "tests/.generated");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return fs.mkdtempSync(path.join(directory, `${new Date().toISOString().replaceAll(":", "-")}-${kind}-`));
}

export function saveJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}

export function interruptionController() {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  return {
    signal: controller.signal,
    close() {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    },
  };
}
