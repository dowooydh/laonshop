/** Category/option-aware reference data. These are comparison examples, never SKU measurements. */
export type SizeGuideInput = {
  name?: string;
  category: string | null;
  gender?: string | null;
  sizes: readonly string[];
};
export type ProductSizeGuideData = {
  kind: "top" | "bottom" | "waist" | "footwear" | "one-size" | "accessory";
  title: string;
  columns: string[];
  rows: string[][];
  unit: string | null;
  note: string;
  measures: string[];
};

const ALPHA_SIZE: Record<string, number> = {
  XS: -1,
  S: 0,
  M: 1,
  L: 2,
  XL: 3,
  XXL: 4,
  "2XL": 4,
  "3XL": 5,
};
const COMPARISON_NOTE =
  "사이즈 옵션 간 차이를 보여주는 참고용 예시입니다. 이 상품을 직접 측정한 수치가 아니며, 실제 치수는 고객센터에 확인해 주세요.";
const TOP_MEASURES = [
  "어깨너비: 옷을 평평하게 놓고 양쪽 어깨 끝 사이를 잽니다.",
  "가슴단면: 겨드랑이 아래 양쪽 끝을 수평으로 잽니다. 둘레가 아닌 한쪽 면의 너비입니다.",
  "총장: 뒷목 중심에서 밑단까지 세로로 잽니다.",
];
const BOTTOM_MEASURES = [
  "허리단면: 허리선을 평평하게 편 뒤 양쪽 끝 사이를 잽니다.",
  "엉덩이단면: 엉덩이에서 가장 넓은 부분을 수평으로 잽니다.",
  "총장: 허리선 윗부분에서 밑단 끝까지 잽니다.",
];

function uniqueOptions(sizes: readonly string[]) {
  return [...new Set(sizes.map((size) => size.trim()).filter(Boolean))];
}
function isAccessory(category: string, name: string) {
  return (
    /가방|액세서리|모자|양말|주얼리|벨트|패션잡화/.test(category) ||
    /캡|모자|삭스|양말|장갑|레그워머|스트랩|벨트|요가 볼|요가 매트|요가 블록|홈트레이닝 세트/.test(
      name,
    )
  );
}

export function getProductSizeGuide({
  name = "",
  category,
  gender,
  sizes,
}: SizeGuideInput): ProductSizeGuideData {
  const options = uniqueOptions(sizes);
  const cat = category ?? "";
  if (
    /신발|슈즈|스니커즈|부츠|샌들|로퍼/.test(cat) &&
    options.length &&
    options.every((size) => /^\d{3}$/.test(size))
  ) {
    return {
      kind: "footwear",
      title: "신발 사이즈 표기",
      unit: "mm",
      columns: ["선택 옵션", "표기 길이", "cm 환산"],
      rows: options.map((size) => [
        size,
        `${size} mm`,
        `${(Number(size) / 10).toFixed(1)} cm`,
      ]),
      note: "선택 가능한 사이즈의 단위 환산표입니다. 신발의 내부 길이·발볼 실측이나 착용감을 보장하는 수치는 아닙니다.",
      measures: [
        "종이에 발을 올리고 뒤꿈치에서 가장 긴 발가락 끝까지 잽니다.",
        "양발을 재고 긴 쪽을 기준으로 제품의 실측·발볼 정보를 함께 확인하세요.",
      ],
    };
  }
  if (isAccessory(cat, name)) {
    return {
      kind: "accessory",
      title: "크기 확인 안내",
      unit: null,
      columns: ["확인 항목", "구매 전 확인할 내용"],
      rows: /가방/.test(cat)
        ? [
            ["가로·세로·폭", "제품 실측 확인 필요"],
            ["손잡이·스트랩", "길이 및 조절 가능 여부 확인"],
          ]
        : [
            ["선택 옵션", options.join(" · ") || "단일 옵션"],
            ["제품 크기", "제품 라벨 또는 고객센터에서 실측 확인"],
          ],
      note: "사진만으로 크기를 판단하기 어려운 상품입니다. 실제 치수와 조절 가능 여부를 확인해 주세요.",
      measures: [],
    };
  }
  if (
    !options.length ||
    options.every((size) => /^(FREE|F|ONE ?SIZE)$/i.test(size))
  ) {
    return {
      kind: "one-size",
      title: "단일 옵션 사이즈 안내",
      unit: null,
      columns: ["선택 옵션", "확인할 내용"],
      rows: [[options.join(" · ") || "단일 옵션", "상품 실측 확인 필요"]],
      note: "FREE·단일 옵션은 모든 체형에 맞는다는 뜻이 아닙니다. 평소 잘 맞는 옷과 어깨·가슴·허리·총장을 비교해 주세요.",
      measures: TOP_MEASURES,
    };
  }
  const dress =
    /원피스|드레스|점프수트/.test(name) ||
    (cat === "원피스" && !/스커트/.test(name));
  const bottom =
    !dress &&
    (/하의|팬츠|데님|스커트/.test(cat) ||
      /스커트|팬츠|슬랙스|청바지|조거|레깅스|쇼츠/.test(name));
  if (
    bottom &&
    options.every(
      (size) =>
        /^\d{2}$/.test(size) && Number(size) >= 20 && Number(size) <= 50,
    )
  ) {
    return {
      kind: "waist",
      title: "허리 사이즈 표기 환산",
      unit: "인치 / cm",
      columns: ["선택 옵션", "인치 표기", "cm 환산"],
      rows: options.map((size) => [
        size,
        `${size} in`,
        `${(Number(size) * 2.54).toFixed(1)} cm`,
      ]),
      note: "인치 표기값을 cm로 환산한 참고표입니다(1 in = 2.54 cm). 바지의 허리단면·밴딩 범위·제품 실측과는 다를 수 있습니다.",
      measures: BOTTOM_MEASURES,
    };
  }
  const isWomen = gender === "women";
  const short = /쇼츠|반바지|핫팬츠|숏팬츠/.test(name);
  const base = bottom
    ? isWomen
      ? [32, 45, short ? 39 : 96]
      : [35, 47, short ? 45 : 98]
    : dress
      ? [34, 43, 108]
      : isWomen
        ? [38, 46, 60]
        : [43, 50, 66];
  return {
    kind: bottom ? "bottom" : "top",
    title: dress ? "원피스 사이즈 비교 예시" : "사이즈 비교 예시",
    unit: "cm · 참고용 예시",
    columns: [
      "선택 옵션",
      ...(bottom
        ? ["허리단면", "엉덩이단면", "총장"]
        : ["어깨너비", "가슴단면", "총장"]),
    ],
    rows: options.map((size) => {
      const index = ALPHA_SIZE[size.toUpperCase()];
      return [
        size,
        ...base.map((value, position) =>
          index === undefined
            ? "확인 필요"
            : String(value + index * (bottom ? 2 : position === 0 ? 2 : 3)),
        ),
      ];
    }),
    note: COMPARISON_NOTE,
    measures: bottom ? BOTTOM_MEASURES : TOP_MEASURES,
  };
}
