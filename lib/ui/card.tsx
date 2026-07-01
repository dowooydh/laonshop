import * as React from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 sm:p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-gray-900", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-gray-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

/** KPI 카드 (매출 카드/합계 카드 줄 공용) */
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
    default: "text-gray-900",
    blue: "text-brand-600",
    red: "text-red-600",
    green: "text-emerald-600",
    orange: "text-orange-600",
  };
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4 shadow-sm", className)}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
