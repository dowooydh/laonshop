// 전역 필름 그레인 오버레이 (§2 원칙 5) — 3D/그라디언트가 무균질하게 보이지 않도록 미세 노이즈.
// 정적(애니메이션 없음)이라 reduced-motion 영향 없음. pointer-events:none, mix-blend-overlay.
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.045] mix-blend-overlay"
      style={{ backgroundImage: NOISE, backgroundSize: "140px 140px" }}
    />
  );
}
