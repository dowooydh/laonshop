import { prisma } from "@/lib/db";
import { EmptyState, Input } from "@/lib/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { RecentProducts } from "@/components/recent-products";

export const dynamic = "force-dynamic";

// 시드 카탈로그 기준 실결과가 있는 검색어만 노출
const SUGGESTED = ["셔츠", "니트", "데님", "슬랙스", "블라우스", "스커트", "스니커즈", "부츠"];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q?.trim() ? `"${q.trim()}" 검색 결과` : "상품 검색" };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 50);

  const products = query
    ? await prisma.product.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { category: { contains: query } },
          ],
        },
        orderBy: { sortOrder: "asc" },
      })
    : [];

  // 빈 검색 화면 채움 — 남/여 추천 4개씩 (카테고리 뷰 '추천순'과 동일 기준)
  const picks = query
    ? []
    : (
        await Promise.all(
          (["men", "women"] as const).map((gender) =>
            prisma.product.findMany({
              where: { gender, active: true },
              orderBy: { sortOrder: "asc" },
              take: 4,
            }),
          ),
        )
      ).flat();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">Search</p>
        <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">상품 검색</h1>
      </header>

      <div className="max-w-xl space-y-4">
        <form action="/search" method="get" role="search">
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="상품명·카테고리로 검색"
            aria-label="상품 검색"
            autoFocus
          />
        </form>

        {/* 추천 검색어 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-step--1 uppercase tracking-widest text-fg-subtle">추천</span>
          {SUGGESTED.map((word) => (
            <Link
              key={word}
              href={`/search?q=${encodeURIComponent(word)}`}
              className={
                "rounded-[var(--radius-pill)] border px-4 py-1.5 text-step--1 transition-colors duration-fast " +
                (word === query
                  ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-accent-cyan"
                  : "border-line bg-raised text-fg-muted hover:bg-overlay hover:text-fg")
              }
            >
              {word}
            </Link>
          ))}
        </div>
      </div>

      {query ? (
        products.length === 0 ? (
          <EmptyState
            title={`"${query}" 검색 결과가 없습니다`}
            description="다른 검색어를 입력하거나 위 추천 검색어를 눌러보세요"
          />
        ) : (
          <section className="space-y-5">
            <p className="font-mono text-step--1 text-fg-subtle">
              &ldquo;{query}&rdquo; 검색 결과 {products.length}개
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  imageUrl={p.imageUrl}
                  eyebrow={`${p.gender === "women" ? "WOMEN" : "MEN"} · ${p.category}`}
                  soldOut={p.stock <= 0}
                />
              ))}
            </div>
          </section>
        )
      ) : (
        <>
          {/* 검색 전 — 추천 상품 그리드 */}
          <section className="space-y-5 border-t border-line pt-8">
            <div className="flex items-end justify-between">
              <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">추천 상품</h2>
              <span className="font-mono text-step--1 text-fg-subtle">MEN · WOMEN</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {picks.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  imageUrl={p.imageUrl}
                  eyebrow={`${p.gender === "women" ? "WOMEN" : "MEN"} · ${p.category}`}
                  soldOut={p.stock <= 0}
                  sizes="(min-width: 640px) 25vw, 50vw"
                />
              ))}
            </div>
          </section>

          <RecentProducts />
        </>
      )}
    </div>
  );
}
