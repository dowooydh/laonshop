// 정책 페이지 공용 셸 — 아이브로 + 디스플레이 헤딩 + 스텝 스케일 본문 (심사 캡처 대상 페이지 톤 정렬)
import type { ReactNode } from "react";

export function PolicyShell({
  eyebrow,
  title,
  effective,
  children,
}: {
  eyebrow: string;
  title: string;
  effective: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-w-0 max-w-3xl py-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">Policy · {eyebrow}</p>
        <h1 className="mt-2 text-balance break-keep font-display text-step-2 font-bold tracking-tight text-fg [overflow-wrap:anywhere]">
          {title}
        </h1>
        <p className="mt-3 font-mono text-step--1 text-fg-subtle">시행일 {effective}</p>
      </header>
      <div className="mt-8 min-w-0 space-y-7 text-step--1 leading-relaxed text-fg-muted [overflow-wrap:anywhere] [&_h2]:text-step-0 [&_h2]:font-semibold [&_h2]:text-fg [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
