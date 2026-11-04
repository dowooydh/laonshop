import Link from "next/link";
import { HomeHero } from "@/components/home-hero";
import { ProductCard } from "@/components/product-card";
import { RecentProducts } from "@/components/recent-products";
import { prisma } from "@/lib/db";
import { getProductClassification } from "@/lib/catalog-taxonomy";
import { getPreparedProducts } from "@/lib/prepared-products";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "상의",
  "하의",
  "아우터",
  "원피스",
  "스커트",
  "신발",
  "가방",
  "모자",
  "주얼리",
  "홈웨어",
  "패션잡화",
  "운동용품",
];

export default async function HomePage() {
  const preparedProducts = getPreparedProducts();
  const [picks, arrivals] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: 8,
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 8,
    }),
  ]);
  const heroProducts = [
    picks.find((p) => p.gender === "women"),
    picks.find((p) => p.gender === "men"),
  ].filter((p): p is (typeof picks)[number] => Boolean(p));
  const hero = heroProducts.length === 2 ? heroProducts : picks.slice(0, 2);

  return (
    <div className="space-y-10 sm:space-y-14">
      <HomeHero
        products={hero.map(({ id, name, imageUrl }) => ({
          id,
          name,
          imageUrl,
        }))}
      />

      <nav
        aria-label="카테고리 바로가기"
        className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3"
      >
        {CATEGORIES.map((category) => (
          <Link
            key={category}
            href={`/search?q=${encodeURIComponent(category)}`}
            className="flex min-h-14 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-raised px-2 py-3 text-center text-sm font-semibold text-fg transition-colors hover:bg-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
          >
            {category}
          </Link>
        ))}
      </nav>

      {preparedProducts.length > 0 && (
        <Link
          href="/catalog-preview"
          className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded border border-dashed border-line bg-raised px-5 py-4 text-sm"
        >
          <span className="font-semibold">출시를 준비하는 새로운 셀렉션</span>
          <span className="text-fg-subtle">판매 준비 상품 {preparedProducts.length}개 보기</span>
        </Link>
      )}
      {[
        {
          title: "지금 눈여겨볼 상품",
          description: "매일의 옷장에 더하기 좋은 라온샵 셀렉트",
          products: picks,
        },
        {
          title: "새로 들어온 상품",
          description: "새롭게 만나는 스타일을 둘러보세요",
          products: arrivals,
        },
      ].map((section) => (
        <section
          key={section.title}
          className="space-y-5"
          aria-label={section.title}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="break-keep text-xl font-bold tracking-tight text-fg sm:text-2xl">
                {section.title}
              </h2>
              <p className="mt-1.5 text-sm text-fg-muted">
                {section.description}
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
            >
              상품 더 보기
            </Link>
          </div>
          {section.products.length ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
              {section.products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  imageUrl={product.imageUrl}
                  eyebrow={getProductClassification(product).category}
                  soldOut={product.stock <= 0}
                />
              ))}
            </div>
          ) : (
            <p className="border-y border-line py-12 text-center text-sm text-fg-muted">
              새로운 상품을 준비하고 있습니다.
            </p>
          )}
        </section>
      ))}

      <section
        className="grid gap-5 border-y border-line py-7 sm:grid-cols-3"
        aria-label="쇼핑 안내"
      >
        <div>
          <h2 className="text-sm font-semibold text-fg">전 상품 무료배송</h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            결제 확인 후 영업일 기준
            <br />
            2~3일 이내 출고합니다.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-fg">주문부터 배송까지</h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            마이페이지에서 주문과
            <br />
            배송 정보를 확인하세요.
          </p>
          <Link
            href="/mypage"
            className="inline-flex min-h-11 items-center text-sm text-fg underline underline-offset-4"
          >
            주문내역 보기
          </Link>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-fg">
            궁금한 점이 있으신가요?
          </h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            배송·교환·반품 안내와
            <br />
            고객센터를 확인하세요.
          </p>
          <Link
            href="/support"
            className="inline-flex min-h-11 items-center text-sm text-fg underline underline-offset-4"
          >
            고객센터
          </Link>
        </div>
      </section>
      {preparedProducts.length > 0 && (
        <section className="space-y-5" aria-label="출시 준비 상품">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">출시 준비 상품</h2>
              <p className="mt-2 text-sm text-fg-muted">
                AI 이미지로 소개하는 새 스타일입니다. 출시 전까지 구매할 수 없습니다.
              </p>
            </div>
            <Link
              href="/catalog-preview"
              className="inline-flex min-h-11 items-center text-sm font-semibold underline"
            >
              준비 상품 {preparedProducts.length}개 보기
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {preparedProducts.slice(0, 8).map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                imageUrl={product.imageUrl}
                prepared
                soldOut
                eyebrow={getProductClassification(product).category}
              />
            ))}
          </div>
        </section>
      )}
      <RecentProducts />
    </div>
  );
}
