# eb40faf 등록카드 청구 claim 동시성 회귀 QA 보고서

작성일: 2026-07-19

담당: Codex QA/테스트 세션

이전 QA 기준: `e05b213887d6f9c978f8024cf316e23610ad836c`

검증 제품 SHA: `eb40faf803549b958c8a9b30950de766e33fd6f5`

비교 범위: `e05b213887d6f9c978f8024cf316e23610ad836c..eb40faf803549b958c8a9b30950de766e33fd6f5`

대상 배포: `dpl_ANFSMZ8W1pFdv7JScqa3vaSEnBdd` / `https://laonshop.com`

결과: **FAIL**

출시 판정:

- 현재 LAONPAY 비활성 fail-closed 운영 유지: **GO**
- LAONPAY hosted 등록·원클릭 활성화: **NO-GO**
- `QA-EB40-01` 첫 청구 in-flight 중 reconciliation claim 허용: **P1 / OPEN**
- `QA-90B-01` 주문·오류 제목 reflow: 정적 검증 통과, 실제 브라우저 행렬은 P1 조기 종료로 **NOT VERIFIED**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 PG, LAONPAY 실제 API, 운영 DB write, Prisma schema push와 Vercel env 변경을 실행하지 않았습니다.
- 현재 Prisma schema를 `/private/tmp`의 PostgreSQL 17 격리 클러스터에 적용하고 일회용 사용자·주문·결제수단·charge fixture만 사용했습니다.
- 실제 `createLaonpayBillingClient` 호출은 일회성 Ed25519 키와 로컬 HTTPS 지연 stub으로만 전달했습니다.
- 키, 서명, 세션 비밀, Authorization, 카드정보와 실제 자격정보를 출력하거나 보고서에 남기지 않았습니다.

## 결론

`QA-EB40-01` P1을 실제 런타임에서 재현했습니다.

- 첫 charge POST 응답을 900ms 지연했습니다.
- 같은 주문의 상태 조회를 병렬로 두 번 실행했습니다.
- stub은 첫 응답 전에 동일 경로·동일 멱등키·동일 본문 해시의 POST를 2회 수신했습니다.
- 두 요청의 수신 간격은 9ms였습니다. 두 번째 POST는 첫 번째 응답보다 약 891ms 먼저 시작됐습니다.
- 최종 로컬 DB는 order `PAID`, charge `PAID`, `requestAttempts=2`였습니다.
- 로컬 order와 charge는 각각 한 건으로 수렴했지만, 외부 승인 POST 두 건이 실제로 겹쳤습니다.

동일 멱등키에 대한 LAONPAY의 원격 멱등 처리가 정상이라면 원격 resource는 한 건으로 수렴할 수 있습니다. 그러나 최초 요청의 응답 유실이 확인되기 전에 reconciliation 예산을 소비하고 외부 승인 요청을 동시에 두 번 보낸다는 점에서 안전 계약을 위반합니다. 원격 멱등 구현의 경합이나 장애가 있으면 중복 승인 위험으로 이어질 수 있으므로 활성화 차단 P1로 판정했습니다.

## 실제 재현

### 사전 상태

| 항목 | 값 |
| --- | --- |
| 주문 | `PENDING` + LAONPAY processing marker |
| charge | `REQUESTING` |
| `requestAttempts` | `0` |
| provider charge/payment ID | 없음 |
| 로컬 order / charge | 각 1건 |
| stub POST 지연 | 900ms |

### 실행 절차

1. 격리 PostgreSQL에 현재 Prisma schema를 적용했습니다.
2. 지정 integration 계정, ACTIVE opaque 결제수단, PENDING 주문과 `REQUESTING+attempts=0` charge를 생성했습니다.
3. 로컬 production 빌드를 일회성 LAONPAY HTTPS stub과 연결했습니다.
4. 동일 인증 세션의 두 페이지에서 같은 주문의 결제 상태 조회 Server Action을 병렬 실행했습니다.
5. stub 수신 기록과 DB 원장을 직접 조회했습니다.

### 실제 결과

| 증거 | 결과 |
| --- | --- |
| 외부 charge POST 수 | **2** |
| 첫 요청 수신 시각 | 기준 `T` |
| 두 번째 요청 수신 시각 | `T+9ms` |
| 두 요청의 path | 동일 |
| 두 요청의 Idempotency-Key | 동일 |
| 두 요청의 body SHA-256 | 동일 |
| 첫 응답 예정 시각 | `T+900ms` |
| 최종 order | `PAID` |
| 최종 charge | `PAID`, `requestAttempts=2` |
| 로컬 중복 order / charge | 없음 |

기대 결과는 첫 POST가 in-flight인 동안 두 번째 요청의 외부 POST 획득이 0회이고 `requestAttempts=1`을 유지하는 것입니다. 실제로는 두 번째 claim이 첫 응답 전에 `attempts=1→2`를 획득하고 POST를 시작했습니다.

## 원인 분석

1. `lib/laonpay/billing-policy.ts:191`
   - `REQUESTING` 상태에서 `requestAttempts <= 1`을 모두 `READY`로 반환합니다.
   - 따라서 첫 POST가 아직 실행 중인 `REQUESTING+attempts=1`과, 첫 결과가 명시적으로 `UNKNOWN`이 된 reconciliation 가능 상태를 구분하지 못합니다.
2. `app/order/actions.ts:897`
   - transaction 안에서 charge를 잠그고 `requestAttempts`를 증가시킨 뒤 transaction을 종료합니다.
   - 외부 POST는 transaction 종료 후 `app/order/actions.ts:1022`에서 실행됩니다.
   - 첫 호출이 네트워크를 기다리는 동안 두 번째 transaction은 `REQUESTING+attempts=1`을 보고 다시 claim할 수 있습니다.
