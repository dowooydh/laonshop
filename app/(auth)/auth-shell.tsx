"use client";

// 인증 화면 셸 — 모노 시안 아이브로 + 디스플레이 헤딩 + 글래스 카드 (핸드오버 §3, §4)
import { Card, CardContent } from "@/lib/ui";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

export function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-12">
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan"
      >
        {eyebrow}
      </motion.p>

      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
        className="mt-2 font-display text-step-3 font-bold tracking-tight text-fg"
      >
        {title}
      </motion.h1>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
        className="mt-8"
      >
        <Card className="shadow-elev2">
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
