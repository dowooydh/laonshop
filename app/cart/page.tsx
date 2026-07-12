"use client";
import { formatKrw } from "@/lib/format";
import { EmptyState, Spinner, buttonVariants, cn } from "@/lib/ui";
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
              <li
                key={`${c.productId}-${c.size}`}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[12px] p-[12px] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="relative h-[80px] w-[64px] shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-overlay">
                  {c.imageUrl && <Image src={c.imageUrl} alt={c.name} fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-step--1 font-medium text-fg [overflow-wrap:anywhere]">{c.name}</div>
                  {c.size && <div className="text-step--1 text-fg-subtle">사이즈 {c.size}</div>}
                  <div className="mt-1 font-mono text-step--1 font-bold text-fg [overflow-wrap:anywhere]">{formatKrw(c.price * c.qty)}</div>
                </div>
                <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-[8px] sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:flex-nowrap">
                  <div className="inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-md)] border border-line">
                    <button
                      type="button"
                      onClick={() => setQty(idx, c.qty - 1)}
                      aria-label="수량 감소"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center leading-none text-fg-muted transition-colors duration-fast hover:text-fg"
                    >
                      −
                    </button>
                    <span className="min-w-[32px] text-center font-mono text-step--1 tabular-nums">{c.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(idx, c.qty + 1)}
                      aria-label="수량 증가"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center leading-none text-fg-muted transition-colors duration-fast hover:text-fg"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center whitespace-nowrap px-[8px] text-step--1 text-fg-subtle transition-colors duration-fast hover:text-danger"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-line bg-overlay px-[20px] py-[16px]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-step--1 text-fg-muted">
              <span className="min-w-[min(100%,8rem)] flex-1">배송비</span>
              <span className="shrink-0 whitespace-nowrap font-mono text-success">무료</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-2.5">
              <span className="min-w-[min(100%,8rem)] flex-1 text-step-0 text-fg-muted">총 결제금액</span>
              <span className="min-w-0 max-w-full text-right font-mono text-step-1 font-extrabold text-fg [overflow-wrap:anywhere]">
                {formatKrw(total)}
              </span>
            </div>
          </div>

          <Link
            href="/checkout"
            className={cn(
              buttonVariants({ variant: "primary", size: "xl" }),
              "min-h-[56px] max-w-full break-keep px-[16px] py-[12px] text-center leading-tight !h-auto !whitespace-normal",
            )}
          >
            주문하기
          </Link>
        </>
      )}
    </div>
  );
}
