"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";

export function BillingReturnNotice({
  initialMessage,
}: {
  initialMessage: string | null;
}) {
  const router = useRouter();
  const noticeRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (!initialMessage) return;

    setMessage(initialMessage);
    const frame = requestAnimationFrame(() => noticeRef.current?.focus());
    router.replace("/mypage/settings#billing-card-management", { scroll: false });

    return () => cancelAnimationFrame(frame);
  }, [initialMessage, router]);

  if (!message) return null;

  return (
    <div
      ref={noticeRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex min-w-0 flex-wrap items-start gap-2 rounded-[var(--radius-md)] border border-accent-cyan/30 bg-accent-cyan/5 p-[12px] text-step--1 text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
    >
      <p className="min-w-[min(100%,12rem)] flex-1 leading-relaxed">{message}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 shrink-0"
        aria-label="카드 등록 결과 안내 닫기"
        onClick={() => setMessage(null)}
      >
        <span aria-hidden="true">×</span>
      </Button>
    </div>
  );
}
