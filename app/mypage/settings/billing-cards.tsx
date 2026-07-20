"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";
import { deleteBillingCardAction } from "../actions";
import { BillingReturnNotice } from "./billing-return-notice";
import {
  deregisterBillingPaymentMethodAction,
  refreshBillingPaymentMethodsAction,
  startBillingRegistrationAction,
  type BillingSettingsActionState,
} from "./billing/actions";

export type BillingCardRow = { id: string; maskedCardNumb: string; dateLabel: string };
export type BillingPaymentMethodRow = {
  id: string;
  cardName: string;
  cardLast4: string;
  cardType: string;
  status: "ACTIVE" | "DEREGISTERING" | "DEREGISTERED" | "UNKNOWN";
  dateLabel: string;
};

type BillingCardsProps = {
  legacyCards: BillingCardRow[];
  paymentMethods: BillingPaymentMethodRow[];
  integrationEligible: boolean;
  integrationConfigured: boolean;
  integrationFeatureEnabled: boolean;
  integrationStorageReady: boolean;
  hasOpenRegistration: boolean;
  registrationMessage: string | null;
};

const DELETE_ERROR_MESSAGE = "카드 삭제 상태를 확인하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
const INITIAL_ACTION_STATE: BillingSettingsActionState = {};
type BillingActionSource = "registration" | "refresh" | "deregister" | null;

function CardMark({ active = false }: { active?: boolean }) {
  return (
    <span
      className={`flex h-[40px] w-[52px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border ${
        active ? "border-accent-cyan/30 bg-accent-cyan/10" : "border-line bg-overlay"
      }`}
    >
      <svg
        width="20"
        height="16"
        viewBox="0 0 24 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className={active ? "text-accent-cyan" : "text-fg-subtle"}
        aria-hidden
      >
        <rect x="1" y="1" width="22" height="16" rx="2.5" />
        <path d="M1 6.2h22" />
      </svg>
    </span>
  );
}
function methodStatusLabel(status: BillingPaymentMethodRow["status"]): string {
  if (status === "ACTIVE") return "사용 가능";
  if (status === "DEREGISTERING") return "해지 확인 중";
  if (status === "DEREGISTERED") return "해지됨";
  return "상태 확인 필요";
}

