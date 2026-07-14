# b234b32 결제 승인 경계·상품 이미지 복구 회귀 QA 보고서

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상 제품 커밋: `b234b3204d205c2d75b322894dfb6049593b932c`

비교 범위: `a51524dfda96604e818e1019303af05aa1587a61..b234b3204d205c2d75b322894dfb6049593b932c`

결과: **PASS**

출시 판정: **GO - 테스트 MID 카드사 심사 경로와 이미지 복구 기준 통과 / 실 MID는 공식 사전 결박 스펙 구현 전 NO-GO**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다. QA 임시 러너는 실행 후 모두 삭제했습니다.
- 결제 검증은 전부 로컬 provider stub과 테스트 DB fixture로 실행했고 KSNET 외부 승인·취소·영수증 호출은 하지 않았습니다.
- 운영에서는 공개 페이지·정적 이미지·읽기 전용 이미지 API와 Vercel 상태만 확인했습니다. 운영 로그인·DB 쓰기·환경변수 변경은 실행하지 않았습니다.
- credential, 세션, 카드정보, 환경변수 실제 값은 출력하거나 보고서에 기록하지 않았습니다.

## 저장소·배포 기준

- 검증 대상은 `main=origin/main=b234b3204d205c2d75b322894dfb6049593b932c`입니다.
- Vercel deployment `dpl_J95BkVcwk69SP7TjzARArkrc7yqE`는 `READY`, target `production`, Git SHA `b234b32`입니다.
- `laonshop.com`, `www.laonshop.com`과 고정 배포 URL이 같은 production 배포에 연결돼 있습니다.
- 최근 1시간 Vercel runtime error cluster는 0건이고 해당 배포의 error/fatal 로그도 0건입니다.
- `AGENTS.md`와 `CLAUDE.md`는 바이트 단위로 동일합니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3에서 실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 49/49, fail 0, skip 0 |
| 이미지 gate | PASS | 상품 329개, WebP 1,645장, 1200x1500, exact duplicate 0 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 독립 코드 검토

| 검토 항목 | 결과 | 근거 |
| --- | --- | --- |
| result 토큰 결박 | PASS | `SESSION_SECRET` HMAC-SHA256가 주문 ID·moid·금액을 함께 서명하고 길이·형식·constant-time 비교를 적용합니다. |
| callback 입력 경계 | PASS | 빈 승인키, 취소값, 1,024자 초과 comm ID, 타 주문 토큰은 marker 기록과 provider 호출 전에 거부합니다. |
| MID fail-closed | PASS | 서버승인은 테스트 MID `2999199999`만 허용하고 실 MID 합성값은 외부 호출 전에 차단합니다. |
| PG 결과 결박 | PASS | 성공 응답은 PG ordno=moid, 승인금액, 승인번호, 거래번호가 모두 유효해야 확정합니다. 불일치는 `PENDING+marker`를 유지합니다. |
| 정확히 한 번 처리 | PASS | marker를 별도 트랜잭션으로 먼저 커밋하고 최종 확정 시에도 주문 advisory lock과 현재 marker를 재검증합니다. |
| WEBFEP 전송 | PASS | 공식 KSNET HTTPS origin만 허용하고 `redirect:error`, 8초 timeout, 성공 tid·approvalNumb 길이 검증을 적용합니다. |
| 미계약 결제 차단 | PASS | 원클릭과 수기 mock 승인 생성이 제거됐고 gate OFF에서는 UI와 직접 Server Action 모두 주문 생성 전 거부합니다. |
| KSPAY 스크립트 | PASS | jQuery 1.12.4 URL·SRI·`crossOrigin=anonymous`·`referrerPolicy=no-referrer`가 고정돼 있습니다. |
| 이미지 URL 경계 | PASS | 허용된 local/brand/HTTPS host만 유지하고 `javascript:`, credentials, custom port, fragment 등은 제거합니다. |
| 이미지 복구 API | PASS | active 상품만 읽고 ID 1~50개·각 64자 이하를 강제하며 `private, no-store`로 반환합니다. |

## 결제 결과 통합 검증

실제 route, Prisma 트랜잭션, provider fetch stub을 함께 사용했습니다.

