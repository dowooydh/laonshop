# QA 핸드오프 최신본

작성일: 2026-07-12

담당: Codex QA/테스트 세션

대상: `main` / `ac9521a84bcb6bcc5d7bff70969b92eb851814ea`

비교 범위: `d8da743a10bcc23f492089d45d4eef3fa51a2dd4..ac9521a84bcb6bcc5d7bff70969b92eb851814ea`

결과: **FAIL**

출시 판정: **NO-GO - 320px·글자 200% 관리자 확정 폼 잘림 P2**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 24/24, skip 0, lint, typecheck, Prisma validate, production audit와 build가 모두 통과했습니다.
- PAID/FAILED 정상 제출은 3초 이내 새 GET으로 이동했고 성공 안내·대기열 제거·DB 상태·감사로그 1건을 함께 확인했습니다.
- Android 로컬 HTTP에서 `randomUUID` 없이 `getRandomValues` UUID v4 fallback, 로그인·로그아웃·nonce 회전이 정상 동작했습니다.
- 관리자 주요 버튼과 상단 명령은 모바일 세 폭에서 48px입니다.
- 320px·글자 200%에서 확정 폼이 카드 밖으로 넓어지고 `overflow-hidden`에 의해 우측이 잘리는 P2를 발견했습니다.
- 상세 보고서: [2026-07-12 `ac9521a` 관리자 완료 전환 회귀 QA 보고서](../reports/2026-07-12-ac9521-regression/report.md)

## 결함

| ID | 우선순위 | 결함 | 증거·관련 위치 |
| --- | --- | --- | --- |
| QA-AC95-01 | P2 | 320px·글자 200%에서 details/form이 카드보다 넓고 우측 입력·버튼이 잘림 | `admin-320-font200-clipped.png`; `app/admin/page.tsx:143`, `app/admin/page.tsx:170` |

## 핵심 통과 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| PAID 성공 전환 | PASS | 3초 이내 fixed query GET, banner/queue 0/DB PAID/audit 1 |
| FAILED 성공 전환 | PASS | 2.447초, banner/queue 0/DB FAILED/audit 1 |
| 오류 inline 복구 | PASS | 금액·MOID·중복 pgTrno 오류 후 busy 해제, 정상 재제출 가능 |
| reload/back | PASS | POST 재전송·처리 전 폼 복원 없음 |
| 실제 dblclick | PASS | POST 1, 주문 상태/audit 정확히 1 |
| 두 탭 병렬 제출 | PASS | 성공 1·오류 1, 주문 상태/audit 정확히 1 |
| guest/CUSTOMER RBAC | PASS | `/login` redirect / semantic 404 |
| Android nonce fallback | PASS | 비보안 HTTP UUID v4, ADMIN login/logout, 전역 오류 0 |
| 모바일 터치 타깃 | PASS | 상단 명령·확정 버튼 48px |
| 320px·200% 폼 | FAIL | details right 394, form right 354, 카드 overflow로 clip |
| 운영 배포 | PASS | Vercel READY, production SHA `ac9521a`, guest `/admin`→`/login` |

## 미실행·잔여 위험

- 실 KSNET/KSTA 조회·승인·취소·영수증
- 운영 관리자 로그인 이후 쓰기 흐름
- Safari/WebKit, iOS 실제 기기
- Android CUSTOMER 계정 전환과 로컬 HTTP checkout 제출
- JS 차단 시 성공 후 자동 이동, 동일 JS task 프로그램 방식 2회 click

## cleanup

- QA 사용자 3명, 주문 9건, 주문항목 9건, 감사로그 5건, QA 상품 1개를 삭제했습니다.
- 최종 DB는 사용자 10, 활성 사용자 9, 주문 4, 주문항목 4, 상품 329, 감사로그 0, 등록카드 4, 찜 0, QA fixture 0입니다.
- 3003 서버와 Android CDP forward를 종료했습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없었습니다.

## 개발 회귀 요청

1. QA-AC95-01 수정 후 article/details/form/input/button 각각의 실제 우측 경계가 viewport 안인지 측정합니다.
2. PAID/FAILED 폼을 각각 열고 320/390/412px·글자 200%에서 모든 필드와 확정 버튼의 시각·키보드 접근성을 재검증합니다.
3. Android 로컬 HTTP checkout까지 지원 대상이면 `crypto.subtle` 부재 경로도 별도 fallback 또는 명시적 지원 정책으로 검증합니다.
