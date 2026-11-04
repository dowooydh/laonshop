"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, Input, Select } from "@/lib/ui";
import {
  getCatalogCategoryCounts,
  getProductClassification,
} from "@/lib/catalog-taxonomy";
import { ProductCard } from "./product-card";

type Card = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: string | null;
  soldOut: boolean;
  createdAt: string;
  prepared?: boolean;
};
const SORTS = {
  recommended: { label: "추천순", fn: () => 0 },
  newest: {
    label: "신상품순",
    fn: (a: Card, b: Card) => b.createdAt.localeCompare(a.createdAt),
  },
  priceAsc: {
    label: "낮은 가격순",
    fn: (a: Card, b: Card) => a.price - b.price,
  },
  priceDesc: {
    label: "높은 가격순",
    fn: (a: Card, b: Card) => b.price - a.price,
  },
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
  const groups = getCatalogCategoryCounts(products);
  const [cat, setCat] = useState("전체");
  const [subcategory, setSubcategory] = useState("전체");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const currentGroup = groups.find((group) => group.category === cat);
  const list = products
    .filter((product) => {
      const classification = getProductClassification(product);
      const keywords =
        `${product.name} ${classification.category} ${classification.subcategory}`.toLocaleLowerCase();
      return (
        (cat === "전체" || classification.category === cat) &&
        (subcategory === "전체" ||
          classification.subcategory === subcategory) &&
        (!inStockOnly || !product.soldOut) &&
        keywords.includes(query.trim().toLocaleLowerCase())
      );
    })
    .sort(SORTS[sort].fn);
  const preparedCount = list.filter((product) => product.prepared).length;
  const reset = () => {
    setCat("전체");
    setSubcategory("전체");
    setQuery("");
    setInStockOnly(false);
  };
  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            {label}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            취향에 맞는 한 벌을 찾아보세요.
          </p>
        </div>
        <Link
          href={`/shop/${gender === "men" ? "women" : "men"}`}
          className="inline-flex min-h-11 items-center text-sm text-fg-muted underline underline-offset-4"
        >
          {gender === "men" ? "여성의류 둘러보기" : "남성의류 둘러보기"}
        </Link>
      </header>
      {products.some((product) => product.prepared) && (
        <p className="rounded border border-dashed border-line bg-raised p-4 text-sm leading-6 text-fg-muted">
          판매 준비 상품은 AI 이미지로 새 스타일을 소개합니다.
          별도로 표시된 준비 상품은 출시 전까지 구매할 수 없습니다.
        </p>
      )}
      <div className="space-y-3 border-b border-line pb-5">
        <div className="flex flex-wrap gap-2" aria-label="상품 카테고리">
          {[{ category: "전체", count: products.length }, ...groups].map(
            (group) => (
              <button
                key={group.category}
                type="button"
                aria-pressed={group.category === cat}
                onClick={() => {
                  setCat(group.category);
                  setSubcategory("전체");
                }}
                className={`inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium ${group.category === cat ? "border-black bg-black text-white" : "border-line bg-raised text-fg-muted hover:bg-overlay"}`}
              >
                {group.category}
                <span className="ml-1.5 text-xs opacity-70">{group.count}</span>
              </button>
            ),
          )}
        </div>
        {currentGroup && currentGroup.subcategories.length > 1 && (
          <div className="flex flex-wrap gap-2" aria-label="세부 상품 분류">
            {[
              { name: "전체", count: currentGroup.count },
              ...currentGroup.subcategories,
            ].map((sub) => (
              <button
                key={sub.name}
                type="button"
                aria-pressed={subcategory === sub.name}
                onClick={() => setSubcategory(sub.name)}
                className={`inline-flex min-h-11 items-center rounded border px-3 py-2 text-sm ${subcategory === sub.name ? "border-fg text-fg" : "border-transparent text-fg-subtle hover:bg-raised"}`}
              >
                {sub.name}
                <span className="ml-1 text-xs">{sub.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-sm text-fg-muted"
        >
          전체 <strong className="font-semibold text-fg">{list.length}</strong>개
          {" · "}판매 상품 {list.length - preparedCount}개
          {preparedCount > 0 && <> · 판매 준비 {preparedCount}개</>}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
              className="h-4 w-4 accent-black"
            />
            구매 가능 상품만
          </label>
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="정렬"
            className="h-11 w-auto min-w-32 text-sm"
          >
            {Object.entries(SORTS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="max-w-md">
        <Input
          type="search"
          aria-label="목록 안에서 상품 검색"
          placeholder="상품명·세부 분류로 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {list.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
          {list.map((product, index) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              price={product.price}
              imageUrl={product.imageUrl}
              soldOut={product.soldOut}
              prepared={product.prepared}
              eyebrow={`${getProductClassification(product).category} · ${getProductClassification(product).subcategory}`}
              priority={index === 0}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3 pb-8 text-center">
          <EmptyState
            title="조건에 맞는 상품이 없습니다"
            description="검색어나 카테고리, 구매 가능 상품 조건을 바꿔보세요."
          />
          <button
            type="button"
            onClick={reset}
            className="min-h-11 px-4 text-sm font-semibold text-fg underline underline-offset-4"
          >
            선택 초기화
          </button>
        </div>
      )}
    </div>
  );
}
