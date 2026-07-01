// 모델 크로스페이드용 룩북 컷 (Unsplash 엄선, 로드 검증됨). 히어로 + 남/여 게이트에서 사용.
const IMG = "?w=1100&q=80&auto=format&fit=crop";
const u = (id: string) => `https://images.unsplash.com/photo-${id}${IMG}`;

export const MEN_MODELS = [
  "1534030347209-467a5b0ad3e6",
  "1536129808005-fae894214c73",
  "1495366691023-cc4eadcc2d7e",
  "1583167465341-639b41dfd97b",
  "1536294738309-2fc595e788fb",
].map(u);

export const WOMEN_MODELS = [
  "1612731486606-2614b4d74921",
  "1659522761084-79196b64abe4",
  "1668952135120-7d997b1b3778",
  "1754315052701-0b98f6ba786b",
  "1613915617430-8ab0fd7c6baf",
].map(u);

// 히어로 "옷 갈아입는" 연출 — 남/여 룩을 번갈아 크로스페이드
export const HERO_LOOKS = [
  WOMEN_MODELS[0],
  MEN_MODELS[0],
  WOMEN_MODELS[2],
  MEN_MODELS[3],
  WOMEN_MODELS[3],
  MEN_MODELS[1],
];
