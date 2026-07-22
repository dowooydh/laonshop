"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  MANUAL_PAYMENT_DEMO_CARD,
  MANUAL_PAYMENT_ISSUERS,
  getManualPaymentIssuerLabel,
  isManualPaymentDemoInput,
  isManualPaymentFormComplete,
  normalizeManualCardNumber,
  type ManualPaymentCardInput,
  type ManualPaymentMode,
} from "@/lib/manual-payment-demo";
import { Button, Input, Label } from "@/lib/ui";

type ManualPaymentDialogProps = {
  open: boolean;
  mode: Exclude<ManualPaymentMode, "disabled">;
  value: ManualPaymentCardInput;
  disabled: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onChange: (value: ManualPaymentCardInput) => void;
  onClose: () => void;
  onComplete: () => void;
};

export function ManualPaymentDialog({
  open,
  mode,
  value,
  disabled,
  triggerRef,
  onChange,
  onClose,
  onComplete,
}: ManualPaymentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const issuerRef = useRef<HTMLSelectElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => issuerRef.current?.focus());
      return;
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  const close = () => {
    onClose();
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const complete = () => {
    if (!isManualPaymentFormComplete(value)) {
      setError("카드사와 카드 정보를 모두 확인해 주세요.");
      return;
    }
    if (mode === "review-demo" && !isManualPaymentDemoInput(value)) {
      setError("실제 카드정보 대신 아래 시연용 정보 자동 입력을 이용해 주세요.");
      return;
    }
    setError("");
    onComplete();
    close();
  };

  const cardDigits = normalizeManualCardNumber(value.cardNo);
  const formattedCardNumber = cardDigits.replace(/(\d{4})(?=\d)/g, "$1 ");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="manual-payment-title"
      aria-describedby="manual-payment-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-auto max-h-[min(92dvh,46rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-raised p-0 text-fg shadow-elev2 backdrop:bg-void/80 backdrop:backdrop-blur-sm"
    >
      <div className="sticky top-0 z-10 flex min-w-0 items-start justify-between gap-3 border-b border-line bg-raised/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-cyan">
            Old Authentication
          </p>
          <h2
            id="manual-payment-title"
            className="mt-1 break-keep font-display text-step-1 font-bold text-fg"
          >
            수기결제 카드정보 입력
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          disabled={disabled}
          aria-label="수기결제 창 닫기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-overlay text-step-1 text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
        >
          ×
        </button>
      </div>

      <div className="min-w-0 space-y-4 px-5 py-5">
        <p
          id="manual-payment-description"
          className="break-keep rounded-[var(--radius-md)] border border-accent-cyan/25 bg-accent-cyan/5 px-4 py-3 text-step--1 leading-relaxed text-fg-muted"
        >
          {mode === "review-demo"
            ? "심사용 시연 화면입니다. 실제 카드정보를 입력하지 마시고 고정 시연값만 사용해 주세요. 실제 승인·청구는 발생하지 않습니다."
            : "카드정보는 이번 승인 요청에만 사용되며 라온샵 데이터베이스에 저장되지 않습니다."}
        </p>

        {mode === "review-demo" ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 w-full !h-auto !whitespace-normal py-2.5"
            disabled={disabled}
            onClick={() => {
              onChange({ ...MANUAL_PAYMENT_DEMO_CARD });
              setError("");
            }}
          >
            시연용 카드정보 자동 입력
          </Button>
        ) : null}

        <div>
          <Label htmlFor="manual-issuer">카드사</Label>
          <select
            ref={issuerRef}
            id="manual-issuer"
            value={value.issuerCode}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...value, issuerCode: event.target.value });
              setError("");
            }}
            className="h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-line bg-overlay px-3 text-step-0 text-fg outline-none transition-colors focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">카드사를 선택해 주세요</option>
            {MANUAL_PAYMENT_ISSUERS.map((issuer) => (
              <option key={issuer.code} value={issuer.code}>
                {issuer.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="manual-card-no">카드번호</Label>
          <Input
            id="manual-card-no"
            inputMode="numeric"
            autoComplete={mode === "review-demo" ? "off" : "cc-number"}
            placeholder="0000 0000 0000 0000"
            value={formattedCardNumber}
            disabled={disabled}
            onChange={(event) => {
              onChange({
                ...value,
                cardNo: normalizeManualCardNumber(event.target.value),
              });
              setError("");
            }}
          />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor="manual-exp-mm">유효기간 월</Label>
            <Input
              id="manual-exp-mm"
              inputMode="numeric"
              maxLength={2}
              placeholder="MM"
              value={value.expMm}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, expMm: event.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="manual-exp-yy">유효기간 연도</Label>
            <Input
              id="manual-exp-yy"
              inputMode="numeric"
              maxLength={2}
              placeholder="YY"
              value={value.expYy}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, expYy: event.target.value.replace(/\D/g, "") })}
            />
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor="manual-pw2">비밀번호 앞 2자리</Label>
            <Input
              id="manual-pw2"
              type="password"
              inputMode="numeric"
              maxLength={2}
              autoComplete="off"
              value={value.pw2}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, pw2: event.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="manual-birth6">생년월일 6자리</Label>
            <Input
              id="manual-birth6"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              placeholder="YYMMDD"
              value={value.birth6}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, birth6: event.target.value.replace(/\D/g, "") })}
            />
          </div>
        </div>

        {value.issuerCode && cardDigits.length >= 4 ? (
          <p className="text-step--1 text-fg-subtle">
            선택 정보: {getManualPaymentIssuerLabel(value.issuerCode)} · •••• {cardDigits.slice(-4)}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="break-keep text-step--1 leading-relaxed text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex min-w-0 flex-col-reverse gap-2 border-t border-line bg-raised/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="min-h-11 !h-auto"
          disabled={disabled}
          onClick={close}
        >
          취소
        </Button>
        <Button
          type="button"
          size="lg"
          className="min-h-11 !h-auto !whitespace-normal"
          disabled={disabled}
          onClick={complete}
        >
          카드정보 입력 완료
        </Button>
      </div>
    </dialog>
  );
}
