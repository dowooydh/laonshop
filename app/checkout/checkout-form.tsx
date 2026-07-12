"use client";
import { formatKrw } from "@/lib/format";
import { Button, Checkbox, EmptyState, FieldError, Input, Label, Spinner, buttonVariants, cn } from "@/lib/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AddressInput } from "@/components/address-input";
import { KspayCheckout } from "@/components/kspay-checkout";
import { cartTotal, getCart, type CartItem } from "@/lib/cart";
import { createCheckoutIdempotencyKey, getCheckoutNonce } from "@/lib/checkout-idempotency";
import { createOrderAction } from "./actions";

export type CheckoutInitial = {
  receiverName: string;
  receiverPhone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
};
export type BillingCardOption = { id: string; maskedCardNumb: string };

export function CheckoutForm({
  initial,
  billingCards = [],
}: {
  initial: CheckoutInitial;
  billingCards?: BillingCardOption[];
}) {
  // 결제수단 구성 — KSNET 김민규 팀장 가이드(2026-07): 카드/카카오/네이버/실시간계좌이체/원클릭(빌링)/수기(구인증).
  // 가상계좌는 KSNET 미지원+심사 거절 사유로 제외.
  const METHODS = [
    { id: "card", label: "카드결제", desc: "신용카드 (인증결제)", enabled: true },
    { id: "kakaopay", label: "카카오페이", desc: "카카오페이 간편결제", enabled: true },
    { id: "naverpay", label: "네이버페이", desc: "네이버페이 간편결제", enabled: true },
    { id: "bank", label: "실시간 계좌이체", desc: "은행 계좌 즉시 이체", enabled: true },
    {
      id: "oneclick",
      label: "원클릭 결제",
      desc: billingCards.length > 0 ? `등록 카드 ${billingCards.length}장` : "설정에서 카드 등록 후 이용",
      enabled: billingCards.length > 0,
    },
    { id: "manual", label: "수기결제", desc: "카드번호 직접 입력 (구인증)", enabled: true },
  ];
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(initial);
  const [method, setMethod] = useState("card");
  const [billingCardId, setBillingCardId] = useState(billingCards[0]?.id ?? "");
  const [manualCard, setManualCard] = useState({ cardNo: "", expMm: "", expYy: "", pw2: "", birth6: "" });
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
    if (method === "manual" && (!manualCard.cardNo || !manualCard.expMm || !manualCard.expYy || !manualCard.pw2 || !manualCard.birth6)) {
      setError("수기결제 카드 정보를 모두 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      // 다른 탭에서 장바구니가 바뀌었을 수 있으므로 제출 직전에 다시 읽는다.
      const currentItems = getCart();
      if (currentItems.length === 0) {
        setItems([]);
        setError("장바구니가 비어 있습니다.");
        return;
      }
      const orderInput = {
        method: method as "card" | "kakaopay" | "naverpay" | "bank" | "oneclick" | "manual",
        items: currentItems.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size })),
        ...form,
        ...(method === "oneclick" && billingCardId ? { billingCardId } : {}),
        ...(method === "manual"
          ? { manualCard: { ...manualCard, cardNo: manualCard.cardNo.replace(/[\s-]/g, "") } }
          : {}),
      };
      const idempotencyKey = await createCheckoutIdempotencyKey(orderInput, getCheckoutNonce());
      const res = await createOrderAction({ ...orderInput, idempotencyKey });
      if (!res.ok) {
        setError(res.error);
      } else if ("redirect" in res) {
        // 원클릭(빌링) — 결제창 없이 승인 완료 후 주문 확인으로 이동
        window.location.href = res.redirect;
        return;
      } else {
        setPay({ formAction: res.formAction, formFields: res.formFields });
      }
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
    <div className="mx-auto min-w-0 max-w-lg space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">Checkout</p>
        <h1 className="font-display text-step-2 font-bold tracking-tight text-fg">주문/결제</h1>
      </header>

      {/* 01 주문 상품 */}
      <section className="rounded-[var(--radius-lg)] border border-line bg-raised p-[20px]">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-mono text-step--1 text-fg-subtle">01</span>
          <span className="text-step-0 font-semibold text-fg">주문 상품</span>
        </div>
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li
              key={`${c.productId}-${c.size}`}
              className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5 text-step--1"
            >
              <span className="min-w-[min(100%,8rem)] flex-1 text-fg-muted [overflow-wrap:anywhere]">
                {c.name}
                {c.size ? ` (${c.size})` : ""} × {c.qty}
              </span>
              <span className="min-w-0 max-w-full text-right font-mono font-medium text-fg [overflow-wrap:anywhere]">
                {formatKrw(c.price * c.qty)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 02 배송 정보 — 최근 주문/회원정보로 프리필됨 */}
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-[20px]">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-step--1 text-fg-subtle">02</span>
            <span className="text-step-0 font-semibold text-fg">배송 정보</span>
          </div>
          {initial.address && (
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">저장된 배송지</span>
          )}
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
          <Label htmlFor="co-zipcode">배송지</Label>
          <AddressInput
            idPrefix="co"
            initial={{ zipcode: initial.zipcode, address: initial.address, addressDetail: initial.addressDetail }}
            onChange={(v) => setForm((f) => ({ ...f, zipcode: v.zipcode, address: v.address, addressDetail: v.addressDetail }))}
          />
        </div>
      </section>

      {/* 03 결제수단 */}
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-[20px]">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-step--1 text-fg-subtle">03</span>
          <span className="text-step-0 font-semibold text-fg">결제수단</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2 sm:grid-cols-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.enabled}
              aria-pressed={method === m.id}
              onClick={() => {
                if (!m.enabled) return;
                setMethod(m.id);
                setError("");
              }}
              className={cn(
                "min-h-11 min-w-0 rounded-[var(--radius-md)] border p-3 text-left transition-colors duration-fast sm:p-3.5",
                !m.enabled && "cursor-not-allowed border-line opacity-60",
                method === m.id && m.enabled
                  ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-fg shadow-glow-cyan"
                  : "border-line bg-raised hover:bg-overlay",
              )}
            >
              <div
                className={cn(
                  "break-keep text-[12px] font-medium leading-5 min-[360px]:text-[13px] sm:text-step-0",
                  m.enabled ? "text-fg" : "text-fg-subtle",
                )}
              >
                {m.label}
              </div>
              <div className="mt-0.5 break-keep text-[12px] leading-4 text-fg-subtle sm:text-step--1">
                {m.desc}
              </div>
            </button>
          ))}
        </div>
        {/* 원클릭 선택 시 — 결제에 사용할 등록 카드 선택 */}
        {method === "oneclick" && billingCards.length > 0 && (
          <div className="min-w-0 space-y-2 rounded-[var(--radius-md)] border border-line bg-overlay p-[16px]">
            {billingCards.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={billingCardId === c.id}
                onClick={() => setBillingCardId(c.id)}
                className="flex min-h-[44px] w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 text-left text-step--1"
              >
                <span className="flex min-w-[min(100%,8rem)] flex-1 flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border",
                      billingCardId === c.id ? "border-accent-cyan" : "border-line",
                    )}
                    aria-hidden
                  >
                    {billingCardId === c.id && <span className="h-[8px] w-[8px] rounded-full bg-accent-cyan" />}
                  </span>
                  <span className="min-w-[min(100%,6rem)] flex-1 font-mono font-semibold tabular-nums text-fg [overflow-wrap:anywhere]">
                    {c.maskedCardNumb}
                  </span>
                </span>
                {billingCardId === c.id && (
                  <span className="max-w-full shrink-0 whitespace-nowrap rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,var(--accent-cyan)_16%,transparent)] px-2 py-0.5 font-mono text-[11px] text-accent-cyan ring-1 ring-inset ring-[color-mix(in_oklab,var(--accent-cyan)_38%,transparent)]">
                    결제 카드
                  </span>
                )}
              </button>
            ))}
            <p className="text-step--1 text-fg-subtle">
              카드 관리는{" "}
              <Link href="/mypage/settings" className="underline underline-offset-2 hover:text-fg">
                설정
              </Link>
              에서 할 수 있습니다.
            </p>
          </div>
        )}

        {/* 수기결제(구인증) 선택 시 — 카드정보 직접 입력. 서버에서 승인 요청 후 즉시 폐기 */}
        {method === "manual" && (
          <div className="min-w-0 space-y-3 rounded-[var(--radius-md)] border border-line bg-overlay p-[16px]">
            <div>
              <Label htmlFor="mc-no">카드번호</Label>
              <Input
                id="mc-no"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000-0000-0000-0000"
                value={manualCard.cardNo}
                onChange={(e) => setManualCard({ ...manualCard, cardNo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3">
              <div>
                <Label htmlFor="mc-mm">유효기간 (MM)</Label>
                <Input id="mc-mm" inputMode="numeric" maxLength={2} placeholder="MM" value={manualCard.expMm} onChange={(e) => setManualCard({ ...manualCard, expMm: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="mc-yy">유효기간 (YY)</Label>
                <Input id="mc-yy" inputMode="numeric" maxLength={2} placeholder="YY" value={manualCard.expYy} onChange={(e) => setManualCard({ ...manualCard, expYy: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3">
              <div>
                <Label htmlFor="mc-pw">비밀번호 앞 2자리</Label>
                <Input id="mc-pw" type="password" inputMode="numeric" maxLength={2} value={manualCard.pw2} onChange={(e) => setManualCard({ ...manualCard, pw2: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="mc-birth">생년월일 6자리</Label>
                <Input id="mc-birth" inputMode="numeric" maxLength={10} placeholder="YYMMDD" value={manualCard.birth6} onChange={(e) => setManualCard({ ...manualCard, birth6: e.target.value })} />
              </div>
            </div>
            <p className="text-step--1 text-fg-subtle">
              카드 정보는 결제 승인에만 사용되며 저장되지 않습니다. (법인카드는 생년월일 대신 사업자번호 10자리)
            </p>
          </div>
        )}
      </section>

      {/* 전자상거래법 제13조 — 재화 대금 외 배송비 고지 (전 상품 무료배송) */}
      <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-line bg-overlay px-[20px] py-[16px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-step--1 text-fg-muted">
          <span className="min-w-[min(100%,8rem)] flex-1">상품 금액</span>
          <span className="min-w-0 max-w-full text-right font-mono [overflow-wrap:anywhere]">{formatKrw(total)}</span>
        </div>
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
      <Button
        type="button"
        size="xl"
        className="min-h-[56px] min-w-0 max-w-full flex-wrap gap-x-2 gap-y-1 px-[clamp(4px,3vw,1.5rem)] py-3 text-center !h-auto !whitespace-normal leading-tight"
        loading={pending}
        disabled={!agree}
        onClick={submit}
      >
        <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{formatKrw(total)}</span>
        <span className="max-w-full break-keep">결제하기</span>
      </Button>

      <p className="text-center text-step--1 text-fg-subtle">
        결제는 KSPAY(KSNET) 인증결제창에서 안전하게 진행됩니다.
      </p>
    </div>
  );
}
