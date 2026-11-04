import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { CATALOG } from "../../prisma/catalog";
import { CATALOG_ADDITIONS } from "../../prisma/catalog-additions";
import { catalogDraftCreateData, catalogDraftId, planCatalogDraftInsert } from "../../lib/catalog-expansion";
import { getCatalogCategoryCounts, getProductClassification } from "../../lib/catalog-taxonomy";

const products = Object.entries(CATALOG).flatMap(([gender, categories]) => Object.entries(categories).flatMap(([category, rows]) => rows.map((product) => ({ ...product, gender, category }))));

test("쇼핑 분류는 기존 모든 SKU를 한 곳에 배정하고 실제 수량을 합산한다", () => {
  const summary = getCatalogCategoryCounts(products);
  assert.equal(summary.reduce((total, row) => total + row.count, 0), products.length);
  assert.equal(new Set(products.map((product) => product.id)).size, products.length);
  for (const row of summary) assert.equal(row.subcategories.reduce((total, sub) => total + sub.count, 0), row.count);
  const counts = new Map(summary.map((row) => [row.category, row.count]));
  assert.ok(counts.get("상의")! > counts.get("가방")!);
  assert.ok(counts.get("하의")! > counts.get("가방")!);
  assert.ok(counts.get("모자")! < counts.get("아우터")!);
  assert.ok(new Set(summary.map((row) => row.count)).size > 8);
});

test("혼합된 원본 분류에서 실제 상품명에 맞는 쇼핑 분류를 찾는다", () => {
  const cases = [
    ["라운지 반팔 티", "홈웨어", "상의"], ["저지 이지 팬츠", "홈웨어", "하의"],
    ["테니스 스커트", "스포츠", "스커트"], ["코튼 버킷햇", "액세서리", "모자"],
    ["요가 블록 세트", "스포츠", "운동용품"], ["코지 니트 블랭킷", "홈웨어", "홈리빙"],
    ["롱 니트 가디건", "아우터", "상의"], ["스포츠 브라", "스포츠", "이너웨어"],
  ];
  for (const [name, category, expected] of cases) assert.equal(getProductClassification({ name, category }).category, expected);
});

test("신규 셀렉션은 상하의 중심 32개 초안이며 기존 상품과 이름·ID가 겹치지 않는다", () => {
  assert.equal(CATALOG_ADDITIONS.length, 32);
  assert.ok(CATALOG_ADDITIONS.filter((draft) => draft.category === "상의" || draft.category === "하의").length > CATALOG_ADDITIONS.length / 2);
  const current = new Set(products.map((product) => `${product.gender}|${product.name}`));
  for (const draft of CATALOG_ADDITIONS) assert.equal(current.has(`${draft.gender}|${draft.name}`), false);
  assert.equal(new Set(CATALOG_ADDITIONS.map(catalogDraftId)).size, CATALOG_ADDITIONS.length);
});

test("신규 상품 생성 값은 판매불가·재고0·사진없음으로 고정한다", () => {
  for (const draft of CATALOG_ADDITIONS) {
    const data = catalogDraftCreateData(draft, 100);
    assert.equal(data.active, false); assert.equal(data.stock, 0); assert.equal(data.imageUrl, null);
    assert.ok(Number.isSafeInteger(data.price) && data.price > 0);
    assert.equal(data.sortOrder, 100);
  }
});

test("초안 계획은 기존 ID와 상품명을 보존하고 재실행 시 삽입하지 않는다", () => {
  const first = planCatalogDraftInsert([]);
  assert.equal(first.insert.length, 32);
  const existing = first.insert.map((draft) => catalogDraftCreateData(draft, 0));
  assert.equal(planCatalogDraftInsert(existing).insert.length, 0);
  assert.equal(planCatalogDraftInsert(existing).skipped.length, 32);
  const conflicting = [{ ...existing[0], name: "운영자가 따로 편집한 상품" }];
  assert.deepEqual(planCatalogDraftInsert(conflicting).conflicts, [CATALOG_ADDITIONS[0].key]);
  const sameName = [{ id: "existing-product-id", name: CATALOG_ADDITIONS[0].name, gender: "men", category: "상의" }];
  assert.equal(planCatalogDraftInsert(sameName).insert.length, 31);
  assert.equal(sameName[0].id, "existing-product-id");
});

test("상품 초안 CLI 기본 실행은 잘못된 DB URL이 있어도 DB에 연결하지 않는다", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "prisma/sync-catalog-drafts.ts"], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DATABASE_URL: "not-a-database-url" },
  });
  const plan = JSON.parse(output) as { mode: string; insertCount: number; inactiveOnly: boolean; stock: number; imageUrl: null; planSha: string };
  assert.equal(plan.mode, "offline-dry-run-no-database");
  assert.equal(plan.insertCount, 32); assert.equal(plan.inactiveOnly, true); assert.equal(plan.stock, 0); assert.equal(plan.imageUrl, null);
  assert.match(plan.planSha, /^[a-f0-9]{64}$/);
});

test("상품 초안 적용은 확인한 DB 대상과 계획 SHA 없이는 연결 전에 거절한다", () => {
  for (const options of [[], ["--expected-database", "127.0.0.1/not-real", "--expected-plan-sha", "unconfirmed"]]) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "prisma/sync-catalog-drafts.ts", "--apply-drafts", ...options], {
      cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://synthetic.invalid:1/never-connect" },
    });
    assert.equal(run.status, 1);
    assert.doesNotMatch(run.stdout + run.stderr, /synthetic\.invalid|postgresql:/);
    assert.equal(run.stdout, "");
  }
});
