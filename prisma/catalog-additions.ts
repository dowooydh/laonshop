/** 신규 셀렉션 초안. 공급·사진·실측·판매가·재고 검수 전까지 판매하지 않는다. */
import type { Category, Gender } from "./catalog";

export type CatalogAdditionDraft = {
  key: string;
  name: string;
  gender: Gender;
  category: Category;
  proposedPrice: number;
  proposedSizes: string;
};

export const CATALOG_ADDITION_VERSION = "20261104-selection-01";
export const CATALOG_ADDITION_REQUIREMENTS = [
  "공급 가능한 실제 상품과 SKU 확인",
  "해당 SKU의 대표사진·상세사진 검수",
  "상품 실측·소재·제조 정보 확인",
  "판매가·판매 재고 확정",
] as const;

export const CATALOG_ADDITIONS: CatalogAdditionDraft[] = [
  { key: "men-top-01", name: "소프트 워시 코튼 티셔츠", gender: "men", category: "상의", proposedPrice: 29000, proposedSizes: "S,M,L,XL" },
  { key: "men-top-02", name: "투포켓 유틸리티 셔츠", gender: "men", category: "상의", proposedPrice: 54000, proposedSizes: "M,L,XL" },
  { key: "men-top-03", name: "크루넥 파인울 니트", gender: "men", category: "상의", proposedPrice: 68000, proposedSizes: "S,M,L,XL" },
  { key: "men-top-04", name: "하프집업 코튼 스웨트셔츠", gender: "men", category: "상의", proposedPrice: 49000, proposedSizes: "M,L,XL" },
  { key: "men-top-05", name: "세미오버핏 피케 티셔츠", gender: "men", category: "상의", proposedPrice: 37000, proposedSizes: "S,M,L,XL" },
  { key: "men-bottom-01", name: "커브드 원턱 코튼 팬츠", gender: "men", category: "하의", proposedPrice: 59000, proposedSizes: "28,30,32,34,36" },
  { key: "men-bottom-02", name: "클린 스트레이트 생지 데님", gender: "men", category: "하의", proposedPrice: 64000, proposedSizes: "28,30,32,34" },
  { key: "men-bottom-03", name: "컴포트 밴딩 슬랙스", gender: "men", category: "하의", proposedPrice: 47000, proposedSizes: "28,30,32,34,36" },
  { key: "men-bottom-04", name: "나일론 이지 카고 팬츠", gender: "men", category: "하의", proposedPrice: 55000, proposedSizes: "S,M,L,XL" },
  { key: "men-bottom-05", name: "테이퍼드 저지 트레이닝 팬츠", gender: "men", category: "하의", proposedPrice: 39000, proposedSizes: "S,M,L,XL" },
  { key: "men-outer-01", name: "싱글 브레스트 워크 자켓", gender: "men", category: "아우터", proposedPrice: 109000, proposedSizes: "M,L,XL" },
  { key: "men-outer-02", name: "라이트 퀼팅 라이너 베스트", gender: "men", category: "아우터", proposedPrice: 69000, proposedSizes: "M,L,XL" },
  { key: "men-shoes-01", name: "스웨이드 드라이빙 로퍼", gender: "men", category: "신발", proposedPrice: 119000, proposedSizes: "250,260,270,280" },
  { key: "men-bag-01", name: "라이트 유틸리티 숄더백", gender: "men", category: "가방", proposedPrice: 48000, proposedSizes: "" },
  { key: "men-hat-01", name: "소프트 코튼 캠프캡", gender: "men", category: "액세서리", proposedPrice: 29000, proposedSizes: "" },
  { key: "men-home-01", name: "모달 코튼 파자마 셋업", gender: "men", category: "홈웨어", proposedPrice: 59000, proposedSizes: "S,M,L" },
  { key: "women-top-01", name: "보트넥 코튼 롱슬리브", gender: "women", category: "상의", proposedPrice: 31000, proposedSizes: "S,M,L" },
  { key: "women-top-02", name: "핀턱 코튼 블라우스", gender: "women", category: "상의", proposedPrice: 48000, proposedSizes: "S,M,L" },
  { key: "women-top-03", name: "소프트 알파카 가디건", gender: "women", category: "상의", proposedPrice: 79000, proposedSizes: "S,M,L" },
  { key: "women-top-04", name: "슬림 골지 카라 니트", gender: "women", category: "상의", proposedPrice: 52000, proposedSizes: "S,M,L" },
  { key: "women-top-05", name: "레이어드 코튼 슬리브리스 탑", gender: "women", category: "상의", proposedPrice: 23000, proposedSizes: "S,M,L" },
  { key: "women-bottom-01", name: "투턱 세미와이드 슬랙스", gender: "women", category: "하의", proposedPrice: 58000, proposedSizes: "25,26,27,28,29" },
  { key: "women-bottom-02", name: "소프트 커브드 데님 팬츠", gender: "women", category: "하의", proposedPrice: 62000, proposedSizes: "25,26,27,28,29" },
  { key: "women-bottom-03", name: "밴딩 코튼 스트레이트 팬츠", gender: "women", category: "하의", proposedPrice: 46000, proposedSizes: "S,M,L" },
  { key: "women-bottom-04", name: "슬릿 부츠컷 저지 팬츠", gender: "women", category: "하의", proposedPrice: 41000, proposedSizes: "S,M,L" },
  { key: "women-outer-01", name: "노카라 트위드 크롭 자켓", gender: "women", category: "아우터", proposedPrice: 119000, proposedSizes: "S,M,L" },
  { key: "women-dress-01", name: "벨티드 코튼 셔츠 원피스", gender: "women", category: "원피스/스커트", proposedPrice: 79000, proposedSizes: "S,M,L" },
  { key: "women-dress-02", name: "스퀘어넥 니트 미디 원피스", gender: "women", category: "원피스/스커트", proposedPrice: 72000, proposedSizes: "S,M,L" },
  { key: "women-skirt-01", name: "A라인 코튼 롱 스커트", gender: "women", category: "원피스/스커트", proposedPrice: 55000, proposedSizes: "S,M,L" },
  { key: "women-jewelry-01", name: "미니 펄 드롭 이어링", gender: "women", category: "액세서리", proposedPrice: 29000, proposedSizes: "" },
  { key: "women-inner-01", name: "소프트 데일리 스포츠 브라", gender: "women", category: "스포츠", proposedPrice: 35000, proposedSizes: "S,M,L" },
  { key: "women-home-01", name: "모달 스트라이프 파자마 셋업", gender: "women", category: "홈웨어", proposedPrice: 63000, proposedSizes: "S,M,L" },
];
