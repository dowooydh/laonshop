import { readFileSync } from "node:fs";

const catalog = readFileSync("prisma/catalog.ts", "utf8");

const COLOR_WORDS = {
  블랙: "black",
  화이트: "white",
  라이트: "light",
  워시드: "washed",
  데님: "denim blue",
  블루: "blue",
  네이비: "navy",
  그레이: "gray",
  베이지: "beige",
  브라운: "brown",
  레더: "leather",
  실버: "silver",
  골드: "gold",
  체크: "check pattern",
  스트라이프: "striped",
};

const EXACT_TERMS = {
  "타탄 체크 오버셔츠": "navy and mustard tartan check cotton overshirt",
  "오버핏 반팔 티셔츠": "oversized short sleeve t-shirt",
  "미니멀 크루넥 니트": "minimal crewneck knit sweater",
  "링클프리 드레스 셔츠": "wrinkle-free dress shirt",
  "스트라이프 옥스포드 셔츠": "striped oxford button-down shirt",
  "헤비웨이트 맨투맨": "heavyweight sweatshirt",
  "슬림핏 폴로 셔츠": "slim fit polo shirt",
  "워시드 데님 셔츠": "washed denim shirt",
  "베이직 롱슬리브 티": "basic long sleeve t-shirt",
  "릴랙스핏 카라 니트": "relaxed collar knit top",
  "플란넬 체크 셔츠": "flannel check shirt",
  "터틀넥 니트": "turtleneck knit sweater",
  "그래픽 반팔 티": "graphic short sleeve t-shirt",
  "코듀로이 셔츠": "corduroy shirt",
  "헨리넥 티셔츠": "henley t-shirt",
  "풀오버 후디": "pullover hoodie",
  "린넨 셔츠": "linen shirt",
  "브이넥 니트": "v-neck knit sweater",
  "샴브레이 셔츠": "chambray shirt",
  "포켓 반팔 티": "short sleeve t-shirt with chest pocket",
};

function slug(product) {
  const source = [product.gender, product.category, product.name].filter(Boolean).join("-");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `p-${(hash >>> 0).toString(36)}`;
}

function hasAny(name, terms) {
  return terms.some((term) => name.includes(term));
}

