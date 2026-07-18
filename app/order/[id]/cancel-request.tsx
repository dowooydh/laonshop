"use client";
// 취소·반품 신청 — 결제완료(PAID) 주문 하단의 절제된 접이식 폼.
import { Button, FieldError, Label, Textarea } from "@/lib/ui";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { requestCancelAction } from "../actions";

export function CancelRequest({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);
  const reasonId = useId();
  const errorId = useId();

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setPending(true);
    try {
      const res = await requestCancelAction({ orderId, reason });
      if (res.ok) router.refresh();
      else setError(res.error);
    } catch {
      setError("신청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="break-keep text-step--1 text-fg-subtle">
          단순 변심은 수령 후 7일 이내 신청할 수 있습니다.{" "}
          <a href="/policy/refund" className="underline underline-offset-2 hover:text-fg-muted">
            청약철회·환불 안내
          </a>
        </p>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={() => setOpen(true)}>
          취소·반품 신청
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-step--1 uppercase tracking-widest text-fg-subtle">취소·반품 신청</p>
      <Label htmlFor={reasonId}>취소·반품 사유 (선택)</Label>
      <Textarea
        id={reasonId}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        placeholder="사유를 입력해 주세요 (선택)"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId}>{error}</FieldError>
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          disabled={pending}
          className="min-h-11 min-w-[min(100%,6rem)] flex-1 sm:flex-none"
          onClick={() => {
            setError("");
            setOpen(false);
          }}
        >
          닫기
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          loading={pending}
          className="min-h-11 min-w-[min(100%,6rem)] flex-1 sm:flex-none"
          onClick={submit}
        >
          신청하기
        </Button>
      </div>
      <p className="text-step--1 text-fg-subtle">
        접수 후 고객센터(070-4044-7008)에서 확인 연락을 드리며, 카드 결제는 승인취소로 환불됩니다.
      </p>
    </div>
  );
}
