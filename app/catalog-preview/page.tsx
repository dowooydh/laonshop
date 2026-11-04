import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getCatalogCategoryCounts, getProductClassification } from "@/lib/catalog-taxonomy";
import { getPreparedProducts } from "@/lib/prepared-products";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "출시 준비 상품",
  robots: { index: false, follow: false },
};

export default function PreparedCatalogPage() {
  const products = getPreparedProducts();
  const counts = getCatalogCategoryCounts(products);
  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <p className="text-sm font-semibold text-fg-subtle">COMING SOON</p>
        <h1 className="text-3xl font-bold">출시를 준비하는 새로운 셀렉션</h1>
        <p className="max-w-3xl text-sm leading-7 text-fg-muted">
          판매 준비 상품 {products.length}개를 AI 이미지로 먼저 소개합니다.
          이미지와 가격은 출시 전 시안이며 확정된 판매 정보가 아닙니다.
          공급·실측·가격·재고 확인 전까지 주문을 받지 않습니다.
        </p>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="준비상품 구성">
        {counts.map((group) => (
          <span key={group.category} className="rounded bg-raised px-3 py-2 text-sm">
            {group.category} {group.count}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            price={product.price}
            imageUrl={product.imageUrl}
            eyebrow={`${product.gender === "women" ? "여성" : "남성"} · ${getProductClassification(product).category}`}
            prepared
            soldOut
            sizes="(min-width: 1024px) 33vw, 50vw"
          />
        ))}
      </div>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
        판매 상품 둘러보기
      </Link>
    </div>
  );
}
