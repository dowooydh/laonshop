# 90b7255 취소 상태쌍 수정 회귀 QA 보고서

작성일: 2026-07-18

담당: Codex QA/테스트 세션

이전 QA 기준: `eba4c3417418805b96738fe5313e93dec4132ea2`

검증 제품 SHA: `90b7255d8de35c12d31a81f12fbde47911a4ae2b`

비교 범위: `eba4c3417418805b96738fe5313e93dec4132ea2..90b7255d8de35c12d31a81f12fbde47911a4ae2b`

대상 배포: `dpl_4hKy3FWShAnjZR81U4wX68nsoJFh` / `https://laonshop.com`

결과: **PARTIAL**

출시 판정:

- `QA-70CA-01` 취소 POST 상태쌍 수정: **PASS / CLOSED**
- 현재 LAONPAY 비활성 fail-closed 운영 유지: **GO**
- LAONPAY hosted 등록·원클릭·취소 활성화: **NO-GO**
- 별도 기존 UI 결함 `QA-90B-01` P2 수정 권장

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 PG, LAONPAY 실제 API, 운영 DB write, Prisma schema push와 Vercel env 변경을 실행하지 않았습니다.
- 실제 `createLaonpayBillingClient`에는 프로세스 메모리의 일회성 Ed25519 키와 로컬 HTTP stub만 주입했습니다.
- DB 상태행렬은 `/private/tmp`의 PostgreSQL 17 격리 클러스터에 현재 Prisma schema를 적용해 검증했습니다.
- 브라우저 액션은 격리 HTTPS origin, 일회용 사용자·주문·결제수단 fixture에서만 실행했습니다.
- 키, 서명, 세션 비밀, Authorization과 카드정보를 출력하거나 보고서·로그에 남기지 않았습니다.

## 결론

이전 P1 `QA-70CA-01`은 수정됐습니다.

- POST와 signed GET이 같은 cancel request/charge 상태쌍 refinement를 사용합니다.
- 실제 billing client가 24개 상태 조합 중 허용 4개만 `ok:true`로 수용했습니다.
- 나머지 20개는 모두 `ok:false, outcome:"UNKNOWN"`으로 fail-closed 처리했습니다.
- 이전 재현 4종은 주문·charge를 `PAID`로 유지하고 취소 원장만 비종결 `UNKNOWN`으로 남겼습니다.
- Action의 반려 확정도 same charge ID, `charge=PAID`, `cancelRequest=REJECTED`를 모두 요구했습니다.
- 정상 seller-first 요청은 signed GET의 원격 reason을 최종 근거로 세 원장에 원자 반영했습니다.

추가로 변경 범위 밖의 주문 완료 제목에서 `360px + 루트 글자 200%` 가로 스크롤을 재현해 `QA-90B-01` P2로 분리했습니다. 대상 범위에서 `app/order/[id]/page.tsx`, 전역 CSS와 Tailwind preset은 변경되지 않았으므로 이번 취소 상태쌍 수정의 귀책 결함은 아닙니다.

## 독립 코드리뷰

변경은 4개 파일, 89줄 추가·19줄 삭제입니다.

- `lib/laonpay/billing-contract.ts`
  - `refineBillingCancelStatusPair`를 POST와 GET schema가 공유합니다.
  - 허용쌍은 `REQUESTED|PROCESSING ↔ CANCEL_REQUESTED`, `DONE ↔ CANCELED`, `REJECTED ↔ PAID`뿐입니다.
  - strict object와 기존 안전 문자열·opaque ID 경계는 유지됩니다.
- `app/order/actions.ts`
  - terminal 반려 분기가 `sameRemoteCharge`, `charge=PAID`, `cancelRequest=REJECTED`를 독립 확인합니다.
  - 모순 응답은 provider ID와 terminal 상태를 확정하지 않고 `UNKNOWN`으로 남습니다.
  - 취소 POST 재호출 금지, signed GET 우선, 소유권·금액·ID 검증은 유지됩니다.
- 관련 테스트
  - 4x6 전체 상태쌍 행렬과 Action의 `charge=PAID` 결박이 추가됐습니다.

신규 P0/P1 결함은 발견하지 못했습니다.

## billing client 24개 상태쌍

실제 `createLaonpayBillingClient().createCancelRequest()`에 HTTP 200 stub 응답을 주입했습니다.

| 구분 | 조합 수 | 결과 |
| --- | ---: | --- |
| `REQUESTED+CANCEL_REQUESTED` | 1 | `ok:true` |
| `PROCESSING+CANCEL_REQUESTED` | 1 | `ok:true` |
| `DONE+CANCELED` | 1 | `ok:true` |
| `REJECTED+PAID` | 1 | `ok:true` |
| 나머지 enum 조합 | 20 | `ok:false, UNKNOWN` |

독립 probe 요청 수는 24회, 허용 4회, 보류 20회로 정확히 일치했습니다.

이전 P1 재현 4종도 모두 `UNKNOWN`이었습니다.

