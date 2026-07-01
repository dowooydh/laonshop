"use client";
import { formatKrw } from "@/lib/format";
import { Button, EmptyState } from "@/lib/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cartTotal, getCart, saveCart, type CartItem } from "@/lib/cart";

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(getCart());
    setReady(true);
  }, []);

  const setQty = (idx: number, qty: number) => {
    const next = items.map((c, i) => (i === idx ? { ...c, qty: Math.max(1, qty) } : c));
    setItems(next);
    saveCart(next);
  };
  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    saveCart(next);
  };

  const total = cartTotal(items);

  if (!ready) return <div className="py-16 text-center text-gray-400">불러오는 중…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">장바구니</h1>

      {items.length === 0 ? (
        <EmptyState title="장바구니가 비어 있습니다" description="마음에 드는 상품을 담아보세요" />
      ) : (
        <>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {items.map((c, idx) => (
              <li key={`${c.productId}-${c.size}`} className="flex items-center gap-3 p-3">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.imageUrl ?? ""} alt={c.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{c.name}</div>
                  {c.size && <div className="text-xs text-gray-400">사이즈 {c.size}</div>}
                  <div className="mt-1 text-sm font-bold">{formatKrw(c.price * c.qty)}</div>
                  <div className="mt-1.5 inline-flex items-center rounded-lg border border-gray-300">
                    <button type="button" onClick={() => setQty(idx, c.qty - 1)} className="h-8 w-8 text-gray-600">−</button>
                    <span className="w-8 text-center text-sm tabular-nums">{c.qty}</span>
                    <button type="button" onClick={() => setQty(idx, c.qty + 1)} className="h-8 w-8 text-gray-600">+</button>
                  </div>
                </div>
                <button type="button" onClick={() => remove(idx)} className="self-start text-xs text-gray-400 hover:text-red-500">
                  삭제
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">총 결제금액</span>
            <span className="text-lg font-extrabold text-gray-900">{formatKrw(total)}</span>
          </div>

          <Link href="/checkout">
            <Button type="button" size="xl">
              주문하기
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
