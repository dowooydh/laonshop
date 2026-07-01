"use client";

// Lenis 스무스 스크롤 (핸드오버 §2·§6) — root 모드, GSAP ScrollTrigger와 동일 window 스크롤 공유.
// prefers-reduced-motion 시 lerp=1(즉시)로 스무딩 비활성 — 언마운트 없이 (§7).
import { ReactLenis } from "lenis/react";
import { useEffect, useState } from "react";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <ReactLenis
      root
      options={{ lerp: reduce ? 1 : 0.12, smoothWheel: !reduce, wheelMultiplier: 1 }}
    >
      {children}
    </ReactLenis>
  );
}
