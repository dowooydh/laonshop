# QA 핸드오프 최신본

작성일: 2026-07-11

담당: Codex QA/테스트 세션

대상: `main` / `5fe1417369f12e71328f221a34604f7a9229a07a`

결과: **FAIL**

출시 판정: **NO-GO**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 install, test, lint, typecheck, Prisma validate, production build는 통과했습니다.
- 로컬 production server, 데스크톱, 390/320 모바일폭, Android Chrome, API, DB를 함께 검증했습니다.
- 재고 1개 상품의 총수량 2 주문이 KSPAY 단계까지 진행되는 결함을 E2E와 DB로 확정했습니다.
- KSPAY 승인 평문 HTTP, result 동시 처리 경합, 주문 생성 멱등성 부재를 실결제 출시 차단 위험으로 확인했습니다.
- 상세 보고서: [2026-07-11 전수 QA 보고서](../reports/2026-07-11-full-audit/report.md)

## 우선 결함

| 우선순위 | 결함 | 증거 | 관련 위치 |
| --- | --- | --- | --- |
| P1 | 상품 재고 1인데 사이즈 S 1 + M 1, 총 2개 주문 생성·결제창 진입 | E2E + DB | `app/checkout/actions.ts:55-76` |
| P1 | KSPAY 승인키를 평문 HTTP로 전송하고 timeout 없음 | 코드 | `lib/kspay/kspay-provider.ts:29`, `:145-155` |
| P1 | 중복 result 승인 경합에서 실패 상태가 실제 성공 승인을 선점 가능 | 코드 | `app/api/pg/kspay/result/route.ts:15-55` |
| P1 | 신규 주문에 서버 멱등키가 없어 다중 탭·재전송 중복 주문 가능 | 코드 | `app/checkout/actions.ts:175-187` |
| P2 | 같은 이메일 동시 가입 중 한 요청이 Prisma P2002/500 | E2E + 서버 로그 | `app/(auth)/actions.ts:33-39` |
| P2 | 이메일 대소문자 변형 2개가 DB unique를 모두 통과 | rollback DB test | `app/(auth)/actions.ts:12`, `prisma/schema.prisma:18` |
| P2 | 320px 로그인 헤더 `scrollWidth=357` | 모바일폭 실측 | `app/layout.tsx:46-116` |
| P2 | PG 외부 스크립트 실패를 삼켜 무한 spinner | 코드 | `components/kspay-checkout.tsx:52-69` |
| P2 | `--fg-subtle` 대비 약 3.46:1로 일반 텍스트 AA 미달 | 계산 + 실화면 | `app/globals.css:17` |
| P3 | 일부 터치 타깃 20~36px | 실측 + 코드 | cart/category/header |
| P3 | production audit PostCSS moderate 1건 | `pnpm audit --prod` | Next 하위 PostCSS 8.4.31 |

## 통과 범위

- 회원가입 필수 동의, 로그인, 정확히 5회 잠금, 로그아웃, 보호 페이지
- 정보 수정, 비밀번호 변경, 회원탈퇴 취소/오류/익명화/주문 보존/재로그인 차단
- 상품 목록, 검색/빈 상태, 정렬, 찜, 최근 본 상품
- 장바구니 사이즈별 라인, 수량, 삭제, 새로고침 유지
- 배송지 프리필, 구매 동의, 서버 가격 재계산, 단일 탭 더블클릭 1건
- KSPAY 폼 진입, callback XSS escape, 빈 result PENDING 유지, 재결제 동일 주문
- 카드 마스킹 저장, 수기/원클릭 실호출 이중 guard
- 주문 IDOR 404, 주문완료/영수증 링크, 취소·반품 접수
- 1440px·390px 주요 화면, Android Chrome 홈·검색
- 푸터 사업자정보와 정책·지원 페이지

## 실행하지 못한 범위

- 실카드 승인/자동취소/실영수증
- 운영 Vercel 배포, Safari/WebKit, iOS 실제 기기
- 실제 PG 503/timeout·중복 승인 fault injection
- Android 홈·검색 이후 전 기능: Chrome 자체 ANR로 PARTIAL
- 200% 글자 확대, 전체 키보드 순회
- 관리자 화면: 저장소에 없음

## cleanup

- 이번 QA 사용자 5, 주문 3, 주문항목 4, 찜 1, QA 상품 1을 정리했습니다.
- 최종 DB 집계는 시작 전과 같은 사용자 9, 주문 4, 상품 329입니다.
- 실결제와 운영·마스터 데이터 변경은 없었습니다.

## 개발 회귀 요청

1. 동일 상품을 사이즈별로 나눈 재고 초과와 두 사용자 동시 주문을 차단합니다.
2. PG 승인 처리 선점·멱등성·성공 우선 상태 전이를 병렬 테스트합니다.
3. 주문 생성에 멱등키를 적용하고 다중 탭/재전송을 테스트합니다.
4. 회원가입 P2002를 사용자 오류로 변환하고 이메일을 case-insensitive unique로 만듭니다.
5. 320px 로그인 헤더, PG script 오류/재시도, subtle 대비를 회귀합니다.
