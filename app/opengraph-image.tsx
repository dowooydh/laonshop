import { ImageResponse } from "next/og";

// 공유 카드 기본 이미지 — 다크 보이드 위 발광 워드마크 (브랜드 톤 그대로, 외부 에셋 불필요)
export const alt = "LAON SHOP — 미래를 입다";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#05060a",
          position: "relative",
        }}
      >
        {/* 히어로 메시 그라디언트 축약판 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 80% at 12% 10%, rgba(79,209,255,0.28), transparent 60%), radial-gradient(50% 70% at 88% 20%, rgba(139,92,255,0.3), transparent 62%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 132, fontWeight: 800, letterSpacing: -6 }}>
          <span style={{ color: "#f4f6fb" }}>LAON</span>
          <span style={{ color: "#4fd1ff", textShadow: "0 0 48px rgba(79,209,255,0.65)" }}>SHOP</span>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            letterSpacing: 14,
            color: "#9aa3b2",
          }}
        >
          WEAR THE FUTURE
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            fontSize: 22,
            letterSpacing: 4,
            color: "#5c6577",
          }}
        >
          laonshop.com
        </div>
      </div>
    ),
    size,
  );
}
