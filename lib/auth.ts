import { prisma, type ShopUser } from "@/lib/db";
import { redirect } from "next/navigation";
import { getSession } from "./session";

/** 로그인 필수 (주문/결제/마이페이지) — 미인증·탈퇴회원은 로그인으로 */
export async function requireShopUser(): Promise<ShopUser> {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const user = await prisma.shopUser.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt) {
    // RSC 렌더 중에는 쿠키 수정이 금지라 destroy()가 throw할 수 있다(탈퇴회원 잔여 세션 등).
    // 쿠키 정리는 다음 로그인/로그아웃 액션에 맡기고 여기선 접근 차단만 보장한다.
    try {
      session.destroy();
    } catch {
      /* noop */
    }
    redirect("/login");
  }
  return user;
}

/** 선택 — 헤더 로그인 상태 표시용 (비로그인 둘러보기 허용).
 *  루트 레이아웃에서 호출되므로 절대 throw하지 않는다 — 빌드타임 프리렌더(/_not-found 등)나
 *  env 미설정 환경에서도 비로그인으로 렌더하고 빌드는 통과해야 한다. */
export async function getShopUser(): Promise<ShopUser | null> {
  try {
    const session = await getSession();
    if (!session.userId) return null;
    const user = await prisma.shopUser.findUnique({ where: { id: session.userId } });
    return user && !user.deletedAt ? user : null;
  } catch {
    return null;
  }
}
