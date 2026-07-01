// LAON SHOP 더미 의류 상품 시드 (카드사 심사용 + 실판매). ㈜커스텀오더.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS = [
  { name: "오버핏 코튼 반팔 티셔츠", price: 29000, category: "상의", sizes: "S,M,L,XL", description: "도톰한 코튼 원단의 데일리 오버핏 티셔츠." },
  { name: "와이드 데님 팬츠", price: 49000, category: "하의", sizes: "26,28,30,32", description: "편안한 와이드핏 데님. 사계절 데일리." },
  { name: "베이직 후드 집업", price: 59000, category: "아우터", sizes: "M,L,XL", description: "기모 안감 후드 집업. 가볍고 따뜻하게." },
  { name: "케이블 니트 가디건", price: 45000, category: "아우터", sizes: "FREE", description: "포인트 케이블 짜임의 데일리 가디건." },
  { name: "슬림 핏 슬랙스", price: 39000, category: "하의", sizes: "S,M,L,XL", description: "깔끔한 슬림핏 슬랙스. 출근·캐주얼 모두." },
  { name: "스트라이프 셔츠", price: 35000, category: "상의", sizes: "S,M,L", description: "산뜻한 스트라이프 코튼 셔츠." },
  { name: "롱 트렌치 코트", price: 89000, category: "아우터", sizes: "M,L", description: "클래식 실루엣의 롱 트렌치 코트." },
  { name: "데일리 맨투맨", price: 32000, category: "상의", sizes: "M,L,XL", description: "부드러운 기모 맨투맨. 데일리룩 필수템." },
  { name: "코튼 치노 팬츠", price: 42000, category: "하의", sizes: "28,30,32,34", description: "탄탄한 코튼 치노. 깔끔한 일자핏." },
  { name: "캐주얼 블레이저", price: 79000, category: "아우터", sizes: "M,L", description: "세미 정장으로도 좋은 캐주얼 블레이저." },
];

async function main() {
  // 더미 데이터 초기화 (주문 → 상품 순)
  await prisma.shopOrderItem.deleteMany();
  await prisma.shopOrder.deleteMany();
  await prisma.product.deleteMany();

  for (const [i, p] of PRODUCTS.entries()) {
    await prisma.product.create({
      data: {
        ...p,
        sortOrder: i,
        imageUrl: `https://picsum.photos/seed/laonshop-${i + 1}/600/750`,
      },
    });
  }
  console.log(`✔ LAON SHOP 상품 ${PRODUCTS.length}개 시드 완료`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
