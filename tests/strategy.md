# 테스트 전략

## 범위

초기 QA 범위는 제품 코드 수정 없이 아래를 검증하는 것이다.

- 사용자 핵심 흐름: 탐색, 검색, 정렬, 찜, 최근 본 상품, 장바구니, 회원가입/로그인, 주문, 결제창 진입, 주문 결과
- 카드사 심사 흐름: 정책 페이지, 사업자정보, 결제경로 캡처 가능성
- 서버 경계: 인증 필요 페이지, 주문 생성 서버 액션, KSPAY callback/result API
- 회귀 위험: localStorage 장바구니/최근 본 상품과 서버 주문 데이터의 불일치, PG 스크립트 로드, 중복 result 처리, 로그인 잠금, 회원 탈퇴

## 테스트 레벨

| 레벨 | 목적 | 현재 상태 | 제안 |
| --- | --- | --- | --- |
| 수동 탐색 QA | 실제 사용자 관점 검증 | 즉시 가능 | `checklists/manual-e2e.md` 사용 |
| 브라우저 E2E | 핵심 플로우 자동 회귀 | 미구성 | Playwright 도입 후보 |
| API/서버 테스트 | PG callback/result, auth action 검증 | 미구성 | route handler 단위 테스트 또는 통합 테스트 |
| DB 검증 | 주문/상품/사용자 상태 확인 | 수동 가능 | 테스트 DB와 seed 필요 |
| 접근성/반응형 | 모바일/키보드/텍스트 겹침 | 수동 가능 | 모바일 viewport와 키보드 탐색 체크 |

## 우선순위

P0:
- 결제 금액 서버 재계산
- 주문 소유권 보호
- KSPAY callback/result 상태 전이
- 회원가입/로그인/로그아웃
- 약관/개인정보 동의 서버 검증
- 회원 탈퇴 익명화
- 카드사 심사 필수 푸터/정책 페이지

P1:
- 장바구니 수량/삭제/빈 상태
- 상품 상세 사이즈/수량
- 검색/정렬/찜/최근 본 상품
- 결제수단 비활성 상태
- 배송지 자동입력과 구매 동의
- 결제 완료 후 장바구니 정리
- 영수증 링크
- 취소/반품 신청 접수
- 마이페이지 설정/비밀번호 변경
- 모바일 주요 화면 레이아웃

P2:
- 이미지 로드 품질
- reduced motion 환경
- 주문 목록 50건 제한
- 잘못된 gender/product/order URL 처리
- 로그인 잠금 해제 UX

## 권장 자동화 구조

자동화 도입 승인을 받으면 아래처럼 추가한다.

```text
tests/
  e2e/
    auth.spec.ts
    catalog.spec.ts
    search-wishlist.spec.ts
    cart-checkout.spec.ts
    mypage-settings.spec.ts
    order-cancel-return.spec.ts
    policy-review.spec.ts
  api/
    kspay-callback.spec.ts
    kspay-result.spec.ts
    order-security.spec.ts
  fixtures/
    users.ts
    products.ts
  reports/
```

## 실행 환경 원칙

- 운영 DB 대신 테스트 DB 또는 로컬 DB를 사용한다.
- 테스트 사용자는 이메일에 `+qa` 또는 `qa-YYYYMMDD` 식별자를 둔다.
- 상품 마스터, 운영 계정, PG 설정은 삭제하지 않는다.
- 주문 테스트 데이터는 직접 생성한 테스트 사용자 범위 안에서만 정리한다.
- KSPAY 실거래/테스트 승인 플로우는 사전 승인된 MID와 테스트 카드 절차가 있을 때만 수행한다.
- KSPAY 결제 왕복은 로컬 `http://localhost:3003`에서만 수행한다. Vercel Preview 결제 테스트는 금지한다.

## 버그로 보고하지 않을 의도된 상태

- 가상계좌·무통장입금은 현재 결제수단에서 제외한다.
- 원클릭 카드 등록·결제는 계약과 안전한 PG 연동 완료 전까지 UI와 서버에서 모두 차단한다.
- 수기결제는 계약 키와 live switch 준비 전까지 모든 계정의 UI·서버에서 차단하고 mock PAID를 만들지 않는다.
- 카드·카카오페이·네이버페이·실시간계좌이체는 현재 코드의 KSPAY 결제창 수단이다.
- KSPAY result는 HMAC·PG `ordno`·금액·승인번호·거래번호를 검증한다. `reHash` 사전 결박 규격 전에는 테스트 MID만 승인하며 실 MID는 차단한다.
- footer의 통신판매업신고 `신고 예정`은 심사 직전 번호로 교체할 예정인 상태다.
- 이메일 인증과 비밀번호 재설정은 현재 단계에서 의도적 미구현이다.
- 취소/반품 신청은 접수까지만 처리하며 실제 승인취소는 운영자 수동 처리다.
- 상품 재고는 기본 999이며, 품절 UI는 DB에서 `stock=0`으로 변경해야 확인된다.
