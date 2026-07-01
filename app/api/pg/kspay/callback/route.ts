// KSPAY 인증결과 수신(rcv) 브릿지 — KSNET이 sndReply로 POST → 부모창에 값 주입.
// reCnclType=1(사용자취소) → parent.mcancel(), 정상 → parent.eparamSet()→goResult().
import { NextResponse, type NextRequest } from "next/server";

function jsEscape(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const reCommConId = String(form.get("reCommConId") ?? "");
  const reCommType = String(form.get("reCommType") ?? "");
  const reHash = String(form.get("reHash") ?? "");
  const reCnclType = String(form.get("reCnclType") ?? "");

  const script =
    reCnclType === "1"
      ? "if (parent && parent.mcancel) parent.mcancel();"
      : [
          `parent.eparamSet(${jsEscape(reCommConId)}, ${jsEscape(reCommType)}, ${jsEscape(reHash)});`,
          "parent.goResult();",
        ].join("\n");

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"></head><body><script>${script}</script></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
