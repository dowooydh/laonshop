import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { getShopUser } from "@/lib/auth";
import { Amount } from "@/lib/ui";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProductInfoSections } from "@/components/product-info";
import { RecentProducts, RecordView } from "@/components/recent-products";
import { AddToCart } from "./add-to-cart";
import { WishlistButton } from "./wishlist-button";

export const dynamic = "force-dynamic";

// generateMetadata와 페이지 본문의 중복 조회 방지
const getProduct = cache((id: string) => prisma.product.findUnique({ where: { id } }));

type GalleryProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
  gender: string | null;
  sortOrder: number;
};

type GalleryProfile = {
  kind: string;
  family: string;
};

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function getGalleryProfile(product: GalleryProduct): GalleryProfile {
  const name = product.name;

  switch (product.category) {
    case "상의":
      if (hasAny(name, ["셔츠", "블라우스"])) return { kind: "shirt", family: "top" };
      if (hasAny(name, ["니트", "가디건", "베스트", "터틀넥", "브이넥", "스웨터"])) {
        return { kind: "knit", family: "top" };
      }
      if (hasAny(name, ["맨투맨", "후디"])) return { kind: "sweat", family: "top" };
      return { kind: "tee", family: "top" };
    case "아우터":
      if (hasAny(name, ["코트", "트렌치", "파카"])) return { kind: "coat", family: "outer" };
      if (hasAny(name, ["베스트"])) return { kind: "vest", family: "outer" };
      return { kind: "jacket", family: "outer" };
    case "하의":
      if (hasAny(name, ["쇼츠"])) return { kind: "shorts", family: "bottom" };
      if (hasAny(name, ["스커트"])) return { kind: "skirt", family: "bottom" };
      if (hasAny(name, ["데님", "진", "스키니진"])) return { kind: "denim", family: "bottom" };
      return { kind: "pants", family: "bottom" };
    case "원피스/스커트":
      if (hasAny(name, ["스커트"])) return { kind: "skirt", family: "bottom" };
      return { kind: "dress", family: "bottom" };
    case "신발":
      if (hasAny(name, ["스니커즈", "로우탑", "하이탑", "트레이너", "러너", "스케이트", "슈즈"])) {
        return { kind: "sneaker", family: "shoes" };
      }
      if (hasAny(name, ["로퍼", "더비", "메리제인"])) return { kind: "loafer", family: "shoes" };
      if (hasAny(name, ["부츠", "앵클부츠", "첼시"])) return { kind: "boots", family: "shoes" };
      if (hasAny(name, ["샌들", "슬라이드", "에스파듀"])) return { kind: "sandal", family: "shoes" };
      return { kind: "heel-flat", family: "shoes" };
    case "가방":
      if (hasAny(name, ["백팩", "짐색"])) return { kind: "backpack", family: "bag" };
      if (hasAny(name, ["토트백", "에코백"])) return { kind: "tote", family: "bag" };
      if (hasAny(name, ["더플백", "위켄더백"])) return { kind: "duffle", family: "bag" };
      if (hasAny(name, ["브리프케이스", "파우치", "클러치", "클러치백", "슬리브", "카메라백"])) {
        return { kind: "case", family: "bag" };
      }
      return { kind: "crossbody", family: "bag" };
    case "액세서리":
      if (hasAny(name, ["볼캡", "비니", "버킷햇", "베레모", "캡"])) return { kind: "hat", family: "accessory" };
      if (hasAny(name, ["네크리스", "링", "팔찌", "이어링", "세트"])) {
        return { kind: "jewelry", family: "accessory" };
      }
      if (hasAny(name, ["시계", "손목시계"])) return { kind: "watch", family: "accessory" };
      if (hasAny(name, ["선글라스"])) return { kind: "eyewear", family: "accessory" };
      if (hasAny(name, ["머플러", "스카프"])) return { kind: "scarf", family: "accessory" };
      if (hasAny(name, ["벨트", "지갑", "카드지갑"])) return { kind: "leather", family: "accessory" };
      if (hasAny(name, ["삭스", "양말", "장갑"])) return { kind: "soft", family: "accessory" };
      if (hasAny(name, ["헤어", "클립"])) return { kind: "hair", family: "accessory" };
      if (hasAny(name, ["넥타이"])) return { kind: "tie", family: "accessory" };
      return { kind: "accessory", family: "accessory" };
    case "홈웨어":
      if (hasAny(name, ["가운", "로브"])) return { kind: "robe", family: "home" };
      if (hasAny(name, ["슬리퍼", "양말", "홈삭스"])) return { kind: "slipper-socks", family: "home" };
      if (hasAny(name, ["안대", "마스크", "헤어밴드"])) return { kind: "home-small", family: "home" };
      if (hasAny(name, ["블랭킷"])) return { kind: "blanket", family: "home" };
      return { kind: "lounge", family: "home" };
    case "스포츠":
      if (hasAny(name, ["자켓", "바람막이", "베스트"])) return { kind: "sport-outer", family: "sport" };
      if (hasAny(name, ["팬츠", "쇼츠", "레깅스", "스커트"])) return { kind: "sport-bottom", family: "sport" };
      if (hasAny(name, ["캡", "헤드밴드", "글러브", "삭스", "레그워머"])) {
        return { kind: "sport-accessory", family: "sport" };
      }
      if (hasAny(name, ["매트", "블록", "세트"])) return { kind: "sport-gear", family: "sport" };
      return { kind: "sport-top", family: "sport" };
    default:
      return { kind: product.category ?? "product", family: product.category ?? "product" };
  }
}

