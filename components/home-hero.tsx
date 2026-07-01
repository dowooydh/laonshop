"use client";

// 홈 히어로 — 모델이 코디를 갈아입는 풀블리드 크로스페이드 + 키네틱 헤드라인 (핸드오버 §3, 쇼핑몰 정체성).
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ModelCrossfade } from "./model-crossfade";
import { HERO_LOOKS } from "@/lib/models";

const HEAD = ["오늘의", "룩을", "입다."];

export function HomeHero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line">
      <ModelCrossfade images={HERO_LOOKS} interval={3800} className="absolute inset-0 h-full w-full" />
      {/* 가독 스크림 */}
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/55 to-void/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-void/70 to-transparent" />

      <div className="relative z-10 flex min-h-[80vh] flex-col justify-end px-6 py-14 sm:px-12 sm:py-20">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono text-step--1 uppercase tracking-[0.3em] text-fg-subtle"
        >
          ㈜커스텀오더 · New Season
        </motion.p>

        <h1 className="mt-3 font-display text-hero font-bold text-fg">
          {HEAD.map((w, i) => (
            <motion.span
              key={w}
              initial={reduce ? false : { opacity: 0, y: 26, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.12 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="mr-[0.25em] inline-block"
            >
              {i === HEAD.length - 1 ? <span className="text-glow-cyan">{w}</span> : w}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-5 max-w-xl text-step-1 leading-relaxed text-fg-muted"
        >
          남성 · 여성, 상의부터 신발까지.
          <br />
          매일의 코디를 공간에서 완성하는 셀렉트샵.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-wrap gap-3"
        >
          <Link
            href="/shop/men"
            className="rounded-[var(--radius-pill)] bg-accent-cyan px-6 py-3 font-medium text-void shadow-glow-cyan transition-[filter] duration-fast hover:brightness-110"
          >
            남성의류
          </Link>
          <Link
            href="/shop/women"
            className="rounded-[var(--radius-pill)] border border-line bg-raised px-6 py-3 font-medium text-fg transition-colors duration-fast hover:bg-overlay"
          >
            여성의류
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
