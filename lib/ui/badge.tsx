import * as React from "react";
import { cn } from "./cn";

// 주문 상태 배지 — 다크 토큰 틴트(color-mix). 키 유지: PAID=blue(시안), PENDING=gray, FAILED=red, CANCELED=redOutline 등.
const VARIANT_CLASS: Record<string, string> = {
  blue: "bg-[color-mix(in_oklab,var(--accent-cyan)_16%,transparent)] text-accent-cyan ring-[color-mix(in_oklab,var(--accent-cyan)_38%,transparent)]",
  gray: "bg-[color-mix(in_oklab,var(--fg-primary)_10%,transparent)] text-fg-muted ring-line",
  orange:
    "bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-warning ring-[color-mix(in_oklab,var(--warning)_38%,transparent)]",
  red: "bg-[color-mix(in_oklab,var(--danger)_16%,transparent)] text-danger ring-[color-mix(in_oklab,var(--danger)_38%,transparent)]",
  green:
    "bg-[color-mix(in_oklab,var(--success)_16%,transparent)] text-success ring-[color-mix(in_oklab,var(--success)_38%,transparent)]",
  lightgray: "bg-[color-mix(in_oklab,var(--fg-primary)_6%,transparent)] text-fg-subtle ring-line",
  redOutline: "bg-transparent text-danger ring-[color-mix(in_oklab,var(--danger)_60%,transparent)]",
};

export function Badge({
  variant = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof VARIANT_CLASS | string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-0.5 text-step--1 font-medium ring-1 ring-inset",
        VARIANT_CLASS[variant] ?? VARIANT_CLASS.gray,
        className,
      )}
      {...props}
    />
  );
}
