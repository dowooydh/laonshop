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
    <div className="mx-auto max-w-lg space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">Checkout</p>
        <h1 className="font-display text-step-2 font-bold tracking-tight text-fg">주문/결제</h1>
      </header>

      {/* 01 주문 상품 */}
      <section className="rounded-[var(--radius-lg)] border border-line bg-raised p-5">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-mono text-step--1 text-fg-subtle">01</span>
          <span className="text-step-0 font-semibold text-fg">주문 상품</span>
        </div>
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={`${c.productId}-${c.size}`} className="flex justify-between py-2.5 text-step--1">
              <span className="text-fg-muted">
                {c.name}
                {c.size ? ` (${c.size})` : ""} × {c.qty}
              </span>
              <span className="font-mono font-medium text-fg">{formatKrw(c.price * c.qty)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 02 배송 정보 */}
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-5">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-mono text-step--1 text-fg-subtle">02</span>
          <span className="text-step-0 font-semibold text-fg">배송 정보</span>
        </div>
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

      {/* 03 결제수단 */}
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-step--1 text-fg-subtle">03</span>
          <span className="text-step-0 font-semibold text-fg">결제수단</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.enabled}
              onClick={() => m.enabled && setMethod(m.id)}
              className={cn(
                "rounded-[var(--radius-md)] border p-3.5 text-left transition-colors duration-fast",
                !m.enabled && "cursor-not-allowed border-line opacity-60",
                method === m.id && m.enabled
                  ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-fg shadow-glow-cyan"
                  : "border-line bg-raised hover:bg-overlay",
              )}
            >
              <div className={cn("text-step-0 font-medium", m.enabled ? "text-fg" : "text-fg-subtle")}>{m.label}</div>
              <div className="mt-0.5 text-step--1 text-fg-subtle">{m.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-step--1 text-fg-subtle">계좌이체·정기결제·수기결제는 PG 스펙 확정 후 오픈됩니다.</p>
      </section>

      <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-line bg-overlay px-5 py-4">
        <span className="text-step-0 text-fg-muted">총 결제금액</span>
        <span className="font-mono text-step-1 font-extrabold text-fg">{formatKrw(total)}</span>
      </div>

      <FieldError>{error}</FieldError>
      <Button type="button" size="xl" loading={pending} onClick={submit}>
        {formatKrw(total)} 결제하기
      </Button>

      <p className="text-center text-step--1 text-fg-subtle">
        결제는 KSPAY(KSNET) 인증결제창에서 안전하게 진행됩니다.
      </p>
    </div>
  );
}
