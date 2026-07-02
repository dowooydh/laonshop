import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { EmptyState, Input } from "@/lib/ui";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-7">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-[0.3em] text-accent-cyan">Search</p>
        <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">상품 검색</h1>
      </header>

      <form action="/search" method="get" className="max-w-md" role="search">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="상품명·카테고리로 검색"
          aria-label="상품 검색"
          autoFocus
        />
      </form>

      {query &&
        (products.length === 0 ? (
          <EmptyState
            title={`"${query}" 검색 결과가 없습니다`}
            description="다른 검색어를 입력하거나 카테고리를 둘러보세요"
          />
        ) : (
          <>
            <p className="font-mono text-step--1 text-fg-subtle">
              &ldquo;{query}&rdquo; 검색 결과 {products.length}개
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <Link
                  key={p.id}
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
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
                      {p.gender === "women" ? "WOMEN" : "MEN"} · {p.category}
                    </div>
                    <div className="truncate text-step-0 font-semibold text-fg">{p.name}</div>
                    <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(p.price)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ))}
    </div>
  );
}
