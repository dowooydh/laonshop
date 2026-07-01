import * as React from "react";
import { cn } from "./cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600",
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
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-center", className)}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {description && <p className="text-xs text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** 금액 강조 표기 */
export function Amount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular-nums font-semibold", className)}>
      {value.toLocaleString("ko-KR")}
      <span className="ml-0.5 font-normal text-gray-500">원</span>
    </span>
  );
}
