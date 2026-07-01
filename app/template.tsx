"use client";

// 페이지 전환 — 리로드 느낌 제거(핸드오버 §2). template은 내비게이션마다 재마운트되어 진입 모션을 준다.
// reduced-motion 시 진입 애니메이션 없음 (§7).
import { motion, useReducedMotion } from "motion/react";

export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
