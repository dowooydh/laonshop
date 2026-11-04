import Image from "next/image";
import Link from "next/link";
import { formatKrw } from "@/lib/format";
import { safeProductImageUrl } from "@/lib/product-image";

/** 사진과 구매 정보를 분리해 작은 화면에서도 상품명과 가격을 읽을 수 있는 공용 카드. */
export function ProductCard({
  id,
  name,
  price,
  imageUrl,
  eyebrow,
  soldOut = false,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
}: {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  eyebrow?: string;
  soldOut?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  const safeImageUrl = safeProductImageUrl(imageUrl);

  return (
    <Link
      href={`/product/${id}`}
      className="group block min-w-0 rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-sm)] bg-overlay">
        {safeImageUrl ? (
          <Image
            src={safeImageUrl}
            alt={name}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-fg-subtle">상품 이미지 준비 중</div>
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-sm bg-black px-2.5 py-1.5 text-xs font-semibold text-white">품절</span>
        )}
      </div>
      <div className="min-w-0 space-y-1 pt-3">
        {eyebrow && <p className="break-words text-xs text-fg-muted">{eyebrow}</p>}
        <p className="line-clamp-2 min-h-10 break-keep text-sm leading-5 text-fg [overflow-wrap:anywhere] group-hover:underline">{name}</p>
        <p className="text-[16px] font-bold tracking-tight text-fg [overflow-wrap:anywhere]">{formatKrw(price)}</p>
        <p className="text-xs text-fg-subtle">무료배송</p>
      </div>
    </Link>
  );
}
