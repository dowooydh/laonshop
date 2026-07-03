// LAON SHOP 상품 시드 (카드사 심사용 + 실판매). ㈜커스텀오더.
// 상품 데이터는 prisma/catalog.ts(SSOT) — 이미지 Unsplash 큐레이션(비전 검증 완료).
import { PrismaClient } from "@prisma/client";
import { CATALOG, DESC, SIZES, u, type Category, type Gender } from "./catalog";

const prisma = new PrismaClient();

async function main() {
  // 초기화 (주문·찜 → 상품 순 — FK 제약)
  await prisma.shopOrderItem.deleteMany();
  await prisma.shopOrder.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.product.deleteMany();

  let sort = 0;
  let count = 0;
  const perCat: Record<string, number> = {};

  for (const gender of ["men", "women"] as Gender[]) {
    for (const [cat, defs] of Object.entries(CATALOG[gender]) as [Category, { name: string; price: number; id: string }[]][]) {
      for (const def of defs) {
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
        count++;
        perCat[`${gender}/${cat}`] = (perCat[`${gender}/${cat}`] ?? 0) + 1;
      }
    }
  }

  console.log(`✔ LAON SHOP 상품 ${count}개 시드 완료`);
  for (const [k, n] of Object.entries(perCat)) console.log(`   ${k}: ${n}개`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
