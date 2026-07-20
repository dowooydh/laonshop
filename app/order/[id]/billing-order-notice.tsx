"use client";

import { useEffect, useRef } from "react";

export function BillingOrderNotice({
  message,
  alert = false,
}: {
  message: string;
  alert?: boolean;
}) {
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => noticeRef.current?.focus());
    const current = new URL(window.location.href);
    const next = current.searchParams;
    next.delete("billingRefresh");
    next.delete("billingCancelRefresh");
    const cleanedUrl = `${current.pathname}${next.size ? `?${next}` : ""}${current.hash}`;
    window.history.replaceState(window.history.state, "", cleanedUrl);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <p
      ref={noticeRef}
      tabIndex={-1}
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
      className="mt-5 rounded-[var(--radius-md)] border border-line bg-raised px-4 py-3 text-center text-step--1 leading-relaxed text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
    >
      {message}
    </p>
  );
}
