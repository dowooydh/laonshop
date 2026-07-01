import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryShop } from "@/components/category-shop";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { men: "남성의류", women: "여성의류" };

export async function generateMetadata({ params }: { params: Promise<{ gender: string }> }): Promise<Metadata> {
  const { gender } = await params;
  const label = LABEL[gender];
  return { title: label ? `${label} · LAON SHOP` : "LAON SHOP" };
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
  }));

  return <CategoryShop gender={gender} label={LABEL[gender]} products={cards} />;
}