function englishName(name, category) {
  if (EXACT_TERMS[name]) return EXACT_TERMS[name];

  const colors = Object.entries(COLOR_WORDS)
    .filter(([ko]) => name.includes(ko))
    .map(([, en]) => en);
  const color = colors.length ? `${colors.join(" ")} ` : "";

  if (category === "아우터") {
    if (name.includes("블레이저")) return `${color}blazer`;
    if (name.includes("트렌치")) return `${color}trench coat`;
    if (hasAny(name, ["롱 패딩", "패딩", "다운"])) return `${color}padded coat`;
    if (name.includes("바시티")) return `${color}varsity jacket`;
    if (name.includes("봄버")) return `${color}bomber jacket`;
    if (name.includes("플리스") || name.includes("후리스")) return `${color}fleece jacket`;
    if (name.includes("무스탕")) return `${color}shearling jacket`;
    if (name.includes("라이더")) return `${color}leather biker jacket`;
    if (name.includes("퀼팅")) return `${color}quilted jacket`;
    if (name.includes("데님")) return `${color}denim jacket`;
    if (name.includes("코듀로이")) return `${color}corduroy jacket`;
    if (name.includes("가디건")) return `${color}cardigan`;
    if (name.includes("코트")) return `${color}coat`;
    if (hasAny(name, ["재킷", "자켓", "집업"])) return `${color}jacket`;
    return `${color}outerwear jacket`;
  }

  if (category === "하의") {
    if (name.includes("스커트")) return `${color}skirt`;
    if (name.includes("쇼츠")) return `${color}shorts`;
    if (name.includes("레깅스")) return `${color}leggings`;
    if (name.includes("부츠컷")) return `${color}bootcut jeans`;
    if (hasAny(name, ["데님", "진"])) return `${color}jeans`;
    if (name.includes("조거")) return `${color}jogger pants`;
    if (name.includes("슬랙스")) return `${color}tailored trousers`;
    if (name.includes("니트")) return `${color}knit pants`;
    if (hasAny(name, ["팬츠", "트라우저"])) return `${color}pants`;
    return `${color}bottoms`;
  }

  if (category === "원피스/스커트") {
    if (name.includes("스커트")) return `${color}skirt`;
    if (name.includes("셔츠 원피스")) return `${color}shirt dress`;
    if (name.includes("니트")) return `${color}knit dress`;
    if (name.includes("슬립")) return `${color}satin slip dress`;
    if (name.includes("랩")) return `${color}wrap dress`;
    if (name.includes("티어드")) return `${color}tiered maxi dress`;
    if (hasAny(name, ["원피스", "드레스"])) return `${color}dress`;
    return `${color}dress or skirt`;
  }

  if (category === "신발") {
    if (name.includes("슬링백")) return `${color}slingback heels`;
    if (name.includes("펌프스")) return `${color}pointed pumps`;
    if (hasAny(name, ["스니커즈", "슈즈", "러너", "트레이너", "로우탑", "하이탑"])) return `${color}sneakers`;
    if (name.includes("메리제인")) return `${color}Mary Jane shoes`;
    if (name.includes("뮬")) return `${color}mules`;
    if (name.includes("힐")) return `${color}heels`;
    if (name.includes("플랫")) return `${color}flats`;
    if (name.includes("에스파듀")) return `${color}espadrilles`;
    if (name.includes("로퍼")) return `${color}loafers`;
    if (name.includes("부츠")) return `${color}boots`;
    if (name.includes("샌들")) return `${color}sandals`;
    if (name.includes("슬리퍼")) return `${color}slippers`;
    return `${color}shoes`;
  }

  if (category === "가방") {
    if (name.includes("숄더백")) return `${color}shoulder bag`;
    if (name.includes("크로스백")) return `${color}crossbody bag`;
    if (name.includes("체인백")) return `${color}chain shoulder bag`;
    if (name.includes("토트백")) return `${color}tote bag`;
    if (name.includes("호보백")) return `${color}hobo bag`;
    if (name.includes("버킷백")) return `${color}bucket bag`;
    if (name.includes("클러치")) return `${color}clutch bag`;
    if (name.includes("백팩")) return `${color}backpack`;
    if (hasAny(name, ["스트로", "라탄"])) return `${color}straw rattan bag`;
    if (name.includes("새첼")) return `${color}satchel bag`;
    if (name.includes("벨트백")) return `${color}belt bag`;
    if (name.includes("위켄더")) return `${color}weekender bag`;
    if (name.includes("탑핸들")) return `${color}top handle bag`;
    if (name.includes("크로셰")) return `${color}crochet bag`;
    if (name.includes("파우치")) return `${color}pouch`;
    if (name.includes("비즈")) return `${color}beaded bag`;
    return `${color}bag`;
  }

  if (category === "액세서리") {
    if (name.includes("이어링")) return `${color}earrings`;
    if (name.includes("네크리스")) return `${color}necklace`;
    if (hasAny(name, ["머플러", "스카프"])) return `${color}scarf`;
    if (name.includes("버킷햇")) return `${color}bucket hat`;
    if (name.includes("선글라스")) return `${color}sunglasses`;
    if (name.includes("시계")) return `${color}watch`;
    if (name.includes("클립")) return `${color}hair claw clip`;
    if (name.includes("벨트")) return `${color}belt`;
    if (name.includes("비니")) return `${color}beanie`;
    if (name.includes("링")) return `${color}ring set`;
    if (name.includes("헤어밴드")) return `${color}headband`;
    if (name.includes("장갑")) return `${color}gloves`;
    if (name.includes("팔찌")) return `${color}bracelet`;
    if (name.includes("베레모")) return `${color}beret`;
    return `${color}fashion accessory`;
  }

  if (category === "홈웨어") {
    if (name.includes("파자마")) return `${color}pajama set`;
    if (hasAny(name, ["로브", "가운"])) return `${color}robe`;
    if (name.includes("집업")) return `${color}lounge zip-up jacket`;
    if (name.includes("슬리퍼")) return `${color}house slippers`;
    if (hasAny(name, ["삭스", "양말"])) return `${color}socks`;
    if (hasAny(name, ["드레스", "원피스"])) return `${color}night dress`;
    if (name.includes("베스트")) return `${color}home knit vest`;
    if (name.includes("아이 마스크")) return `${color}sleep eye mask`;
    if (name.includes("헤어밴드")) return `${color}terry headband`;
    if (name.includes("가디건")) return `${color}home cardigan`;
    if (name.includes("팬츠")) return `${color}lounge pants`;
    if (hasAny(name, ["라운지", "셋업"])) return `${color}loungewear set`;
    return `${color}homewear`;
  }

  if (category === "스포츠") {
    if (name.includes("스포츠 브라")) return `${color}sports bra`;
    if (name.includes("레깅스")) return `${color}leggings`;
    if (name.includes("팬츠")) return `${color}training pants`;
    if (name.includes("트랙 자켓")) return `${color}track jacket`;
    if (name.includes("바람막이")) return `${color}windbreaker jacket`;
    if (name.includes("쇼츠")) return `${color}shorts`;
    if (name.includes("스커트")) return `${color}tennis skirt`;
    if (name.includes("후디")) return `${color}hoodie`;
    if (hasAny(name, ["트레이닝 티", "요가 탑"])) return `${color}training top`;
    if (name.includes("원피스")) return `${color}tennis dress`;
    if (name.includes("레그워머")) return `${color}knit leg warmers`;
    if (hasAny(name, ["삭스", "양말"])) return `${color}socks`;
    if (name.includes("요가 블록")) return `${color}yoga block set`;
    if (name.includes("캡")) return `${color}running cap`;
    if (name.includes("세트")) return `${color}activewear set`;
    return `${color}activewear`;
  }

  if (hasAny(name, ["셔츠", "블라우스"])) return `${color}button-up shirt`;
  if (hasAny(name, ["티셔츠", "반팔", "롱슬리브"]) || /(^|\s)티($|\s)/.test(name)) return `${color}t-shirt`;
  if (hasAny(name, ["니트", "스웨터"])) return `${color}knit sweater`;
  if (name.includes("가디건")) return `${color}cardigan`;
  if (name.includes("후디")) return `${color}hoodie`;
  if (name.includes("코트")) return `${color}coat`;
  if (hasAny(name, ["재킷", "자켓"])) return `${color}jacket`;
  if (name.includes("베스트")) return `${color}vest`;
  if (hasAny(name, ["팬츠", "슬랙스", "진", "트라우저", "레깅스"])) return `${color}pants`;
  if (name.includes("쇼츠")) return `${color}shorts`;
  if (name.includes("스커트")) return `${color}skirt`;
  if (hasAny(name, ["원피스", "드레스"])) return `${color}dress`;
  if (hasAny(name, ["스니커즈", "슈즈", "러너", "트레이너", "로우탑", "하이탑"])) return `${color}sneakers`;
  if (name.includes("로퍼")) return `${color}loafers`;
  if (name.includes("부츠")) return `${color}boots`;
  if (name.includes("샌들")) return `${color}sandals`;
  if (name.includes("백팩")) return `${color}backpack`;
  if (name.includes("토트백")) return `${color}tote bag`;
  if (hasAny(name, ["크로스백", "슬링백"])) return `${color}crossbody bag`;
  if (hasAny(name, ["가방", "백", "파우치", "슬리브"])) return `${color}bag`;
  if (hasAny(name, ["볼캡", "캡"])) return `${color}cap`;
  if (name.includes("비니")) return `${color}beanie`;
  if (name.includes("시계")) return `${color}watch`;
  if (name.includes("선글라스")) return `${color}sunglasses`;
  if (hasAny(name, ["머플러", "스카프"])) return `${color}scarf`;
  if (name.includes("벨트")) return `${color}belt`;
  if (name.includes("장갑")) return `${color}gloves`;
  if (hasAny(name, ["삭스", "양말"])) return `${color}socks`;
  if (hasAny(name, ["파자마", "라운지", "셋업"])) return `${color}loungewear set`;
  if (hasAny(name, ["로브", "가운"])) return `${color}robe`;

  return `${color}fashion product`;
}

