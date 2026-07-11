# QA 핸드오프 최신본

작성일: 2026-07-11

담당: Codex QA/테스트 세션

대상: `main` / `8dc613b1df8607fe27a891e48426726654074439`

비교 범위: `d70ccf1a14b734c5d4681682926b7fbec5bc7588..8dc613b1df8607fe27a891e48426726654074439`

결과: **FAIL**

출시 판정: **NO-GO - 관리자 확정 성공 후 UI 무한 pending P1**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 21/21, skip 0, lint, typecheck, Prisma validate, production audit와 build가 모두 통과했습니다.
- DB 역할 RBAC, 5분 보호, 입력 검증, advisory lock, PAID/FAILED 동시성, PG callback 경합 모사, 주문-감사로그 원자성은 통과했습니다.
- 결제 확정은 DB와 감사로그에 정상 커밋되지만 관리자 화면이 `aria-busy=true`와 spinner 상태로 끝나지 않는 P1을 발견했습니다.
- Android 로컬 HTTP에서 `crypto.randomUUID` 부재로 전역 오류 화면이 발생하는 P2와, 관리자 주요 명령 높이 40px의 터치 타깃 P2를 발견했습니다.
- 상세 보고서: [2026-07-11 `8dc613b` 관리자 회귀 QA 보고서](../reports/2026-07-11-8dc613b-admin-regression/report.md)

## 결함

| ID | 우선순위 | 결함 | 증거·관련 위치 |
| --- | --- | --- | --- |
| QA-8DC-01 | P1 | 정상 PAID/FAILED 확정 후 DB는 커밋되지만 UI가 무한 pending, 목록도 stale | `admin-success-stuck-390.png`; `app/admin/actions.ts:108`, 두 admin form의 `useActionState` |
| QA-8DC-02 | P2 | Android `10.0.2.2` HTTP에서 `crypto.randomUUID` 부재로 ERROR 화면 | `android-http-randomuuid-error.png`; `lib/checkout-idempotency.ts:48` |
| QA-8DC-03 | P2 | 관리자 확정 버튼·상단 명령 높이 40px | `lib/ui/button.tsx:22`, admin forms |

## 핵심 통과 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| guest/CUSTOMER/ADMIN RBAC | PASS | redirect/404/직접 Action 404, DB 변화 0 |
| DB role 강등·deletedAt | PASS | 기존 세션 즉시 차단 |
| 액션 도중 role 강등 | PASS | lock 7.4초 후 권한 오류, marker/audit 0 |
| 5분 보호 구간 | PASS | 화면 분리와 stale form 서버 거부 |
| PAID/FAILED 입력 검증 | PASS | 금액·승인번호·pgTrno·MOID·체크·메모 검증 |
| 중복 pgTrno | PASS | PENDING+marker 유지, audit 0 |
| 정상 상태 전환 | PASS | PAID/FAILED와 audit 1 원자 저장 |
| PAID/FAILED 동시 제출 | PASS | 성공 1, 오류 1, audit 1 |
| PG callback 경합 모사 | PASS | 동일 lock 5.9초 대기, PG PAID 유지, admin audit 0 |
| 감사로그 insert 실패 | PASS | actor FK fault 뒤 주문 rollback, audit 0 |
| 구매자 재결제 경계 | PASS | FAILED만 재결제, marker는 확인 중 |
| 계정 정책 | PASS | 가입 CUSTOMER, 관리자 11자 거부/12자 cost12, 탈퇴 차단 |
| 긴 문자열·XSS·키보드 | PASS | 실행 0, overflow 0, details Enter/Space |
| 운영 배포 | PASS | Vercel READY, production SHA `8dc613b`, guest `/admin`→`/login` |

## 미실행·잔여 위험

- 실 KSNET/KSTA 조회·승인·취소·영수증
- 운영 관리자 로그인 이후 쓰기 흐름
- Safari/WebKit, iOS 실제 기기
- Android 관리자 화면은 QA-8DC-02로 로그인 이후 검증 중단

## cleanup

- QA 사용자 4명, 주문 9건, 주문항목 9건, 감사로그 4건, QA 상품 1개를 삭제했습니다.
- 최종 DB는 사용자 9, 활성 사용자 8, 주문 4, 주문항목 4, 상품 329, 감사로그 0, 등록카드 4, 찜 0, QA fixture 0입니다.
- 3003 서버와 Android CDP forward를 종료했습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없었습니다.

## 개발 회귀 요청

1. QA-8DC-01 수정 후 PAID/FAILED 단일 제출에서 3초 이내 pending 종료, 성공 메시지, 목록 제거, 감사 이력 노출을 함께 검증합니다.
2. `crypto.randomUUID` 없는 비보안 모바일 호스트 fallback을 추가하고 Android `10.0.2.2`에서 로그인·로그아웃·계정 전환을 재검증합니다.
3. 관리자 주요 명령의 모바일 높이를 44px 이상으로 보정하고 320/390/412px을 재측정합니다.
