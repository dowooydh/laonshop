// 디스플레이/모노 폰트는 next/font로 self-host(FOUT 방지). 본문 한글은 Pretendard(globals.css @import) 유지.
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

/** 디스플레이/키네틱 헤드라인 — 미래지향 지오메트릭 그로테스크 (§4.2) */
export const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

/** 스펙·가격 강조 모노 (§4.2) */
export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
