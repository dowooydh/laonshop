"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createCheckoutNonce } from "@/lib/checkout-idempotency";
import { formatKrw } from "@/lib/format";
import { Button } from "@/lib/ui/button";
import {
  BILLING_REVIEW_LEGACY_STORAGE_KEY,
  BILLING_REVIEW_STORAGE_KEY,
  chargeBillingReviewCard,
  createBillingReviewPaymentMethodId,
  createBillingReviewRequestId,
  createBillingReviewSnapshot,
  deregisterBillingReviewCard,
  parseBillingReviewSnapshot,
  queryBillingReviewCard,
  serializeBillingReviewSnapshot,
  type BillingReviewChargeOutcome,
  type BillingReviewSnapshot,
} from "@/lib/billing-review-mock";

type BillingCardReviewMockProps = {
  reviewChargeAmount: number;
};

const OUTCOME_OPTIONS: Array<{ value: BillingReviewChargeOutcome; label: string; description: string }> = [
  { value: "success", label: "승인", description: "정상 승인 응답" },
  { value: "declined", label: "거절", description: "명시적 승인 거절" },
  { value: "indeterminate", label: "결과 미상", description: "timeout·5xx" },
];

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

function LifecycleStep({ index, label, state }: { index: string; label: string; state: string }) {
  return (
    <li className="flex min-w-0 items-center gap-[10px] rounded-[var(--radius-md)] border border-line bg-base px-[12px] py-[10px]">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-accent-cyan/30 font-mono text-[0.7rem] text-accent-cyan">
        {index}
      </span>
      <span className="min-w-0 flex-1 text-step--1 font-medium text-fg">{label}</span>
      <span className="shrink-0 text-right font-mono text-[0.7rem] text-fg-subtle">{state}</span>
    </li>
  );
}

function chargeStateLabel(snapshot: BillingReviewSnapshot): string {
  if (snapshot.chargeStatus === "SUCCEEDED") return "승인 완료";
  if (snapshot.chargeStatus === "DECLINED") return "승인 거절";
  if (snapshot.chargeStatus === "PENDING_REVIEW") return "확인 대기";
  return "대기";
}