function shots(category) {
  if (category === "신발") {
    return "Panel 1 side profile hero shot, panel 2 on-foot styling photo, panel 3 angled front view, panel 4 top-down pair shot, panel 5 macro sole/laces/material detail.";
  }
  if (category === "가방") {
    return "Panel 1 front product hero shot, panel 2 worn on model, panel 3 side angle showing depth and strap, panel 4 open storage detail, panel 5 macro hardware/stitching/material detail.";
  }
  if (category === "액세서리") {
    return "Panel 1 clean product hero shot, panel 2 worn styling shot, panel 3 alternate angle, panel 4 flat lay, panel 5 macro material/clasp/texture detail.";
  }
  return "Panel 1 front view on model, panel 2 three-quarter side view on model in a different pose, panel 3 back view on model, panel 4 hanger or flat-lay product-only shot, panel 5 close-up fabric/button/seam detail.";
}

function prompt(product) {
  const gender = product.gender === "women" ? "women's" : "men's";
  const itemName = englishName(product.name, product.category);
  return `Use case: product-mockup
Asset type: LAON SHOP ecommerce product detail image source sheet, to be split into five separate product photos
Primary request: Create one clean 5-panel product photography contact sheet for a single SKU. Each panel must show the same exact ${gender} ${itemName} with identical color, material, silhouette, construction, and fit. Do not show a different product in any panel.
Product name: ${product.name}
Category: ${product.gender} / ${product.category}
Subject: ${gender} ${itemName}
Style/medium: photorealistic Korean online fashion mall product photography
Composition/framing: five equal vertical panels in one row, with thin white gutters between panels. ${shots(product.category)} Keep each panel fully contained and easy to crop.
Lighting/mood: consistent soft studio catalog lighting, premium ecommerce, neutral background
Materials/textures: realistic material texture, seams, stitching, fasteners, and product detail
Text (verbatim): none
Constraints: same exact SKU across all five panels; no brand logos, no text, no watermark, no extra products, no random accessories, no mismatched colors; all panels must be usable as product detail photos
Avoid: different clothes, different colors, cropped-off product, collage decorations, labels, text, watermarks`;
}

function products() {
  const rows = [];
  let gender = "";
  let category = "";

  for (const line of catalog.split("\n")) {
    const genderMatch = line.match(/^  (men|women): \{/);
    if (genderMatch) gender = genderMatch[1];

    const categoryMatch = line.match(/^    "([^"]+)": \[/);
    if (categoryMatch) category = categoryMatch[1];

    const productMatch = line.match(/\{ name: "([^"]+)", price: (\d+), id: "([^"]+)"/);
    if (productMatch) {
      rows.push({ gender, category, name: productMatch[1], price: Number(productMatch[2]), photoId: productMatch[3] });
    }
  }

  return rows;
}

const all = products();
const arg = process.argv[2];

if (arg === "--json") {
  console.log(JSON.stringify(all.map((product, index) => ({ index, slug: slug(product), prompt: prompt(product), ...product })), null, 2));
} else {
  const index = Number(arg ?? 0);
  const product = all[index];
  if (!product) {
    console.error(`No product at index ${index}. Product count: ${all.length}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ index, slug: slug(product), prompt: prompt(product), ...product }, null, 2));
}
