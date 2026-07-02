"use client";

// 헤더 장바구니 수량 — lib/cart.ts의 'laonshop-cart-change' 이벤트 구독 (담기 피드백).
import { useEffect, useState } from "react";
import { getCart } from "@/lib/cart";

export function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(getCart().reduce((sum, c) => sum + c.qty, 0));
    update();
    window.addEventListener("laonshop-cart-change", update);
    window.addEventListener("storage", update); // 다른 탭 동기화
    return () => {
      window.removeEventListener("laonshop-cart-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (count === 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-[color-mix(in_oklab,var(--accent-cyan)_16%,transparent)] px-1.5 font-mono text-[11px] font-semibold tabular-nums text-accent-cyan ring-1 ring-inset ring-[color-mix(in_oklab,var(--accent-cyan)_38%,transparent)]">
      {count > 99 ? "99+" : count}
    </span>
  );
}
