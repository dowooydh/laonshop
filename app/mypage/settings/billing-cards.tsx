"use client";
// 간편결제(원클릭) 카드 관리 — 안전 연동 전까지 신규 등록은 닫고 과거 레코드 삭제만 제공한다.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBillingCardAction } from "../actions";
import { BillingCardReviewMock } from "./billing-card-review-mock";

export type BillingCardRow = { id: string; maskedCardNumb: string; dateLabel: string };
type BillingCardsProps = { cards: BillingCardRow[]; reviewMockupEnabled: boolean };

const DELETE_ERROR_MESSAGE = "카드 삭제 상태를 확인하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";

function CardMark() {
  return (
    <span className="flex h-[36px] w-[48px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-overlay">
      <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-fg-subtle" aria-hidden>
        <rect x="1" y="1" width="22" height="16" rx="2.5" />
        <path d="M1 6.2h22" />
      </svg>
    </span>
  );
}

export function BillingCards({ cards, reviewMockupEnabled }: BillingCardsProps) {
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = (id: string) => {
    setDeleteError(null);
    setDeletingId(id);
    startDelete(async () => {
      try {
        const result = await deleteBillingCardAction(id);
        if (!result.ok) {
          setDeleteError(result.error ?? DELETE_ERROR_MESSAGE);
          return;
        }
        router.refresh();
      } catch {
        setDeleteError(DELETE_ERROR_MESSAGE);
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {reviewMockupEnabled ? <BillingCardReviewMock /> : null}
      <div className="rounded-[var(--radius-md)] border border-line bg-overlay p-[16px] text-step--1 text-fg-subtle">
        {reviewMockupEnabled
          ? "위 카드 등록 시연은 화면 확인용이며 실제 원클릭 결제에는 사용할 수 없습니다. 결제 시 일반 카드결제의 KSPAY 인증결제창을 이용해 주세요."
          : "카드 등록과 원클릭 결제는 현재 이용할 수 없습니다. 결제 시 일반 카드결제의 KSPAY 인증결제창을 이용해 주세요."}
      </div>
      {deleteError ? (
        <p
          id="billing-card-delete-error"
          role="alert"
          className="rounded-[var(--radius-md)] border border-danger bg-[color-mix(in_oklab,var(--danger)_6%,transparent)] p-[12px] text-step--1 text-danger"
        >
          {deleteError}
        </p>
      ) : null}
      {cards.length === 0 ? (
        <p className="text-step--1 text-fg-subtle">서버에 저장된 기존 카드 정보가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-raised">
          {cards.map((c) => (
            <li key={c.id} className="flex min-w-0 items-center gap-[12px] p-[16px]">
              <CardMark />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-step--1 font-semibold tabular-nums text-fg [overflow-wrap:anywhere]">{c.maskedCardNumb}</div>
                <div className="text-step--1 text-fg-subtle [overflow-wrap:anywhere]">{c.dateLabel} 등록 · 결제 사용 중지</div>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => remove(c.id)}
                aria-busy={deletingId === c.id}
                aria-describedby={deleteError ? "billing-card-delete-error" : undefined}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center whitespace-nowrap px-[8px] text-step--1 text-fg-subtle transition-colors duration-fast hover:text-danger"
              >
                {deletingId === c.id ? "삭제 중" : "삭제"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
