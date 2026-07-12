# QA 핸드오프 최신본

작성일: 2026-07-12

담당: Codex QA/테스트 세션

대상: `main` / `b24aa40a2ee169ad7d8c8f1251db24bd04f24a51`

비교 범위: `79efe2d155a78af927898070b97515bf385793dc..b24aa40a2ee169ad7d8c8f1251db24bd04f24a51`

결과: **PASS**

출시 판정: **GO - QA-C695-01~04 수정 및 인접 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 24/24, skip 0, lint, typecheck, Prisma validate, production audit, build와 diff check가 모두 통과했습니다.
- 이전과 같은 긴 값 fixture로 320/360/390/412px × 100%/200%의 mypage/settings/cart/checkout/order/retry를 실제 검증했습니다.
- checkout 기본·원클릭·수기와 retry 기본·원클릭의 document·descendant·버튼 내부 치수가 모두 통과했습니다.
- 320px·200% 9개 핵심 상태는 overflow-hidden/clip 조상 침범을 별도 검사해 모두 0이었습니다.
- 실제 Android Chrome 인증 후 412px·200% 핵심 화면도 `scrollWidth=viewport`, outside/clipped 0으로 통과했습니다.
- 1280px 기존 배치, 키보드·focus-visible·44px 타깃, 뒤로가기·새로고침을 확인했습니다.
- 운영 배포 SHA 일치, guest smoke와 최근 1시간 runtime error/fatal 0을 확인했습니다.
- 상세 보고서: [2026-07-12 `b24aa40` 모바일·200% 확대 수정 회귀 QA 보고서](../reports/2026-07-12-b24aa40-responsive-fix-regression/report.md)

## 결함 회귀

| ID | 이전 결과 | 현재 결과 | 핵심 비교 |
| --- | --- | --- | --- |
| QA-C695-01 | checkout `sw529`, settings `sw488` | PASS | 둘 다 320px·200% `sw305=vw305` |
| QA-C695-02 | mypage 정상 `sw328`, 200% `sw655` | PASS | 정상·200% 모두 `sw305=vw305` |
| QA-C695-03 | cart `sw451`, 증가 right 450 | PASS | `sw305`, 증가 right 166, 삭제 right 260 |
| QA-C695-04 | retry `sw363`, 카드·CTA clipping | PASS | `sw305`, card/CTA internal scroll=client |

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 24/24, lint/typecheck/prisma/audit/build/diff check PASS |
| mypage/settings | PASS | 4폭×2배율 outside/clipped 0, 주소 행 100% 한 행·200% 두 행 |
| cart | PASS | 4폭×2배율 `sw=vw`, 44px 수량·삭제, desktop 3열 1행 |
| checkout | PASS | 기본·원클릭·수기 전 조합, 카드·CTA internal scroll=client |
| order/retry | PASS | 4개 상태와 재결제 기본·원클릭, 긴 MOID·금액·주소 통과 |
| 키보드·접근성 | PASS | Tab/Shift+Tab, Space, aria-pressed, 2px focus ring, 44px 타깃 |
| Android Chrome | PASS | 인증 화면 412px·200%, `sw=vw=412`, outside/clipped 0 |
| desktop 1280px | PASS | cart 3열 1행, 결제수단 2열, 카드 입력 2열 |
| 운영 배포 | PASS | READY, production SHA `b24aa40`, runtime error/fatal 0 |

## 도구 이슈

- Android 최초 로그인 확인은 좁은 헤더의 시각적 줄바꿈 때문에 연속 문자열 단정만 실패했습니다. `/mypage` 접근과 제목으로 재검증해 실제 인증 유지와 핵심 화면 PASS를 확인했습니다.
- Android 요소 screenshot은 안정화 대기 30초 제한에 걸렸지만 캡처 없는 동일 흐름에서 DOM·콘솔 결과를 회수했습니다. 제품 실패가 아닙니다.

## 미실행·잔여 위험

- Safari/WebKit, iOS 실제 기기
- 운영 인증 사용자 쓰기 흐름
- 실 KSNET/KSTA 승인·취소·영수증
- 결제·재결제 submit 및 설정 저장·삭제 Server Action

## cleanup

- 독립 fixture 두 차례에서 누적 QA 사용자 2명, 주문 8건, 주문항목 8건, 등록카드 2건, 찜 2건, QA 상품 2개를 삭제했습니다.
- 최종 DB는 사용자 10, 활성 사용자 9, 주문 4, 주문항목 4, 상품 329, 감사로그 0, 등록카드 4, 찜 0으로 기준선을 복원했습니다.
- QA fixture 잔존은 0건이며 3003 서버, Playwright, Android CDP forward/reverse를 종료했습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없었습니다.

## 개발 회귀 요청

자동 수정 1/2 결과 PASS입니다. 추가 제품 수정 없이 현재 제품 커밋을 출시 후보로 유지하고 Safari/WebKit·iOS와 실 PG는 별도 검증 범위로 관리합니다.
