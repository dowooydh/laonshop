"use client";
// 결제 미완료(PENDING/FAILED) 주문의 결제 재개 — 주문서로 돌아가지 않고
// 이 화면에서 결제수단을 다시 선택해 KSPAY 결제창을 재호출한다.
import { useState } from "react";
import { formatKrw } from "@/lib/format";
import { Button, FieldError, cn } from "@/lib/ui";
import { KspayCheckout } from "@/components/kspay-checkout";
import { retryPaymentAction } from "../actions";

export type RetryBillingCard = { id: string; maskedCardNumb: string };

export function RetryPayment({
  orderId,
  amount,
  billingCards,
}: {
  orderId: string;
  amount: number;
  billingCards: RetryBillingCard[];
}) {
  const METHODS = [
    { id: "card", label: "카드결제", desc: "신용카드 (인증결제)" },
    { id: "kakaopay", label: "카카오페이", desc: "카카오페이 간편결제" },
    { id: "naverpay", label: "네이버페이", desc: "네이버페이 간편결제" },
    { id: "bank", label: "실시간 계좌이체", desc: "은행 계좌 즉시 이체" },
    ...(billingCards.length > 0
      ? [{ id: "oneclick", label: "원클릭 결제", desc: `등록 카드 ${billingCards.length}장` }]
      : []),
  ];
  const [method, setMethod] = useState("card");
  const [billingCardId, setBillingCardId] = useState(billingCards[0]?.id ?? "");
  const [pay, setPay] = useState<{ formAction: string; formFields: Record<string, string> } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError("");
    setPending(true);
    try {
      const res = await retryPaymentAction({
        orderId,
        method: method as "card" | "kakaopay" | "naverpay" | "bank" | "oneclick",
        ...(method === "oneclick" && billingCardId ? { billingCardId } : {}),
      });
      if (!res.ok) {
        setError(res.error);
      } else if ("redirect" in res) {
        window.location.href = res.redirect;
        return;
      } else {
        setPay({ formAction: res.formAction, formFields: res.formFields });
      }
    } catch {
      setError("결제 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  if (pay) return <KspayCheckout formAction={pay.formAction} formFields={pay.formFields} />;

  return (
    <section className="mt-6 space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-5">
      <div>
        <p className="text-step-0 font-semibold text-fg">결제 이어서 진행하기</p>
        <p className="mt-1 text-step--1 text-fg-subtle">
          결제창이 닫혔거나 결제가 완료되지 않았습니다. 결제수단을 선택해 같은 주문으로 다시 결제할 수 있습니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={cn(
              "rounded-[var(--radius-md)] border p-3.5 text-left transition-colors duration-fast",
              method === m.id
                ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-fg shadow-glow-cyan"
                : "border-line bg-raised hover:bg-overlay",
            )}
          >
            <div className="text-step-0 font-medium text-fg">{m.label}</div>
            <div className="mt-0.5 text-step--1 text-fg-subtle">{m.desc}</div>
          </button>
        ))}
      </div>
      {method === "oneclick" && billingCards.length > 0 && (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-line bg-overlay p-4">
          {billingCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setBillingCardId(c.id)}
              className="flex w-full items-center justify-between gap-3 text-left text-step--1"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    billingCardId === c.id ? "border-accent-cyan" : "border-line",
                  )}
                  aria-hidden
                >
                  {billingCardId === c.id && <span className="h-2 w-2 rounded-full bg-accent-cyan" />}
                </span>
                <span className="font-mono font-semibold tabular-nums text-fg">{c.maskedCardNumb}</span>
              </span>
              {billingCardId === c.id && (
                <span className="rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,var(--accent-cyan)_16%,transparent)] px-2 py-0.5 font-mono text-[11px] text-accent-cyan ring-1 ring-inset ring-[color-mix(in_oklab,var(--accent-cyan)_38%,transparent)]">
                  결제 카드
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <FieldError>{error}</FieldError>
      <Button type="button" size="lg" className="w-full" loading={pending} onClick={submit}>
        {formatKrw(amount)} 결제하기
      </Button>
      <p className="text-center text-step--1 text-fg-subtle">결제는 KSPAY(KSNET) 인증결제창에서 안전하게 진행됩니다.</p>
    </section>
  );
}
