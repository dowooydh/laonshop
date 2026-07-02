import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const BASE = "https://laonshop.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, createdAt: true },
  });

  const staticPaths: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/shop/men`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/shop/women`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/policy/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policy/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policy/refund`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/policy/shipping`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...staticPaths,
    ...products.map((p) => ({
      url: `${BASE}/product/${p.id}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
