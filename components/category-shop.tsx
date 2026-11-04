"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, Input, Select } from "@/lib/ui";
import { ProductCard } from "./product-card";

type Card = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: string | null;
  soldOut: boolean;
  createdAt: string;
};

const CAT_ORDER = ["상의", "아우터", "하의", "원피스/스커트", "신발", "가방", "액세서리", "홈웨어", "스포츠"];
const SORTS = {
  recommended: { label: "추천순", fn: () => 0 },
  newest: { label: "신상품순", fn: (a: Card, b: Card) => b.createdAt.localeCompare(a.createdAt) },
  priceAsc: { label: "낮은 가격순", fn: (a: Card, b: Card) => a.price - b.price },
  priceDesc: { label: "높은 가격순", fn: (a: Card, b: Card) => b.price - a.price },
} as const;
type SortKey = keyof typeof SORTS;

export function CategoryShop({ gender, label, products }: { gender: "men" | "women"; label: string; products: Card[] }) {
  const cats = [...CAT_ORDER.filter((c) => products.some((p) => p.category === c)), ...Array.from(new Set(products.map((p) => p.category).filter((c): c is string => c !== null && !CAT_ORDER.includes(c))))];
  const [cat, setCat] = useState("전체");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const list = products.filter((p) => (cat === "전체" || p.category === cat) && (!inStockOnly || !p.soldOut) && p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort(SORTS[sort].fn);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{label}</h1><p className="mt-2 text-sm text-fg-muted">취향에 맞는 한 벌을 찾아보세요.</p></div>
        <Link href={`/shop/${gender === "men" ? "women" : "men"}`} className="inline-flex min-h-11 items-center text-sm text-fg-muted underline underline-offset-4">{gender === "men" ? "여성의류 둘러보기" : "남성의류 둘러보기"}</Link>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-line pb-5" aria-label="상품 카테고리">
        {["전체", ...cats].map((category) => (
          <button key={category} type="button" aria-pressed={category === cat} onClick={() => setCat(category)} className={`inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan ${category === cat ? "border-black bg-black text-white" : "border-line bg-raised text-fg-muted hover:bg-overlay"}`}>
            {category}<span className="ml-1.5 text-xs opacity-70">{category === "전체" ? products.length : products.filter((p) => p.category === category).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" aria-atomic="true" className="text-sm text-fg-muted">상품 <strong className="font-semibold text-fg">{list.length}</strong>개</p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg-muted"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} className="h-4 w-4 accent-black" />품절 제외</label>
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="정렬" className="h-11 w-auto min-w-32 text-sm">{Object.entries(SORTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</Select>
        </div>
      </div>
      <div className="max-w-md"><Input type="search" aria-label="목록 안에서 상품 검색" placeholder="목록 안에서 상품명 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {list.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
          {list.map((product, index) => <ProductCard key={product.id} {...product} eyebrow={product.category ?? undefined} priority={index === 0} />)}
        </div>
      ) : <div className="space-y-3 pb-8 text-center"><EmptyState title="조건에 맞는 상품이 없습니다" description="검색어나 카테고리, 품절 제외 조건을 바꿔보세요." /><button type="button" onClick={() => { setCat("전체"); setQuery(""); setInStockOnly(false); }} className="min-h-11 px-4 text-sm font-semibold text-fg underline underline-offset-4">선택 초기화</button></div>}
    </div>
  );
}