3. `app/checkout/actions.ts:179`
   - checkout도 같은 정책으로 claim을 커밋한 뒤 `app/checkout/actions.ts:706`에서 외부 POST를 실행하므로 동일 경합 구조를 공유합니다.
4. `tests/api/laonpay-billing-policy.test.ts:31`
   - 현재 단위 테스트가 `REQUESTING+attempts=1`을 허용 상태로 명시해 런타임 경합을 정상 계약으로 고정하고 있습니다.

경합 타임라인:

1. 요청 A가 `REQUESTING+0`을 잠그고 `attempts=1`로 커밋합니다.
2. 요청 A가 외부 POST를 시작하고 900ms 응답을 기다립니다.
3. 요청 B가 같은 원장을 잠근 뒤 `REQUESTING+1`을 `READY`로 판정합니다.
4. 요청 B가 `attempts=2`로 커밋하고 같은 key/body의 외부 POST를 시작합니다.
5. 두 외부 요청이 891ms 이상 동시에 진행됩니다.

## 필수 수정 후 회귀

1. 최초 POST claim과 응답 유실 후 reconciliation 가능 상태를 DB에서 명시적으로 구분해야 합니다.
2. 첫 POST in-flight 중 병렬 요청은 외부 POST 0회, `requestAttempts=1`을 유지해야 합니다.
3. 최초 호출이 timeout/5xx/connection close로 `UNKNOWN`을 원자 기록한 뒤에만 reconciliation claim을 허용해야 합니다.
4. 명시적 `UNKNOWN` 상태에서 병렬 reconciliation 두 건은 정확히 하나만 `attempts=1→2`를 획득하고 전체 POST 수가 최초 1회 + reconciliation 1회여야 합니다.
5. provider charge ID가 생긴 경합 요청은 POST 없이 signed GET만 수행해야 합니다.
6. checkout 최초 claim과 주문 상세 refresh 양방향을 교차 병렬 실행해도 같은 제한이 유지되어야 합니다.
7. 같은 Idempotency-Key와 byte-identical body는 유지하되, 멱등키 자체에 의존해 in-flight 중복 POST를 허용해서는 안 됩니다.
8. 첫 호출 결과 저장 transaction fault에서도 새 POST를 허용하지 않고 안전한 확인 대기 상태를 유지해야 합니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3 기준으로 독립 재실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| focused billing/policy/UI/client | PASS | 57/57, fail 0, skip 0 |
| `pnpm test` | PASS | 106/106, fail 0, skip 0 |
| 이미지 gate | PASS | 329상품/1,316장, 큐레이션 20상품/100장 |
| `pnpm lint` | PASS | 오류·경고 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |
| `AGENTS.md` / `CLAUDE.md` parity | PASS | byte-identical |

정적 테스트 전체 통과는 P1을 상쇄하지 않습니다. 기존 정책 테스트가 문제 상태인 `REQUESTING+attempts=1`을 허용하도록 작성돼 있어 실제 지연·병렬 실행에서만 결함이 드러났습니다.

## UI와 외부 교차 기준

- `QA-90B-01` 수정 파일과 접근성 정적 테스트는 통과했습니다.
- P1 조기 종료 원칙에 따라 320/360/390/412px × 100%/200% 실제 브라우저 상태 행렬은 이번 회차에서 실행하지 않았습니다. 따라서 UI 수정은 별도 회차에서 실제 rect 기준으로 재검증해야 합니다.
- 전달받은 LAONPAY QA 증거 커밋 `c0c25417d6f824d8ad5ca0e65bcffff4323f0c54`에서는 LAONPAY 제품 `bd88ef28` 범위가 PASS이며 신규 결함 0입니다.
- 위 LAONPAY 결과는 양측 계약 일치 참고 근거이며, 이번 LAONSHOP in-flight claim P1과는 독립입니다.
- 실제 schema/env/partner key/KSNET billing readiness가 미활성인 HOLD 상태도 유지합니다.

## 실행하지 못한 항목

- `QA-90B-01`의 실제 브라우저 320/360/390/412px × 100%/200% 상태별 제목 측정
- local-only 종료 transaction fault와 provider ID 경합의 추가 동적 행렬
- Android/iOS 인증 주문 상세
- LAONPAY hosted/API 실제 상호운용
- 실카드, KSNET 승인·취소·해지와 운영 인증 계정 쓰기

P1 재현 후 조기 종료했으므로 위 항목은 제품 PASS가 아니라 미실행입니다.

## Cleanup

- 격리 fixture 최종 확인 시 users 2, products 1, orders 14, items 14, payment methods 1, charges 7이었습니다.
- custom HTTPS Next server와 LAONPAY 지연 stub을 종료했습니다.
- PostgreSQL을 정상 종료하고 임시 DB cluster와 log를 삭제했습니다.
- 일회성 Ed25519 key, TLS key/certificate, fetch preload, fixture, browser runner와 요청 기록을 모두 삭제했습니다.
- port 3443, 3444, 55433 listener가 없고 `/private/tmp/laonshop-eb40-*` 잔존 파일이 0개임을 확인했습니다.
- 운영 DB, Vercel env, LAONPAY/PG 상태와 제품 코드는 변경하지 않았습니다.

## 최종 판정

`QA-EB40-01`은 코드 감사 가설뿐 아니라 900ms 지연 stub과 실제 Server Action 병렬 실행에서 외부 POST 2회, 수신 간격 9ms로 재현됐습니다. LAONPAY 기능이 현재 운영에서 fail-closed인 동안 기존 KSPAY 운영은 유지할 수 있지만, 등록카드 결제 활성화는 이 P1을 수정하고 위 동시성 회귀를 통과하기 전까지 **NO-GO**입니다.
