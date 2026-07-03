"use client";
// 간편결제(원클릭) 카드 관리 — 등록 카드 목록 + 접이식 등록 폼.
// 카드정보는 서버에서 검증 즉시 폐기되고 마스킹 번호만 표시된다.
import { Button, FieldError, FieldHint, Input, Label } from "@/lib/ui";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { deleteBillingCardAction, registerBillingCardAction, type SettingsState } from "../actions";

export type BillingCardRow = { id: string; maskedCardNumb: string; dateLabel: string };

function CardMark() {
  return (
    <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-overlay">
      <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-fg-subtle" aria-hidden>
        <rect x="1" y="1" width="22" height="16" rx="2.5" />
        <path d="M1 6.2h22" />
      </svg>
    </span>
  );
}

export function BillingCards({ cards }: { cards: BillingCardRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showError, setShowError] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [state, action, pending] = useActionState<SettingsState, FormData>(registerBillingCardAction, {});

  // 의존성은 state 객체 — 액션마다 새 객체가 오므로 연속 성공(true→true)에도 매번 실행된다
  useEffect(() => {
    if (state.ok) setOpen(false);
    if (state.error) setShowError(true);
  }, [state]);

  const openForm = () => {
    setShowError(false); // 이전 시도의 에러가 새 폼에 남지 않게
    setOpen(true);
  };
  const closeForm = () => {
    setShowError(false);
    setOpen(false);
  };

  const remove = (id: string) =>
    startDelete(async () => {
      await deleteBillingCardAction(id);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {cards.length === 0 ? (
        <p className="text-step--1 text-fg-subtle">
          등록된 카드가 없습니다. 카드를 등록하면 주문서에서 원클릭 결제를 선택할 수 있습니다.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-raised">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-4">
              <CardMark />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-step--1 font-semibold tabular-nums text-fg">{c.maskedCardNumb}</div>
                <div className="text-step--1 text-fg-subtle">{c.dateLabel} 등록</div>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => remove(c.id)}
                className="text-step--1 text-fg-subtle transition-colors duration-fast hover:text-danger"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <Button type="button" variant="outline" size="md" onClick={openForm}>
          카드 등록
        </Button>
      ) : (
        <form action={action} className="space-y-4 rounded-[var(--radius-lg)] border border-line bg-raised p-5">
          <div className="space-y-1.5">
            <Label htmlFor="bc-no">카드번호</Label>
            <Input id="bc-no" name="cardNo" inputMode="numeric" autoComplete="cc-number" placeholder="0000-0000-0000-0000" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bc-mm">유효기간 (MM)</Label>
              <Input id="bc-mm" name="expMm" inputMode="numeric" maxLength={2} placeholder="MM" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-yy">유효기간 (YY)</Label>
              <Input id="bc-yy" name="expYy" inputMode="numeric" maxLength={2} placeholder="YY" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bc-pw">비밀번호 앞 2자리</Label>
              <Input id="bc-pw" name="pw2" type="password" inputMode="numeric" maxLength={2} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc-birth">생년월일 6자리</Label>
              <Input id="bc-birth" name="birth6" inputMode="numeric" maxLength={10} placeholder="YYMMDD" required />
            </div>
          </div>
          <FieldHint>카드번호는 저장되지 않으며, 등록 후 마스킹된 번호만 표시됩니다.</FieldHint>
          <FieldError>{showError ? state.error : undefined}</FieldError>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="md" onClick={closeForm}>
              취소
            </Button>
            <Button type="submit" variant="secondary" size="md" loading={pending}>
              등록하기
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
