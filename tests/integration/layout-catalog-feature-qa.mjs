// Local disposable dataset checks; never connect to a non-loopback database.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const state = JSON.parse(readFileSync(process.env.QA_STATE_FILE, "utf8"));
assert.equal(new URL(state.databaseUrl).hostname, "127.0.0.1");
assert.equal(new URL(state.databaseUrl).pathname, "/laonshop_qa");
process.env.DATABASE_URL = state.databaseUrl;
process.env.DIRECT_URL = state.databaseUrl;
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasources: { db: { url: state.databaseUrl } } });
const moduleAt = name => import(pathToFileURL(`${process.cwd()}/${name}`).href);
const { getReviewExamples, showReviewExamples } = await moduleAt("lib/review-examples.ts");
const { getProductSizeGuide } = await moduleAt("lib/product-size-guide.ts");
const { getCatalogCategoryCounts, getProductClassification } = await moduleAt("lib/catalog-taxonomy.ts");
const checks = [];
async function check(name, callback) { await callback(); checks.push(name); }
try {
  const products = await db.product.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  const reviewBefore = await db.shopProductReview.count();
  await check("production and unspecified production runtimes hide examples", () => {
    assert.equal(showReviewExamples({ VERCEL_ENV: "production", NODE_ENV: "production" }), false);
    assert.equal(showReviewExamples({ NODE_ENV: "production" }), false);
    assert.equal(showReviewExamples({}), false);
    assert.equal(showReviewExamples({ VERCEL_ENV: "preview", NODE_ENV: "production" }), true);
  });
  const totals = new Set();
  await check("all 329 active products have stable 30+ illustrative evaluations and 10%+ text", () => {
    assert.equal(products.length, 329);
    for (const product of products) {
      const result = getReviewExamples(`${product.name}:${product.imageUrl ?? ""}`), second = getReviewExamples(`${product.name}:${product.imageUrl ?? ""}`);
      assert.ok(result.total >= 30, product.name);
      const written = result.reviews.filter(review => review.content);
      assert.ok(written.length / result.total >= 0.1, product.name);
      assert.equal(result.textCount, written.length);
      assert.equal(result.reviews.length, result.total);
      assert.deepEqual(result, second);
      assert.ok(result.reviews.every(review => review.rating >= 1 && review.rating <= 5));
      assert.ok(written.every(review => /예시|화면/.test(review.content)));
      totals.add(result.total);
    }
    assert.ok(totals.size >= 20);
  });
  await check("size guides match every active product option and use explicit reference language", () => {
    for (const product of products) {
      const sizes = (product.sizes || "").split(",").map(s => s.trim()).filter(Boolean);
      const guide = getProductSizeGuide({ name: product.name, category: product.category, gender: product.gender, sizes });
      assert.ok(guide.rows.length >= 1, product.name);
      assert.ok(/참고|환산|실측|고객센터|표기|치수|확인/.test(guide.note), product.name);
      if (["top", "bottom", "waist", "footwear"].includes(guide.kind)) assert.deepEqual(guide.rows.map(row => row[0]), [...new Set(sizes)], product.name);
      if (guide.kind === "accessory") assert.equal(guide.unit, null);
      if (guide.kind === "footwear") assert.equal(guide.unit, "mm");
    }
  });
  const summaries = {};
  await check("visible category counts are derived from real products and vary by merchandise", () => {
    for (const gender of ["men", "women"]) {
      const rows = products.filter(product => product.gender === gender);
      const result = getCatalogCategoryCounts(rows);
      assert.equal(result.reduce((sum, row) => sum + row.count, 0), rows.length);
      assert.ok(new Set(result.map(row => row.count)).size > 5);
      summaries[gender] = result.map(row => ({ category: row.category, count: row.count }));
      const assignments = rows.map(getProductClassification);
      assert.ok(assignments.every(item => item.category && item.subcategory));
    }
  });
  await check("illustrative content never inserts actual review rows", async () => assert.equal(await db.shopProductReview.count(), reviewBefore));
  const output = { status: "PASS", count: checks.length, checks, products: products.length, exampleCountVariants: totals.size, actualReviewRows: reviewBefore, categoryDistribution: summaries };
  writeFileSync("tests/reports/2026-11-04-layout-catalog-followup/feature-results.json", JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ status: output.status, count: output.count, products: output.products, exampleCountVariants: output.exampleCountVariants }));
} finally { await db.$disconnect(); }
