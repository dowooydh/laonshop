import * as React from "react";
import { cn } from "./cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent-cyan",
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-16 text-center", className)}>
      <p className="text-step-0 font-medium text-fg-muted">{title}</p>
      {description && <p className="text-step--1 text-fg-subtle">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** 금액 강조 표기 — 가격은 모노로 (§4.2) */
export function Amount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-mono font-semibold tabular-nums", className)}>
      {value.toLocaleString("ko-KR")}
      <span className="ml-0.5 font-sans font-normal text-fg-muted">원</span>
    </span>
  );
}
