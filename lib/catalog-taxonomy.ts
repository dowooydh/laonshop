/** 판매 상품의 원본 분류·SKU를 보존하면서 쇼핑용 분류를 만든다. 무작위 수량은 표시하지 않는다. */
export const STORE_CATEGORY_ORDER = [
  "상의", "하의", "아우터", "원피스", "스커트", "신발", "가방", "모자", "주얼리", "패션잡화", "홈웨어", "운동용품", "홈리빙", "이너웨어",
] as const;

export type CatalogClassification = { category: string; subcategory: string };
export type ClassifiableProduct = { name: string; category: string | null };

function top(name: string): CatalogClassification {
  if (/가디건|니트|스웨터/.test(name)) return { category: "상의", subcategory: "니트·가디건" };
  if (/후디|후드|맨투맨|스웨트|스웻/.test(name)) return { category: "상의", subcategory: "맨투맨·후디" };
  if (/셔츠|블라우스/.test(name) && !/티셔츠/.test(name)) return { category: "상의", subcategory: "셔츠·블라우스" };
  return { category: "상의", subcategory: "티셔츠·탑" };
}

function bottom(name: string): CatalogClassification {
  if (/레깅스|트레이닝|조거|스웨트|스웻|트랙/.test(name)) return { category: "하의", subcategory: "트레이닝·레깅스" };
  if (/쇼츠|반바지/.test(name)) return { category: "하의", subcategory: "반바지" };
  if (/데님|스키니진|와이드 진|스트레이트 진|슬림 진|워시 진/.test(name)) return { category: "하의", subcategory: "데님" };
  if (/슬랙스|트라우저/.test(name)) return { category: "하의", subcategory: "슬랙스" };
  return { category: "하의", subcategory: "캐주얼 팬츠" };
}

function outer(name: string): CatalogClassification {
  if (/코트|트렌치|파카/.test(name)) return { category: "아우터", subcategory: "코트·트렌치" };
  if (/패딩|다운|푸퍼|베스트/.test(name)) return { category: "아우터", subcategory: "패딩·베스트" };
  if (/윈드|바람막이|러닝 자켓|플리스|후리스|레인|아노락/.test(name)) return { category: "아우터", subcategory: "바람막이·플리스" };
  return { category: "아우터", subcategory: "자켓·집업" };
}

function shoes(name: string): CatalogClassification {
  if (/부츠/.test(name)) return { category: "신발", subcategory: "부츠" };
  if (/샌들|슬리퍼|뮬|에스파듀/.test(name)) return { category: "신발", subcategory: "샌들·슬리퍼" };
  if (/스니커즈|러너|러닝|트레이너|로우탑|하이탑|스케이트/.test(name)) return { category: "신발", subcategory: "스니커즈" };
  return { category: "신발", subcategory: "구두·로퍼" };
}

function accessories(name: string): CatalogClassification {
  if (/캡|볼캡|비니|버킷햇|베레모/.test(name)) return { category: "모자", subcategory: /비니|베레모/.test(name) ? "비니·베레모" : /버킷/.test(name) ? "버킷햇" : "볼캡" };
  if (/네크리스|팔찌|이어링|링 세트|실버 링/.test(name)) return { category: "주얼리", subcategory: /네크리스/.test(name) ? "목걸이" : /이어링/.test(name) ? "귀걸이" : /팔찌/.test(name) ? "팔찌" : "반지" };
  if (/선글라스/.test(name)) return { category: "패션잡화", subcategory: "선글라스" };
  if (/시계/.test(name)) return { category: "패션잡화", subcategory: "시계" };
  if (/벨트|지갑/.test(name)) return { category: "패션잡화", subcategory: "벨트·지갑" };
  if (/머플러|스카프/.test(name)) return { category: "패션잡화", subcategory: "머플러·스카프" };
  if (/헤어|헤드밴드/.test(name)) return { category: "패션잡화", subcategory: "헤어 액세서리" };
  if (/삭스|양말|장갑|글러브|레그워머/.test(name)) return { category: "패션잡화", subcategory: "양말·장갑" };
  return { category: "패션잡화", subcategory: "기타 패션잡화" };
}

