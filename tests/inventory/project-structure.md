# 프로젝트 구조 분석

분석일: 2026-07-02

## 기술 스택

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- Prisma 6, PostgreSQL(Neon)
- 인증: `iron-session`, 쿠키명 `laonshop_session`
- 결제: KSNET KSPAY V1.4 인증결제창
- 배포: Vercel

## 주요 디렉터리

- `app/`: App Router 화면, 서버 액션, API 라우트
- `components/`: 홈/카테고리/결제창 등 UI 컴포넌트
- `lib/`: 인증, 세션, DB, 장바구니, KSPAY provider, 포맷 유틸
- `prisma/`: DB 스키마와 상품 시드
- `docs/`: 디자인/이관 관련 문서
- `tests/`: QA 운영 문서와 향후 테스트 코드

## 라우트 맵

| 경로 | 유형 | 주요 검증 포인트 |
| --- | --- | --- |
| `/` | 홈 | 히어로, 남/여 쇼핑 진입, 헤더/푸터 |
| `/shop/men`, `/shop/women` | 상품 목록 | 성별 필터, active 상품만 노출, 빈 목록 상태 |
| `/product/[id]` | 상품 상세 | inactive/not found, 사이즈 선택, 수량, 장바구니 저장 |
| `/cart` | 장바구니 | localStorage 로드, 수량 변경, 삭제, 빈 상태, 합계, 헤더 배지 |
| `/checkout` | 주문/결제 | 로그인 필요 여부, 배송지 자동입력, 구매 동의, 결제수단 비활성 상태, 주문 생성 |
| `/order/[id]` | 주문 결과 | 본인 주문 접근, PAID/FAILED/PENDING/CANCEL_REQUESTED 표시, 영수증 링크, PAID 시 장바구니 정리 |
| `/mypage` | 마이페이지 | 로그인 필수, 주문 목록, 찜 목록, 빈 상태 |
| `/mypage/settings` | 마이페이지 설정 | 정보 수정, 비밀번호 변경, 회원 탈퇴 |
| `/search` | 상품 검색 | 상품명/카테고리 검색, 빈 결과 |
| `/support` | 고객센터 | FAQ, 정책 링크 |
| `/login`, `/register` | 인증 | 약관 동의, 입력 검증, 중복 이메일, 로그인 잠금, 세션 생성/삭제 |
| `/policy/terms`, `/policy/privacy`, `/policy/refund` | 심사 정책 | 카드사 심사 필수 페이지 접근성/푸터 링크 |
| `/policy/shipping` | 배송 정책 | 배송/교환/반품 안내 |
| `/api/pg/kspay/callback` | API | KSNET rcv 브릿지, 취소/정상 스크립트, HTML escaping |
| `/api/pg/kspay/result` | API | 서버 승인, 금액 DB 기준, 멱등성, 상태 전이 |

## 데이터 모델

| 모델 | 역할 | QA 관점 |
| --- | --- | --- |
| `ShopUser` | 쇼핑몰 회원 | 이메일 unique, 비밀번호 hash, 기본 배송지, 탈퇴 익명화, 세션 연결 |
| `Product` | 상품 마스터 | 가격 정수 원, active 필터, 재고 필드, 성별/카테고리/사이즈 |
| `Wishlist` | 찜 | 사용자/상품 unique, 비로그인 redirect |
| `ShopOrder` | 주문 | user 소유권, moid unique, PENDING/PAID/FAILED/CANCEL_REQUESTED/CANCELED |
| `ShopOrderItem` | 주문 상품 스냅샷 | 주문 시점 상품명/가격/수량/사이즈 보존 |

## 결제 흐름

1. 사용자가 장바구니(localStorage)에서 `/checkout` 진입
2. `createOrderAction`이 로그인 사용자 확인
3. 서버가 상품을 DB에서 재조회하고 금액을 재계산
4. `ShopOrder(PENDING)`과 `ShopOrderItem` 생성
5. KSPAY 결제창 폼 필드 생성
6. `components/kspay-checkout.tsx`가 jQuery를 먼저 로드한 뒤 KSPAY 스크립트 `_pay()` 호출
7. KSNET이 `/api/pg/kspay/callback`으로 인증 결과 POST
8. callback HTML이 부모창의 `eparamSet()`과 `goResult()` 호출
9. `/api/pg/kspay/result`가 `recv_post.jsp` 서버승인 요청
10. 주문을 `PAID` 또는 `FAILED`로 전이한 뒤 `/order/[id]`로 redirect

## 추가 사용자 기능

- 검색: `app/search/page.tsx`
- 정렬/카테고리 탭: `components/category-shop.tsx`
- 찜: `app/product/[id]/wishlist-button.tsx`, `app/product/actions.ts`
- 최근 본 상품: `components/recent-products.tsx`
- 마이페이지 설정: `app/mypage/settings/*`, `app/mypage/actions.ts`
- 취소/반품 접수: `app/order/[id]/cancel-request.tsx`, `app/order/actions.ts`
- 전역 에러/404/로딩: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/loading.tsx`

## 현재 테스트 자동화 상태

- `package.json`에 테스트 러너 스크립트는 없다.
- Playwright, Vitest 등 테스트 의존성도 아직 없다.
- 따라서 초기 QA 구조는 문서/체크리스트 중심으로 만들고, 자동화 도입은 별도 승인 후 진행한다.
