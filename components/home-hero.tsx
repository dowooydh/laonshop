"use client";

// 홈 히어로 셸 (핸드오버 §3) — 그라디언트 메시 + 키네틱 헤드라인 + WebGL 크리스탈.
// 모바일/저사양/reduced-motion → Canvas 미마운트, 정적 메시 폴백 (§7).
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const HeroCanvas = dynamic(() => import("./hero-canvas"), { ssr: false });

const HEAD = ["입는", "것을", "공간에서."];

export function HomeHero() {
  const reduce = useReducedMotion();
  const [render3D, setRender3D] = useState(false);

  useEffect(() => {
    const small = window.matchMedia("(max-width: 767px)").matches;
    const lowMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRender3D(!small && !lowMotion);
  }, []);

  return (
    <section className="mesh-hero relative overflow-hidden rounded-[var(--radius-lg)] border border-line">
      {render3D && (
        <div className="pointer-events-none absolute inset-0 opacity-90">
          <HeroCanvas />
        </div>
      )}

      <div className="relative z-10 px-6 py-20 sm:px-12 sm:py-28 lg:py-36">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono text-step--1 uppercase tracking-[0.3em] text-fg-subtle"
        >
          ㈜커스텀오더 · Future Wear
        </motion.p>

        <h1 className="mt-4 max-w-3xl font-display text-hero font-bold text-fg">
          {HEAD.map((w, i) => (
            <motion.span
              key={w}
              initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="mr-[0.25em] inline-block"
            >
              {i === HEAD.length - 1 ? <span className="text-glow-cyan">{w}</span> : w}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-6 max-w-md text-step-1 text-fg-muted"
        >
          상의 · 하의 · 아우터. 평면 카탈로그가 아니라 부유하는 오브젝트로 만나는 셀렉트샵.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          <Link
            href="#collection"
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-accent-cyan px-6 py-3 font-medium text-void shadow-glow-cyan transition-[filter] duration-fast hover:brightness-110"
          >
            컬렉션 보기 <span aria-hidden>↓</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
