# QA 핸드오프 최신본

작성일: 2026-07-02
담당: Codex QA/테스트 세션
상태: 초기 QA 운영 구조 생성, 테스트 미실행

## 이번 작업 요약

- 프로젝트 구조, 주요 라우트, 데이터 모델, 결제 흐름을 읽고 QA 관점으로 정리했다.
- 제품 코드는 수정하지 않았다.
- `tests/` 아래 QA 운영 문서, 체크리스트, 데이터 정책, 핸드오프 문서를 생성했다.
- 초기 요청에 따라 실제 E2E 테스트는 아직 실행하지 않았다.

## 주요 기능 맵

- 쇼핑: 홈, 성별 상품 목록, 상품 상세
- 장바구니: localStorage 저장, 수량 변경, 삭제, 빈 상태
- 인증: 회원가입, 로그인, 로그아웃, 보호 페이지
- 주문/결제: 서버 주문 생성, KSPAY 인증결제창, callback/result API, 주문 상태 전이
- 마이페이지: 사용자 주문 목록, 주문 상세
- 카드사 심사: 푸터 사업자정보, 이용약관, 개인정보처리방침, 환불 정책

## 테스트 전략

- 우선 수동 E2E 체크리스트로 핵심 흐름을 검증한다.
- 자동화는 Playwright/API 테스트 도입 승인을 받은 뒤 `tests/e2e`, `tests/api`에 추가한다.
- 결제 관련 테스트는 KSPAY 테스트 MID와 테스트 카드/절차 확인 후 실행한다.
- 운영 데이터 삭제는 금지하고, QA 생성 데이터만 정리한다.

## 필요한 계정/서버/기기/권한

### 계정

- 테스트 회원 생성 가능 권한 또는 QA 전용 계정
- 가능하면 `qa+...@example.test` 패턴 사용
- KSPAY 테스트 결제를 실행할 경우 테스트 카드/결제 절차 정보

### 서버/환경

- 로컬 개발 서버: `pnpm dev` 기본 포트 `3003`
- 빌드 검증: `pnpm build`
- 테스트 DB 또는 로컬 DB 연결 문자열
- 환경 변수: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `PG_MODE=kspay`, `KSPAY_STORE_ID`

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
| P1 | 푸터 사업자정보에 대표/주소가 현재 표시되지 않는 것으로 보인다. 카드사 심사 필수 요소 기준 충족 여부 확인 필요 | `app/layout.tsx` | 사업자정보 최종 요구사항 |
| P1 | 장바구니는 localStorage 가격을 표시하지만 주문 금액은 서버 재계산이다. 화면 표시 금액과 실제 주문 금액 불일치 케이스 확인 필요 | `lib/cart.ts`, `app/checkout/actions.ts` | 가격 변경 후 기존 장바구니 |

## 다음 테스트 요청 시 바로 할 일

1. `git status`와 최근 diff 확인
2. 개발 서버 실행 또는 대상 URL 확인
3. 테스트 DB/계정 확인
4. `tests/checklists/manual-e2e.md` 기준으로 범위 선택
5. 실행 결과와 결함을 이 문서에 갱신

