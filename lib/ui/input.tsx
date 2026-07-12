import * as React from "react";
import { cn } from "./cn";

const fieldBase =
  "w-full rounded-[var(--radius-md)] border border-line bg-raised text-fg placeholder:text-fg-subtle transition-colors duration-fast focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, "flex h-11 px-3.5 text-step-0", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "flex min-h-[88px] px-3.5 py-2.5 text-step-0", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      fieldBase,
      "flex h-11 appearance-none px-3.5 pr-9 text-step-0",
      // 셰브론 (fg-subtle #5C6577)
      "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235c6577%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_0.85rem_center] bg-no-repeat",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-step--1 font-medium text-fg-muted", className)} {...props} />;
}

/** 동의 체크 — 라벨 전체가 클릭 영역. children에 정책 링크 포함 가능. */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <label className={cn("flex min-h-11 cursor-pointer items-start gap-2.5 py-2 text-step--1 leading-relaxed text-fg-muted", className)}>
    <input
      ref={ref}
      type="checkbox"
      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent-cyan)]"
      {...props}
    />
    <span>{children}</span>
  </label>
));
Checkbox.displayName = "Checkbox";

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-step--1 text-fg-subtle", className)} {...props} />;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-step--1 text-danger">{children}</p>;
}
