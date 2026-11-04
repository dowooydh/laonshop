import { notFound } from "next/navigation";
import Link from "next/link";
import { getPreparedProducts } from "@/lib/prepared-products";
import { ProductGallery } from "@/components/product-gallery";
import { ProductSizeGuide } from "@/components/product-size-guide";
import { ReviewExamples } from "@/components/review-examples";
import { getReviewExamples, showReviewExamples } from "@/lib/review-examples";
import { getProductClassification } from "@/lib/catalog-taxonomy";
import { formatKrw } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "출시 준비 상품",
  robots: { index: false, follow: false },
};
export default async function PreparedProductPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const product = getPreparedProducts().find((entry) => entry.key === key);
  if (!product) notFound();
  const classification = getProductClassification(product);
  return (
    <div className="min-w-0 space-y-8">
      <Link
        href="/catalog-preview"
        className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
      >
        출시 준비 상품 목록
      </Link>
      <div className="grid min-w-0 gap-8 md:grid-cols-2">
        <ProductGallery
          images={[
            { src: product.imageUrl, alt: `${product.name} AI 생성 이미지` },
          ]}
          name={product.name}
          soldOut={false}
        />
        <div className="min-w-0 space-y-5">
          <p className="text-sm font-semibold text-fg-subtle">
            {classification.category} · {classification.subcategory}
          </p>
          <h1 className="text-3xl font-bold leading-snug">{product.name}</h1>
          <p className="text-2xl font-bold">
            예상 가격 {formatKrw(product.price)}
          </p>
          <p className="rounded border border-dashed border-line bg-raised p-4 text-sm leading-7 text-fg-muted">
            AI로 제작한 상품 이미지 시안입니다. 공급·실측·가격·재고가 확정되지
            않은 판매 준비 상품으로, 출시 전까지 구매할 수 없습니다.
          </p>
          <p className="text-sm text-fg-muted">
            예정 옵션: {product.sizes.split(",").join(" · ") || "단일 옵션"}
          </p>
          <span className="inline-flex min-h-12 items-center rounded border border-line bg-raised px-6 text-sm font-semibold">
            판매 준비 중
          </span>
          <a
            href="#size-guide"
            className="flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            참고용 사이즈표 보기
          </a>
        </div>
      </div>
      <section className="space-y-3 border-t border-line pt-7" aria-labelledby="prepared-description-title">
        <h2 id="prepared-description-title" className="text-xl font-semibold">디자인 소개</h2>
        <p className="max-w-3xl text-sm leading-7 text-fg-muted">
          {product.name}는 일상적인 스타일링을 위해 준비하는 {classification.subcategory} 상품입니다.
          이미지에서 디자인과 전체적인 실루엣을 살펴보세요. 상세 소재·제조 정보와
          실제 치수는 출시가 확정되면 안내합니다.
        </p>
      </section>
      <ProductSizeGuide
        name={product.name}
        category={product.category}
        gender={product.gender}
        sizes={product.sizes.split(",").filter(Boolean)}
      />
      {showReviewExamples() && <ReviewExamples data={getReviewExamples(product.key)} />}
    </div>
  );
}
