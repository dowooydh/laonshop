"use client";
// 결제 미완료(PENDING/FAILED) 주문의 결제 재개 — 주문서로 돌아가지 않고
// 이 화면에서 결제수단을 다시 선택해 KSPAY 결제창을 재호출한다.
import { useState } from "react";
import { formatKrw } from "@/lib/format";
import { Button, FieldError, cn } from "@/lib/ui";
import { KspayCheckout } from "@/components/kspay-checkout";
import { retryPaymentAction } from "../actions";

export function RetryPayment({
  orderId,
  amount,
}: {
  orderId: string;
  amount: number;
}) {
  const METHODS = [
    { id: "card", label: "카드결제", desc: "신용카드 (인증결제)" },
    { id: "kakaopay", label: "카카오페이", desc: "카카오페이 간편결제" },
    { id: "naverpay", label: "네이버페이", desc: "네이버페이 간편결제" },
    { id: "bank", label: "실시간 계좌이체", desc: "은행 계좌 즉시 이체" },
  ];
  const [method, setMethod] = useState("card");
  const [pay, setPay] = useState<{ formAction: string; formFields: Record<string, string> } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError("");
    setPending(true);
    try {
      const res = await retryPaymentAction({
        orderId,
        method: method as "card" | "kakaopay" | "naverpay" | "bank",
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
    <section className="mt-6 min-w-0 space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-[20px]">
      <div>
        <p className="text-step-0 font-semibold text-fg">결제 이어서 진행하기</p>
        <p className="mt-1 text-step--1 text-fg-subtle [overflow-wrap:anywhere]">
          결제창이 닫혔거나 결제가 완료되지 않았습니다. 결제수단을 선택해 같은 주문으로 다시 결제할 수 있습니다.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2 sm:grid-cols-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={method === m.id}
            onClick={() => {
              setMethod(m.id);
              setError("");
            }}
            className={cn(
              "min-h-11 min-w-0 rounded-[var(--radius-md)] border p-3 text-left transition-colors duration-fast sm:p-3.5",
              method === m.id
                ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-fg shadow-glow-cyan"
                : "border-line bg-raised hover:bg-overlay",
            )}
          >
            <div className="break-keep text-[12px] font-medium leading-5 text-fg min-[360px]:text-[13px] sm:text-step-0">
              {m.label}
            </div>
            <div className="mt-0.5 break-keep text-[12px] leading-4 text-fg-subtle sm:text-step--1">
              {m.desc}
            </div>
          </button>
        ))}
      </div>
      <FieldError>{error}</FieldError>
      <Button
        type="button"
        size="lg"
        className="min-h-[48px] w-full min-w-0 max-w-full flex-wrap gap-x-2 gap-y-1 px-[clamp(4px,3vw,1.25rem)] py-3 text-center !h-auto !whitespace-normal leading-tight"
        loading={pending}
        onClick={submit}
      >
        <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{formatKrw(amount)}</span>
        <span className="max-w-full break-keep">결제하기</span>
      </Button>
      <p className="text-center text-step--1 text-fg-subtle">결제는 KSPAY(KSNET) 인증결제창에서 안전하게 진행됩니다.</p>
    </section>
  );
}
