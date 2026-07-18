# cc19a4b 등록카드 청구 claim 동시성 수정 회귀 QA 보고서

작성일: 2026-07-19

담당: Codex QA/테스트 세션

이전 QA 기준: 제품 `eb40faf803549b958c8a9b30950de766e33fd6f5` / QA `dbcb54b115c1868aa10f7793dbffc71b4b02b23b`

검증 제품 SHA: `cc19a4b82544f73703990a5dcf5f266e4add6d4d`

비교 범위: `dbcb54b115c1868aa10f7793dbffc71b4b02b23b..cc19a4b82544f73703990a5dcf5f266e4add6d4d`

대상 배포: `dpl_96QZ7gTPRmRVasuzDjHuXifg9VwM` / `https://laonshop.com`

결과: **PASS**

출시 판정:

- `QA-EB40-01` 첫 charge POST in-flight 중 중복 POST: **FIXED / PASS**
- `QA-90B-01` 주문·오류 제목 reflow: **FIXED / PASS**
- 현재 LAONPAY 비활성 fail-closed 운영과 기존 KSPAY 경로 유지: **GO**
- LAONPAY hosted 등록·원클릭 활성화: 외부 schema/env/key/KSNET readiness와 실제 상호운용 미완료로 **HOLD**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 PG, LAONPAY 실제 API, 운영 DB write, Prisma 운영 schema push와 Vercel env 변경을 실행하지 않았습니다.
- 현재 Prisma schema를 `/private/tmp`의 일회용 PostgreSQL 격리 클러스터에만 적용했습니다.
- 일회용 사용자·상품·주문·opaque 결제수단·charge fixture와 로컬 HTTPS 지연 stub만 사용했습니다.
- 카드 원문, billingToken, PG key, TID, Authorization, 서명 원문과 실제 자격정보를 출력하거나 기록하지 않았습니다.

## 결론

이전 P1 `QA-EB40-01`은 실제 브라우저 Server Action과 지연 stub에서 재현되지 않았습니다.

- 원 재현과 동일하게 첫 charge POST를 900ms 지연하고 같은 주문 상태 조회 두 건을 병렬 실행했습니다.
- 첫 POST가 활성 상태인 중간 관찰과 종료 후 모두 외부 POST는 1회, 최대 동시 활성 POST는 1이었습니다.
- 최종 order와 charge는 각각 한 건으로 `PAID`, `requestAttempts=1`에 수렴했습니다.
- checkout 최초 claim의 POST를 6초 지연하고 주문 상세 상태 조회를 교차 실행해도 POST는 1회였습니다.
- 명시적 `UNKNOWN+attempts=1`에 도달한 뒤에만 동일 멱등키 reconciliation 1회가 허용됐습니다.
- 5분 전 `REQUESTING+attempts=1`은 POST 0회, 5분 후에는 병렬 조회 중 한 건만 reconciliation을 획득했습니다.
- provider charge ID가 있으면 POST 없이 signed GET만 사용했습니다.
- 최초 UNKNOWN 기록 transaction에 오류를 한 번 주입했을 때 `REQUESTING+attempts=1`을 유지했고 즉시 병렬 조회도 새 POST를 만들지 않았습니다.

주문 상태 제목과 404 제목은 320/360/390/412px, 루트 글자 100%/200%의 56조합에서 문서·부모 폭 안에 들어왔습니다.

## 실제 동시성 검증

### 1. QA-EB40-01 원 재현

사전 상태:

| 항목 | 값 |
| --- | --- |
| order | `PENDING` + LAONPAY processing marker |
| charge | `REQUESTING`, `requestAttempts=0` |
| provider charge/payment ID | 없음 |
| stub POST 지연 | 900ms |
| 동시 요청 | 동일 주문 상태 조회 2건 |

결과:

| 증거 | 결과 |
| --- | --- |
| 첫 응답 전 POST 수 | **1** |
| 첫 응답 전 활성 POST | **1** |
| 최대 동시 활성 POST | **1** |
| 종료 후 전체 POST 수 | **1** |
| 최종 order | `PAID` |
| 최종 charge | `PAID`, `requestAttempts=1` |
| provider ID | charge/payment ID 각 1개 |
| 브라우저·서버 오류 | 0 |

이전 SHA에서는 같은 조건에서 POST 2건이 9ms 간격으로 겹쳤습니다. 이번 SHA에서는 첫 POST가 응답하기 전 두 번째 조회가 외부 호출을 획득하지 못했습니다.

### 2. checkout 최초 claim과 주문 조회 교차

