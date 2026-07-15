// 공용 상품 카드 — 검색·추천 그리드용 (서버 컴포넌트 호환, 모션 없는 버전).
// 카테고리 뷰(category-shop.tsx)는 탭 전환 애니메이션 때문에 자체 카드 유지.
import Image from "next/image";
import Link from "next/link";
import { formatKrw } from "@/lib/format";
import { safeProductImageUrl } from "@/lib/product-image";

export function ProductCard({
  id,
  name,
  price,
  imageUrl,
  eyebrow,
  soldOut = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
}: {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  eyebrow?: string;
  soldOut?: boolean;
  sizes?: string;
}) {
  const safeImageUrl = safeProductImageUrl(imageUrl);

  return (
    <Link
      href={`/product/${id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised transition-[border-color,box-shadow] duration-base hover:border-accent-cyan hover:shadow-glow-cyan"
    >
      {safeImageUrl && (
        <Image
          src={safeImageUrl}
          alt={name}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.02]"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void via-void/60 to-transparent" />
      {soldOut && (
        <div className="absolute inset-0 flex items-center justify-center bg-void/60">
          <span className="whitespace-nowrap font-mono text-step--1 uppercase tracking-[0.3em] text-fg">Sold Out</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        {eyebrow && (
          <div className="truncate whitespace-nowrap font-mono text-[11px] uppercase tracking-widest text-fg-subtle">{eyebrow}</div>
        )}
        <div className="truncate text-step-0 font-semibold text-fg">{name}</div>
        <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(price)}</div>
      </div>
    </Link>
  );
}