- `REJECTED+CANCELED`
- `REJECTED+CANCEL_REQUESTED`
- `REQUESTED+PAID`
- `DONE+PAID`

## 격리 DB seller-first 상태행렬

실제 로그인 세션, 주문 상세 UI, Server Action, Prisma transaction과 실제 billing client를 함께 사용했습니다. 외부 호출은 로컬 stub이 응답했습니다.

| 원격 POST 상태 | POST 직후 로컬 order / charge / cancel | signed GET 후 최종 상태 | 원격 사유 |
| --- | --- | --- | --- |
| `REQUESTED+CANCEL_REQUESTED` | `CANCEL_REQUESTED / CANCEL_REQUESTED / REQUESTED` | 동일 | request와 order에 reason B 반영 |
| `PROCESSING+CANCEL_REQUESTED` | `CANCEL_REQUESTED / CANCEL_REQUESTED / PROCESSING` | 늦은 `REQUESTED` GET 뒤에도 `PROCESSING` 유지 | reason B 반영 |
| `DONE+CANCELED` | `PAID / PAID / UNKNOWN`, provider ID 보존 | `CANCELED / CANCELED / DONE` | request와 order에 reason B 반영 |
| `REJECTED+PAID` | `PAID / PAID / REJECTED`, provider ID 보존 | `PAID / PAID / REJECTED` | reason B, rejectReason, processedAt 반영 |

`DONE`은 local `UNKNOWN+provider ID`를 먼저 남긴 뒤 signed GET에서 request, charge와 order를 같은 transaction으로 `DONE/CANCELED/CANCELED` 확정했습니다.

`REJECTED`는 charge와 order를 `PAID`로 유지하고 주문의 `cancelReason`, `cancelRequestedAt`을 null로 유지했습니다. signed GET 뒤 원격 reason과 rejectReason만 취소 원장에 보강했습니다.

`PROCESSING` 시나리오는 signed GET을 두 번 실행했습니다. 원격의 늦은 `REQUESTED`가 로컬 `PROCESSING`을 되돌리지 않았고, 외부 요청 수는 POST 1회·GET 2회였습니다.

## 모순 응답과 no-write

이전 P1 4개 모순 POST 응답을 실제 Server Action에 제출했습니다.

| 조합 | order | charge | cancel request | provider cancel ID |
| --- | --- | --- | --- | --- |
| `REJECTED+CANCELED` | `PAID` | `PAID` | `UNKNOWN` | null |
| `REJECTED+CANCEL_REQUESTED` | `PAID` | `PAID` | `UNKNOWN` | null |
| `REQUESTED+PAID` | `PAID` | `PAID` | `UNKNOWN` | null |
| `DONE+PAID` | `PAID` | `PAID` | `UNKNOWN` | null |

terminal `REJECTED`, `CANCELED` 또는 주문 취소가 생성되지 않았습니다. 취소 원장의 `UNKNOWN`은 외부 호출 claim과 결과 불명확 상태를 보존하는 의도된 비종결 write입니다.

signed GET에는 각각 다음 불일치를 주입했습니다.

- cancel request ID
- charge ID
- external order ID
- 서버 재계산 금액
- provider payment ID

5개 모두 조회 전의 `CANCEL_REQUESTED/CANCEL_REQUESTED/REQUESTED`와 로컬 reason A를 그대로 유지했고 추가 DB write가 없었습니다.

타 사용자 주문 URL은 not-found 화면을 반환했고 주문 상세와 외부 요청이 노출되지 않았습니다. 타 사용자 원장은 불변이었습니다.

provider cancel request ID가 유실된 fallback에서 charge GET이 `PAID`를 반환하면 주문·charge는 `PAID`, 취소 원장은 `UNKNOWN`, 로컬 reason A를 그대로 유지했습니다. `PAID`를 취소 반려로 추론하지 않았고 취소 POST 재호출은 0회였습니다.

전체 격리 stub 요청은 POST 13회, GET 11회였습니다. 각 취소 신청 POST는 정확히 1회였고 상태 조회 과정에서 취소 POST 재호출은 없었습니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3 기준으로 독립 재실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| focused billing/client | PASS | 51/51, fail 0, skip 0 |
| `pnpm test` | PASS | 102/102, fail 0, skip 0 |
| 이미지 gate | PASS | 329상품/1,316장, 큐레이션 20상품/100장 |
| `pnpm lint` | PASS | 오류·경고 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |
| `AGENTS.md` / `CLAUDE.md` parity | PASS | byte-identical |

## fail-closed 운영 경계

LAONPAY 3개 env를 제거한 동일 격리 production 빌드에서 확인했습니다.

- 지정 심사 계정 설정 화면은 “간편결제 연동을 준비하고 있습니다” 안내를 표시했습니다.
- hosted 카드 등록 버튼과 저장된 opaque 결제수단 행은 표시하지 않았습니다.
- checkout은 등록카드 원클릭과 수기결제를 표시하지 않았습니다.
- 일반 KSPAY 카드결제는 계속 표시했습니다.
- 화면 탐색 전후 LAONPAY 외부 요청 추가 0건, DB count 변화 0건이었습니다.

