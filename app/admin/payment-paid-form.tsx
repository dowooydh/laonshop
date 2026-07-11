"use client";

import { useActionState } from "react";
import { confirmPaymentPaidAction, type AdminPaymentState } from "./actions";
import { usePaymentResolutionNavigation } from "./use-payment-resolution-navigation";
import { Button, Checkbox, FieldError, FieldHint, Input, Label, Textarea } from "@/lib/ui";

const INITIAL_STATE: AdminPaymentState = { status: "idle" };

export function PaymentPaidForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(confirmPaymentPaidAction, INITIAL_STATE);
  usePaymentResolutionNavigation(state);

  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <input type="hidden" name="orderId" value={orderId} />

      <div>
        <Label htmlFor={`paid-amount-${orderId}`}>KSTA 승인 금액</Label>
        <Input
          id={`paid-amount-${orderId}`}
          name="confirmedAmount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="조회된 승인 금액을 직접 입력"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`paid-approval-${orderId}`}>승인번호</Label>
          <Input id={`paid-approval-${orderId}`} name="approvalNo" maxLength={64} autoComplete="off" required />
        </div>
        <div>
          <Label htmlFor={`paid-pg-${orderId}`}>PG 거래번호</Label>
          <Input id={`paid-pg-${orderId}`} name="pgTrno" maxLength={100} autoComplete="off" required />
        </div>
      </div>

      <div>
        <Label htmlFor={`paid-card-${orderId}`}>결제수단·카드사 (선택)</Label>
        <Input
          id={`paid-card-${orderId}`}
          name="cardName"
          maxLength={50}
          placeholder="예: 신한카드"
          autoComplete="off"
        />
      </div>

      <div>
        <Label htmlFor={`paid-reason-${orderId}`}>확인 메모</Label>
        <Textarea
          id={`paid-reason-${orderId}`}
          name="reason"
          minLength={5}
          maxLength={500}
          placeholder="KSTA 조회 시각과 확인 근거를 기록해 주세요."
          required
        />
        <FieldHint>카드번호, 비밀번호, 생년월일 등 결제 인증정보는 입력하지 마세요.</FieldHint>
      </div>

      <Checkbox name="confirmed" required>
        KSTA에서 주문번호와 금액, 승인번호가 모두 일치하는 것을 확인했습니다.
      </Checkbox>

      <div aria-live={state.status === "error" ? "assertive" : "polite"}>
        <FieldError>{state.status === "error" ? state.message : undefined}</FieldError>
        {state.status === "success" && <p className="text-step--1 text-success">{state.message}</p>}
      </div>

      <Button type="submit" size="lg" loading={pending} disabled={pending} className="w-full sm:w-auto">
        결제완료로 확정
      </Button>
    </form>
  );
}