function tokenizeProductName(name: string) {
  return name
    .toLowerCase()
    .split(/[\s/·]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreGalleryImage(product: GalleryProduct, candidate: GalleryProduct) {
  const productProfile = getGalleryProfile(product);
  const candidateProfile = getGalleryProfile(candidate);
  const productTokens = tokenizeProductName(product.name);
  const productTokenSet = new Set(productTokens);
  const candidateTokens = tokenizeProductName(candidate.name);
  const overlap = candidateTokens.filter((token) => productTokenSet.has(token)).length;
  const sameItemType = productTokens.at(-1) === candidateTokens.at(-1) ? 1 : 0;
  const nearby = Math.max(0, 8 - Math.abs(product.sortOrder - candidate.sortOrder));

  return (
    (product.category === candidate.category ? 32 : 0) +
    (productProfile.kind === candidateProfile.kind ? 24 : 0) +
    (productProfile.family === candidateProfile.family ? 12 : 0) +
    overlap * 12 +
    sameItemType * 8 +
    nearby
  );
}

function buildGalleryImages(product: GalleryProduct, galleryCandidates: GalleryProduct[]) {
  const images: { src: string; alt: string }[] = [];
  const seen = new Set<string>();
  const pushImage = (src: string | null, alt: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    images.push({ src, alt });
  };

  pushImage(product.imageUrl, `${product.name} 대표 이미지`);

  const productProfile = getGalleryProfile(product);
  const candidates = galleryCandidates
    .filter((candidate) => candidate.id !== product.id && candidate.imageUrl && candidate.gender === product.gender)
    .sort((a, b) => {
      const scoreDiff = scoreGalleryImage(product, b) - scoreGalleryImage(product, a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.sortOrder - b.sortOrder;
    });
  const addMatching = (match: (candidate: GalleryProduct) => boolean) => {
    for (const candidate of candidates) {
      const before = images.length;
      if (match(candidate)) pushImage(candidate.imageUrl, `${product.name} 스타일링 컷`);
      if (images.length !== before && images.length >= 5) return;
    }
  };

  // 품목명 기준으로 먼저 맞추고, 부족한 경우에만 같은 카테고리 안의 호환 품목군으로 보강한다.
  addMatching((candidate) => {
    const profile = getGalleryProfile(candidate);
    return candidate.category === product.category && profile.kind === productProfile.kind;
  });
  if (images.length < 5) {
    addMatching((candidate) => {
      const profile = getGalleryProfile(candidate);
      return profile.family === productProfile.family && profile.kind === productProfile.kind;
    });
  }
  if (images.length < 5) {
    addMatching((candidate) => {
      const profile = getGalleryProfile(candidate);
      return candidate.category === product.category && profile.family === productProfile.family;
    });
  }

  return images;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product || !product.active) return { title: "상품을 찾을 수 없습니다" };
  const description = `${product.name} — ${product.description ?? "LAON SHOP 셀렉트"} ${formatKrw(product.price)}`;
  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product || !product.active) notFound();

  const sizes = (product.sizes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const soldOut = product.stock <= 0;
  const gender = product.gender === "women" ? "women" : "men";
  const genderLabel = gender === "women" ? "여성의류" : "남성의류";

  const galleryCandidates = await prisma.product.findMany({
    where: { gender: product.gender, active: true, id: { not: product.id } },
    orderBy: { sortOrder: "asc" },
  });
  const galleryImages = buildGalleryImages(product, galleryCandidates);
  const related = galleryCandidates.filter((candidate) => candidate.category === product.category).slice(0, 4);

  const user = await getShopUser();
  const wished = user
    ? !!(await prisma.wishlist.findUnique({
        where: { userId_productId: { userId: user.id, productId: product.id } },
      }))
    : false;

  // 검색 리치 스니펫 + '실제 커머스' 신호 (가격은 정수 원 그대로)
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
      availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RecordView item={{ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl }} />

      <Link
        href={`/shop/${gender}`}
        className="group inline-flex items-center gap-2 font-mono text-step--1 uppercase tracking-widest text-fg-subtle transition-colors hover:text-fg-muted"
      >
        <span className="transition-transform group-hover:-translate-x-0.5">←</span>
        {genderLabel}
      </Link>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
        {/* 이미지 패널 */}
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised p-3 shadow-elev2 md:p-4">
            <div className="pointer-events-none absolute -inset-x-16 -top-24 h-56 bg-accent-cyan/10 blur-3xl" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] bg-overlay shadow-glow-cyan">
              {galleryImages[0] && (
                <Image
                  src={galleryImages[0].src}
                  alt={galleryImages[0].alt}
                  fill
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              )}
              {soldOut && (
                <div className="absolute inset-0 flex items-center justify-center bg-void/60">
                  <span className="font-mono text-step-0 uppercase tracking-[0.3em] text-fg">Sold Out</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 상세 */}
        <div className="flex flex-col md:py-2">
          <div className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">
            {product.category}
          </div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <h1 className="font-display text-step-3 font-bold leading-tight tracking-tight text-fg">
              {product.name}
            </h1>
            <WishlistButton productId={product.id} initialWished={wished} />
          </div>

          <div className="mt-5 flex items-baseline gap-1">
            <Amount value={product.price} className="text-step-2 text-fg" />
          </div>

          {/* 전상법 제13조 — 계약 전 배송비·소요기간 고지 (아코디언 외 상시 노출) */}
          <p className="mt-2 font-mono text-step--1 text-fg-subtle">
            무료배송 · 결제 확인 후 영업일 2~3일 내 출고
          </p>

          {product.description && (
            <p className="mt-6 whitespace-pre-wrap text-step-0 leading-relaxed text-fg-muted">
              {product.description}
            </p>
          )}

          {/* 같은 카테고리의 실제 착용·스타일링 컷을 섞어 원본 확대/크롭처럼 보이지 않게 구성한다. */}
          {galleryImages.length > 1 && (
            <div className="mt-8 space-y-4 border-t border-line pt-8">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-step--1 uppercase tracking-widest text-fg-subtle">Looks</p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
                  {galleryImages.length} photos
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {galleryImages.slice(1).map((image, index) => (
                  <div
                    key={`${image.src}-${index}`}
                    className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] border border-line bg-overlay"
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover"
                    />
                    <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-line bg-void/55 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-fg-subtle backdrop-blur">
                      {String(index + 2).padStart(2, "0")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-line pt-8">
            <AddToCart
              product={{ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl }}
              sizes={sizes}
              soldOut={soldOut}
            />
          </div>

          <ProductInfoSections category={product.category} />
        </div>
      </div>

      {/* 연관 상품 — 상세 dead-end 방지 (같은 젠더·카테고리) */}
      {related.length > 0 && (
        <section className="border-t border-line pt-8">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-step-1 font-bold tracking-tight text-fg">함께 볼 만한</h2>
            <Link
              href={`/shop/${gender}`}
              className="font-mono text-step--1 uppercase tracking-widest text-fg-subtle transition-colors hover:text-accent-cyan"
            >
              더 보기 →
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => (
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
                    sizes="(min-width: 640px) 25vw, 50vw"
                    className="object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.06]"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void via-void/60 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="truncate text-step--1 font-semibold text-fg">{p.name}</div>
                  <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(p.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <RecentProducts excludeId={product.id} />
    </div>
  );
}
