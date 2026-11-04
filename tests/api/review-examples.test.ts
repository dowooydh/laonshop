import assert from "node:assert/strict";
import test from "node:test";
import {
  getReviewExamples,
  showReviewExamples,
} from "../../lib/review-examples";
test("예시 후기는 production·미확인 런타임에서 노출하지 않는다", () => {
  for (const env of [
    {},
    { NODE_ENV: "production" },
    { VERCEL_ENV: "production", NODE_ENV: "development" },
    { VERCEL_ENV: "development", NODE_ENV: "production" },
  ])
    assert.equal(showReviewExamples(env), false);
  assert.equal(showReviewExamples({ VERCEL_ENV: "preview" }), true);
  assert.equal(showReviewExamples({ NODE_ENV: "development" }), true);
});
test("상품별 예시는 30개 이상이고 10퍼센트 이상이 글 후기이며 결과가 안정적이다", () => {
  const totals = new Set<number>();
  for (let i = 0; i < 500; i++) {
    const key = `product-${i}`;
    const result = getReviewExamples(key);
    totals.add(result.total);
    assert.ok(result.total >= 30);
    assert.equal(result.reviews.length, result.total);
    assert.equal(
      result.reviews.filter((review) => review.content).length,
      result.textCount,
    );
    assert.ok(result.textCount / result.total >= 0.1);
    assert.equal(
      new Set(result.reviews.map((review) => review.id)).size,
      result.total,
    );
    assert.ok(
      result.reviews.every(
        (review) =>
          Number.isInteger(review.rating) &&
          review.rating >= 1 &&
          review.rating <= 5,
      ),
    );
    assert.deepEqual(getReviewExamples(key), result);
  }
  assert.ok(totals.size > 20);
});
