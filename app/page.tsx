// LAON SHOP 홈 — 모델 히어로 + 남/여 게이트 + 최근 본 상품
import { HomeHero } from "@/components/home-hero";
import { GenderGate } from "@/components/gender-gate";
import { RecentProducts } from "@/components/recent-products";

export default function HomePage() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <HomeHero />

      <section className="space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <h2 className="break-keep font-display text-step-1 font-bold tracking-tight text-fg min-[360px]:text-step-2">무엇을 입을까</h2>
          <span className="shrink-0 whitespace-nowrap font-mono text-step--1 text-fg-subtle">MEN · WOMEN</span>
        </div>
        <GenderGate />
      </section>

      <RecentProducts />
    </div>
  );
}