- 잘못된 토큰, 타 주문 토큰, 빈 comm ID, 취소값, 길이 초과 comm ID는 외부 provider 호출 0회이며 주문 status·approvalNo·pgTrno 변화가 0이었습니다.
- 실 MID 합성값은 외부 provider 호출 0회, DB 변화 0으로 차단됐습니다.
- PG ordno 불일치, 금액 불일치, 승인번호 누락, 거래번호 누락 4종은 각각 외부 호출 1회 후 `PENDING+__KSPAY_PROCESSING__`을 유지했습니다.
- 위 불일치 주문을 같은 요청으로 재전송해도 외부 호출은 추가 0회였습니다.
- 명시적 승인 거절은 `FAILED`, marker 해제로 확정됐습니다.
- 동일 valid result 2개를 병렬 제출했을 때 외부 승인 stub은 정확히 1회, 주문은 `PAID` 1건으로 확정됐고 후속 재전송의 추가 호출은 0회였습니다.
- fixture로 사용자 1명, 상품 1개, 주문·항목 각 13개를 생성했으며 검증 직후 전부 삭제해 시작 카운트를 복원했습니다.

## WEBFEP fault injection

- 307, 308, HTTP 503, connection close, timeout, 비정상 JSON, 승인번호 누락, tid 누락, tid 길이 초과 9종을 stub으로 실행했습니다.
- 모든 fault는 요청 1회만 발생했고 성공/실패 확정 대신 `indeterminate=true`로 반환됐습니다.
- 각 요청의 redirect mode는 `error`, method는 POST, timeout signal은 `AbortSignal`임을 단정했습니다.
- 정상 envelope는 앞뒤 공백을 제거한 tid·approvalNumb·카드사명으로 1회 성공했습니다.
- 카드 원문과 API 키는 로그·증거에 남기지 않았습니다.

## 이미지·저장 데이터 전수 검증

- 활성 상품 329개 모두 `getProductDetailImages` 결과가 정확히 5장이었습니다.
- 자산 경로 1,645개와 SHA-256 digest 1,645개가 모두 고유해 누락·정확 중복·다른 slug 혼입이 없었습니다.
- 로컬 production 상품 상세 HTML 329/329가 HTTP 200이며 각 페이지에서 버전된 01~05 참조가 정확히 5개였습니다.
- 이번 범위에는 WebP 파일 자체 변경이 없습니다. 직전 기준의 329개 전 상품 시각 감사 결과와 이번 자산 digest·HTML 결과를 교차해 이미지 내용 회귀가 없음을 확인했습니다.
- 이미지 API 정상 요청은 200, 빈 ID·65자 ID·51개 ID는 400, cache-control은 `private, no-store, max-age=0`이었습니다.
- 구형 cart/recent의 `imageUrl=null`과 악성 URL은 허용된 버전 URL로 복구되고 수량 2·사이즈 M·checkout nonce가 유지됐습니다.
- 이미지 API 503에서는 항목·수량·사이즈·nonce가 유지됐고, localStorage quota 오류에서는 저장 원본을 보존하면서 현재 화면에 복구 이미지를 표시했습니다.

## 로컬 production 브라우저

설치된 Google Chrome을 사용했습니다. Playwright 번들 Chromium 추가 설치는 하지 않았습니다.

- 상품 상세를 320/360/390/412px의 100%·200% 8조합에서 확인했습니다.
- 모든 조합에서 상세 이미지 5장, 원본 비율 약 0.8, 대표 이미지 priority, 나머지 4장 lazy, 문서와 주요 descendant의 가로 overflow 0이었습니다.
- 인증 fixture로 checkout에 진입해 카드·카카오페이·네이버페이·실시간 계좌이체 4개를 확인했습니다.
- gate OFF에서 수기결제·원클릭 버튼은 각각 0개였고 320/390/412px 200%에서도 overflow가 없었습니다.
- 설정 화면의 카드 원문 입력과 카드 등록 버튼은 0개였습니다.
- 의도적으로 주입한 이미지 API 503 콘솔 1건을 제외한 console warning/error와 page error는 0이었습니다.

## Android Chrome

- Android emulator Chrome 133.0.6943.137에서 운영 공개 화면을 확인했습니다.
- 실제 CSS 폭 412px의 100%·200%에서 `innerWidth=clientWidth=scrollWidth=412`였습니다.
- 운영 상품 상세 이미지 5장과 4:5 비율, 구형 cart 이미지 복구, 수량·사이즈·nonce 보존을 확인했습니다.
- 비로그인 `/checkout`은 `/login`으로 이동했고 console warning/error와 4xx/5xx 리소스는 0이었습니다.
- 테스트 후 Android localStorage와 쿠키, CDP 포워딩을 정리했습니다.

