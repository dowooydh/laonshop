// RYU SHOP 홈 — 의류 상품 그리드
import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-10 text-white">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">데일리룩, RYU SHOP</h1>
        <p className="mt-2 text-sm text-blue-100">상의 · 하의 · 아우터 — 매일 입기 좋은 옷</p>
      </section>

      {products.length === 0 ? (
        <p className="py-16 text-center text-gray-400">등록된 상품이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link key={p.id} href={`/product/${p.id}`} className="group">
              <div className="aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl ?? ""}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="mt-2.5">
                <div className="text-[11px] font-medium text-gray-400">{p.category}</div>
                <div className="truncate text-sm font-medium text-gray-900">{p.name}</div>
                <div className="mt-0.5 text-sm font-bold text-gray-900">{formatKrw(p.price)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
