import { createPrivateKey } from "node:crypto";
import { pathToFileURL } from "node:url";

const EXPECTED_SHOP_ORIGIN = "https://laonshop.com";
const EXPECTED_LAONPAY_ORIGIN = "https://pay.laonpay.com";
const KEY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

type CheckStatus = "READY" | "CLOSED" | "INVALID";

export type ReadinessCheck = {
  name: string;
  status: CheckStatus;
  detail: string;
};

export type ReadinessReport = {
  status: CheckStatus;
  checks: ReadinessCheck[];
};

export type BillingReadinessEnv = Readonly<
  Record<string, string | undefined>
>;

function isExactOrigin(value: string, expected: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === expected &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.pathname === "" || url.pathname === "/") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function validatesAsEd25519PrivateKey(value: string): boolean {
  try {
    const trimmed = value.trim();
    const key = trimmed.includes("BEGIN PRIVATE KEY")
      ? createPrivateKey(trimmed.replace(/\\n/g, "\n"))
      : createPrivateKey({
          key: Buffer.from(trimmed, "base64"),
          format: "der",
          type: "pkcs8",
        });
    return key.type === "private" && key.asymmetricKeyType === "ed25519";
  } catch {
    return false;
  }
}

function closed(name: string, detail: string): ReadinessCheck {
  return { name, status: "CLOSED", detail };
}

function invalid(name: string, detail: string): ReadinessCheck {
  return { name, status: "INVALID", detail };
}

function ready(name: string, detail: string): ReadinessCheck {
  return { name, status: "READY", detail };
}

function checkGate(name: string, value: string | undefined): ReadinessCheck {
  if (!value || value === "0") return closed(name, "명시적 활성화 게이트가 닫혀 있습니다.");
  if (value !== "1") return invalid(name, "0, 1 또는 미설정만 허용됩니다.");
  return ready(name, "명시적 활성화 게이트가 열려 있습니다.");
}