export function getProductClassification(product: ClassifiableProduct): CatalogClassification {
  const { name, category } = product;
  if (category === "상의") return top(name);
  if (category === "하의") return /스커트/.test(name) ? { category: "스커트", subcategory: /미니/.test(name) ? "미니 스커트" : "미디·롱 스커트" } : bottom(name);
  if (category === "아우터") return /가디건/.test(name) ? top(name) : outer(name);
  if (category === "원피스/스커트") return /스커트/.test(name) ? { category: "스커트", subcategory: /미니/.test(name) ? "미니 스커트" : "미디·롱 스커트" } : { category: "원피스", subcategory: /미니/.test(name) ? "미니 원피스" : "미디·롱 원피스" };
  if (category === "신발") return shoes(name);
  if (category === "가방") return { category: "가방", subcategory: /백팩|짐색/.test(name) ? "백팩·짐색" : /크로스|슬링|메신저|벨트백|웨이스트/.test(name) ? "크로스·메신저백" : /파우치|클러치|슬리브/.test(name) ? "파우치·클러치" : /더플|위켄더/.test(name) ? "여행·더플백" : "토트·숄더백" };
  if (category === "액세서리") return accessories(name);
  if (category === "홈웨어") {
    if (/블랭킷|안대|마스크|헤어밴드/.test(name)) return { category: "홈리빙", subcategory: /블랭킷/.test(name) ? "담요" : "수면·욕실 소품" };
    if (/슬리퍼/.test(name)) return shoes(name);
    if (/삭스|양말/.test(name)) return accessories(name);
    if (/팬츠|쇼츠/.test(name)) return bottom(name);
    if (/가디건|스웨터|베스트|반팔 티/.test(name)) return top(name);
    if (/집업/.test(name)) return outer(name);
    return { category: "홈웨어", subcategory: /가운|로브/.test(name) ? "로브·가운" : "파자마·라운지 세트" };
  }
  if (category === "스포츠") {
    if (/매트|블록|트레이닝 세트/.test(name) && !/팬츠|셋업/.test(name)) return { category: "운동용품", subcategory: "트레이닝 도구" };
    if (/스포츠 브라/.test(name)) return { category: "이너웨어", subcategory: "스포츠 이너" };
    if (/캡|삭스|양말|헤드밴드|글러브|레그워머/.test(name)) return accessories(name);
    if (/스커트/.test(name)) return { category: "스커트", subcategory: "스포츠 스커트" };
    if (/원피스/.test(name)) return { category: "원피스", subcategory: "스포츠 원피스" };
    if (/팬츠|레깅스|쇼츠/.test(name)) return bottom(name);
    if (/자켓|바람막이|베스트/.test(name)) return outer(name);
    return top(name);
  }
  return { category: category || "기타", subcategory: "전체" };
}

export function getCatalogCategoryCounts(products: ClassifiableProduct[]) {
  const categories = new Map<string, { count: number; subcategories: Map<string, number> }>();
  for (const product of products) {
    const { category, subcategory } = getProductClassification(product);
    const group = categories.get(category) ?? { count: 0, subcategories: new Map<string, number>() };
    group.count += 1;
    group.subcategories.set(subcategory, (group.subcategories.get(subcategory) ?? 0) + 1);
    categories.set(category, group);
  }
  const order = (name: string) => {
    const index = (STORE_CATEGORY_ORDER as readonly string[]).indexOf(name);
    return index < 0 ? STORE_CATEGORY_ORDER.length : index;
  };
  return [...categories].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b, "ko")).map(([category, group]) => ({
    category, count: group.count,
    subcategories: [...group.subcategories].map(([name, count]) => ({ name, count })),
  }));
}