1. 장바구니 상품 한 건으로 등록카드 checkout을 제출했습니다.
2. 외부 POST 응답을 6초 지연했습니다.
3. DB에 새 order와 `REQUESTING+attempts=1` charge가 생성된 직후 주문 상세 상태 조회를 실행했습니다.
4. stub 중간 상태와 최종 DB를 직접 조회했습니다.

| 시점 | POST 수 | 최대 동시 활성 | charge |
| --- | --- | --- | --- |
| 첫 POST in-flight | 1 | 1 | `REQUESTING`, attempts 1, provider ID 없음 |
| 상태 조회 실행 후 | 1 | 1 | 새 claim 없음 |
| 첫 응답 완료 후 | 1 | 1 | `PAID`, attempts 1, provider ID 확정 |

새 order와 charge는 각각 한 건만 생성됐습니다.

### 3. UNKNOWN 순차 대사

- 첫 요청을 503으로 종료했습니다.
- 첫 단계 직후 DB는 order `PENDING`, charge `UNKNOWN`, `requestAttempts=1`, provider ID 없음이었습니다.
- 이후 같은 주문 상태 조회 두 건을 병렬 실행했습니다.
- 두 번째 외부 POST는 한 건만 발생했고 최종 `PAID`, `requestAttempts=2`로 수렴했습니다.
- 최초 POST와 reconciliation POST는 같은 Idempotency-Key와 같은 body SHA-256을 사용했습니다.
- 두 POST는 겹치지 않았고 `maxConcurrentPosts=1`이었습니다.

별도로 이미 `UNKNOWN+attempts=1`인 fixture의 병렬 조회 두 건도 외부 POST 1회, 최종 `PAID+attempts=2`로 수렴했습니다.

### 4. REQUESTING stale 경계

클릭 직전에 격리 charge의 `updatedAt`을 조정해 페이지 준비 시간의 영향을 제거했습니다.

| 상태 | 병렬 조회 | POST | 최종 원장 |
| --- | --- | --- | --- |
| fresh `REQUESTING+1` | 2건 | 0 | `REQUESTING+1` 유지 |
| 5분-1초 `REQUESTING+1` | 2건 | 0 | `REQUESTING+1` 유지 |
| 5분+1초 `REQUESTING+1` | 2건 | 1 | `PAID+2` |

5분 이후 복구에서도 최대 동시 활성 POST는 1이었습니다.

### 5. provider ID와 fault 경계

- `UNKNOWN+attempts=1`에 provider charge ID가 있는 주문은 charge POST 0회, signed GET 1회였습니다.
- GET에는 Idempotency-Key header가 없었습니다.
- 최초 UNKNOWN 전이 UPDATE를 PostgreSQL trigger로 한 번만 실패시켰습니다.
- 실패 직후 DB는 order `PENDING`, charge `REQUESTING+attempts=1`, provider ID 없음이었습니다.
- trigger 제거 직후 상태 조회 두 건을 병렬 실행해도 stub POST 총계는 최초 1회에서 증가하지 않았습니다.

## 코드 경계 확인

수정 계약을 실제 diff와 코드에서 독립 대조했습니다.

1. `lib/laonpay/billing-policy.ts:192`
   - `REQUESTING`은 attempts 0만 최초 claim 가능하며 attempts 1은 차단합니다.
   - reconciliation은 `UNKNOWN+attempts=1`에서만 허용합니다.
2. `lib/laonpay/billing-policy.ts:216`
   - provider ID가 없는 `REQUESTING+attempts=1`만 5분 이후 stale 복구 대상으로 제한합니다.
3. `app/checkout/actions.ts:179`
   - user, order, payment method, charge, 금액, fingerprint와 provider ID를 transaction 안에서 다시 결박합니다.
4. `app/checkout/actions.ts:282`
   - 첫 외부 결과가 실제 UNKNOWN인 경우에만 같은 잠금 순서로 `REQUESTING+1 → UNKNOWN+1`을 원자 기록합니다.
5. `app/order/actions.ts:967`
   - fresh `REQUESTING+1`은 `PENDING`으로 반환하고, stale 원장만 `updatedAt` CAS 후 reconciliation claim을 허용합니다.

독립 리뷰에서 신규 P0/P1/P2 결함은 발견하지 못했습니다.

## UI reflow 회귀

Chrome production build에서 다음 주문 제목을 검증했습니다.

- `PAID`: 결제가 완료되었습니다
- 일반 `PENDING`: 결제가 완료되지 않았습니다
- `FAILED`: 결제에 실패했습니다
- `CANCEL_REQUESTED`: 취소·반품 신청이 접수되었습니다
- `CANCELED`: 주문이 취소되었습니다
- KSPAY processing: 결제 결과를 확인하고 있습니다
- 404: 페이지를 찾을 수 없습니다