운영 Vercel은 `READY`, target `production`, region `sin1`, Git SHA `90b7255d8de35c12d31a81f12fbde47911a4ae2b`입니다. `laonshop.com`, `www.laonshop.com` alias와 대상 배포가 일치하고 alias error는 없습니다. 최근 1시간 runtime error cluster와 대상 배포 error/fatal 로그는 각각 0건입니다.

## 발견 결함

### QA-90B-01 - 360px·글자 200%에서 주문 완료 제목이 문서 폭을 확장함

- 심각도: **P2**
- 상태: **OPEN**
- 변경 귀책: **아님**. 대상 범위에서 주문 페이지·전역 CSS·Tailwind preset 변경 0
- 영향: 확대 사용자가 주문·취소 상태 화면에서 12px의 수평 스크롤을 경험

재현:

1. 로그인한 고객의 등록카드 `REJECTED` 주문 상세를 엽니다.
2. viewport를 `360x915`로 설정합니다.
3. 루트 글자 크기를 `200%`로 설정합니다.
4. 문서와 주문 완료 제목의 scroll/client 폭을 측정합니다.

기대:

- `document.scrollWidth=clientWidth=360`
- 제목과 상태 안내가 부모 폭 안에서 줄바꿈

실제:

- 문서 `scrollWidth=372`, `clientWidth=360`
- `<h1>` parent `clientWidth=296`, 내부 `scrollWidth=340`
- 관련 class: `text-balance break-keep ... min-[360px]:text-step-2`
- 정확히 360px에서 큰 제목 breakpoint가 활성화되며 12px 가로 스크롤이 생김

교차 측정:

| viewport / root font | document scroll/client | 조회 버튼 높이 | 의미 있는 viewport 이탈 |
| --- | --- | ---: | ---: |
| 320px / 200% | `320/320` | 146px | 0 |
| 360px / 200% | `372/360` | 98px | 0 |
| 390px / 200% | `390/390` | 98px | 0 |
| 412px / 200% | `412/412` | 98px | 0 |

반려 안내와 `취소 상태 조회` 버튼은 모든 폭에서 viewport 안에 있었고 버튼 내부 text clipping은 0, 최소 높이는 44px 이상이었습니다. 기능 조작은 가능하지만 WCAG reflow 관점의 수평 스크롤이므로 P2로 판정했습니다.

권장 회귀:

- 주문 상태 H1의 `min-[360px]:text-step-2`를 확대 환경에서 안전한 크기 또는 줄바꿈 규칙으로 조정
- 360px·200%에서 H1 `scrollWidth<=clientWidth`와 document `scrollWidth=clientWidth` 동시 단정
- PAID, PENDING, FAILED, CANCEL_REQUESTED, CANCELED 제목 교차 확인

## 도구 한계와 미실행

- 실제 Android/iOS 인증 주문 화면은 이번 표적 회차에서 실행하지 않았습니다.
- LAONPAY hosted/API 상호운용, 실카드, KSNET 승인·취소·해지는 실행하지 않았습니다.
- 운영 인증 계정의 쓰기 흐름은 실행하지 않았습니다.
- 격리 custom HTTPS server의 Server Action redirect prefetch는 로컬 DNS가 `laonshop.com:3443`을 자기 자신으로 해석하지 못해 timeout 로그를 남겼습니다. 브라우저 액션 응답·DB 상태·외부 요청 수는 완료됐고 브라우저 console/page error는 0이어서 제품 실패와 분리했습니다.
- 번들 Playwright 브라우저 바이너리가 없어 설치하지 않고 로컬 Google Chrome 150을 명시해 실행했습니다.

## Cleanup

- 격리 fixture 최종 count는 users 2, products 1, orders 15, items 15, payment methods 2, charges 15, cancel requests 14였습니다.
- QA custom HTTPS server와 Chrome 세션을 종료했습니다.
- PostgreSQL을 정상 종료하고 임시 database, cluster, log를 삭제했습니다.
- 일회성 Ed25519 key, TLS key/certificate, env, stub, browser runner와 요청 로그를 모두 삭제했습니다.
- port 3003, 3443, 55432 listener가 없고 `/private/tmp/laonshop-90b-*` 잔존 파일이 0개임을 확인했습니다.
- 운영 DB, Vercel env, LAONPAY/PG 상태와 제품 코드는 변경하지 않았습니다.

## 최종 판정

`QA-70CA-01`의 파서와 Action 독립 방어는 실제 client 24조합과 격리 DB 상태행렬에서 모두 통과했습니다. 취소 상태쌍 수정은 **PASS / CLOSED**입니다.

전체 판정은 변경 범위 밖의 `QA-90B-01` P2와 실제 플랫폼·상호운용 미실행 범위를 반영해 **PARTIAL**입니다. 현재 fail-closed 운영 배포는 유지할 수 있지만, LAONPAY 활성화는 양측 계약 QA, schema/env/key readiness, hosted E2E와 P2 reflow 수정 전까지 **NO-GO**입니다.
