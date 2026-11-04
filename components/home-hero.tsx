import Image from "next/image";
import Link from "next/link";
import { safeProductImageUrl } from "@/lib/product-image";

type HeroProduct = { id: string; name: string; imageUrl: string | null };

export function HomeHero({ products = [] }: { products?: HeroProduct[] }) {
  return (
    <section aria-labelledby="home-title" className="grid overflow-hidden rounded-[var(--radius-md)] bg-[#edf0f3] md:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col items-start justify-center px-6 py-9 sm:px-10 md:py-12 lg:px-14">
        <p className="text-sm font-semibold text-[#475569]">매일 입고 싶은 옷을 고르는 곳</p>
        <h1 id="home-title" className="mt-3 break-keep text-3xl font-bold leading-tight tracking-[-0.04em] text-[#111827] sm:text-4xl lg:text-5xl">
          나다운 옷,<br />새로운 일상.
        </h1>
        <p className="mt-4 max-w-sm break-keep text-sm leading-6 text-[#475569] sm:text-[16px]">
          편하게 손이 가는 기본부터 눈길이 가는 한 벌까지.<br className="hidden sm:block" /> 라온샵에서 오늘의 취향을 찾아보세요.
        </p>
        <div className="mt-6 flex w-full max-w-sm flex-wrap gap-2">
          <Link href="/shop/women" className="inline-flex min-h-12 min-w-24 flex-1 items-center justify-center rounded-[var(--radius-sm)] bg-black px-5 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2">여성의류 보기</Link>
          <Link href="/shop/men" className="inline-flex min-h-12 min-w-24 flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-[#cbd5e1] bg-white px-5 py-3 text-sm font-semibold text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2">남성의류 보기</Link>
        </div>
      </div>
      <div className="grid min-h-64 grid-cols-2 gap-2 px-4 pb-4 sm:min-h-80 sm:gap-3 md:px-5 md:py-5">
        {products.slice(0, 2).map((product, index) => {
          const src = safeProductImageUrl(product.imageUrl);
          return (
            <Link href={`/product/${product.id}`} key={product.id} className={`relative block min-h-64 overflow-hidden rounded-[var(--radius-sm)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan sm:min-h-80 ${index === 1 ? "mt-7" : "mb-7"}`}>
              {src && <Image src={src} alt={product.name} fill priority sizes="(min-width: 768px) 30vw, 50vw" className="object-cover" />}
              <span className="absolute inset-x-0 bottom-0 bg-white/95 px-3 py-2 text-xs font-medium text-[#111827] [overflow-wrap:anywhere]">{product.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
