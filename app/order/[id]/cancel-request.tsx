"use client";
// 취소·반품 신청 — 결제완료(PAID) 주문 하단의 절제된 접이식 폼.
import { Button, FieldError, Label, Textarea } from "@/lib/ui";
import { useEffect, useId, useRef, useState } from "react";
import { requestCancelAction } from "../actions";

export function CancelRequest({
  orderId,
  billing = false,
  demo = false,
}: {
  orderId: string;
  billing?: boolean;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const submittingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();
  const errorId = useId();
  const uncertainId = useId();

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => reasonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const close = () => {
    setError("");
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setPending(true);
    let keepLocked = false;
    let reloading = false;
    try {
      const res = await requestCancelAction({ orderId, reason });
      if (res.ok) {
        // 취소 접수 원장을 source of truth로 다시 읽는다. 부분 갱신만으로는
        // 간헐적으로 기존 화면이 남아 사용자가 중복 신청할 수 있다.
        reloading = true;
        window.location.reload();
        return;
      } else {
        setError(res.error);
        if (res.retryBlocked) {
          keepLocked = true;
          setUncertain(true);
        }
      }
    } catch {
      keepLocked = true;
      setUncertain(true);
      setError(
        "취소 요청 응답을 확인하지 못했습니다. 중복 요청을 막기 위해 다시 신청하지 말고 주문 상태를 조회해 주세요.",
      );
    } finally {
      if (!keepLocked && !reloading) submittingRef.current = false;
      if (!reloading) setPending(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="break-keep text-step--1 text-fg-subtle">
          {demo ? (
            "시연 주문은 실제 청구 없이 취소 접수 화면까지 확인할 수 있습니다."
          ) : (
            <>
              단순 변심은 수령 후 7일 이내 신청할 수 있습니다.{" "}
              <a href="/policy/refund" className="underline underline-offset-2 hover:text-fg-muted">
                청약철회·환불 안내
              </a>
            </>
          )}
        </p>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 shrink-0"
          onClick={() => setOpen(true)}
        >
          {billing ? "전체 주문 취소 요청" : demo ? "시연 주문 취소" : "취소·반품 신청"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-step--1 uppercase tracking-widest text-fg-subtle">
        {billing ? "전체 주문 취소 요청" : demo ? "시연 주문 취소" : "취소·반품 신청"}
      </p>
      {billing ? (
        <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-3 text-step--1 leading-relaxed text-fg-muted">
          등록카드 결제는 부분취소를 지원하지 않습니다. 이 요청은 주문의 모든
          상품과 전체 결제금액을 대상으로 하며, 실제 취소는 LAONPAY 관리자가
          확인한 뒤 처리합니다.
        </p>
      ) : null}
      {uncertain ? (
        <p
          id={uncertainId}
          role="status"
          className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 p-3 text-step--1 leading-relaxed text-fg-muted"
        >
          이전 취소 요청의 결과를 확인하고 있습니다. 중복 요청을 막기 위해
          사유와 신청 버튼을 잠갔습니다. 아래 버튼으로 주문 상태를 다시
          확인해 주세요.
        </p>
      ) : null}
      <Label htmlFor={reasonId}>
        {billing ? "전체 취소 사유 (선택)" : demo ? "시연 취소 사유 (선택)" : "취소·반품 사유 (선택)"}
      </Label>
      <Textarea
        ref={reasonRef}
        id={reasonId}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        disabled={pending || uncertain}
        placeholder="사유를 입력해 주세요 (선택)"
        aria-invalid={Boolean(error)}
        aria-describedby={
          [error ? errorId : null, uncertain ? uncertainId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      <FieldError id={errorId}>{error}</FieldError>
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          disabled={pending}
          className="min-h-11 min-w-[min(100%,6rem)] flex-1 sm:flex-none"
          onClick={close}
        >
          닫기
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          loading={pending}
          disabled={uncertain}
          className="min-h-11 min-w-[min(100%,6rem)] flex-1 sm:flex-none"
          onClick={submit}
        >
          신청하기
        </Button>
      </div>
      {uncertain ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-12 w-full !h-auto py-3 !whitespace-normal"
          onClick={() => window.location.reload()}
        >
          새로고침 후 주문 상태 조회
        </Button>
      ) : null}
      <p className="text-step--1 text-fg-subtle">
        {demo
          ? "시연 주문에는 실제 승인취소나 환불이 발생하지 않습니다."
          : "접수 후 고객센터(070-4044-7008)에서 확인 연락을 드리며, 카드 결제는 승인취소로 환불됩니다."}
      </p>
    </div>
  );
}
