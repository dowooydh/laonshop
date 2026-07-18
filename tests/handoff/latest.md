# QA 핸드오프 최신본

작성일: 2026-07-19

검증 제품 SHA: `eb40faf803549b958c8a9b30950de766e33fd6f5`

비교 범위: `e05b213887d6f9c978f8024cf316e23610ad836c..eb40faf803549b958c8a9b30950de766e33fd6f5`

운영 배포: `dpl_ANFSMZ8W1pFdv7JScqa3vaSEnBdd` / `https://laonshop.com`

결과: **FAIL**

## 판정

- `QA-EB40-01` 첫 charge POST in-flight 중 두 번째 claim 허용: **P1 / OPEN**
- 현재 LAONPAY 비활성 fail-closed 운영: **GO**
- LAONPAY hosted 등록·원클릭 활성화: **NO-GO**
- `QA-90B-01` 제목 reflow: 정적 PASS, 실제 브라우저 행렬은 P1 조기 종료로 **NOT VERIFIED**

상세 증거는
[`2026-07-19-eb40faf-billing-claim-concurrency-regression.md`](../reports/2026-07-19-eb40faf-billing-claim-concurrency-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 첫 청구 병렬 claim | **FAIL** | 900ms 지연 중 동일 key/body 외부 POST 2회, 9ms 간격 |
| 로컬 원장 | PARTIAL | order/charge 각 1건, 최종 PAID이나 `requestAttempts=2` |
| 원인 | CONFIRMED | `REQUESTING+attempts=1`을 READY로 허용하고 claim 커밋 후 외부 POST |
| 정적 검증 | PASS | focused 57/57, 전체 106/106, lint/typecheck/prisma/audit/build |
| UI reflow | NOT VERIFIED | 정적 테스트만 통과, 실제 320/360/390/412px 행렬 미실행 |
| LAONPAY 외부 기준 | PASS / 별도 | 제품 `bd88ef28`, QA 증거 `c0c25417...`; 본 P1과 독립 |
| Cleanup | PASS | 격리 DB·서버·stub·키·인증서·runner·로그 삭제, listener 0 |

## 발견 결함

### QA-EB40-01 - 첫 승인 POST가 진행 중인데 reconciliation POST를 병렬 허용함

- 심각도: **P1**
- 상태: **OPEN**
- 활성화 판정: **NO-GO**

재현:

1. charge를 `REQUESTING`, `requestAttempts=0`, provider ID 없음으로 준비합니다.
2. 외부 charge POST 응답을 900ms 지연합니다.
3. 같은 주문의 상태 조회를 병렬 두 건 실행합니다.
4. stub 요청 수·수신 시각과 DB 원장을 확인합니다.

기대:

- 첫 POST in-flight 중 두 번째 외부 POST 0회
- `requestAttempts=1` 유지

실제:

- 동일 경로·Idempotency-Key·body SHA-256의 POST 2회
- 수신 간격 9ms로 두 요청이 첫 응답 전에 중첩
- 최종 로컬 order `PAID`, charge `PAID`, `requestAttempts=2`
- 로컬 order/charge 중복은 없지만 외부 승인 안전성이 원격 멱등 구현에 의존

원인:

- `lib/laonpay/billing-policy.ts:191`이 `REQUESTING+attempts=1`도 `READY`로 허용합니다.
- `app/order/actions.ts:897`에서 attempts를 커밋한 뒤 `app/order/actions.ts:1022`에서 외부 POST를 실행합니다.
- checkout의 `app/checkout/actions.ts:179` claim 경로도 같은 정책을 사용합니다.
- 현재 정책 단위 테스트도 `REQUESTING+attempts=1` 허용을 정상으로 고정합니다.

필수 회귀:

1. 첫 POST in-flight 중 병렬 요청의 외부 POST 0회·attempts 1 유지
2. 첫 결과가 명시적으로 `UNKNOWN` 기록된 뒤에만 reconciliation 허용
3. 병렬 reconciliation 두 건 중 한 건만 claim, 전체 POST 최대 2회
4. provider ID 발생 경합은 POST 없이 signed GET만 실행
5. checkout 최초 claim과 주문 상세 refresh 교차 병렬 검증
6. 첫 결과 저장 fault에서도 새 POST 없이 확인 대기

## 실행하지 못한 항목

- `QA-90B-01`의 320/360/390/412px × 100%/200% 실제 상태별 제목 rect
- local-only 종료 fault, provider ID 경합의 추가 동적 행렬
- Android/iOS 인증 주문 상세
- LAONPAY hosted/API 상호운용, 실카드, KSNET 승인·취소·해지

P1 실제 재현 후 조기 종료했으므로 위 항목은 PASS가 아니라 미실행입니다.

## Cleanup

- 격리 PostgreSQL 17, custom HTTPS server와 지연 stub을 정상 종료했습니다.
- 일회성 Ed25519 key, TLS 인증서, fixture, preload, browser runner와 요청 기록을 삭제했습니다.
- port 3443, 3444, 55433 listener와 `/private/tmp/laonshop-eb40-*` 잔존 파일이 없습니다.
- 운영 DB, Vercel env, PG 상태와 제품 코드는 변경하지 않았습니다.

## 개발 작업 전달

현재 fail-closed 운영 배포의 기존 KSPAY 경로는 유지할 수 있습니다. LAONPAY 등록카드 활성화는 `REQUESTING+attempts=1`을 첫 POST in-flight와 명시적 UNKNOWN reconciliation 상태로 구분하고, 지연 stub 병렬 회귀에서 최초 POST 한 건만 확인될 때까지 **NO-GO**입니다.
