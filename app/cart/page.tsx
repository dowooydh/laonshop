"use client";
import { formatKrw } from "@/lib/format";
import { EmptyState, Spinner, buttonVariants } from "@/lib/ui";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cartTotal, getCart, saveCart, type CartItem } from "@/lib/cart";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(getCart());
    setReady(true);
  }, []);

  const setQty = (idx: number, qty: number) => {
    const next = items.map((c, i) => (i === idx ? { ...c, qty: Math.min(99, Math.max(1, qty)) } : c));
    setItems(next);
    saveCart(next);
  };
  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    saveCart(next);
  };

  const total = cartTotal(items);

  if (!ready)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">Cart</p>
        <h1 className="font-display text-step-2 font-bold tracking-tight text-fg">장바구니</h1>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="장바구니가 비어 있습니다"
          description="마음에 드는 상품을 담아보세요"
          action={
            <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
              쇼핑하러 가기
            </Link>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-raised">
            {items.map((c, idx) => (
              <li key={`${c.productId}-${c.size}`} className="flex items-center gap-3 p-3">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-overlay">
                  {c.imageUrl && <Image src={c.imageUrl} alt={c.name} fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-step--1 font-medium text-fg">{c.name}</div>
                  {c.size && <div className="text-step--1 text-fg-subtle">사이즈 {c.size}</div>}
                  <div className="mt-1 font-mono text-step--1 font-bold text-fg">{formatKrw(c.price * c.qty)}</div>
                  <div className="mt-1.5 inline-flex items-center rounded-[var(--radius-md)] border border-line">
                    <button
                      type="button"
                      onClick={() => setQty(idx, c.qty - 1)}
                      aria-label="수량 감소"
                      className="h-8 w-8 text-fg-muted transition-colors duration-fast hover:text-fg"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-mono text-step--1 tabular-nums">{c.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(idx, c.qty + 1)}
                      aria-label="수량 증가"
                      className="h-8 w-8 text-fg-muted transition-colors duration-fast hover:text-fg"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="self-start text-step--1 text-fg-subtle transition-colors duration-fast hover:text-danger"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-line bg-overlay px-5 py-4">
            <div className="flex items-center justify-between text-step--1 text-fg-muted">
              <span>배송비</span>
              <span className="font-mono text-success">무료</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2.5">
              <span className="text-step-0 text-fg-muted">총 결제금액</span>
              <span className="font-mono text-step-1 font-extrabold text-fg">{formatKrw(total)}</span>
            </div>
          </div>

          <Link href="/checkout" className={buttonVariants({ variant: "primary", size: "xl" })}>
            주문하기
          </Link>
        </>
      )}
    </div>
  );
}
