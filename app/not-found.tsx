import Link from "next/link";
import { buttonVariants } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">404</p>
      <h1 className="mt-3 font-display text-step-3 font-bold tracking-tight text-fg">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-3 text-step-0 text-fg-muted">주소가 바뀌었거나 삭제된 페이지예요.</p>
      <div className="mt-8">
        <Link href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
          홈으로
        </Link>
      </div>
      <p className="mt-6 font-mono text-step--1 text-fg-subtle">
        <Link href="/shop/men" className="transition-colors hover:text-fg-muted">
          MEN
        </Link>
        <span className="mx-2">·</span>
        <Link href="/shop/women" className="transition-colors hover:text-fg-muted">
          WOMEN
        </Link>
      </p>
    </div>
  );
}
