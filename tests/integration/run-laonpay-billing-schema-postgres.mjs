import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const temporaryRoot = mkdtempSync(join(tmpdir(), "laonshop-billing-schema-"));
const dataDirectory = join(temporaryRoot, "data");
const postgresLog = join(temporaryRoot, "postgres.log");
const databaseName = "laonshop_billing_schema";
const additiveSql = join(root, "ops/laonpay-billing/sql/001_additive.sql");
const verifySql = join(root, "ops/laonpay-billing/sql/002_post_verify.sql");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} 실행 실패\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return result;
}

function runPsql(args, { expectFailure = false } = {}) {
  const result = spawnSync(
    "psql",
    [
      "--host=127.0.0.1",
      `--port=${port}`,
      `--dbname=${databaseName}`,
      "--set=ON_ERROR_STOP=1",
      ...args,
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  if (expectFailure ? result.status === 0 : result.status !== 0) {
    throw new Error(
      `psql 검증 결과 불일치\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return result;
}

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      reject(new Error("격리 PostgreSQL 포트를 할당하지 못했습니다."));
      return;
    }
    const assignedPort = address.port;
    server.close((error) => {
      if (error) reject(error);
      else resolve(assignedPort);
    });
  });
});

let started = false;
try {
  run("initdb", [
    "--pgdata",
    dataDirectory,
    "--auth=trust",
    "--encoding=UTF8",
    "--no-locale",
  ]);
  run("pg_ctl", [
    "--pgdata",
    dataDirectory,
    "--log",
    postgresLog,
    "--options",
    `-F -p ${port} -h 127.0.0.1`,
    "--wait",
    "start",
  ]);
  started = true;
  run("createdb", [
    "--host=127.0.0.1",
    `--port=${port}`,
    databaseName,
  ]);

  runPsql([
    "--command",
    [
      'CREATE TABLE "ShopUser" ("id" TEXT PRIMARY KEY);',
      'CREATE TABLE "ShopOrder" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL);',
    ].join("\n"),
  ]);
  runPsql(["--file", additiveSql]);
  runPsql(["--file", additiveSql]);
  runPsql(["--file", verifySql]);

  runPsql([
    "--command",
    'ALTER TABLE "ShopBillingCharge" ALTER COLUMN "requestAttempts" DROP DEFAULT;',
  ]);
  runPsql(["--file", verifySql], { expectFailure: true });
  runPsql([
    "--command",
    'ALTER TABLE "ShopBillingCharge" ALTER COLUMN "requestAttempts" SET DEFAULT 0;',
  ]);

  runPsql([
    "--command",
    'ALTER TABLE "ShopBillingPaymentMethod" ADD COLUMN "billingToken" TEXT;',
  ]);
  runPsql(["--file", verifySql], { expectFailure: true });
  runPsql([
    "--command",
    'ALTER TABLE "ShopBillingPaymentMethod" DROP COLUMN "billingToken";',
  ]);
  runPsql([
    "--command",
    'ALTER TABLE "ShopBillingCharge" ADD COLUMN "provider_token" TEXT;',
  ]);
  runPsql(["--file", verifySql], { expectFailure: true });

  const additiveSource = readFileSync(additiveSql, "utf8");
  if (/^\s*(?:DROP|TRUNCATE|DELETE)\b/im.test(additiveSource)) {
    throw new Error("additive SQL에 파괴 명령이 포함되어 있습니다.");
  }

  process.stdout.write(
    "LAONPAY billing schema: repeat apply, post-verify, negative checks PASS\n",
  );
} finally {
  if (started) {
    spawnSync("pg_ctl", [
      "--pgdata",
      dataDirectory,
      "--mode=fast",
      "--wait",
      "stop",
    ]);
  }
  rmSync(temporaryRoot, { recursive: true, force: true });
}
