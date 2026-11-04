// 실행 전 검토용. 기본은 offline dry-run이며 명시적 DB 확인/적용 플래그만 DB에 연결한다.
import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { CATALOG_ADDITIONS, CATALOG_ADDITION_REQUIREMENTS, CATALOG_ADDITION_VERSION } from "./catalog-additions";
import { catalogDraftCreateData, planCatalogDraftInsert } from "../lib/catalog-expansion";
import { getCatalogCategoryCounts } from "../lib/catalog-taxonomy";

const args = process.argv.slice(2);
const allowedFlags = new Set(["--check-db", "--apply-drafts", "--expected-database", "--expected-plan-sha", "--dry-run"]);
const values = new Map<string, string>();
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  if (!allowedFlags.has(flag)) throw new Error("알 수 없는 옵션입니다.");
  if (flag === "--expected-database" || flag === "--expected-plan-sha") {
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`${flag} 값을 지정해 주세요.`);
    values.set(flag, value);
  }
}
const apply = args.includes("--apply-drafts");
if (apply && args.includes("--dry-run")) throw new Error("dry-run과 적용 옵션을 함께 사용할 수 없습니다.");
const fingerprint = createHash("sha256").update(JSON.stringify({ version: CATALOG_ADDITION_VERSION, drafts: CATALOG_ADDITIONS })).digest("hex");
const describe = (plan: ReturnType<typeof planCatalogDraftInsert>, scope: string) => ({
  mode: scope, version: plan.version, planSha: fingerprint, proposed: plan.proposed,
  insertCount: plan.insert.length, skippedCount: plan.skipped.length, conflicts: plan.conflicts,
  inactiveOnly: true, stock: 0, imageUrl: null, confirmationsRequired: CATALOG_ADDITION_REQUIREMENTS,
  categoryCounts: getCatalogCategoryCounts(plan.insert),
  drafts: plan.insert.map((draft) => ({ key: draft.key, name: draft.name, gender: draft.gender,
    category: draft.category, proposedPrice: draft.proposedPrice, proposedSizes: draft.proposedSizes })),
});

async function main() {
  if (!apply && !args.includes("--check-db")) {
    console.log(JSON.stringify(describe(planCatalogDraftInsert([]), "offline-dry-run-no-database"), null, 2));
    return;
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("명시적인 DB 확인·적용에는 DATABASE_URL이 필요합니다.");
  const target = new URL(rawUrl);
  if (!["postgres:", "postgresql:"].includes(target.protocol)) throw new Error("지원하지 않는 DB 연결 형식입니다.");
  const databaseIdentity = `${target.host}${target.pathname}`;
  if (apply && values.get("--expected-database") !== databaseIdentity) throw new Error("확인한 DB 식별자가 일치하지 않아 적용을 중단했습니다.");
  if (apply && values.get("--expected-plan-sha") !== fingerprint) throw new Error("검토한 신규 상품 계획 SHA가 일치하지 않아 적용을 중단했습니다.");
  const db = new PrismaClient({ log: [] });
  try {
    const result = await db.$transaction(async (tx) => {
      if (!apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      else await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('laonshop:catalog-drafts:20261104'))::text`);
      const existing = await tx.product.findMany({ select: { id: true, name: true, gender: true, category: true } });
      const plan = planCatalogDraftInsert(existing);
      if (plan.conflicts.length) throw new Error("기존 상품과 신규 초안 ID가 충돌해 아무 상품도 변경하지 않았습니다.");
      if (!apply) return { ...describe(plan, "database-read-only-dry-run"), inserted: 0 };
      const maxSort = (await tx.product.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1;
      const created = plan.insert.length ? await tx.product.createMany({ data: plan.insert.map((draft, index) => catalogDraftCreateData(draft, maxSort + index + 1)) }) : { count: 0 };
      return { ...describe(plan, "inactive-drafts-inserted"), inserted: created.count };
    }, { maxWait: 5000, timeout: 30000 });
    console.log(JSON.stringify(result, null, 2));
  } finally { await db.$disconnect(); }
}

main().catch(() => { console.error("신규 상품 계획 실행 실패: 옵션·확인한 DB 대상·계획 SHA·DB 접근권한을 확인해 주세요. 비밀값은 출력하지 않습니다."); process.exitCode = 1; });
