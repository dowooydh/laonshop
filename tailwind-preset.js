/** LAON SHOP Tailwind 테마 preset — 미래지향 다크 디자인 토큰(핸드오버 §4).
 *  실값은 globals.css의 :root CSS 변수(다크/라이트 토글 대응). 여기선 변수를 Tailwind 유틸에 매핑만 한다.
 *  ⚠️ 기본 스케일(rounded-lg 등)·기본 컬러(cyan-500 등)는 건드리지 않는다 — 미이관 페이지 호환. 전부 additive. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // 기존 brand(파랑) — 아직 이관 안 된 페이지 호환용. 페이즈 진행하며 제거.
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdbff",
          300: "#8ec4ff",
          400: "#59a3ff",
          500: "#3380ff",
          600: "#1b60f5",
          700: "#144be1",
          800: "#173db6",
          900: "#19388f",
          950: "#142357",
        },
        // §4.1 미래지향 다크 토큰 (CSS 변수 참조 → 테마 토글 시 자동 반영)
        void: "var(--bg-void)",
        base: "var(--bg-base)",
        raised: "var(--bg-raised)",
        overlay: "var(--bg-overlay)",
        line: "var(--line)",
        fg: {
          DEFAULT: "var(--fg-primary)",
          muted: "var(--fg-muted)",
          subtle: "var(--fg-subtle)",
        },
        accent: {
          cyan: "var(--accent-cyan)",
          violet: "var(--accent-violet)",
          lime: "var(--accent-lime)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Apple SD Gothic Neo",
          "Segoe UI",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "Space Grotesk",
          "Pretendard Variable",
          "Pretendard",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "Pretendard Variable",
          "Pretendard",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      // §4.2 유동 타이포 스케일(additive — 기본 text-sm 등은 그대로)
      fontSize: {
        "step--1": "var(--step--1)",
        "step-0": "var(--step-0)",
        "step-1": "var(--step-1)",
        "step-2": ["var(--step-2)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "step-3": ["var(--step-3)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        hero: ["var(--step-hero)", { lineHeight: "0.92", letterSpacing: "-0.04em" }],
      },
      borderRadius: {
        // additive: 기본 sm/md/lg/xl/2xl 는 유지, pill만 추가
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        elev1: "var(--shadow-1)",
        elev2: "var(--shadow-2)",
        "glow-cyan": "var(--glow-cyan)",
        "glow-violet": "var(--glow-violet)",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out-expo)",
        "in-out-brand": "var(--ease-in-out)",
      },
      transitionDuration: {
        fast: "180ms",
        base: "360ms",
        slow: "720ms",
        cinematic: "1200ms",
      },
      keyframes: {
        "slide-down": {
          from: { transform: "translateY(-16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: "0.7" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.36s cubic-bezier(.16,1,.3,1)",
        "fade-in": "fade-in 0.2s ease-out",
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
      },
    },
  },
};
