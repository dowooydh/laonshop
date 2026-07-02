"use client";
// 찜 하트 — 상품 상세 타이틀 옆. 낙관적 토글, 비로그인은 서버 액션이 /login으로 리다이렉트.
import { useState, useTransition } from "react";
import { cn } from "@/lib/ui";
import { toggleWishlistAction } from "../actions";

export function WishlistButton({ productId, initialWished }: { productId: string; initialWished: boolean }) {
  const [wished, setWished] = useState(initialWished);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    setWished((w) => !w); // 낙관적 반영
    startTransition(async () => {
      try {
        const res = await toggleWishlistAction(productId);
        setWished(res.wished);
      } catch {
        setWished((w) => !w); // 로그인 리다이렉트 외 실패 시 원복
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={wished}
      aria-label={wished ? "위시리스트에서 제거" : "위시리스트에 담기"}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors duration-fast",
        wished
          ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-accent-cyan"
          : "border-line bg-raised text-fg-subtle hover:bg-overlay hover:text-fg",
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}
