"use client";
import { formatKrw } from "@/lib/format";
import { Button, Checkbox, EmptyState, FieldError, Input, Label, Spinner, buttonVariants, cn } from "@/lib/ui";
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
  const [agree, setAgree] = useState(false);

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
    if (!agree) {
      setError("주문 내용 확인 및 구매조건에 동의해 주세요.");
      return;
    }
    setPending(true);
    try {
      const res = await createOrderAction({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size })),
        ...form,
      });
      if (res.ok) setPay({ formAction: res.formAction, formFields: res.formFields });
      else setError(res.error);
    } catch {
      setError("주문 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  if (pay) return <KspayCheckout formAction={pay.formAction} formFields={pay.formFields} />;
  if (!ready)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  if (items.length === 0)
    return (
      <EmptyState
        title="장바구니가 비어 있습니다"
        description="마음에 드는 상품을 담아보세요"
        action={
          <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
            쇼핑하러 가기
          </Link>
        }
      />
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

      {/* 전자상거래법 제13조 — 재화 대금 외 배송비 고지 (전 상품 무료배송) */}
      <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-line bg-overlay px-5 py-4">
        <div className="flex items-center justify-between text-step--1 text-fg-muted">
          <span>상품 금액</span>
          <span className="font-mono">{formatKrw(total)}</span>
        </div>
        <div className="flex items-center justify-between text-step--1 text-fg-muted">
          <span>배송비</span>
          <span className="font-mono text-success">무료</span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2.5">
          <span className="text-step-0 text-fg-muted">총 결제금액</span>
          <span className="font-mono text-step-1 font-extrabold text-fg">{formatKrw(total)}</span>
        </div>
      </div>

      {/* 전자상거래법 제8조 — 결제 전 주문내용 확인·구매조건 동의 (심사 캡처 요소) */}
      <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)}>
        [필수] 주문 상품·결제 정보를 확인하였으며,{" "}
        <Link href="/policy/terms" target="_blank" className="text-fg underline underline-offset-2 hover:text-accent-cyan">
          이용약관
        </Link>
        ,{" "}
        <Link href="/policy/privacy" target="_blank" className="text-fg underline underline-offset-2 hover:text-accent-cyan">
          개인정보처리방침
        </Link>{" "}
        및{" "}
        <Link href="/policy/refund" target="_blank" className="text-fg underline underline-offset-2 hover:text-accent-cyan">
          청약철회·환불 정책
        </Link>
        에 동의합니다.
      </Checkbox>

      <FieldError>{error}</FieldError>
      <Button type="button" size="xl" loading={pending} disabled={!agree} onClick={submit}>
        {formatKrw(total)} 결제하기
      </Button>

      <p className="text-center text-step--1 text-fg-subtle">
        결제는 KSPAY(KSNET) 인증결제창에서 안전하게 진행됩니다.
      </p>
    </div>
  );
}
