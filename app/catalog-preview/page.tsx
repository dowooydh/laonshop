import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { CATALOG_ADDITIONS } from "@/prisma/catalog-additions";
import {
  getCatalogCategoryCounts,
  getProductClassification,
} from "@/lib/catalog-taxonomy";
import {
  getPreparedProducts,
  preparedProductsAllowed,
} from "@/lib/prepared-products";
import { formatKrw } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "신규 AI 셀렉션",
  robots: { index: false, follow: false },
};
export default function CatalogPreviewPage() {
  if (!preparedProductsAllowed(process.env)) notFound();
  const products = getPreparedProducts();
  const counts = getCatalogCategoryCounts(CATALOG_ADDITIONS);
  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <p className="text-sm font-semibold text-fg-subtle">미리보기 전용</p>
        <h1 className="text-3xl font-bold">AI로 준비한 새로운 셀렉션</h1>
        <p className="max-w-3xl text-sm leading-7 text-fg-muted">
          신규 상품 {CATALOG_ADDITIONS.length}개의 구성 초안과 별도로 생성한 AI
          이미지입니다. 실제 공급 정보·실측·판매가·재고 확인 전까지 구매할 수
          없습니다. 아래 금액은 검토용 가격이며 판매 가격이 아닙니다.
        </p>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="준비상품 구성">
        {counts.map((group) => (
          <span
            key={group.category}
            className="rounded bg-raised px-3 py-2 text-sm"
          >
            {group.category} {group.count}
          </span>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOG_ADDITIONS.map((draft) => {
          const classification = getProductClassification(draft);
          const product = products.find((entry) => entry.key === draft.key);
          return (
            <article
              key={draft.key}
              className="overflow-hidden rounded border border-line"
            >
              {product && (
                <Link
                  href={`/catalog-preview/${draft.key}`}
                  className="relative block aspect-[4/5] bg-raised"
                >
                  <Image
                    src={product.imageUrl}
                    alt={`${product.name} AI 생성 시안`}
                    fill
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    className="object-cover"
                  />
                </Link>
              )}
              <div className="space-y-3 p-5">
                <p className="text-xs text-fg-subtle">
                  {draft.gender === "women" ? "여성" : "남성"} ·{" "}
                  {classification.category} · {classification.subcategory}
                </p>
                <h2 className="text-lg font-semibold">
                  {product ? (
                    <Link
                      href={`/catalog-preview/${draft.key}`}
                      className="inline-flex min-h-11 items-center"
                    >
                      {draft.name}
                    </Link>
                  ) : (
                    draft.name
                  )}
                </h2>
                <p className="text-sm text-fg-muted">
                  검토 가격 {formatKrw(draft.proposedPrice)}
                </p>
                <p className="text-sm text-fg-muted">
                  검토 옵션 {draft.proposedSizes || "단일 옵션"}
                </p>
                <p className="border-t border-line pt-3 text-xs leading-6 text-fg-subtle">
                  {product ? "AI 이미지 시안 · " : "사진 준비 중 · "}실측·공급
                  확인 대기
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
      >
        판매 중인 상품 둘러보기
      </Link>
    </div>
  );
}
