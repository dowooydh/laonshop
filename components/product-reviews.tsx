"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { submitProductReview } from "@/app/reviews/actions";
import { Button, Label, Select, Textarea } from "@/lib/ui";

type Props = {
  productId: string;
  loggedIn: boolean;
  available: boolean;
  total: number;
  averageRating: number | null;
  reviews: {
    id: string;
    rating: number;
    content: string;
    authorLabel: string;
    purchasedSize: string | null;
    createdAt: string;
  }[];
  items: {
    id: string;
    orderId: string;
    orderNumber: string;
    name: string;
    size: string | null;
  }[];
};

export function ProductReviews({
  productId,
  loggedIn,
  available,
  total,
  averageRating,
  reviews,
  items,
}: Props) {
  const [state, action, pending] = useActionState(submitProductReview, {
    status: "idle",
  });
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") {
      form.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  return (
    <section
      id="reviews"
      className="scroll-mt-60 space-y-6 border-t border-line pt-8"
      aria-labelledby="reviews-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews-title" className="text-xl font-bold">
          구매후기{" "}
          {available ? <span className="text-fg-subtle">{total}</span> : null}
        </h2>
        <span className="text-sm text-fg-subtle">
          배송완료된 상품의 구매자가 남긴 후기입니다.
        </span>
      </div>
      {!available ? (
        <p className="rounded-md bg-raised p-5 text-sm text-fg-muted">
          지금은 구매후기를 이용할 수 없습니다. 잠시 후 다시 확인해주세요.
        </p>
      ) : (
        <>
          {total > 0 ? (
            <div className="flex items-center gap-4 border-y border-line py-6">
              <span className="text-4xl font-bold">
                {averageRating?.toFixed(1)}
              </span>
              <div>
                <p
                  className="text-lg"
                  aria-label={`5점 만점에 ${averageRating?.toFixed(1)}점`}
                >
                  ★ <span className="text-sm text-fg-subtle">/ 5</span>
                </p>
                <p className="text-sm text-fg-subtle">구매후기 {total}개</p>
              </div>
            </div>
          ) : (
            <div className="bg-raised px-5 py-8 text-center">
              <p className="font-semibold">첫 구매후기를 기다리고 있어요</p>
              <p className="mt-2 text-sm text-fg-subtle">
                받아본 상품의 착용감과 사이즈를 알려주세요.
              </p>
            </div>
          )}
          <div className="divide-y divide-line">
            {reviews.map((review) => (
              <article key={review.id} className="space-y-3 py-5">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    {review.authorLabel}{" "}
                    <span className="ml-2 font-normal text-fg-subtle">
                      구매자
                    </span>
                  </span>
                  <time className="text-fg-subtle" dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </time>
                </div>
                <p className="text-sm" aria-label={`별점 ${review.rating}점`}>
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                  {review.purchasedSize ? (
                    <span className="ml-3 text-fg-subtle">
                      구매 옵션 {review.purchasedSize}
                    </span>
                  ) : null}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                  {review.content}
                </p>
              </article>
            ))}
          </div>
          {total > reviews.length && (
            <p className="text-sm text-fg-subtle">
              최근 후기 {reviews.length}개를 표시하고 있습니다.
            </p>
          )}
          {!loggedIn ? (
            <Link
              href={`/login?next=${encodeURIComponent(`/product/${productId}#reviews`)}`}
              className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
            >
              로그인하고 구매후기 작성하기
            </Link>
          ) : items.length > 0 ? (
            <form
              action={action}
              ref={form}
              className="space-y-4 rounded-md border border-line p-5"
            >
              <h3 className="font-semibold">구매후기 작성</h3>
              <fieldset disabled={pending} className="space-y-4">
                <div>
                  <Label htmlFor="review-order-item">구매 상품</Label>
                  <Select id="review-order-item" name="orderItemId" required>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.size ? ` (${item.size})` : ""} ·{" "}
                        {item.orderNumber}
                      </option>
                    ))}
                  </Select>
                </div>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">별점</legend>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <label
                        key={rating}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line px-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="rating"
                          value={rating}
                          defaultChecked={rating === 5}
                          required
                        />
                        {rating}점
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <Label htmlFor="review-content">
                    상품을 받아보니 어떠셨나요?
                  </Label>
                  <Textarea
                    id="review-content"
                    name="content"
                    minLength={10}
                    maxLength={2000}
                    required
                    placeholder="착용감과 사이즈 등 구매에 도움이 되는 내용을 10자 이상 남겨주세요."
                  />
                  <p className="mt-2 text-xs text-fg-subtle">
                    최대 2,000자. 연락처·주소 등 개인정보는 적지 마세요.
                  </p>
                </div>
                <Button type="submit" size="lg" loading={pending}>
                  후기 등록
                </Button>
              </fieldset>
              {state.message && (
                <p
                  role={state.status === "error" ? "alert" : "status"}
                  className="text-sm"
                >
                  {state.message}
                </p>
              )}
            </form>
          ) : (
            <p className="text-sm text-fg-subtle">
              배송완료된 구매 상품이 있으면 후기를 작성할 수 있습니다. 주문
              상품별 한 번씩 작성할 수 있어요.
            </p>
          )}
        </>
      )}
    </section>
  );
}