export function BillingCards({
  legacyCards,
  paymentMethods,
  integrationEligible,
  integrationConfigured,
  integrationFeatureEnabled,
  integrationStorageReady,
  hasOpenRegistration,
  registrationMessage,
}: BillingCardsProps) {
  const router = useRouter();
  const [deletingLegacy, startLegacyDelete] = useTransition();
  const [deregistering, startDeregister] = useTransition();
  const billingUiLockedRef = useRef(false);
  const deregisteringIds = useRef(new Set<string>());
  const deregisterTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const deregisterConfirmRef = useRef<HTMLButtonElement>(null);
  const actionStatusRef = useRef<HTMLParagraphElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<BillingActionSource>(null);
  const [confirmingDeregisterId, setConfirmingDeregisterId] = useState<string | null>(null);
  const [deregisteringId, setDeregisteringId] = useState<string | null>(null);
  const [methodActionError, setMethodActionError] = useState<string | null>(null);
  const [methodActionMessage, setMethodActionMessage] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [registrationState, registrationAction, registrationPending] = useActionState(
    startBillingRegistrationAction,
    INITIAL_ACTION_STATE,
  );
  const [refreshState, refreshAction, refreshPending] = useActionState(
    refreshBillingPaymentMethodsAction,
    INITIAL_ACTION_STATE,
  );
  const billingActionPending =
    registrationPending || refreshPending || deregistering;

  useEffect(() => {
    if (!billingActionPending) billingUiLockedRef.current = false;
  }, [billingActionPending]);

  useEffect(() => {
    const restoreAfterHostedHistory = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // 외부 hosted 등록 화면에서 뒤로 돌아오면 BFCache가 action pending/ref
      // 스냅샷을 그대로 복원할 수 있다. 전체 재로드로 HttpOnly cookie·DB 상태를
      // 다시 읽고, 보이지 않는 영구 잠금 상태를 남기지 않는다.
      billingUiLockedRef.current = false;
      deregisteringIds.current.clear();
      window.location.reload();
    };
    window.addEventListener("pageshow", restoreAfterHostedHistory);
    return () =>
      window.removeEventListener("pageshow", restoreAfterHostedHistory);
  }, []);

  useEffect(() => {
    if (confirmingDeregisterId) deregisterConfirmRef.current?.focus();
  }, [confirmingDeregisterId]);

  const actionMessage =
    activeAction === "refresh"
      ? refreshPending
        ? null
        : refreshState.message
      : activeAction === "deregister"
        ? methodActionMessage
        : null;

  useEffect(() => {
    if (!actionMessage) return;
    const frame = requestAnimationFrame(() => actionStatusRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [actionMessage]);

  const removeLegacy = (id: string) => {
    setDeleteError(null);
    setDeletingId(id);
    startLegacyDelete(async () => {
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

  const deregister = (id: string) => {
    if (
      billingUiLockedRef.current ||
      billingActionPending ||
      deregisteringIds.current.has(id)
    ) {
      return;
    }
    billingUiLockedRef.current = true;
    deregisteringIds.current.add(id);
    setActiveAction("deregister");
    setDeregisteringId(id);
    setMethodActionError(null);
    setMethodActionMessage(null);
    startDeregister(async () => {
      try {
        const result = await deregisterBillingPaymentMethodAction(id);
        if (!result.ok) {
          setMethodActionError(result.error ?? "카드 해지 상태를 확인하지 못했습니다.");
          router.refresh();
          return;
        }
        setMethodActionMessage(result.message ?? "카드 상태를 확인했습니다.");
        setConfirmingDeregisterId(null);
        router.refresh();
      } catch {
        setMethodActionError("카드 해지 상태를 확인하지 못했습니다. 상태 조회 후 다시 확인해 주세요.");
        router.refresh();
      } finally {
        billingUiLockedRef.current = false;
        deregisteringIds.current.delete(id);
        setDeregisteringId(null);
      }
    });
  };

  const ready =
    integrationEligible && integrationConfigured && integrationStorageReady;
  const actionError =
    activeAction === "registration"
      ? registrationPending
        ? null
        : registrationState.error
      : activeAction === "refresh"
        ? refreshPending
          ? null
          : refreshState.error
        : activeAction === "deregister"
          ? methodActionError
          : null;

  return (
    <div className="min-w-0 space-y-4">
      <BillingReturnNotice initialMessage={registrationMessage} />

      {!integrationEligible ? (
        <div className="rounded-[var(--radius-md)] border border-line bg-overlay p-[16px] text-step--1 leading-relaxed text-fg-subtle">
          카드 등록과 원클릭 결제는 현재 이용할 수 없습니다. 결제 시 일반 카드결제의 KSPAY 인증결제창을 이용해 주세요.
        </div>
      ) : !integrationConfigured ? (
        <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-[16px] text-step--1 leading-relaxed text-fg-muted">
          간편결제 연동을 준비하고 있습니다. 연결이 확인되기 전에는 카드정보를 입력받지 않으며 일반 카드결제를 이용할 수 있습니다.
        </div>
      ) : !integrationStorageReady ? (
        <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-[16px] text-step--1 leading-relaxed text-danger">
          간편결제 원장을 사용할 수 없어 카드 등록을 안전하게 차단했습니다. 설정 확인 전에는 일반 카드결제를 이용해 주세요.
        </div>
      ) : (
        <div className="min-w-0 space-y-4 rounded-[var(--radius-lg)] border border-accent-cyan/25 bg-raised p-[16px] sm:p-[20px]">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="font-display text-step-1 font-semibold text-fg">LAONPAY 간편결제</h3>
              <p className="max-w-[54ch] text-step--1 leading-relaxed text-fg-muted">
                카드 등록은 LAONPAY의 보안 등록 화면에서 진행됩니다. 라온샵에는 카드사·끝 4자리와 불투명 결제수단 ID만 저장됩니다.
              </p>
            </div>
            <CardMark active />
          </div>

          {!integrationFeatureEnabled ? (
            <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-[12px] text-step--1 leading-relaxed text-fg-muted">
              현재 신규 카드 등록·결제·해지는 점검 중입니다. 기존 등록 상태 조회는
              가능하며, 진행 중인 등록이 있으면 같은 요청만 이어서 확인할 수 있습니다.
              확인이 끝날 때까지 일반 카드결제를 이용해 주세요.
            </p>
          ) : null}

          {hasOpenRegistration ? (
            <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-[12px] text-step--1 text-warning">
              확인 중인 카드 등록 요청이 있습니다. 새 요청을 만들지 않고 같은 요청 상태를 이어서 확인합니다.
            </p>
          ) : null}

          {actionError ? (
            <p
              id="billing-method-action-error"
              role="alert"
              aria-live="assertive"
              className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-[12px] text-step--1 text-danger"
            >
              {actionError}
            </p>
          ) : null}

          {actionMessage ? (
            <p
              ref={actionStatusRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="rounded-[var(--radius-md)] border border-success/30 bg-success/5 p-[12px] text-step--1 text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
            >
              {actionMessage}
            </p>
          ) : null}

          <div className="flex min-w-0 flex-wrap gap-2">
            {integrationFeatureEnabled || hasOpenRegistration ? (
              <form
                action={registrationAction}
                onSubmit={(event) => {
                  if (billingUiLockedRef.current || billingActionPending) {
                    event.preventDefault();
                    return;
                  }
                  billingUiLockedRef.current = true;
                  setActiveAction("registration");
                  setMethodActionError(null);
                  setMethodActionMessage(null);
                }}
                className="min-w-[min(100%,12rem)] flex-1"
              >
                <Button
                  type="submit"
                  size="lg"
                  loading={registrationPending}
                  disabled={billingActionPending}
                  className="h-auto min-h-[48px] w-full min-w-0 whitespace-normal py-3 text-center leading-snug"
                >
                  {hasOpenRegistration
                    ? "등록 절차 이어서 확인"
                    : "LAONPAY에서 카드 등록"}
                </Button>
              </form>
            ) : null}
            <form
              action={refreshAction}
              onSubmit={(event) => {
                if (billingUiLockedRef.current || billingActionPending) {
                  event.preventDefault();
                  return;
                }
                billingUiLockedRef.current = true;
                setActiveAction("refresh");
                setMethodActionError(null);
                setMethodActionMessage(null);
              }}
              className="min-w-[min(100%,10rem)] flex-1"
            >
              <Button
                type="submit"
                variant="outline"
                size="lg"
                loading={refreshPending}
                disabled={billingActionPending}
                className="h-auto min-h-[48px] w-full min-w-0 whitespace-normal py-3 text-center leading-snug"
              >
                등록 카드 상태 조회
              </Button>
            </form>
          </div>
        </div>
      )}

      {ready && paymentMethods.length > 0 ? (
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-raised">
          {paymentMethods.map((method) => {
            const canDeregister =
              integrationFeatureEnabled && method.status === "ACTIVE";
            const confirming = confirmingDeregisterId === method.id;
            const targetDeregistering = deregisteringId === method.id;
            const visibleStatusLabel =
              !integrationFeatureEnabled && method.status === "ACTIVE"
                ? "결제 일시 중지"
                : methodStatusLabel(method.status);
            const confirmationId = `billing-deregister-confirm-${method.id}`;
            return (
              <li key={method.id} className="flex min-w-0 flex-wrap items-center gap-3 p-[16px]">
                <CardMark active={method.status === "ACTIVE"} />
                <div className="min-w-[min(100%,10rem)] flex-1">
                  <p className="text-step--1 font-semibold text-fg [overflow-wrap:anywhere]">
                    {method.cardName} · •••• {method.cardLast4}
                  </p>
                  <p className="text-[0.72rem] text-fg-subtle [overflow-wrap:anywhere]">
                    {method.cardType === "UNKNOWN"
                      ? "카드 유형 미확인"
                      : method.cardType}{" "}
                    · {method.dateLabel} 등록 ·{" "}
                    {visibleStatusLabel}
                  </p>
                </div>
                {canDeregister ? (
                  <Button
                    ref={(node) => {
                      if (node) deregisterTriggerRefs.current.set(method.id, node);
                      else deregisterTriggerRefs.current.delete(method.id);
                    }}
                    type="button"
                    variant="ghost"
                    size="md"
                    disabled={billingActionPending}
                    aria-expanded={confirming}
                    aria-controls={confirmationId}
                    onClick={() => {
                      setActiveAction(null);
                      setMethodActionError(null);
                      setConfirmingDeregisterId(method.id);
                    }}
                    className="min-h-[44px] min-w-[72px]"
                  >
                    해지
                  </Button>
                ) : (
                  <span className="rounded-full bg-overlay px-3 py-2 font-mono text-[0.7rem] text-fg-subtle">
                    {visibleStatusLabel}
                  </span>
                )}
                {canDeregister && confirming ? (
                  <div
                    id={confirmationId}
                    role="group"
                    aria-label={`${method.cardName} 끝 ${method.cardLast4} 카드 해지 확인`}
                    className="w-full min-w-0 space-y-3 rounded-[var(--radius-md)] border border-warning/35 bg-warning/5 p-3"
                  >
                    <p className="break-keep text-step--1 leading-relaxed text-fg-muted">
                      {method.cardName} 끝 {method.cardLast4} 카드를 해지하면 등록카드 결제에 더 이상
                      사용할 수 없습니다. 해지를 진행할까요?
                    </p>
                    <div className="flex min-w-0 flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        disabled={billingActionPending}
                        className="min-h-11 min-w-[min(100%,6rem)] flex-1 sm:flex-none"
                        onClick={() => {
                          setConfirmingDeregisterId(null);
                          deregisterTriggerRefs.current.get(method.id)?.focus();
                        }}
                      >
                        계속 사용
                      </Button>
                      <Button
                        ref={deregisterConfirmRef}
                        type="button"
                        variant="danger"
                        size="md"
                        loading={targetDeregistering}
                        disabled={billingActionPending}
                        aria-describedby={methodActionError ? "billing-method-action-error" : undefined}
                        className="min-h-11 min-w-[min(100%,6rem)] flex-1 sm:flex-none"
                        onClick={() => deregister(method.id)}
                      >
                        해지 확인
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : ready ? (
        <p className="text-step--1 text-fg-subtle">등록된 간편결제 카드가 없습니다.</p>
      ) : null}

      {deleteError ? (
        <p
          id="billing-card-delete-error"
          role="alert"
          className="rounded-[var(--radius-md)] border border-danger bg-[color-mix(in_oklab,var(--danger)_6%,transparent)] p-[12px] text-step--1 text-danger"
        >
          {deleteError}
        </p>
      ) : null}

      {legacyCards.length > 0 ? (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-step--1 text-fg-subtle">이전에 저장된 사용 중지 카드 정보</p>
          <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-raised">
            {legacyCards.map((card) => (
              <li key={card.id} className="flex min-w-0 items-center gap-[12px] p-[16px]">
                <CardMark />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-step--1 font-semibold tabular-nums text-fg [overflow-wrap:anywhere]">
                    {card.maskedCardNumb}
                  </div>
                  <div className="text-step--1 text-fg-subtle [overflow-wrap:anywhere]">
                    {card.dateLabel} 등록 · 결제 사용 중지
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deletingLegacy}
                  onClick={() => removeLegacy(card.id)}
                  aria-busy={deletingId === card.id}
                  aria-describedby={deleteError ? "billing-card-delete-error" : undefined}
                  className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center whitespace-nowrap px-[8px] text-step--1 text-fg-subtle transition-colors duration-fast hover:text-danger"
                >
                  {deletingId === card.id ? "삭제 중" : "삭제"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