## 운영 공개 검증

- `https://laonshop.com`, `https://www.laonshop.com`, 고정 배포 URL은 모두 HTTP 200이었습니다.
- 운영 샘플 상품 HTML은 버전된 상세 이미지 참조 5개를 반환했습니다.
- 운영 정적 WebP 5개를 직접 내려받아 모두 `image/webp`, 1200x1500으로 파싱했습니다.
- 운영 이미지 API는 정상 200, 빈 ID·65자 ID 400이며 버전된 안전 URL을 반환했습니다.
- 운영 로그인, 주문 생성, 결제창 호출, PG 승인·취소는 실행하지 않았습니다.

## QA 도구 이슈 구분

- 임시 TypeScript 러너의 첫 실행은 CommonJS top-level await 제약으로 제품 코드 진입 전에 종료됐고 `main()` 래퍼로 수정 후 PASS했습니다.
- Playwright 번들 Chromium 실행 파일이 없어 추가 설치 없이 설치된 Google Chrome을 지정했습니다.
- Next optimizer의 정수 리사이즈는 359x449처럼 4:5에 미세한 반올림이 있어 브라우저는 허용오차로, 원본은 1200x1500 exact로 별도 판정했습니다.
- 통합 quota 러너의 초기 fixture 주입은 홈 헤더 비동기 동기화와 경합했습니다. 앱 UI가 개입하지 않는 최소 독립 러너로 다시 실행해 화면 복구·저장 원본·nonce 보존을 PASS로 확정했습니다.
- 위 도구 이슈로 제품 FAIL을 판정한 항목은 없습니다.

## 결함과 잔여 위험

- 이번 변경의 신규 P0/P1/P2 제품 결함은 발견하지 못했습니다.
- KSNET `reHash`/`reCommConId` 주문 사전 결박 공식 스펙이 아직 없습니다. 테스트 MID에서도 악의적인 교차 comm ID는 사후 불일치로 보류되지만 orphan 테스트 승인이 생길 수 있어 KSTA 대조가 필요합니다.
- 실 MID는 현재 fail-closed입니다. 공식 사전 결박 스펙 구현과 실 KSNET 회귀 전에는 실 MID 전환을 **NO-GO**로 유지합니다.
- 공개 이미지 복구 API는 읽기 전용·50개 제한이지만 반복 요청 비용과 abuse rate는 P2 운영 관찰 항목입니다.
- 운영 DB의 과거 mock 카드 레코드 4건은 기능상 결제에 사용되지 않으며 승인 없는 운영 데이터 삭제는 하지 않았습니다.
- Safari/WebKit/iOS 실제 기기와 실 KSNET 승인·취소·영수증은 실행하지 않았습니다.

## cleanup

- `qa.b234.*` 사용자·주문·상품 잔존은 모두 0입니다.
- 최종 테스트 DB는 사용자 10명(활성 9), 상품 329개, 주문 9개, 주문항목 9개, 감사로그 0개, 과거 카드 4개, 찜 0개입니다.
- 로컬 3013 production 서버, 임시 QA 러너 8개, Android CDP 포워딩을 종료·삭제했습니다.
- 운영·마스터 데이터, Vercel env·도메인 설정, 실 PG 상태 변경은 없습니다.

## 최종 판정

변조·취소·실 MID 입력은 외부 승인과 DB 변경 전에 차단됐고, 병렬 valid result는 외부 호출 1회와 `PAID` 1건으로 수렴했습니다. PG 결과가 불명확하거나 식별자가 맞지 않으면 재승인 없이 `PENDING+marker`를 유지합니다. 미계약 수기·원클릭 mock 승인 경로는 UI와 서버에서 모두 닫혔습니다.

전 상품 329개·자산 1,645개·HTML 329개, 모바일 Chrome 8개 조합, 실제 Android Chrome, 운영 공개 배포가 같은 결과를 가리키므로 제품 커밋 `b234b32`를 현재 테스트 MID 카드사 심사 범위에서 **PASS / GO**로 판정합니다. 실 MID 전환은 공식 사전 결박 스펙 구현 전까지 **NO-GO**입니다.
