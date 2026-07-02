"use client";

// /shop/[gender] 카테고리 뷰 — 상의/하의/신발 탭 + 선택 카테고리 10개 그리드.
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { formatKrw } from "@/lib/format";
import { EmptyState, Select } from "@/lib/ui";

type Card = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: string | null;
  soldOut: boolean;
  createdAt: string; // ISO — 신상품순 정렬용
};

const CATS = ["상의", "하의", "신발"] as const;

const SORTS = {
  recommended: { label: "추천순", fn: () => 0 }, // 서버 sortOrder 유지
  newest: { label: "신상품순", fn: (a: Card, b: Card) => b.createdAt.localeCompare(a.createdAt) },
  priceAsc: { label: "낮은 가격순", fn: (a: Card, b: Card) => a.price - b.price },
  priceDesc: { label: "높은 가격순", fn: (a: Card, b: Card) => b.price - a.price },
} as const;

type SortKey = keyof typeof SORTS;

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
  const [sort, setSort] = useState<SortKey>("recommended");
  const list = products.filter((p) => p.category === cat).sort(SORTS[sort].fn);

  return (
    <div className="space-y-7">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">
          {gender === "men" ? "MEN" : "WOMEN"}
        </p>
        <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">{label}</h1>
      </header>

      {/* 카테고리 탭 + 정렬 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap gap-2">
        {CATS.map((c) => {
          const active = c === cat;
          const n = products.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
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
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="정렬"
          className="h-9 w-auto min-w-32 text-step--1"
        >
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {list.length === 0 ? (
        <EmptyState title="아직 준비 중인 카테고리입니다" description="다른 카테고리를 둘러보세요" />
      ) : (
        /* 그리드 (탭 전환 시 재애니메이션 위해 key=cat) */
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
                {p.imageUrl && (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.06]"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void via-void/60 to-transparent" />
                {p.soldOut && (
                  <div className="absolute inset-0 flex items-center justify-center bg-void/60">
                    <span className="font-mono text-step--1 uppercase tracking-[0.3em] text-fg">Sold Out</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="truncate text-step-0 font-semibold text-fg">{p.name}</div>
                  <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(p.price)}</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
