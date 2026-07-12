# QA 핸드오프 최신본

작성일: 2026-07-12

담당: Codex QA/테스트 세션

대상: `main` / `c695ea97e739faabfd84b2c3913cfd12f67950d2`

비교 범위: `4eec28dbaafcf49c5183f9a502d8678a871bf8b6..c695ea97e739faabfd84b2c3913cfd12f67950d2`

결과: **FAIL**

출시 판정: **NO-GO - 체크아웃·장바구니·재결제의 200% 확대 조작 결함 수정 필요**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 24/24, skip 0, lint, typecheck, Prisma validate, production audit와 build가 모두 통과했습니다.
- 공개 13개 경로와 404의 320/360/390/412px × 100%/200% 112조합은 실제 요소 경계 오버플로 0으로 통과했습니다.
- 홈 히어로는 정상 글자에서 제목 1줄, 설명 2줄, CTA 한 줄 라벨을 유지했습니다.
- 로그인 후 실제 사용자 흐름에서는 200% 확대 시 체크아웃·설정·장바구니·마이페이지·재결제의 수평 오버플로와 조작부 잘림이 재현됐습니다.
- Android Chrome 412px 공개 홈 100%/200%와 guest checkout→login은 통과했습니다. HTTP 로컬 대상의 `Secure` 세션 제한으로 Android 인증 화면은 미실행입니다.
- 상세 보고서: [2026-07-12 `c695ea9` 모바일·200% 확대 회귀 QA 보고서](../reports/2026-07-12-c695ea9-responsive-regression/report.md)

## 발견 결함

| ID | 우선순위 | 결과 | 핵심 증거 |
| --- | --- | --- | --- |
| QA-C695-01 | P1 | FAIL | checkout `sw529`, settings `sw488`; 주소 버튼·결제 CTA 화면 밖 |
| QA-C695-02 | P2 | FAIL | mypage 320px 정상 `sw328`, 200% `sw655`; 긴 계정값·설정 링크 밀림 |
| QA-C695-03 | P1 | FAIL | cart 200% `sw451`; 수량 증가 right 450 |
| QA-C695-04 | P1 | FAIL | retry 200% `sw363`; 카드 배지·결제 CTA 내부 잘림 |

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 24/24, lint/typecheck/prisma/audit/build PASS |
| 공개 모바일 112조합 | PASS | descendant rect overflow/clipping 0 |
| 홈·목록·상품 상세 | PASS | 정상 2열/200% 1열, 히어로·표·CTA 경계 통과 |
| 인증 모바일 100% | PARTIAL | 360~412px 통과, 320px mypage 긴 값 오버플로 |
| 인증 모바일 200% | FAIL | checkout/settings/cart/mypage/retry 수평 오버플로 |
| 키보드·focus | PASS | Enter/Space, Tab, aria-pressed, 2px focus-visible |
| desktop 1280px | PASS | 결제 2열, 상품 4열 유지 |
| Android Chrome | PARTIAL | 공개 화면 PASS, 인증 화면 미실행 |
| 운영 배포 | PASS | READY, production SHA `c695ea9`, runtime error/fatal 0 |

## 원인 후보

- `components/address-input.tsx:90`: 고정 가로 주소 행, `w-32` 입력, 줄바꿈 없는 버튼
- `app/checkout/checkout-form.tsx:234,340`: 카드 행과 금액 CTA의 고정 한 줄 배치
- `app/mypage/page.tsx:56`: 긴 사용자 값 child의 최소폭·강제 줄바꿈 부재
- `app/cart/page.tsx:59,67`: 이미지·정보·수량·삭제의 고정 가로 조합
- `app/order/[id]/retry-payment.tsx:103,127`: 등록 카드 행과 재결제 CTA의 고정 한 줄 배치

## 미실행·잔여 위험

- Android 인증 후 결제·주문·마이페이지
- Safari/WebKit, iOS 실제 기기
- 실 KSNET/KSTA 승인·취소·영수증
- 운영 로그인 이후 쓰기 흐름

## cleanup

- QA 사용자 1명, 주문 4건, 주문항목 4건, 등록카드 1건, 찜 1건, QA 상품 1개를 삭제했습니다.
- 최종 DB는 사용자 10, 활성 사용자 9, 주문 4, 주문항목 4, 상품 329, 감사로그 0, 등록카드 4, 찜 0으로 기준선을 복원했습니다.
- QA fixture 잔존은 0건이며 3003 서버, Playwright, Android CDP 포트 포워딩을 종료했습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없었습니다.

## 개발 회귀 요청

P1 세 건을 수정한 뒤 320/360/390/412px 200%에서 document 폭뿐 아니라 주소 버튼, 수량 컨트롤, 카드 배지, 결제 CTA의 실제 경계와 내부 비클리핑을 다시 검증해야 합니다.
