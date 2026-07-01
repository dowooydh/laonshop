# LAON SHOP — 젠더 리스트럭처 + 모델 히어로 (설계)

**날짜:** 2026-07-02 · **상태:** 승인됨 · **범위:** 홈 재구성 + 젠더/카테고리 상품 구조. 상세페이지·KSPAY·결제·footer 불변(§1).

## 목표
쇼핑몰 정체성을 강화한다. 첫 화면은 모델이 코디를 갈아입는 연출, 그 아래 남/여 게이트, 클릭하면 상의/하의/신발 카테고리로 10개씩 탐색.

## 결정 (사용자 승인)
1. 모델 연출 = **실사 모델 크로스페이드**(motion, reduced-motion 시 정지).
2. 이미지 = **엄선한 고정 사진**(Unsplash/Pexels에서 카테고리별 실제 컷을 선별·URL 고정·로드 검증).
3. 상품 DB = **60개 재구성** — `Product.gender`(men/women) 추가, 카테고리 상의/하의/신발, 남·여 각 30(카테고리당 10). `prisma db push` 1회(승인됨). 재시드로 기존 더미10 + 테스트주문 정리.
4. 히어로 = **옷 갈아입는 모델로 교체**(WebGL 크리스탈 제거).

## 정보구조 / 라우팅
- `/` = 모델 히어로 + 남/여 게이트(기존 '컬렉션' 벤토 그리드 대체).
- `/shop/men`, `/shop/women` = 카테고리 탭[상의·하의·신발] + 선택 카테고리 10개 그리드 → 카드 클릭 → 기존 `/product/[id]`(불변).
- 네비바: 로고 옆 `남성의류`(→/shop/men) `여성의류`(→/shop/women).

## 컴포넌트
- `components/model-crossfade.tsx` (신규, 재사용) — `images: string[]`를 일정 간격 크로스페이드(+미세 스케일). reduced-motion 시 첫 컷 고정. lazy/preload.
- `components/home-hero.tsx` (교체) — 풀블리드 ModelCrossfade + 키네틱 헤드라인 + CTA.
- `components/gender-gate.tsx` (신규) — 좌 남/우 여 split, 각 ModelCrossfade + 라벨, 클릭 시 /shop/[gender].
- `app/shop/[gender]/page.tsx` (신규, 서버) — gender별 상품 로드, 카테고리 탭 UI.
- `components/category-shop.tsx` (신규, client) — 탭 상태(상의/하의/신발) + 그리드(기존 ProductGrid 스타일 재사용/응용).
- `app/page.tsx`, `app/layout.tsx`(네비), `next.config.ts`(이미지 호스트) 수정.

## 데이터
- schema: `Product`에 `gender String?` 추가(기존 컬럼/관계 불변 — §1). 카테고리 값 = "상의"|"하의"|"신발".
- seed: 60개 { gender, category, name, price, imageUrl(엄선), sizes }. 신발 사이즈는 "230,240,...,280" 류.
- `prisma db push` → `pnpm db:seed` (프로덕션 Neon).

## 이미지 소싱
- 카테고리별(6) 실제 컷 10장씩 + 남/여 모델 크로스페이드 컷 몇 장을 브라우저로 검색·선별, `images.unsplash.com`/pexels CDN URL 고정, 샘플 로드 검증. `next.config.ts` remotePatterns에 호스트 추가.

## 불변(§1)
상세페이지, 장바구니·체크아웃·주문완료, KSPAY 결제 흐름, footer 사업자정보, 정책 3종.

## 검증
`pnpm build` 통과 · 홈(히어로+게이트)·/shop/men·women·카테고리 탭·상세 진입 렌더 · KSPAY 결제창 회귀 · 커밋·push(자동배포).
