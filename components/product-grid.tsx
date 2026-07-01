"use client";

// 벤토 상품 그리드 (핸드오버 §4.6) — 크기 변주 카드 + 스크롤 진입 스태거 + 호버 리빌.
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { formatKrw } from "@/lib/format";

type ProductCard = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: string | null;
};

// 벤토 스팬: 0번=피처(2x2), 5번=와이드(2x1), 나머지 1x1
function span(i: number) {
  if (i === 0) return "sm:col-span-2 sm:row-span-2";
  if (i === 5) return "sm:col-span-2";
  return "";
}

export function ProductGrid({ products }: { products: ProductCard[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:auto-rows-[minmax(11rem,1fr)]">
      {products.map((p, i) => (
        <motion.div
          key={p.id}
          className={span(i)}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.5, delay: (i % 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href={`/product/${p.id}`}
            className="group relative block h-full min-h-[11rem] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised transition-[box-shadow,border-color] duration-base hover:border-accent-cyan hover:shadow-glow-cyan"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl ?? ""}
              alt={p.name}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.06]"
            />
            {/* 하단 스크림 — 텍스트 가독 */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void via-void/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-accent-cyan">{p.category}</div>
              <div className="mt-1 truncate text-step-0 font-semibold text-fg">{p.name}</div>
              <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(p.price)}</div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
