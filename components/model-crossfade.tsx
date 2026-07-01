"use client";

// 모델 크로스페이드 — 여러 룩북 컷을 일정 간격으로 부드럽게 전환(옷 갈아입는 느낌).
// reduced-motion 시 첫 컷 고정. 이미지는 스택 렌더로 프리로드됨.
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export function ModelCrossfade({
  images,
  interval = 3600,
  className = "",
}: {
  images: string[];
  interval?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce || images.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % images.length), interval);
    return () => clearInterval(t);
  }, [reduce, images.length, interval]);

  return (
    <div className={`overflow-hidden bg-base ${className}`}>
      {images.map((src, idx) => (
        <motion.img
          key={src}
          src={src}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          initial={false}
          animate={{ opacity: idx === i ? 1 : 0, scale: idx === i ? 1 : 1.06 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
