"use client";

// 남/여 게이트 — 좌 남성 / 우 여성, 각 모델 크로스페이드. 클릭 시 /shop/[gender].
import Link from "next/link";
import { ModelCrossfade } from "./model-crossfade";
import { MEN_MODELS, WOMEN_MODELS } from "@/lib/models";

const SIDES = [
  { href: "/shop/men", label: "남성의류", en: "MEN", images: MEN_MODELS },
  { href: "/shop/women", label: "여성의류", en: "WOMEN", images: WOMEN_MODELS },
];

export function GenderGate() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SIDES.map((s, idx) => (
        <Link
          key={s.href}
          href={s.href}
          className="group relative block h-[56vh] min-h-[26rem] overflow-hidden rounded-[var(--radius-lg)] border border-line transition-[border-color,box-shadow] duration-base hover:border-accent-cyan hover:shadow-glow-cyan"
        >
          <ModelCrossfade
            images={s.images}
            interval={4200 + idx * 600}
            className="absolute inset-0 h-full w-full transition-transform duration-slow ease-out-expo group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/45 to-void/10" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 sm:p-7">
            <div>
              <div className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">{s.en}</div>
              <div className="mt-1 font-display text-step-2 font-bold tracking-tight text-fg">{s.label}</div>
            </div>
            <span className="mb-1 text-2xl text-fg transition-transform duration-base group-hover:translate-x-1 group-hover:text-accent-cyan">
              →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
