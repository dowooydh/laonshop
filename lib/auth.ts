import { prisma, type ShopUser } from "@/lib/db";
import { redirect } from "next/navigation";
import { getSession } from "./session";

/** 로그인 필수 (주문/결제/마이페이지) — 미인증 시 로그인으로 */
export async function requireShopUser(): Promise<ShopUser> {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const user = await prisma.shopUser.findUnique({ where: { id: session.userId } });
  if (!user) {
    session.destroy();
    redirect("/login");
  }
  return user;
}

/** 선택 — 헤더 로그인 상태 표시용 (비로그인 둘러보기 허용) */
export async function getShopUser(): Promise<ShopUser | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.shopUser.findUnique({ where: { id: session.userId } });
}
