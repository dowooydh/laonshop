# QA 핸드오프 최신본

작성일: 2026-07-18

담당: Codex QA/테스트 세션

제품 SHA: `70ca87bfe1d6629193fcba10815b7763ffc5725f`

비교 범위: `0652dddd8ba4c8449c9089459cd9cd4047fc72dd..70ca87bfe1d6629193fcba10815b7763ffc5725f`

대상 배포: `dpl_27TAHvFGXvsVrYndU5eqkCg1Z5WR` / `https://laonshop.com`

결과: **FAIL**

출시 판정:

- 현재 fail-closed 운영 유지: **GO**
- LAONPAY hosted 등록·원클릭·취소 활성화: **NO-GO**
- P1 수정 후 재검증 필요

## 요약

- 제품 코드는 수정하지 않았습니다.
- seller-first 원격 reason을 signed GET의 source of truth로 반영하는 변경과 ID·소유권·금액·paymentId 결박 유지 여부를 독립 검토했습니다.
- focused 50/50, 전체 test 101/101, lint, typecheck, Prisma validate, audit와 production build는 통과했습니다.
- 별도 실제 client probe에서 취소 POST 모순 상태쌍 4개가 모두 `ok: true`로 파싱됐습니다.
- `REJECTED+CANCELED`와 `REJECTED+CANCEL_REQUESTED`는 Action이 charge 상태를 확인하지 않고 terminal 로컬 `REJECTED`로 기록할 수 있습니다.
- 실제 원격 취소 가능성이 있는 주문을 반려로 표시하고 로컬 주문·결제·취소 원장이 어긋날 수 있어 `QA-70CA-01`을 P1로 확정했습니다.
- 현재 LAONPAY env/schema 미적용 운영에서는 해당 경로가 fail-closed이므로 즉시 실사용 영향은 없습니다.
- P1 확정 후 제어 지침에 따라 실제 DB 상태행렬과 인증 UI는 수정 SHA로 이월했습니다.
- 상세 보고서: [70ca87b seller-first 취소 대사 회귀](../reports/2026-07-18-70ca87b-seller-first-cancel-regression.md)

## 핵심 결과

| 영역 | 결과 | 증거 |
| --- | --- | --- |
| seller-first reason 코드 경계 | PASS | signed GET 원격 reason 반영, ID·owner·amount·paymentId 결박 유지 |
| focused billing/client | PASS | 50/50, skip 0 |
| 전체 정적 회귀 | PASS | test 101/101, skip 0, lint/typecheck/prisma/audit/build |
| POST 상태쌍 parser | **FAIL** | 모순 4종 모두 client `ok: true` |
| `REJECTED` Action 독립 방어 | **FAIL** | `charge.status === "PAID"` 결박 없음 |
| signed GET 상태쌍 parser | PASS | strict 상태쌍 검증 유지 |
| 배포 상태 | PASS | READY, 제품 SHA 일치, runtime error/error·fatal 0 |
| 실제 DB 상태행렬 | NOT EXECUTED | P1 확정 후 수정 SHA로 이월 |
| 인증 반응형 UI | NOT EXECUTED | P1 조기 종료 |
| cleanup | PASS | 임시 probe·격리 PostgreSQL 완전 삭제 |

## 결함

### QA-70CA-01 - 취소 POST 모순 상태쌍을 성공 응답으로 수용

- 심각도: **P1**
- 관련 코드: `lib/laonpay/billing-contract.ts:123`, `app/order/actions.ts:224`, `app/order/actions.ts:230`
- 재현:
  - `REJECTED+CANCELED` → client `ok: true`
  - `REJECTED+CANCEL_REQUESTED` → client `ok: true`
  - `REQUESTED+PAID` → client `ok: true`
  - `DONE+PAID` → client `ok: true`
- 실제: 앞의 두 조합은 Action에서 terminal `REJECTED`로 기록될 수 있습니다.
- 기대: POST도 `REQUESTED|PROCESSING↔CANCEL_REQUESTED`, `DONE↔CANCELED`, `REJECTED↔PAID`만 허용하고 나머지는 `UNKNOWN`으로 보류해야 합니다.
- 영향: 후속 signed GET 전까지 실제 원격 취소 상태와 고객 표시·로컬 원장이 불일치합니다.

## 필수 수정·회귀

- POST response schema에 signed GET과 같은 상태쌍 `superRefine` 추가
- Action rejected 분기에 `charge.status === "PAID"` 독립 결박
- 네 모순 조합의 client `UNKNOWN`과 terminal DB no-write 회귀 추가
- seller-first A/B reason의 REQUESTED/PROCESSING/DONE/REJECTED 격리 DB 상태행렬
- `DONE+CANCELED`의 로컬 UNKNOWN+provider ID 후 signed GET CANCELED 수렴
- ID·owner·externalOrderId·amount·paymentId 불일치 no-write와 charge fallback
- REJECTED 안내·조회 버튼 320~412px/확대/키보드 회귀

## 안전·운영 증거

- Vercel 배포는 READY/production, region `sin1`, Git SHA `70ca87b`와 local/origin HEAD가 일치합니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal 0입니다.
- 실제 카드, PG, LAONPAY API, 운영 DB write, schema push와 Vercel env 변경을 실행하지 않았습니다.
- 현재 env/schema 미적용 fail-closed 운영은 유지할 수 있으나 빌링 활성화는 금지해야 합니다.

## Cleanup

- 임시 client probe 파일을 삭제했습니다.
- 격리 PostgreSQL은 schema 적용 뒤 fixture 생성 전에 중단했습니다.
- 임시 DB cluster/database/log를 삭제하고 port 55432 listener 0을 확인했습니다.
- 운영 데이터·env·PG와 제품 코드를 변경하지 않았습니다.

## 개발 회신

`70ca87b`은 seller-first reason 대사를 보강했지만 POST 응답 상태쌍 검증이 없어 P1 `QA-70CA-01`이 확인됐습니다. 현재 비활성 운영은 유지할 수 있으나 LAONPAY 빌링 활성화는 FAIL/NO-GO입니다. parser와 Action 독립 방어 수정 후 새 SHA에서 격리 DB 상태행렬과 인증 UI를 재검증해야 합니다.
