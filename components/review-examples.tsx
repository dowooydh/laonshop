"use client";
import { useState } from "react";
import type { getReviewExamples } from "@/lib/review-examples";
export function ReviewExamples({
  data,
}: {
  data: ReturnType<typeof getReviewExamples>;
}) {
  const [writtenOnly, setWrittenOnly] = useState(false);
  const [visible, setVisible] = useState(12);
  const reviews = writtenOnly
    ? data.reviews.filter((review) => review.content)
    : data.reviews;
  return (
    <section
      className="space-y-5 rounded-md border-2 border-dashed border-line p-4 sm:p-6"
      aria-labelledby="review-examples-title"
      data-review-examples
    >
      <div>
        <h2 id="review-examples-title" className="text-xl font-bold">
          미리보기용 후기 예시
        </h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          아래 별점과 글은 화면 구성을 확인하기 위한 예시입니다. 실제 구매후기가
          아니며 상품의 평점·후기 수에 합산하지 않습니다.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <span className="text-3xl font-bold">
          {data.averageRating.toFixed(1)}{" "}
          <span className="text-sm font-normal">/ 5</span>
        </span>
        <p className="text-sm text-fg-muted">
          예시 {data.total}개 · 글 후기 예시 {data.textCount}개
        </p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="예시 후기 필터">
        {[false, true].map((written) => (
          <button
            key={String(written)}
            type="button"
            aria-pressed={writtenOnly === written}
            onClick={() => {
              setWrittenOnly(written);
              setVisible(12);
            }}
            className={`min-h-11 rounded border px-4 py-2 text-sm ${writtenOnly === written ? "border-fg bg-fg text-void" : "border-line text-fg"}`}
          >
            {written
              ? `글 후기 예시 ${data.textCount}`
              : `전체 예시 ${data.total}`}
          </button>
        ))}
      </div>
      <div className="divide-y divide-line">
        {reviews.slice(0, visible).map((review) => (
          <article key={review.id} className="space-y-3 py-4">
            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <span className="text-fg-subtle">{review.label}</span>
              <span aria-label={`예시 별점 ${review.rating}점`}>
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </span>
            </div>
            {review.content ? (
              <p className="text-sm leading-7 [overflow-wrap:anywhere]">
                {review.content}
              </p>
            ) : (
              <p className="text-xs text-fg-subtle">별점만 남긴 예시입니다.</p>
            )}
          </article>
        ))}
      </div>
      {visible < reviews.length && (
        <button
          type="button"
          onClick={() => setVisible((count) => count + 12)}
          className="min-h-11 w-full rounded border border-line px-4 py-3 text-sm font-semibold"
        >
          후기 예시 더 보기 ({Math.min(visible, reviews.length)}/
          {reviews.length})
        </button>
      )}
    </section>
  );
}
