import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryShop } from "@/components/category-shop";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { men: "남성의류", women: "여성의류" };

export async function generateMetadata({ params }: { params: Promise<{ gender: string }> }): Promise<Metadata> {
  const { gender } = await params;
  const label = LABEL[gender];
  if (!label) return {};
  return {
    title: label,
    description: `LAON SHOP ${label} — 상의·하의·신발 셀렉트. 전 상품 무료배송.`,
  };
}

export default async function ShopGenderPage({ params }: { params: Promise<{ gender: string }> }) {
  const { gender } = await params;
  if (gender !== "men" && gender !== "women") notFound();

  const products = await prisma.product.findMany({
    where: { gender, active: true },
    orderBy: { sortOrder: "asc" },
  });

  const cards = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    category: p.category,
    soldOut: p.stock <= 0,
    createdAt: p.createdAt.toISOString(),
  }));

  return <CategoryShop gender={gender} label={LABEL[gender]} products={cards} />;
}
