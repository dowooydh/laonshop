import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { getShopUser } from "@/lib/auth";
import { getProductDetailImages } from "@/lib/product-detail-images";
import { getProductReviews, getReviewableItems } from "@/lib/commerce/queries";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProductInfoSections } from "@/components/product-info";
import { ProductSizeGuide } from "@/components/product-size-guide";
import { getProductClassification } from "@/lib/catalog-taxonomy";
import { ProductGallery } from "@/components/product-gallery";
import { ProductReviews } from "@/components/product-reviews";
import { ReviewExamples } from "@/components/review-examples";
import { getReviewExamples, showReviewExamples } from "@/lib/review-examples";
import { ProductCard } from "@/components/product-card";
import { RecentProducts, RecordView } from "@/components/recent-products";
import { AddToCart } from "./add-to-cart";
import { WishlistButton } from "./wishlist-button";

export const dynamic = "force-dynamic";
const getProduct = cache((id: string) =>
  prisma.product.findUnique({ where: { id } }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product?.active) return { title: "상품을 찾을 수 없습니다" };
  const description = `${product.name} — ${product.description ?? "LAON SHOP 셀렉트"} ${formatKrw(product.price)}`;
  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: getProductDetailImages(product).map((image) => image.src),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product?.active) notFound();
  const user = await getShopUser();
  const [related, reviews, reviewable, wished] = await Promise.all([
    prisma.product.findMany({
      where: {
        gender: product.gender,
        category: product.category,
        active: true,
        id: { not: product.id },
      },
      orderBy: { sortOrder: "asc" },
      take: 4,
    }),
    getProductReviews(id),
    user
      ? getReviewableItems(user.id, id)
      : Promise.resolve({ available: true, items: [] }),
    user
      ? prisma.wishlist
          .findUnique({
            where: { userId_productId: { userId: user.id, productId: id } },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ]);
  const galleryImages = getProductDetailImages(product);
  const sizes = (product.sizes ?? "")
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean);
  const gender = product.gender === "women" ? "women" : "men";
  const soldOut = product.stock <= 0;
  const classification = getProductClassification(product);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: galleryImages.map((image) => image.src),
    description: product.description ?? undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "KRW",
      availability: soldOut
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
  };
  return (
    <div className="min-w-0 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <RecordView
        item={{
          id,
          name: product.name,
          price: product.price,
          imageUrl: galleryImages[0]?.src ?? product.imageUrl,
        }}
      />
      <nav
        aria-label="현재 위치"
        className="flex flex-wrap items-center gap-2 text-sm text-fg-subtle"
      >
        <Link href="/" className="inline-flex min-h-11 items-center">
          홈
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/shop/${gender}`}
          className="inline-flex min-h-11 items-center"
        >
          {gender === "women" ? "여성의류" : "남성의류"}
        </Link>
        <span aria-hidden>/</span>
        <span>
          {classification.category} · {classification.subcategory}
        </span>
      </nav>
      <div className="grid min-w-0 gap-7 md:grid-cols-2 md:gap-10">
        <ProductGallery
          images={galleryImages}
          name={product.name}
          soldOut={soldOut}
        />
        <div className="min-w-0 md:sticky md:top-6 md:self-start">
          <p className="text-sm font-semibold text-fg-muted">
            LAON SHOP · {classification.category}
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h1 className="min-w-0 break-keep text-2xl font-bold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
              {product.name}
            </h1>
            <WishlistButton productId={id} initialWished={wished} />
          </div>
          {reviews.available && reviews.total > 0 && (
            <a
              href="#reviews"
              className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium"
            >
              <span aria-hidden>★</span> {reviews.averageRating?.toFixed(1)}{" "}
              <span className="text-fg-subtle">후기 {reviews.total}개</span>
            </a>
          )}
          <p className="mt-5 text-3xl font-bold tracking-tight">
            {formatKrw(product.price)}
          </p>
          <dl
            className="my-6 space-y-1 border-y border-line py-4 text-sm"
            aria-label="구매 안내"
          >
            <div className="grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4">
              <dt className="w-16 shrink-0 text-fg-subtle">배송비</dt>
              <dd className="min-w-0 font-semibold leading-6">무료배송</dd>
            </div>
            <div className="grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4">
              <dt className="w-16 shrink-0 text-fg-subtle">출고 안내</dt>
              <dd className="min-w-0 break-keep leading-6 [overflow-wrap:anywhere]">
                결제 확인 후 영업일 2~3일 내 출고
              </dd>
            </div>
            <div className="grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4">
              <dt className="w-16 shrink-0 text-fg-subtle">교환·반품</dt>
              <dd className="min-w-0 leading-6">
                <Link
                  href="/policy/refund"
                  className="inline-flex min-h-11 min-w-11 max-w-full items-center break-keep leading-6 underline underline-offset-4 [overflow-wrap:anywhere]"
                >
                  수령 후 7일 이내 신청 안내
                </Link>
              </dd>
            </div>
          </dl>
          <a
            href="#size-guide"
            className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            사이즈표·측정 방법 보기
          </a>
          <AddToCart
            product={{
              id,
              name: product.name,
              price: product.price,
              imageUrl: galleryImages[0]?.src ?? product.imageUrl,
            }}
            sizes={sizes}
            soldOut={soldOut}
          />
          <p className="mt-4 text-sm leading-relaxed text-fg-subtle">
            주문내역에서 결제 상태와 배송 정보를 확인할 수 있습니다.
          </p>
        </div>
      </div>
      <nav
        aria-label="상품 상세 메뉴"
        className="sticky top-0 z-20 grid grid-cols-3 border-y border-line bg-void"
      >
        {[
          ["#details", "상품정보"],
          [
            "#reviews",
            `구매후기${reviews.available ? ` (${reviews.total})` : ""}`,
          ],
          ["#shipping", "배송·교환·반품"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="flex min-h-14 min-w-0 items-center justify-center px-2 text-center text-sm font-semibold hover:bg-raised"
          >
            {label}
          </a>
        ))}
      </nav>
      <section
        id="details"
        className="scroll-mt-60 space-y-6"
        aria-labelledby="details-title"
      >
        <ProductSizeGuide
          name={product.name}
          category={product.category}
          gender={product.gender}
          sizes={sizes}
        />
        <h2 id="details-title" className="text-xl font-bold">
          상품정보
        </h2>
        {product.description && (
          <p className="max-w-3xl whitespace-pre-wrap leading-relaxed text-fg-muted [overflow-wrap:anywhere]">
            {product.description}
          </p>
        )}
        <div className="mx-auto max-w-3xl space-y-3">
          {galleryImages.slice(1).map((image) => (
            <div key={image.src} className="relative aspect-[4/5] bg-raised">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </section>
      <ProductReviews
        productId={id}
        loggedIn={Boolean(user)}
        available={reviews.available && reviewable.available}
        total={reviews.total}
        averageRating={reviews.averageRating}
        reviews={reviews.reviews.map((review) => ({
          ...review,
          createdAt: review.createdAt.toISOString(),
        }))}
        items={reviewable.items}
      />
      {showReviewExamples() && (
        <ReviewExamples
          data={getReviewExamples(`${product.name}:${product.imageUrl ?? ""}`)}
        />
      )}
      <section
        id="shipping"
        className="scroll-mt-60"
        aria-label="배송·교환·반품 안내"
      >
        <ProductInfoSections category={product.category} />
      </section>
      {related.length > 0 && (
        <section className="space-y-5 border-t border-line pt-8">
          <h2 className="text-xl font-bold">함께 둘러보세요</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name}
                price={p.price}
                imageUrl={p.imageUrl}
                eyebrow={p.category ?? undefined}
                soldOut={p.stock <= 0}
              />
            ))}
          </div>
        </section>
      )}
      <RecentProducts excludeId={id} />
    </div>
  );
}