export function BillingCardReviewMock({ reviewChargeAmount }: BillingCardReviewMockProps) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<BillingReviewSnapshot | null>(null);
  const [chargeOutcome, setChargeOutcome] = useState<BillingReviewChargeOutcome>("success");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardPreviewRef = useRef<HTMLInputElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const registrationTriggerRef = useRef<HTMLButtonElement>(null);
  const registrationLockedRef = useRef(false);
  const chargeLockedRef = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(BILLING_REVIEW_STORAGE_KEY);
      const parsed = parseBillingReviewSnapshot(stored);
      setSnapshot(parsed);
      if (stored && !parsed) window.sessionStorage.removeItem(BILLING_REVIEW_STORAGE_KEY);
      window.sessionStorage.removeItem(BILLING_REVIEW_LEGACY_STORAGE_KEY);
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

  const persist = (nextSnapshot: BillingReviewSnapshot, message: string) => {
    try {
      window.sessionStorage.setItem(BILLING_REVIEW_STORAGE_KEY, serializeBillingReviewSnapshot(nextSnapshot));
    } catch {
      // 저장소가 차단돼도 현재 탭의 시연 상태만 유지하며 외부 전송은 하지 않는다.
    }
    setSnapshot(nextSnapshot);
    setActionError(null);
    setAnnouncement(message);
    window.requestAnimationFrame(() => flowRef.current?.focus());
  };

  const registerPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (snapshot) {
      close();
      return;
    }
    if (registrationLockedRef.current) return;
    registrationLockedRef.current = true;

    try {
      const paymentMethodId = createBillingReviewPaymentMethodId(() => createCheckoutNonce());
      persist(
        createBillingReviewSnapshot(paymentMethodId),
        "카드 등록 시연을 완료했습니다. 불투명 결제수단 식별자와 카드사·끝 4자리만 유지합니다.",
      );
      close();
    } catch (error) {
      registrationLockedRef.current = false;
      setActionError(error instanceof Error ? error.message : "카드 등록 시연을 완료하지 못했습니다.");
    }
  };

  const queryPreview = () => {
    if (!snapshot) return;
    persist(queryBillingReviewCard(snapshot), "등록 조회를 완료했습니다. 브라우저 Mock의 등록 상태를 확인했습니다.");
  };

  const chargePreview = () => {
    if (!snapshot || chargeLockedRef.current) return;
    chargeLockedRef.current = true;
    try {
      const requestId = createBillingReviewRequestId(() => createCheckoutNonce());
      const nextSnapshot = chargeBillingReviewCard(snapshot, chargeOutcome, requestId);
      const message =
        nextSnapshot.chargeStatus === "SUCCEEDED"
          ? "빌링 결제 Mock 승인을 완료했습니다."
          : nextSnapshot.chargeStatus === "DECLINED"
            ? "빌링 결제 Mock이 명시적으로 거절되었습니다."
            : "결제 결과가 불명확하여 확인 대기로 전환했습니다. 자동 재시도하지 않습니다.";
      persist(nextSnapshot, message);
    } catch (error) {
      chargeLockedRef.current = false;
      setActionError(error instanceof Error ? error.message : "빌링 결제 시연을 완료하지 못했습니다.");
    }
  };

  const deregisterPreview = () => {
    if (!snapshot) return;
    try {
      persist(deregisterBillingReviewCard(snapshot), "카드 등록 해지를 완료했습니다. 이후 등록 조회는 미등록 상태입니다.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "카드 등록 해지를 완료하지 못했습니다.");
    }
  };

  const resetPreview = () => {
    try {
      window.sessionStorage.removeItem(BILLING_REVIEW_STORAGE_KEY);
      window.sessionStorage.removeItem(BILLING_REVIEW_LEGACY_STORAGE_KEY);
    } catch {
      // 브라우저 저장소가 차단된 경우에도 현재 탭의 시연 상태는 초기화한다.
    }
    setSnapshot(null);
    setChargeOutcome("success");
    setActionError(null);
    setAnnouncement("브라우저 Mock 시연 상태를 초기화했습니다.");
    registrationLockedRef.current = false;
    chargeLockedRef.current = false;
    window.requestAnimationFrame(() => registrationTriggerRef.current?.focus());
  };

  const openRegistration = () => {
    if (snapshot?.cardStatus === "DEREGISTERED") resetPreview();
    setActionError(null);
    setOpen(true);
  };

  return (
    <div className="min-w-0 space-y-[12px]">
      <div className="relative min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-accent-cyan/25 bg-raised p-[16px] sm:p-[20px]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-accent-cyan/10 blur-3xl" aria-hidden />
        <div className="relative min-w-0 space-y-[16px]">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-[12px]">
            <div className="min-w-0 space-y-[6px]">
              <span className="inline-flex min-h-[28px] items-center rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-[10px] font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-accent-cyan">
                Billing lifecycle preview
              </span>
              <h3 className="font-display text-step-1 font-semibold tracking-tight text-fg">간편결제 카드 등록</h3>
              <p className="max-w-[48ch] text-step--1 leading-relaxed text-fg-muted">
                카드 등록부터 조회·빌링 결제·등록 해지까지 개발계 계약 흐름을 확인할 수 있습니다.
              </p>
            </div>
            <CardMark />
          </div>

          <div className="rounded-[var(--radius-md)] border border-warning/25 bg-warning/5 px-[12px] py-[10px] text-step--1 leading-relaxed text-fg-subtle">
            시연 전용 Mock입니다. 실제 카드정보·KSNET 빌링키·PG 인증정보를 입력받거나 전송하지 않으며 주문 결제에도 연결되지 않습니다.
          </div>

          {actionError && !open ? (
            <p role="alert" className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-[12px] text-step--1 text-danger">
              {actionError}
            </p>
          ) : null}

          {snapshot ? (
            <div ref={flowRef} tabIndex={-1} className="min-w-0 space-y-[14px] rounded-[var(--radius-sm)]">
              <div className="min-w-0 rounded-[var(--radius-md)] border border-line bg-base p-[14px]">
                <div className="flex min-w-0 flex-wrap items-center gap-[12px]">
                  <CardMark />
                  <div className="min-w-0 flex-1">
                    <p className="text-step--1 font-semibold text-fg [overflow-wrap:anywhere]">
                      {snapshot.cardIssuer} · 끝 {snapshot.cardLast4}
                    </p>
                    <p className="font-mono text-[0.72rem] text-fg-subtle [overflow-wrap:anywhere]">
                      결제수단 ID ····{snapshot.paymentMethodId.slice(-8)}
                    </p>
                  </div>
                  <span className={`rounded-full px-[10px] py-[6px] font-mono text-[0.7rem] ${snapshot.cardStatus === "ACTIVE" ? "bg-success/10 text-success" : "bg-overlay text-fg-subtle"}`}>
                    {snapshot.cardStatus === "ACTIVE" ? "등록됨" : "해지됨"}
                  </span>
                </div>
              </div>

              <ol className="grid min-w-0 grid-cols-1 gap-[8px] sm:grid-cols-2">
                <LifecycleStep index="01" label="카드 등록" state="완료" />
                <LifecycleStep
                  index="02"
                  label="등록 조회"
                  state={snapshot.queryStatus === "FOUND" ? "확인됨" : snapshot.queryStatus === "NOT_FOUND" ? "미등록" : "대기"}
                />
                <LifecycleStep index="03" label="billing/pay" state={chargeStateLabel(snapshot)} />
                <LifecycleStep index="04" label="등록 해지" state={snapshot.cardStatus === "DEREGISTERED" ? "완료" : "대기"} />
              </ol>

              {snapshot.cardStatus === "ACTIVE" && snapshot.queryStatus === "NOT_REQUESTED" ? (
                <Button type="button" variant="secondary" size="lg" className="h-auto min-h-[48px] min-w-0 w-full whitespace-normal py-[12px] text-center leading-snug" onClick={queryPreview}>
                  등록 정보 조회
                </Button>
              ) : null}

              {snapshot.cardStatus === "ACTIVE" && snapshot.queryStatus === "FOUND" && snapshot.chargeStatus === "NOT_REQUESTED" ? (
                <div className="space-y-[12px] rounded-[var(--radius-md)] border border-line bg-base p-[14px]">
                  <div className="min-w-0">
                    <p className="text-step--1 font-semibold text-fg">빌링 결제 결과 선택</p>
                    <p className="text-step--1 leading-relaxed text-fg-subtle">
                      검증 금액 {formatKrw(reviewChargeAmount)} · 사용자 입력 불가 · 실제 거래 생성 없음
                    </p>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-[8px] sm:grid-cols-3" role="group" aria-label="빌링 결제 Mock 결과">
                    {OUTCOME_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={chargeOutcome === option.value}
                        onClick={() => setChargeOutcome(option.value)}
                      className={`min-h-[48px] min-w-0 rounded-[var(--radius-md)] border px-[10px] py-[8px] text-left transition-colors ${chargeOutcome === option.value ? "border-accent-cyan bg-accent-cyan/10 text-fg" : "border-fg-subtle bg-raised text-fg-muted hover:border-fg-muted"}`}
                      >
                        <span className="block text-step--1 font-semibold">{option.label}</span>
                        <span className="block text-[0.72rem] leading-snug text-fg-subtle">{option.description}</span>
                      </button>
                    ))}
                  </div>
                  <Button type="button" size="lg" className="h-auto min-h-[48px] min-w-0 w-full whitespace-normal py-[12px] text-center leading-snug" onClick={chargePreview}>
                    billing/pay 시연
                  </Button>
                </div>
              ) : null}

              {snapshot.chargeStatus !== "NOT_REQUESTED" ? (
                <div
                  role="status"
                  className={`rounded-[var(--radius-md)] border p-[12px] text-step--1 leading-relaxed ${snapshot.chargeStatus === "SUCCEEDED" ? "border-success/30 bg-success/5 text-success" : snapshot.chargeStatus === "DECLINED" ? "border-danger/30 bg-danger/5 text-danger" : "border-warning/30 bg-warning/5 text-warning"}`}
                >
                  {snapshot.chargeStatus === "SUCCEEDED"
                    ? `${formatKrw(snapshot.chargeAmount ?? reviewChargeAmount)} Mock 승인을 완료했습니다. PG TID는 생성하지 않았습니다.`
                    : snapshot.chargeStatus === "DECLINED"
                      ? "명시적 승인 거절로 종료했습니다. 자동 재시도하지 않습니다."
                      : "timeout·5xx 결과를 확인 대기로 보존했습니다. 운영 확인 전 자동 재시도·해지를 차단합니다."}
                </div>
              ) : null}

              {snapshot.chargeStatus === "SUCCEEDED" ? (
                <p className="rounded-[var(--radius-md)] border border-line bg-overlay p-[12px] text-step--1 leading-relaxed text-fg-subtle">
                  취소 기능은 라온샵에 제공하지 않습니다. 실제 연동에서는 LAONPAY 관리자 전체취소 요청만 사용하며 부분취소는 금지합니다.
                </p>
              ) : null}

              {snapshot.chargeStatus === "PENDING_REVIEW" ? (
                <p className="rounded-[var(--radius-md)] border border-line bg-overlay p-[12px] text-step--1 leading-relaxed text-fg-subtle">
                  아래 초기화는 이 브라우저 탭의 Mock 표시만 지웁니다. 실제 결제 결과를 확정하거나 재시도하는 동작이 아닙니다.
                </p>
              ) : null}

              <div className="flex min-w-0 flex-wrap gap-[8px]">
                {snapshot.cardStatus === "ACTIVE" && snapshot.chargeStatus !== "PENDING_REVIEW" ? (
                  <Button type="button" variant="outline" size="lg" className="h-auto min-h-[48px] min-w-0 flex-1 whitespace-normal py-[12px] text-center leading-snug" onClick={deregisterPreview}>
                    등록 해지
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="lg" className="h-auto min-h-[48px] min-w-0 flex-1 whitespace-normal py-[12px] text-center leading-snug" onClick={resetPreview}>
                  브라우저 Mock 초기화
                </Button>
              </div>
            </div>
          ) : null}

          <Button ref={registrationTriggerRef} type="button" size="lg" className="h-auto min-h-[48px] min-w-0 w-full whitespace-normal py-[12px] text-center leading-snug sm:w-auto" onClick={openRegistration}>
            {snapshot?.cardStatus === "ACTIVE" ? "카드 등록 화면 다시 보기" : snapshot ? "새 카드 등록 시연" : "카드 등록하기"}
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
                  <input id="billing-review-expiry-preview" value="MM / YY" readOnly aria-readonly="true" autoComplete="off" className="h-[48px] w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-base px-[14px] font-mono text-step-0 text-fg-muted" />
                </div>
                <div className="space-y-[7px]">
                  <label htmlFor="billing-review-password-preview" className="block text-step--1 font-medium text-fg-muted">
                    카드 비밀번호
                  </label>
                  <input id="billing-review-password-preview" value="앞 2자리 · ••" readOnly aria-readonly="true" autoComplete="off" className="h-[48px] w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-base px-[14px] font-mono text-step-0 text-fg-muted" />
                </div>
              </div>

              <div className="space-y-[7px]">
                <label htmlFor="billing-review-birth-preview" className="block text-step--1 font-medium text-fg-muted">
                  생년월일
                </label>
                <input id="billing-review-birth-preview" value="YYMMDD · ••••••" readOnly aria-readonly="true" autoComplete="off" className="h-[48px] w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-base px-[14px] font-mono text-step-0 text-fg-muted" />
              </div>

              <p id="billing-review-dialog-safety" className="rounded-[var(--radius-md)] border border-warning/25 bg-warning/5 p-[12px] text-step--1 leading-relaxed text-fg-subtle">
                실제 카드정보는 입력할 수 없습니다. 등록 결과는 불투명 결제수단 ID와 카드사·끝 4자리로만 이 브라우저 탭에 표시됩니다.
              </p>

              {actionError ? (
                <p role="alert" className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-[12px] text-step--1 text-danger">
                  {actionError}
                </p>
              ) : null}

              <Button type="submit" size="xl" className="h-auto min-h-[56px] min-w-0 whitespace-normal py-[14px] text-center leading-snug">
                {snapshot ? "등록 화면 닫기" : "카드 등록하기"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
