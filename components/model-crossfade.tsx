"use client";

// 모델 크로스페이드 — 여러 룩북 컷을 일정 간격으로 부드럽게 전환(옷 갈아입는 느낌).
// reduced-motion 시 첫 컷 고정. 스택 렌더로 전 컷 프리로드(첫 컷만 priority, next/image 최적화).
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

export function ModelCrossfade({
  images,
  interval = 3600,
  className = "",
  sizes = "100vw",
}: {
  images: string[];
  interval?: number;
  className?: string;
  sizes?: string;
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
        <motion.div
          key={src}
          aria-hidden
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: idx === i ? 1 : 0, scale: idx === i ? 1 : 1.06 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <Image
            src={src}
            alt=""
            fill
            sizes={sizes}
            priority={idx === 0}
            draggable={false}
            className="object-cover"
          />
        </motion.div>
      ))}
    </div>
  );
}
