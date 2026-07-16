"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/lib/ui/button";
import {
  BILLING_REVIEW_STORAGE_KEY,
  createBillingReviewSnapshot,
  parseBillingReviewSnapshot,
  serializeBillingReviewSnapshot,
  type BillingReviewSnapshot,
} from "@/lib/billing-review-mock";

const REGISTERED_MESSAGE =
  "카드 등록 화면 시연이 완료되었습니다. 실제 빌링키나 결제수단은 생성되지 않았습니다.";

function CardMark() {
  return (
    <span className="flex h-[40px] w-[52px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-accent-cyan/30 bg-accent-cyan/10">
      <svg width="20" height="16" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-accent-cyan" aria-hidden>
        <rect x="1" y="1" width="22" height="16" rx="2.5" />
        <path d="M1 6.2h22" />
      </svg>
    </span>
  );
}

export function BillingCardReviewMock() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<BillingReviewSnapshot | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardPreviewRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(BILLING_REVIEW_STORAGE_KEY);
      const parsed = parseBillingReviewSnapshot(stored);
      setSnapshot(parsed);
      if (stored && !parsed) window.sessionStorage.removeItem(BILLING_REVIEW_STORAGE_KEY);
    } catch {
      setSnapshot(null);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => cardPreviewRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [close, open]);

  const registerPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSnapshot = createBillingReviewSnapshot();
    try {
      window.sessionStorage.setItem(BILLING_REVIEW_STORAGE_KEY, serializeBillingReviewSnapshot(nextSnapshot));
    } catch {
      // 저장소가 차단돼도 현재 화면의 시연 상태만 유지하며 외부 전송은 하지 않는다.
    }
    setSnapshot(nextSnapshot);
    setAnnouncement(REGISTERED_MESSAGE);
    close();
  };

  const deregisterPreview = () => {
    try {
      window.sessionStorage.removeItem(BILLING_REVIEW_STORAGE_KEY);
    } catch {
      // 브라우저 저장소가 차단된 경우에도 현재 화면에서는 즉시 제거한다.
    }
    setSnapshot(null);
    setAnnouncement("시연용 카드 등록을 해지했습니다.");
  };

  return (
    <div className="min-w-0 space-y-[12px]">
      <div className="relative min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-accent-cyan/25 bg-raised p-[16px] sm:p-[20px]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-accent-cyan/10 blur-3xl" aria-hidden />
        <div className="relative min-w-0 space-y-[16px]">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-[12px]">
            <div className="min-w-0 space-y-[6px]">
              <span className="inline-flex min-h-[28px] items-center rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-[10px] font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-accent-cyan">
                Card registration preview
              </span>
              <h3 className="font-display text-step-1 font-semibold tracking-tight text-fg">간편결제 카드 등록</h3>
              <p className="max-w-[42ch] text-step--1 leading-relaxed text-fg-muted">
                카드 등록 화면과 마스킹된 카드 관리 과정을 확인할 수 있습니다.
              </p>
            </div>
            <CardMark />
          </div>

          <div className="rounded-[var(--radius-md)] border border-warning/25 bg-warning/5 px-[12px] py-[10px] text-step--1 leading-relaxed text-fg-subtle">
            시연 전용 화면입니다. 실제 카드정보를 입력받거나 서버로 전송하지 않으며, 결제에는 사용할 수 없습니다.
          </div>

          {snapshot ? (
            <div className="min-w-0 rounded-[var(--radius-md)] border border-line bg-base p-[14px]">
              <div className="flex min-w-0 flex-wrap items-center gap-[12px]">
                <CardMark />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-step--1 font-semibold tabular-nums text-fg [overflow-wrap:anywhere]">{snapshot.maskedCardNumb}</p>
                  <p className="text-step--1 text-fg-subtle [overflow-wrap:anywhere]">{snapshot.dateLabel} 등록 · 화면 확인용</p>
                </div>
                <button
                  type="button"
                  onClick={deregisterPreview}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] px-[10px] text-step--1 text-fg-subtle transition-colors hover:bg-overlay hover:text-danger"
                >
                  등록 해지
                </button>
              </div>
            </div>
          ) : null}

          <Button type="button" size="lg" className="min-h-[48px] w-full sm:w-auto" onClick={() => setOpen(true)}>
            {snapshot ? "카드 등록 화면 다시 보기" : "카드 등록하기"}
          </Button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center p-[8px] sm:items-center sm:p-[16px]">
          <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" aria-hidden onMouseDown={close} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-review-dialog-title"
            aria-describedby="billing-review-dialog-description billing-review-dialog-safety"
            className="glass relative z-10 max-h-[calc(100dvh-16px)] w-full min-w-0 max-w-md overflow-y-auto rounded-t-[var(--radius-lg)] border border-line p-[16px] pb-[max(16px,env(safe-area-inset-bottom))] text-fg shadow-elev2 sm:max-h-[min(760px,calc(100dvh-32px))] sm:rounded-[var(--radius-lg)] sm:p-[24px]"
          >
            <div className="mb-[20px] flex min-w-0 items-start justify-between gap-[12px]">
              <div className="min-w-0 space-y-[5px]">
                <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-accent-cyan">Simple pay</p>
                <h2 id="billing-review-dialog-title" className="font-display text-step-1 font-semibold tracking-tight text-fg">
                  카드 등록
                </h2>
                <p id="billing-review-dialog-description" className="text-step--1 leading-relaxed text-fg-muted">
                  마스킹된 안전 시연값으로 등록 화면을 확인합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-line bg-overlay text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
                aria-label="카드 등록 창 닫기"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <form onSubmit={registerPreview} className="min-w-0 space-y-[16px]">
              <div className="space-y-[7px]">
                <label htmlFor="billing-review-card-preview" className="block text-step--1 font-medium text-fg-muted">
                  카드 번호
                </label>
                <input
                  ref={cardPreviewRef}
                  id="billing-review-card-preview"
                  value="•••• •••• •••• 1234"
                  readOnly
                  aria-readonly="true"
                  autoComplete="off"
                  className="h-[48px] w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-base px-[14px] font-mono text-step-0 tabular-nums text-fg"
                />
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-[14px] sm:grid-cols-2">
                <div className="space-y-[7px]">
                  <label htmlFor="billing-review-expiry-preview" className="block text-step--1 font-medium text-fg-muted">
                    유효 기간
                  </label>
                  <input
                    id="billing-review-expiry-preview"
                    value="MM / YY"
                    readOnly
                    aria-readonly="true"
                    autoComplete="off"
                    className="h-[48px] w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-base px-[14px] font-mono text-step-0 text-fg-muted"
                  />
                </div>
                <div className="space-y-[7px]">
                  <label htmlFor="billing-review-password-preview" className="block text-step--1 font-medium text-fg-muted">
                    카드 비밀번호
                  </label>
                  <input
                    id="billing-review-password-preview"
                    value="앞 2자리 · ••"
                    readOnly
                    aria-readonly="true"
                    autoComplete="off"
                    className="h-[48px] w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-base px-[14px] font-mono text-step-0 text-fg-muted"
                  />
                </div>
              </div>

              <div className="space-y-[7px]">
                <label htmlFor="billing-review-birth-preview" className="block text-step--1 font-medium text-fg-muted">
                  생년월일
                </label>
                <input
                  id="billing-review-birth-preview"
                  value="YYMMDD · ••••••"
                  readOnly
                  aria-readonly="true"
                  autoComplete="off"
                  className="h-[48px] w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-base px-[14px] font-mono text-step-0 text-fg-muted"
                />
              </div>

              <p
                id="billing-review-dialog-safety"
                className="rounded-[var(--radius-md)] border border-warning/25 bg-warning/5 p-[12px] text-step--1 leading-relaxed text-fg-subtle"
              >
                실제 카드번호·유효기간·비밀번호·생년월일은 입력할 수 없습니다. 등록 결과는 이 브라우저 탭에 마스킹 정보로만 표시됩니다.
              </p>

              <Button type="submit" size="xl" className="min-h-[56px] whitespace-normal text-center leading-snug">
                카드 등록하기
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
