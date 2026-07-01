import * as React from "react";
import { cn } from "./cn";

/** 지시서 6장 상태 배지 색: PAID=파랑, PENDING=회색, CANCEL_REQUESTED=주황, CANCELED=빨강, EXPIRED=연회색, FAILED=빨강 외곽선 */
const VARIANT_CLASS: Record<string, string> = {
  blue: "bg-brand-50 text-brand-700 ring-brand-600/20",
  gray: "bg-gray-100 text-gray-600 ring-gray-500/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  lightgray: "bg-gray-50 text-gray-400 ring-gray-400/20",
  redOutline: "bg-white text-red-600 ring-red-500/60",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export function Badge({
  variant = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof VARIANT_CLASS | string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        VARIANT_CLASS[variant] ?? VARIANT_CLASS.gray,
        className,
      )}
      {...props}
    />
  );
}
