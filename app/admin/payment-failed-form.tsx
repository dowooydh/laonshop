"use client";

import { useActionState } from "react";
import { confirmPaymentFailedAction, type AdminPaymentState } from "./actions";
import { usePaymentResolutionNavigation } from "./use-payment-resolution-navigation";
import { Button, Checkbox, FieldError, FieldHint, Input, Label, Textarea } from "@/lib/ui";

const INITIAL_STATE: AdminPaymentState = { status: "idle" };

type PaymentFailedFormProps = {
  orderId: string;
  orderMoid: string;
  totalLabel: string;
};

export function PaymentFailedForm({ orderId, orderMoid, totalLabel }: PaymentFailedFormProps) {
  const [state, action, pending] = useActionState(confirmPaymentFailedAction, INITIAL_STATE);
  usePaymentResolutionNavigation(state);

  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <input type="hidden" name="orderId" value={orderId} />

      <div className="rounded-[var(--radius-md)] border border-danger bg-[color-mix(in_oklab,var(--danger)_6%,transparent)] p-4 text-step--1">
        <p className="font-medium text-fg">실패 처리할 주문을 다시 확인하세요.</p>
        <p className="mt-1 break-all font-mono text-fg-muted">{orderMoid}</p>
        <p className="mt-1 font-mono font-semibold text-fg">{totalLabel}</p>
      </div>

      <div>
        <Label htmlFor={`failed-moid-${orderId}`}>주문번호 다시 입력</Label>
        <Input
          id={`failed-moid-${orderId}`}
          name="confirmedMoid"
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          placeholder={orderMoid}
          required
        />
      </div>

      <div>
        <Label htmlFor={`failed-reason-${orderId}`}>확인 메모</Label>
        <Textarea
          id={`failed-reason-${orderId}`}
          name="reason"
          minLength={5}
          maxLength={500}
          placeholder="KSTA에서 미승인 또는 취소 상태를 확인한 근거를 기록해 주세요."
          required
        />
        <FieldHint>실패 확정 뒤 구매자는 같은 주문번호로 결제를 다시 시도할 수 있습니다.</FieldHint>
      </div>

      <Checkbox name="confirmed" required>
        KSTA에 유효한 승인 내역이 없거나 해당 승인이 취소된 것을 확인했습니다.
      </Checkbox>

      <div aria-live={state.status === "error" ? "assertive" : "polite"}>
        <FieldError>{state.status === "error" ? state.message : undefined}</FieldError>
        {state.status === "success" && <p className="text-step--1 text-success">{state.message}</p>}
      </div>

      <Button type="submit" variant="danger" size="lg" loading={pending} disabled={pending} className="w-full sm:w-auto">
        결제실패로 확정
      </Button>
    </form>
  );
}
