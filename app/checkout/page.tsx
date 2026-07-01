"use client";
import { formatKrw } from "@/lib/format";
import { Button, FieldError, Input, Label, cn } from "@/lib/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KspayCheckout } from "@/components/kspay-checkout";
import { cartTotal, getCart, type CartItem } from "@/lib/cart";
import { createOrderAction } from "./actions";

const METHODS = [
  { id: "auth", label: "카드·간편결제", desc: "신용카드 / 카카오·네이버·삼성페이", enabled: true },
  { id: "bank", label: "계좌이체", desc: "준비 중", enabled: false },
  { id: "billing", label: "정기결제(빌링)", desc: "준비 중", enabled: false },
  { id: "manual", label: "수기결제", desc: "준비 중", enabled: false },
];

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ receiverName: "", receiverPhone: "", address: "" });
  const [method, setMethod] = useState("auth");
  const [pay, setPay] = useState<{ formAction: string; formFields: Record<string, string> } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setItems(getCart());
    setReady(true);
  }, []);

  const total = cartTotal(items);

  const submit = async () => {
    setError("");
    if (!form.receiverName || !form.receiverPhone || !form.address) {
      setError("배송 정보를 모두 입력해 주세요.");
      return;
    }
    setPending(true);
    const res = await createOrderAction({
      items: items.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size })),
      ...form,
    });
    setPending(false);
    if (res.ok) setPay({ formAction: res.formAction, formFields: res.formFields });
    else setError(res.error);
  };

  if (pay) return <KspayCheckout formAction={pay.formAction} formFields={pay.formFields} />;
  if (!ready) return <div className="py-16 text-center text-fg-subtle">불러오는 중…</div>;
  if (items.length === 0)
    return (
      <div className="py-16 text-center">
        <p className="text-fg-muted">장바구니가 비어 있습니다.</p>
        <Link href="/" className="mt-3 inline-block text-accent-cyan hover:underline">
          쇼핑하러 가기 →
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-lg font-bold text-fg">주문/결제</h1>

      {/* 주문 상품 */}
      <section className="rounded-xl border border-line bg-raised p-4">
        <div className="mb-2 text-sm font-semibold text-fg">주문 상품</div>
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={`${c.productId}-${c.size}`} className="flex justify-between py-2 text-sm">
              <span className="text-fg-muted">
                {c.name}
                {c.size ? ` (${c.size})` : ""} × {c.qty}
              </span>
              <span className="font-medium">{formatKrw(c.price * c.qty)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 배송 정보 */}
      <section className="space-y-3 rounded-xl border border-line bg-raised p-4">
        <div className="text-sm font-semibold text-fg">배송 정보</div>
        <div>
          <Label htmlFor="rn">받는 분</Label>
          <Input id="rn" value={form.receiverName} onChange={(e) => setForm({ ...form, receiverName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="rp">연락처</Label>
          <Input id="rp" inputMode="numeric" placeholder="010-0000-0000" value={form.receiverPhone} onChange={(e) => setForm({ ...form, receiverPhone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="addr">배송지</Label>
          <Input id="addr" placeholder="주소를 입력해 주세요" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </section>

      {/* 결제수단 */}
      <section className="space-y-2 rounded-xl border border-line bg-raised p-4">
        <div className="text-sm font-semibold text-fg">결제수단</div>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.enabled}
              onClick={() => m.enabled && setMethod(m.id)}
              className={cn(
                "rounded-lg border p-3 text-left",
                !m.enabled && "cursor-not-allowed border-line opacity-60",
                method === m.id && m.enabled
                  ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-fg"
                  : "border-line bg-raised",
              )}
            >
              <div className={cn("text-sm font-medium", m.enabled ? "text-fg" : "text-fg-subtle")}>{m.label}</div>
              <div className="text-[11px] text-fg-subtle">{m.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-fg-subtle">계좌이체·정기결제·수기결제는 PG 스펙 확정 후 오픈됩니다.</p>
      </section>

      <div className="flex items-center justify-between rounded-xl bg-raised px-4 py-3">
        <span className="text-sm text-fg-muted">총 결제금액</span>
        <span className="text-lg font-extrabold">{formatKrw(total)}</span>
      </div>

      <FieldError>{error}</FieldError>
      <Button type="button" size="xl" loading={pending} onClick={submit}>
        {formatKrw(total)} 결제하기
      </Button>
    </div>
  );
}
