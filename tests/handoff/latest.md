# QA 핸드오프 최신본

작성일: 2026-07-19

검증 제품 SHA: `cc19a4b82544f73703990a5dcf5f266e4add6d4d`

비교 기준: 제품 `eb40faf803549b958c8a9b30950de766e33fd6f5` / QA `dbcb54b115c1868aa10f7793dbffc71b4b02b23b`

운영 배포: `dpl_96QZ7gTPRmRVasuzDjHuXifg9VwM` / `https://laonshop.com`

결과: **PASS**

## 판정

- `QA-EB40-01` 첫 charge POST in-flight 중 병렬 재호출: **FIXED / PASS**
- `QA-90B-01` 주문·오류 제목 reflow: **FIXED / PASS**
- 현재 LAONPAY 비활성 fail-closed 운영과 기존 KSPAY 경로: **GO**
- LAONPAY hosted 등록·원클릭 활성화: schema/env/key/KSNET readiness와 실제 상호운용 미완료로 **HOLD**
- 신규 P0/P1/P2: **없음**

상세 증거는
[`2026-07-19-cc19a4b-billing-claim-concurrency-regression.md`](../reports/2026-07-19-cc19a4b-billing-claim-concurrency-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 원 P1 900ms 병렬 재현 | PASS | 첫 응답 전/후 POST 1, 최대 동시 활성 1, 최종 `PAID+attempts=1` |
| checkout/상태조회 교차 | PASS | 6초 in-flight 중 POST 1, charge `REQUESTING+1`; 최종 `PAID+1` |
| UNKNOWN 순차 대사 | PASS | 첫 503 후 `UNKNOWN+1`, reconciliation 1회, 총 POST 2·동시 활성 1 |
| UNKNOWN 병렬 claim | PASS | 두 조회 중 POST 1, 최종 `PAID+attempts=2` |
| fresh/stale 경계 | PASS | fresh·5분-1초 POST 0, 5분+1초 POST 1 |
| provider ID | PASS | charge POST 0, signed GET 1 |
| UNKNOWN 기록 fault | PASS | rollback 후 `REQUESTING+1`, 후속 병렬 조회 POST 증가 0 |
| 제목 reflow | PASS | 6상태+404, 320/360/390/412px × 100%/200%, 실패 0/56 |
| 정적 검증 | PASS | focused 23/23, 전체 107/107, skip 0, lint/typecheck/prisma/audit/build |
| 운영 배포 | PASS | READY production, SHA 일치, 최근 1시간 runtime error와 배포 error/fatal 0 |
| Cleanup | PASS | 격리 DB 7종 count 0, listener·임시 파일 0 |

## QA-EB40-01 수정 확인

### 원 재현

1. order `PENDING`, charge `REQUESTING+attempts=0`, provider ID 없음으로 준비했습니다.
2. charge POST 응답을 900ms 지연했습니다.
3. 같은 주문 상태 조회를 병렬 두 건 실행했습니다.
4. 첫 응답 전 stub과 최종 DB 원장을 직접 조회했습니다.

기대:

- 첫 POST in-flight 중 두 번째 외부 POST 0회
- `requestAttempts=1` 유지

실제:

- 첫 응답 전 POST 1회, 활성 POST 1회
- 전체 POST 1회, 최대 동시 활성 POST 1회
- 최종 order `PAID`
- 최종 charge `PAID`, `requestAttempts=1`
- order/charge 중복 0

이전 SHA의 POST 2회·9ms 간격 중첩은 재현되지 않았습니다.

### 교차·복구 경계

- checkout 최초 charge POST를 6초 지연한 상태에서 새 주문의 상태 조회를 실행해도 POST는 1회였습니다.
- 첫 503은 `UNKNOWN+attempts=1`로 기록됐고, 이후 동일 key/body reconciliation 한 건만 허용됐습니다.
- 병렬 reconciliation 두 건은 한 건만 claim해 최종 attempts 2에 수렴했습니다.
- `REQUESTING+attempts=1`은 fresh와 5분-1초에서 POST 0, 5분+1초에서 POST 1이었습니다.
- provider charge ID가 있으면 POST 없이 signed GET만 수행했습니다.
- UNKNOWN 기록 transaction을 한 번 실패시킨 뒤 원장은 `REQUESTING+1`에 남았고 즉시 병렬 조회에서도 새 POST가 없었습니다.

## 제목 reflow

다음 7개 제목을 320/360/390/412px, 루트 글자 100%/200%에서 측정했습니다.

- 결제가 완료되었습니다
- 결제가 완료되지 않았습니다
- 결제에 실패했습니다
- 취소·반품 신청이 접수되었습니다
- 주문이 취소되었습니다
- 결제 결과를 확인하고 있습니다
- 페이지를 찾을 수 없습니다

56조합 모두 아래 조건을 통과했습니다.

- document 가로 overflow 0
- H1 `scrollWidth <= parent.clientWidth`
- H1 실제 right 경계가 부모 경계 안

의도적인 404 경로의 8개 resource 404 메시지는 예상 결과로 분리했습니다.

## 정적·운영 검증

- Node 22.23.1 / pnpm 11.5.3
- focused billing/policy 23/23 PASS, skip 0
- `pnpm test` 107/107 PASS, skip 0
- 이미지 gate: 상품 329개/1,316장, 큐레이션 20상품/100장 PASS
- lint, typecheck, Prisma validate, production audit, build PASS
- Next 15.5.19, static generation 20/20
- `AGENTS.md`/`CLAUDE.md` byte-identical
- Vercel `dpl_96QZ7gTPRmRVasuzDjHuXifg9VwM` READY/production, Git SHA `cc19a4b` 일치
- apex HTTP 200, www→apex HTTP 308
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal 0

## 외부 blocker와 미실행 범위

- LAONPAY QA 증거 `c0c25417d6f824d8ad5ca0e65bcffff4323f0c54`의 제품 `bd88ef28` 범위는 PASS이며 신규 결함 0입니다.
- LAONPAY 실제 hosted/API 상호운용, 운영 additive migration, partner key/readiness env, KSNET billing 권한·개발 pgapi는 아직 미활성·미검증입니다.
- 실카드, 실 PG, 운영 DB write, Vercel env 변경과 KSNET 승인·취소·해지는 실행하지 않았습니다.
- Android/iOS 인증 주문 상세은 이번 수정 직접 범위가 아니어서 실행하지 않았습니다.
- stale CAS와 provider ID가 같은 순간에 생기는 미세 경합은 provider-ID 선행 GET과 transaction/CAS 코드를 대조했으며 별도 타이밍 fault injection은 실행하지 않았습니다.

위 항목은 이번 수정 회귀의 결함이 아니라 활성화 선행 조건입니다. 실제 LAONPAY 기능 활성화는 양측 schema/env/key와 격리 상호운용 QA 완료 전까지 HOLD입니다.

## Cleanup

- 격리 fixture 삭제 후 users/products/orders/items/payment methods/charges/cancel requests가 모두 0건입니다.
- custom HTTPS Next server, 지연 stub과 PostgreSQL을 정상 종료했습니다.
- 일회성 Ed25519/TLS 키, 인증서, preload, fixture, browser runner, DB cluster와 log를 삭제했습니다.
- port 3453, 3454, 55434 listener와 `/private/tmp/laonshop-cc19-*` 잔존 파일이 없습니다.
- 운영 DB, Vercel env, LAONPAY/PG 상태와 제품 코드는 변경하지 않았습니다.

## 개발 작업 전달

자동 수정 2/2 제품 `cc19a4b`는 원 P1의 실제 지연·병렬 재현, checkout/조회 교차, UNKNOWN·stale·provider·fault 경계와 제목 56개 조합을 모두 통과했습니다. 따라서 이번 제품 회귀는 **PASS**입니다.

현재 fail-closed 운영과 기존 KSPAY 경로는 유지할 수 있습니다. LAONPAY 등록카드 활성화는 제품 결함과 별개로 실제 schema/env/key/KSNET readiness와 양측 상호운용 QA가 완료될 때까지 **HOLD**입니다.