export function evaluateLaonpayBillingReadiness(
  env: BillingReadinessEnv,
): ReadinessReport {
  const checks: ReadinessCheck[] = [];

  if (!env.VERCEL_ENV) {
    checks.push(closed("VERCEL_ENV", "운영 런타임이 아니므로 닫혀 있습니다."));
  } else if (env.VERCEL_ENV === "production") {
    checks.push(ready("VERCEL_ENV", "운영 런타임 범위입니다."));
  } else if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") {
    checks.push(closed("VERCEL_ENV", "비운영 런타임이므로 닫혀 있습니다."));
  } else {
    checks.push(invalid("VERCEL_ENV", "허용된 Vercel 런타임 값이 아닙니다."));
  }

  if (!env.SHOP_APP_URL?.trim()) {
    checks.push(closed("SHOP_APP_URL", "고정 복귀 origin이 설정되지 않았습니다."));
  } else if (isExactOrigin(env.SHOP_APP_URL.trim(), EXPECTED_SHOP_ORIGIN)) {
    checks.push(ready("SHOP_APP_URL", "고정 apex HTTPS origin과 일치합니다."));
  } else {
    checks.push(invalid("SHOP_APP_URL", "고정 apex HTTPS origin 형식과 일치하지 않습니다."));
  }

  if (!env.LAONPAY_BILLING_API_BASE?.trim()) {
    checks.push(closed("LAONPAY_BILLING_API_BASE", "LAONPAY seller origin이 설정되지 않았습니다."));
  } else if (
    isExactOrigin(env.LAONPAY_BILLING_API_BASE.trim(), EXPECTED_LAONPAY_ORIGIN)
  ) {
    checks.push(ready("LAONPAY_BILLING_API_BASE", "계약된 seller HTTPS origin과 일치합니다."));
  } else {
    checks.push(
      invalid(
        "LAONPAY_BILLING_API_BASE",
        "계약된 seller HTTPS origin 형식과 일치하지 않습니다.",
      ),
    );
  }

  if (!env.LAONPAY_PARTNER_KEY_ID?.trim()) {
    checks.push(closed("LAONPAY_PARTNER_KEY_ID", "파트너 키 식별자가 설정되지 않았습니다."));
  } else if (KEY_ID_PATTERN.test(env.LAONPAY_PARTNER_KEY_ID.trim())) {
    checks.push(ready("LAONPAY_PARTNER_KEY_ID", "파트너 키 식별자 형식이 유효합니다."));
  } else {
    checks.push(invalid("LAONPAY_PARTNER_KEY_ID", "파트너 키 식별자 형식이 유효하지 않습니다."));
  }

  if (!env.LAONPAY_PARTNER_PRIVATE_KEY?.trim()) {
    checks.push(closed("LAONPAY_PARTNER_PRIVATE_KEY", "서버 전용 서명키가 설정되지 않았습니다."));
  } else if (validatesAsEd25519PrivateKey(env.LAONPAY_PARTNER_PRIVATE_KEY)) {
    checks.push(ready("LAONPAY_PARTNER_PRIVATE_KEY", "Ed25519 PKCS#8 서명키 형식이 유효합니다."));
  } else {
    checks.push(
      invalid(
        "LAONPAY_PARTNER_PRIVATE_KEY",
        "Ed25519 PKCS#8 서명키 형식이 유효하지 않습니다.",
      ),
    );
  }

  const schemaGate = checkGate(
    "LAONPAY_BILLING_SCHEMA_READY",
    env.LAONPAY_BILLING_SCHEMA_READY,
  );
  const featureGate = checkGate(
    "LAONPAY_BILLING_FEATURE_ENABLED",
    env.LAONPAY_BILLING_FEATURE_ENABLED,
  );
  checks.push(schemaGate, featureGate);

  if (
    env.LAONPAY_BILLING_FEATURE_ENABLED === "1" &&
    checks.some(
      (check) =>
        check.name !== "LAONPAY_BILLING_FEATURE_ENABLED" &&
        check.status !== "READY",
    )
  ) {
    checks.push(
      invalid(
        "LAONPAY_BILLING_GATE_ORDER",
        "feature 게이트는 운영·고정 origin·파트너 서명·schema 준비가 모두 READY일 때만 열 수 있습니다.",
      ),
    );
  }

  const status: CheckStatus = checks.some((check) => check.status === "INVALID")
    ? "INVALID"
    : checks.some((check) => check.status === "CLOSED")
      ? "CLOSED"
      : "READY";
  return { status, checks };
}

export function formatLaonpayBillingReadiness(report: ReadinessReport): string {
  const lines = [
    `LAONPAY billing readiness: ${report.status}`,
    ...report.checks.map(
      (check) => `[${check.status}] ${check.name}: ${check.detail}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function runLaonpayBillingReadinessCli(
  args: string[],
  env: BillingReadinessEnv,
  write: (message: string) => void = (message) => process.stdout.write(message),
): number {
  if (args.includes("--help")) {
    write(
      "Usage: tsx scripts/check-laonpay-billing-readiness.ts [--allow-closed]\n" +
        "환경변수 값은 출력하지 않으며 외부 서비스와 DB를 호출하지 않습니다.\n",
    );
    return 0;
  }
  const unknownArgs = args.filter((arg) => arg !== "--allow-closed");
  if (unknownArgs.length > 0) {
    write("알 수 없는 인자가 있습니다. --help로 사용법을 확인하세요.\n");
    return 2;
  }

  const report = evaluateLaonpayBillingReadiness(env);
  write(formatLaonpayBillingReadiness(report));
  if (report.status === "READY") return 0;
  if (report.status === "CLOSED" && args.includes("--allow-closed")) return 0;
  return 1;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  process.exitCode = runLaonpayBillingReadinessCli(process.argv.slice(2), process.env);
}
