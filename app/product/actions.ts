"use server";
// 위시리스트(찜) 토글 — 비로그인 클릭 시 requireShopUser가 /login으로 보낸다
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireShopUser } from "@/lib/auth";

export async function toggleWishlistAction(productId: string): Promise<{ wished: boolean }> {
  const user = await requireShopUser();

  const existing = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });
  if (existing) {
    await prisma.wishlist.delete({ where: { id: existing.id } });
  } else {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) return { wished: false };
    await prisma.wishlist.create({ data: { userId: user.id, productId } });
  }
  revalidatePath("/mypage");
  return { wished: !existing };
}
