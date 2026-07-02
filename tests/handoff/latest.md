# QA 핸드오프 최신본

작성일: 2026-07-03
담당: Codex QA/테스트 세션
상태: 테스트 환경 안내 반영, 테스트 미실행

## 이번 작업 요약

- 최신 코드 파일 목록을 확인해 검색, 정렬, 찜, 최근 본 상품, 마이페이지 설정, 취소/반품 접수, 영수증 링크가 테스트 범위에 포함됨을 반영했다.
- 제품 코드는 수정하지 않았다.
- 로컬 테스트 환경, 환경변수, 셋업 순서, 결제 테스트 주의사항을 문서화했다.
- 실제 E2E 테스트는 아직 실행하지 않았다.

## 주요 기능 맵

- 쇼핑: 홈, 성별 상품 목록, 검색, 정렬, 상품 상세, 최근 본 상품
- 장바구니: localStorage 저장, 수량 변경, 삭제, 빈 상태
- 인증: 약관 동의 회원가입, 로그인, 로그인 잠금, 로그아웃, 보호 페이지, 회원 탈퇴
- 찜: 상품 상세 토글, 마이페이지 찜 목록
- 주문/결제: 배송지 자동입력, 구매 동의, 서버 주문 생성, KSPAY 인증결제창, callback/result API, 주문 상태 전이
- 주문 사후: 주문 완료, 영수증 링크, 취소/반품 신청 접수
- 마이페이지: 사용자 주문 목록, 찜 목록, 정보 수정, 비밀번호 변경, 탈퇴
- 카드사 심사: 푸터 사업자정보, 이용약관, 개인정보처리방침, 배송/환불 정책

## 테스트 전략

- 우선 수동 E2E 체크리스트로 핵심 흐름을 검증한다.
- 자동화는 Playwright/API 테스트 도입 승인을 받은 뒤 `tests/e2e`, `tests/api`에 추가한다.
- 결제 관련 테스트는 KSPAY 테스트 MID와 테스트 카드/절차 확인 후 로컬에서만 실행한다.
- 운영 데이터 삭제는 금지하고, QA 생성 데이터만 정리한다.

## 필요한 계정/서버/기기/권한

### 계정

- 테스트 회원 생성 가능 권한 또는 QA 전용 계정
- 가능하면 `qa+...@example.test` 패턴 사용
- KSPAY 테스트 결제를 실행할 경우 테스트 카드/결제 절차 정보
- 회원 탈퇴 검증용 일회용 테스트 계정

### 서버/환경

- 로컬 개발 서버: `pnpm dev` 기본 포트 `3003`
- 빌드 검증: `pnpm build`
- 테스트 DB 또는 로컬 DB 연결 문자열
- 환경 변수: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `PG_MODE=kspay`, `KSPAY_STORE_ID`
- 추가 환경 변수: `SHOP_APP_URL=http://localhost:3003`
- 셋업: `pnpm install` → `pnpm prisma db push` → `pnpm db:seed` → `pnpm dev`
- 런타임 기준: Node 22.x + pnpm 11.5.3
- 현재 이 세션은 직접 `node -v` 확인 시 Node `v25.9.0`, `pnpm build` 경고 기준 Node `v24.14.0`, pnpm `11.7.0`, `corepack` 미탑재로 확인됨. 실제 검증 전 환경 정렬 필요.

### 기기/브라우저

- 데스크톱 Chromium 계열 브라우저
- 모바일 viewport 390px 전후
- 가능하면 Safari/WebKit 계열 추가 확인
- 결제창 팝업/iframe이 막히지 않는 브라우저 설정

### 권한

- DB read 권한. 테스트 데이터 정리가 필요하면 QA 생성 데이터 한정 write/delete 권한
- 서버 로그 확인 권한
- 브라우저 콘솔/네트워크 확인 권한
- Vercel preview 테스트 시 배포 URL 접근 권한

## 초기 리스크/관찰사항

| 우선순위 | 관찰 | 관련 위치 | 확인 필요 |
| --- | --- | --- | --- |
| P0 | `/checkout`는 클라이언트 컴포넌트에서 server action을 호출한다. 비로그인 시 `requireShopUser()` redirect가 client action 호출 중 어떤 사용자 경험으로 나타나는지 확인 필요 | `app/checkout/page.tsx`, `app/checkout/actions.ts` | 비로그인 checkout 버튼 클릭 시 UX |
| P0 | `createOrderAction`에서 판매 종료 상품 포함 시 throw가 발생한다. 사용자에게 오류 메시지로 보이는지 확인 필요 | `app/checkout/actions.ts` | inactive/삭제 상품이 localStorage에 남은 케이스 |
| P0 | KSPAY result는 PENDING일 때만 승인 처리한다. 중복 POST 멱등성은 의도상 양호하나 실제 재호출 시 응답/상태 확인 필요 | `app/api/pg/kspay/result/route.ts` | 중복 callback/result |
| P1 | 결제창 스크립트 로드 실패 catch가 사용자 메시지를 갱신하지 않는다 | `components/kspay-checkout.tsx` | 네트워크 실패/차단 UX |
| 제외 | 푸터 대표/주소 없음, 통신판매업신고 `신고 예정`은 심사 직전 기재 예정 상태로 버그 보고 제외 | `app/layout.tsx` | 심사 직전 최종 확인 |
| P1 | 장바구니는 localStorage 가격을 표시하지만 주문 금액은 서버 재계산이다. 화면 표시 금액과 실제 주문 금액 불일치 케이스 확인 필요 | `lib/cart.ts`, `app/checkout/actions.ts` | 가격 변경 후 기존 장바구니 |

## 버그 보고 제외 항목

- 결제수단 중 계좌이체, 무통장입금, 원클릭 결제 준비 중 비활성
- footer 대표자/주소 없음, 통신판매업신고 `신고 예정`
- 이메일 인증, 비밀번호 재설정 미구현
- 취소/반품 신청이 접수까지만 처리되고 실제 승인취소는 운영자 수동 처리
- 상품 재고 기본 999. 품절 UI는 DB에서 `stock=0`으로 변경해야 노출

## 다음 테스트 요청 시 바로 할 일

1. `git status`와 최근 diff 확인
2. Node 22.x/pnpm 11.5.3 환경 확인
3. 개발 서버 실행 또는 대상 URL 확인. 결제 테스트는 로컬만 허용
4. 테스트 DB/계정 확인
5. `tests/checklists/manual-e2e.md` 기준으로 범위 선택
6. 실행 결과와 결함을 이 문서에 갱신
