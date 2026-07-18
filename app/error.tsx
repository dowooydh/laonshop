"use client";

import { Button, buttonVariants } from "@/lib/ui";
import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-danger">Error</p>
      <h1 className="mt-3 min-w-0 max-w-full text-balance break-keep font-display text-step-2 font-bold tracking-tight text-fg [overflow-wrap:anywhere] sm:text-step-3">
        문제가 발생했습니다
      </h1>
      <p className="mt-3 break-keep text-step-0 text-fg-muted">잠시 후 다시 시도해 주세요.</p>
      <div className="mt-8 flex gap-3">
        <Button type="button" variant="primary" size="lg" onClick={reset}>
          다시 시도
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          홈으로
        </Link>
      </div>
    </div>
  );
}
