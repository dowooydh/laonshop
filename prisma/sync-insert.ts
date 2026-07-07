// 카탈로그 확장분 insert-only 싱크 — 기존 상품 ID·주문·계정 보존 (destructive seed 대신 사용).
// 실행: pnpm tsx prisma/sync-insert.ts
import { PrismaClient } from "@prisma/client";
import { CATALOG, DESC, SIZES, u, type Category, type Gender } from "./catalog";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.product.findMany({ select: { name: true, gender: true, category: true } });
  const seen = new Set(existing.map((p) => `${p.gender}|${p.category}|${p.name}`));
  const maxSort = (await prisma.product.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;

  let sort = maxSort + 1;
  let inserted = 0;
  for (const gender of ["men", "women"] as Gender[]) {
    for (const [cat, defs] of Object.entries(CATALOG[gender]) as [Category, { name: string; price: number; id: string }[]][]) {
      for (const def of defs) {
        const key = `${gender}|${cat}|${def.name}`;
        if (seen.has(key)) continue;
        await prisma.product.create({
          data: {
            name: def.name,
            description: DESC[cat],
            price: def.price,
            imageUrl: u(def.id),
            category: cat,
            gender,
            sizes: SIZES[cat][gender],
            sortOrder: sort++,
          },
        });
        seen.add(key);
        inserted++;
      }
    }
  }
  const total = await prisma.product.count();
  console.log(`✔ 신규 ${inserted}개 삽입 → DB 총 ${total}개`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
