// LAON SHOP 홈 — 모델 히어로 + 남/여 게이트
import { HomeHero } from "@/components/home-hero";
import { GenderGate } from "@/components/gender-gate";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <HomeHero />

      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-step-2 font-bold tracking-tight text-fg">무엇을 입을까</h2>
          <span className="font-mono text-step--1 text-fg-subtle">MEN · WOMEN</span>
        </div>
        <GenderGate />
      </section>
    </div>
  );
}
