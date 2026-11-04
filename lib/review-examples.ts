/** Only illustrative preview content; never written to real purchase/review ledgers. */
export function showReviewExamples(
  env: { VERCEL_ENV?: string; NODE_ENV?: string } = process.env,
) {
  return (
    env.VERCEL_ENV === "preview" ||
    (!env.VERCEL_ENV && env.NODE_ENV === "development")
  );
}
function hash(value: string) {
  let result = 2166136261;
  for (const character of value)
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
const TEXT = [
  "사이즈를 비교하기 편했어요. 선택한 옵션과 착용감을 함께 남기는 후기 화면의 예시입니다.",
  "편하게 입는 일상 코디에 활용했어요. 짧은 한 줄 후기의 표시 예시입니다.",
  "사진을 여러 장 확인하고 선택했어요. 길이가 긴 후기도 자연스럽게 줄바꿈되는지 확인하는 예시 문장입니다.",
  "색감과 소재에 대한 의견을 남기는 예시 후기입니다. 실제 상품에 대한 평가가 아닙니다.",
  "평소 입는 옷과 사이즈를 비교해 보았어요. 구매 옵션이 후기와 함께 보이는 화면 예시입니다.",
  "배송과 포장에 대한 의견도 이런 형태로 표시할 수 있어요. 화면 확인용 예시입니다.",
  "조금 여유 있는 스타일을 선호해요. 다른 취향과 별점이 함께 보이는 후기 구성 예시입니다.",
  "전체 길이와 디테일을 함께 확인했어요. 실제 후기가 등록됐을 때의 읽기 간격을 보여주는 예시입니다.",
];
export function getReviewExamples(productKey: string) {
  const seed = hash(productKey);
  const total = 36 + (seed % 47);
  const textCount = Math.ceil(total * 0.15);
  const textPositions = new Set(
    Array.from({ length: textCount }, (_, index) =>
      Math.floor((index * total) / textCount),
    ),
  );
  const reviews = Array.from({ length: total }, (_, index) => ({
    id: `example-${index + 1}`,
    label: `후기 예시 ${String(index + 1).padStart(2, "0")}`,
    rating: [5, 4, 5, 4, 3, 5, 4, 2, 5, 4][(seed + index * 7) % 10],
    content: textPositions.has(index)
      ? TEXT[(seed + index) % TEXT.length]
      : null,
  }));
  return {
    total,
    textCount,
    averageRating:
      reviews.reduce((sum, review) => sum + review.rating, 0) / total,
    reviews,
  };
}
