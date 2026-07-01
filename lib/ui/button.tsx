import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "./cn";

// 다크 퍼스트 + 발광. 악센트는 CTA/글로우에만 좁게. (핸드오버 §4)
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium transition-[background-color,box-shadow,border-color,transform,filter] duration-fast ease-out-expo active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // 발광 시안 CTA — 이 앱의 시그니처 버튼
        primary: "bg-accent-cyan text-void shadow-glow-cyan hover:brightness-110",
        violet: "bg-accent-violet text-void shadow-glow-violet hover:brightness-110",
        secondary: "bg-raised text-fg border border-line hover:bg-overlay",
        outline: "border border-line bg-transparent text-fg hover:bg-raised hover:border-fg-subtle",
        ghost: "bg-transparent text-fg-muted hover:bg-raised hover:text-fg",
        danger: "bg-danger text-void hover:brightness-110",
        link: "text-accent-cyan underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-step--1",
        md: "h-10 px-4 text-step-0",
        lg: "h-12 px-5 text-step-0",
        xl: "h-14 w-full px-6 text-step-1", // 모바일 풀폭 CTA
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };
