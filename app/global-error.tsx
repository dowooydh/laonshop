"use client";

// 루트 레이아웃 자체가 죽었을 때의 최후 방어선 — globals.css가 없으므로 인라인 스타일로 다크 톤 유지.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#05060a",
          color: "#f4f6fb",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: "monospace", fontSize: 13, letterSpacing: "0.3em", color: "#ff5c7a" }}>ERROR</p>
        <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 700 }}>문제가 발생했습니다</h1>
        <p style={{ marginTop: 8, color: "#9aa3b2" }}>잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 28,
            padding: "12px 24px",
            borderRadius: 14,
            border: "none",
            background: "#4fd1ff",
            color: "#05060a",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
