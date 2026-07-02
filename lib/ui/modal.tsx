"use client";

import * as React from "react";
import { cn } from "./cn";

/** 의존성 없는 단순 모달 — 다크 글래스 패널. 확인/폼 모달 공용. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-void/70 animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "glass animate-slide-down relative z-10 w-full max-w-md rounded-t-[var(--radius-lg)] border border-line p-6 text-fg shadow-elev2 sm:rounded-[var(--radius-lg)]",
          className,
        )}
      >
        {title && <h2 className="mb-3 text-step-1 font-semibold tracking-tight text-fg">{title}</h2>}
        <div className="text-step-0 text-fg-muted">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
