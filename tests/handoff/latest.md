# QA 핸드오프 최신본

작성일: 2026-07-12

담당: Codex QA/테스트 세션

대상: `main` / `970b098c5d8f2b88247474119b85962459c2876f`

비교 범위: `15db7fb21e1e38cf0bc4d4daf1109bc21e000468..970b098c5d8f2b88247474119b85962459c2876f`

결과: **PASS**

출시 판정: **GO - QA-AC95-01 수정 및 관련 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 24/24, skip 0, lint, typecheck, Prisma validate, production audit와 build가 모두 통과했습니다.
- 320px·글자 200%에서 PAID/FAILED details right `272`, form right `232`로 article right `273` 안에 들어왔습니다.
- 320/390/412px·200%, 일반 글자 세 폭, 1280px 2열에서 실제 요소 경계·버튼 내부 비클리핑·44px 타깃을 확인했습니다.
- Enter/Space, Tab/Shift+Tab 순서와 focus-visible ring 비클리핑을 확인했습니다.
- PAID/FAILED 성공 전환은 각각 1.806초/1.188초, 오류 재제출 1.074초, 실제 dblclick POST 1회로 통과했습니다.
- 두 탭은 POST 2회 중 성공 URL 1개, 대기 URL 1개이며 DB PAID/audit는 정확히 1건입니다.
- 상세 보고서: [2026-07-12 `970b098` 관리자 200% reflow 최종 QA 보고서](../reports/2026-07-12-970b098-final-regression/report.md)

## 결함 회귀

| ID | 이전 결과 | 현재 결과 | 증거 |
| --- | --- | --- | --- |
| QA-AC95-01 | FAIL - 320px·200% details/form 우측 잘림 | PASS - 모든 폼과 컨트롤 article 내부 | `admin-320-font200-paid-fixed.png`, `admin-320-font200-failed-fixed.png` |

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 320px·200% PAID/FAILED | PASS | article right 273, details 272, form/controls 232 |
| 390/412px·200% | PASS | details/form/control right가 article 내부 |
| 일반 글자·desktop 2열 | PASS | 세 모바일 폭 48px, 1280px 551px 2열 |
| 키보드·focus | PASS | Enter/Space, 정·역 Tab 순서, 2px focus ring |
| PAID/FAILED 성공 | PASS | 3초 이내 fixed query GET, queue 0, audit 1 |
| 오류 후 재제출 | PASS | inline 오류·busy 해제 후 1.074초 성공 |
| dblclick | PASS | POST 1, PAID/audit 1 |
| 두 탭 동시 제출 | PASS | POST 2, 성공 1, DB PAID/audit 1 |
| 운영 배포 | PASS | Vercel READY, production SHA `970b098`, guest `/admin`→`/login`, runtime error 0 |

## 도구 이슈

- 최초 PAID 브라우저에서 Playwright MCP transport가 action 완료 뒤 종료됐으나 DB는 정상 PAID/audit 1이었고, fixture 초기화 후 독립 프로세스로 UI 전환까지 재검증했습니다.
- 두 탭 초기 시도는 DB 확정 뒤 DOM 수집이 30초 제한에 걸렸습니다. 최종 단축 실행에서 두 URL과 POST 수를 회수했고 DB 정확히 한 번을 확인했습니다. 제품 실패로 처리하지 않았습니다.

## 미실행·잔여 위험

- 실 KSNET/KSTA 조회·승인·취소·영수증
- 운영 관리자 로그인 이후 쓰기 흐름
- Safari/WebKit, iOS 실제 기기
- Android 로컬 HTTP checkout 재검증
- JS 차단 시 성공 후 자동 이동

## cleanup

- QA 사용자 2명, 주문 6건, 주문항목 6건, 감사로그 5건, QA 상품 1개를 삭제했습니다.
- 최종 DB는 사용자 10, 활성 사용자 9, 주문 4, 주문항목 4, 상품 329, 감사로그 0, 등록카드 4, 찜 0, QA fixture 0입니다.
- 3003 서버와 headless Chrome을 종료했고 listener·잔여 QA 프로세스가 없습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없었습니다.

## 개발 회귀 요청

자동 수정 2/2 결과 PASS입니다. 추가 제품 수정 없이 현재 커밋을 출시 후보로 유지하고, 실 PG 및 Safari/iOS는 별도 검증 범위로 관리합니다.
