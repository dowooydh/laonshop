// LAON SHOP 상품 시드 (카드사 심사용 + 실판매). ㈜커스텀오더.
// 남/여 × 상의/하의/신발 × 10 = 60개. 이미지는 Unsplash 엄선 컷(로드 검증됨).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMG = "?w=800&q=80&auto=format&fit=crop";
const u = (id: string) => `https://images.unsplash.com/photo-${id}${IMG}`;

type Gender = "men" | "women";
type Category = "상의" | "하의" | "신발";
interface Def {
  name: string;
  price: number;
  id: string;
}

const SIZES: Record<Category, Record<Gender, string>> = {
  상의: { men: "S,M,L,XL", women: "S,M,L" },
  하의: { men: "28,30,32,34", women: "25,26,27,28" },
  신발: { men: "250,260,270,280", women: "230,240,250,260" },
};

const CATALOG: Record<Gender, Record<Category, Def[]>> = {
  men: {
    상의: [
      { name: "옥스포드 코튼 셔츠", price: 39000, id: "1607345366928-199ea26cfe3e" },
      { name: "오버핏 반팔 티셔츠", price: 25000, id: "1602810320073-1230c46d89d4" },
      { name: "미니멀 크루넥 니트", price: 59000, id: "1602810316693-3667c854239a" },
      { name: "링클프리 드레스 셔츠", price: 45000, id: "1603252110481-7ba873bf42ab" },
      { name: "스트라이프 옥스포드 셔츠", price: 42000, id: "1521572163474-6864f9cf17ab" },
      { name: "헤비웨이트 맨투맨", price: 38000, id: "1740711152088-88a009e877bb" },
      { name: "슬림핏 폴로 셔츠", price: 34000, id: "1602810318383-e386cc2a3ccf" },
      { name: "워시드 데님 셔츠", price: 49000, id: "1621072156002-e2fccdc0b176" },
      { name: "베이직 롱슬리브 티", price: 22000, id: "1624835567150-0c530a20d8cc" },
      { name: "릴랙스핏 카라 니트", price: 62000, id: "1642764873654-9eef0467b342" },
    ],
    하의: [
      { name: "와이드 데님 팬츠", price: 49000, id: "1718252540511-e958742e4165" },
      { name: "슬림핏 슬랙스", price: 42000, id: "1718252540558-7b383b52642e" },
      { name: "코튼 치노 팬츠", price: 39000, id: "1552904219-f4b87efe8792" },
      { name: "카고 조거 팬츠", price: 46000, id: "1678222532251-2f303290c1e5" },
      { name: "원턱 테이퍼드 슬랙스", price: 52000, id: "1535426618342-0bbe434e7927" },
      { name: "스트레이트 데님", price: 55000, id: "1473966968600-fa801b869a1a" },
      { name: "트랙 팬츠", price: 33000, id: "1601561446301-fecc99036f4b" },
      { name: "크롭 슬랙스", price: 44000, id: "1548883354-7622d03aca27" },
      { name: "린넨 이지 팬츠", price: 48000, id: "1517184828383-bdf7e82f395f" },
      { name: "워시드 와이드 진", price: 51000, id: "1552903905-5e39e774e375" },
    ],
    신발: [
      { name: "레트로 러닝 스니커즈", price: 89000, id: "1460353581641-37baddab0fa2" },
      { name: "미니멀 레더 스니커즈", price: 119000, id: "1537261131936-3cdff36a1ac9" },
      { name: "캔버스 로우탑", price: 59000, id: "1496202703211-aa28e9500c30" },
      { name: "청키 대드 스니커즈", price: 99000, id: "1584609226397-de5612afdfea" },
      { name: "스웨이드 트레이너", price: 79000, id: "1560769629-975ec94e6a86" },
      { name: "하이탑 스니커즈", price: 85000, id: "1603808033192-082d6919d3e1" },
      { name: "클래식 더비 슈즈", price: 139000, id: "1618677831708-0e7fda3148b4" },
      { name: "매쉬 러너", price: 72000, id: "1578955220606-4a6c181aa6bb" },
      { name: "레더 로퍼", price: 129000, id: "1556774687-0e2fdd0116c0" },
      { name: "코트 스니커즈", price: 68000, id: "1615440321519-dda3d4b5ccab" },
    ],
  },
  women: {
    상의: [
      { name: "실크 새틴 블라우스", price: 59000, id: "1708533096181-dab486856499" },
      { name: "퍼프 슬리브 블라우스", price: 48000, id: "1620062161349-7abc66286084" },
      { name: "오버핏 니트 베스트", price: 42000, id: "1765365353704-ed0b6e1b11c2" },
      { name: "스퀘어넥 크롭 탑", price: 32000, id: "1761117228880-df2425bd70da" },
      { name: "프릴 셔링 블라우스", price: 45000, id: "1613891737415-be7670d21c19" },
      { name: "케이블 니트 가디건", price: 62000, id: "1761121317492-57feee4fc674" },
      { name: "볼륨 슬리브 셔츠", price: 39000, id: "1611235116156-0cbda6649efb" },
      { name: "리본 타이 블라우스", price: 52000, id: "1770294758906-c8762abb2c8b" },
      { name: "슬림 립 니트", price: 29000, id: "1620062213761-9af24c959624" },
      { name: "코튼 셔츠 블라우스", price: 38000, id: "1772037869794-d1bcfd2a8e36" },
    ],
    하의: [
      { name: "하이웨이스트 스키니진", price: 46000, id: "1602293589930-45aad59ba3ab" },
      { name: "와이드 데님 팬츠", price: 49000, id: "1714143136372-ddaf8b606da7" },
      { name: "플레어 슬랙스", price: 52000, id: "1541099649105-f69ad21f3246" },
      { name: "프론트턱 와이드 팬츠", price: 54000, id: "1605518216938-7c31b7b14ad0" },
      { name: "부츠컷 데님", price: 51000, id: "1714143136367-7bb68f3f0669" },
      { name: "A라인 미디 스커트", price: 44000, id: "1560243563-062bfc001d68" },
      { name: "테이퍼드 슬랙스", price: 42000, id: "1713880453396-aa0493e308ec" },
      { name: "코튼 벌룬 팬츠", price: 47000, id: "1598554747436-c9293d6a588f" },
      { name: "스트레이트 진", price: 48000, id: "1637069585336-827b298fe84a" },
      { name: "플리츠 롱스커트", price: 56000, id: "1542272604-787c3835535d" },
    ],
    신발: [
      { name: "스트랩 슬링백", price: 79000, id: "1519415943484-9fa1873496d4" },
      { name: "포인티드 펌프스", price: 89000, id: "1621996659490-3275b4d0d951" },
      { name: "청키 로퍼", price: 72000, id: "1560343090-f0409e92791a" },
      { name: "미니멀 스니커즈", price: 65000, id: "1637003833874-971d4da7eea6" },
      { name: "앵클 스트랩 힐", price: 82000, id: "1499013819532-e4ff41b00669" },
      { name: "스퀘어토 플랫", price: 58000, id: "1543163521-1bf539c55dd2" },
      { name: "레더 메리제인", price: 76000, id: "1535043934128-cf0b28d52f95" },
      { name: "로우힐 뮬", price: 69000, id: "1531310197839-ccf54634509e" },
      { name: "첼시 부츠", price: 98000, id: "1670938258821-2956d4ce9c9b" },
      { name: "발레 플랫", price: 54000, id: "1632761298177-51e35403e27e" },
    ],
  },
};

const DESC: Record<Category, string> = {
  상의: "데일리로 입기 좋은 ㈜커스텀오더 셀렉트 상의.",
  하의: "실루엣을 살린 ㈜커스텀오더 셀렉트 하의.",
  신발: "코디를 완성하는 ㈜커스텀오더 셀렉트 슈즈.",
};

async function main() {
  // 초기화 (주문 → 상품 순)
  await prisma.shopOrderItem.deleteMany();
  await prisma.shopOrder.deleteMany();
  await prisma.product.deleteMany();

  const genders: Gender[] = ["men", "women"];
  const cats: Category[] = ["상의", "하의", "신발"];
  let sort = 0;
  let count = 0;

  for (const gender of genders) {
    for (const cat of cats) {
      for (const def of CATALOG[gender][cat]) {
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
      }
    }
  }

  console.log(`✔ LAON SHOP 상품 ${count}개 시드 완료 (남/여 × 상의/하의/신발 × 10)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
