"use client";

// /shop/[gender] 카테고리 뷰 — 상의/하의/신발 탭 + 선택 카테고리 10개 그리드.
import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { formatKrw } from "@/lib/format";

type Card = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: string | null;
};

const CATS = ["상의", "하의", "신발"] as const;

export function CategoryShop({
  gender,
  label,
  products,
}: {
  gender: "men" | "women";
  label: string;
  products: Card[];
}) {
  const reduce = useReducedMotion();
  const [cat, setCat] = useState<string>("상의");
  const list = products.filter((p) => p.category === cat);

  return (
    <div className="space-y-7">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">
          {gender === "men" ? "MEN" : "WOMEN"}
        </p>
        <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">{label}</h1>
      </header>

      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-4">
        {CATS.map((c) => {
          const active = c === cat;
          const n = products.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={
                "rounded-[var(--radius-pill)] px-5 py-2 text-step-0 font-medium transition-colors duration-fast " +
                (active
                  ? "bg-accent-cyan text-void shadow-glow-cyan"
                  : "border border-line bg-raised text-fg-muted hover:bg-overlay hover:text-fg")
              }
            >
              {c}
              <span className={"ml-1.5 font-mono text-step--1 " + (active ? "text-void/70" : "text-fg-subtle")}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* 그리드 (탭 전환 시 재애니메이션 위해 key=cat) */}
      <div key={cat} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p, i) => (
          <motion.div
            key={p.id}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: (i % 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={`/product/${p.id}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised transition-[border-color,box-shadow] duration-base hover:border-accent-cyan hover:shadow-glow-cyan"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl ?? ""}
                alt={p.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.06]"
              />
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void via-void/60 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="truncate text-step-0 font-semibold text-fg">{p.name}</div>
                <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(p.price)}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
