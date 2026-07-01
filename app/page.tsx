// LAON SHOP 홈 — WebGL 히어로 + 벤토 상품 그리드
import { prisma } from "@/lib/db";
import { HomeHero } from "@/components/home-hero";
import { ProductGrid } from "@/components/product-grid";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const cards = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    category: p.category,
  }));

  return (
    <div className="space-y-12">
      <HomeHero />

      <section id="collection" className="scroll-mt-24 space-y-5">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-step-2 font-bold tracking-tight text-fg">컬렉션</h2>
          <span className="font-mono text-step--1 text-fg-subtle">{cards.length} pieces</span>
        </div>
        {cards.length === 0 ? (
          <p className="py-16 text-center text-fg-subtle">등록된 상품이 없습니다.</p>
        ) : (
          <ProductGrid products={cards} />
        )}
      </section>
    </div>
  );
}
