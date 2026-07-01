import * as React from "react";
import { cn } from "./cn";

// 글래스 서피스 (§4.3) — 헤어라인 보더 + 백드롭 블러 + 낮은 엘리베이션.
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass rounded-[var(--radius-lg)] border border-line text-fg shadow-elev1", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-step-1 font-semibold tracking-tight text-fg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-step--1 text-fg-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}

/** KPI/합계 카드 */
export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "blue" | "red" | "green" | "orange";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-fg",
    blue: "text-accent-cyan",
    red: "text-danger",
    green: "text-success",
    orange: "text-warning",
  };
  return (
    <div className={cn("glass rounded-[var(--radius-lg)] border border-line p-5 shadow-elev1", className)}>
      <div className="text-step--1 font-medium text-fg-muted">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-bold tabular-nums", tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-step--1 text-fg-subtle">{sub}</div>}
    </div>
  );
}
