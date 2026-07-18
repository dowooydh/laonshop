import { type NextRequest, NextResponse } from "next/server";

/**
 * 세션 쿠키가 host-only이므로 www에서 등록을 시작해 apex로 복귀하면 세션이 끊긴다.
 * 모든 운영 요청을 결제 파트너 allowlist와 같은 apex origin으로 정규화한다.
 */
export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const shouldUseApex =
    hostname === "www.laonshop.com" ||
    (process.env.VERCEL_ENV === "production" && hostname !== "laonshop.com");
  if (!shouldUseApex) return NextResponse.next();
  const target = request.nextUrl.clone();
  target.protocol = "https:";
  target.hostname = "laonshop.com";
  target.port = "";
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