320/360/390/412px × 100%/200% = 56조합에서 아래 조건이 모두 통과했습니다.

- `document.scrollWidth === document.clientWidth`
- `h1.scrollWidth <= parent.clientWidth`
- H1 실제 right 경계가 부모 right 경계를 넘지 않음
- 제품 console/page error 0

의도적인 404 URL을 4개 폭 × 2개 배율로 연 8건의 404 resource 메시지는 예상 결과이며 런타임 결함에서 제외했습니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3 기준으로 독립 재실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| focused billing/policy | PASS | 23/23, fail 0, skip 0 |
| `pnpm test` | PASS | 107/107, fail 0, skip 0 |
| 이미지 gate | PASS | 329상품/1,316장, 큐레이션 20상품/100장 |
| `pnpm lint` | PASS | 오류·경고 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |
| `AGENTS.md` / `CLAUDE.md` parity | PASS | byte-identical |

## 운영 배포

Vercel API와 공개 HTTP를 읽기 전용으로 확인했습니다.

| 항목 | 결과 |
| --- | --- |
| deployment | `dpl_96QZ7gTPRmRVasuzDjHuXifg9VwM` |
| fixed URL | `https://laonshop-cdg9x3pbu-customorder.vercel.app` |
| target / state | production / READY |
| Git SHA | `cc19a4b82544f73703990a5dcf5f266e4add6d4d` |
| local / origin / production | 모두 동일 |
| 최근 1시간 runtime error cluster | 0 |
| 해당 배포 error/fatal 로그 | 0 |
| apex | HTTP 200 |
| www | apex로 HTTP 308 |

운영 schema와 LAONPAY readiness env가 미적용된 상태이므로 실제 hosted 등록·원클릭 외부 호출은 활성화 대상이 아닙니다.

## 외부 기준과 미실행 범위

- 전달받은 LAONPAY QA 증거 커밋 `c0c25417d6f824d8ad5ca0e65bcffff4323f0c54`에서는 LAONPAY 제품 `bd88ef28` 범위가 PASS이며 신규 결함 0입니다.
- 위 결과는 양측 계약 일치 참고 근거이며 실제 상호운용 완료를 의미하지 않습니다.
- LAONPAY hosted/API 실제 상호운용, 운영 additive migration, partner key/readiness env와 KSNET billing 권한·개발 pgapi는 미활성·미검증입니다.
- 실카드, 실 KSNET 승인·취소·해지와 운영 인증 계정 쓰기는 금지 범위로 실행하지 않았습니다.
- Android/iOS 인증 주문 상세은 이번 제품 수정의 직접 범위가 아니며 실행하지 않았습니다.
- stale CAS와 provider ID가 동일 순간에 생기는 미세 경합은 provider-ID 선행 GET 경계와 transaction/CAS 코드로 대조했으며 별도 타이밍 fault injection은 실행하지 않았습니다.

위 미실행 항목은 `QA-EB40-01` 수정 회귀 PASS를 바꾸지 않지만, 실제 LAONPAY 활성화는 양측 schema/env/key와 격리 상호운용 QA 완료 전까지 HOLD입니다.

## Cleanup

- 격리 fixture를 삭제한 뒤 users/products/orders/items/payment methods/charges/cancel requests가 모두 0건임을 확인했습니다.
- custom HTTPS Next server와 LAONPAY 지연 stub을 종료했습니다.
- PostgreSQL을 정상 종료하고 임시 DB cluster와 log를 삭제했습니다.
- 일회성 Ed25519 key, TLS key/certificate, fetch preload, fixture, browser runner와 요청 기록을 모두 삭제했습니다.
- port 3453, 3454, 55434 listener가 없고 `/private/tmp/laonshop-cc19-*` 잔존 파일이 0개임을 확인했습니다.
- 운영 DB, Vercel env, LAONPAY/PG 상태와 제품 코드는 변경하지 않았습니다.

## 최종 판정

자동 수정 2/2 제품 `cc19a4b`는 이전 P1의 실제 900ms 지연 재현과 checkout/주문 조회 교차, UNKNOWN 순차 대사, stale 전후, provider GET, transaction fault를 모두 통과했습니다. 주문·오류 제목의 실제 56개 폭/배율 조합도 통과했습니다.

따라서 이번 제품 수정 회귀는 **PASS**입니다. 현재 fail-closed 운영과 기존 KSPAY 경로는 유지할 수 있습니다. 다만 LAONPAY 등록카드 활성화는 제품 결함과 별개로 실제 schema/env/key/KSNET 준비 및 양측 상호운용 QA가 완료될 때까지 **HOLD**입니다.
