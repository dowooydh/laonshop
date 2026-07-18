# 70ca87b seller-first 취소 대사 회귀 QA 보고서

작성일: 2026-07-18

담당: Codex QA/테스트 세션

이전 QA 기준: `0652dddd8ba4c8449c9089459cd9cd4047fc72dd`

검증 제품 SHA: `70ca87bfe1d6629193fcba10815b7763ffc5725f`

비교 범위: `0652dddd8ba4c8449c9089459cd9cd4047fc72dd..70ca87bfe1d6629193fcba10815b7763ffc5725f`

대상 배포: `dpl_27TAHvFGXvsVrYndU5eqkCg1Z5WR` / `https://laonshop.com`

결과: **FAIL**

출시 판정:

- 현재 env/schema 미적용 fail-closed 운영 유지: **GO**
- LAONPAY hosted 등록·원클릭·취소 활성화: **NO-GO**
- 제품 수정 후 재검증 필요: **P1 차단**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 PG, LAONPAY 실제 API, 운영 DB write, Prisma schema push와 Vercel env 변경을 실행하지 않았습니다.
- 실제 `createLaonpayBillingClient`에 로컬 HTTP stub 응답을 주입해 취소 POST parser를 검증했습니다.
- 격리 PostgreSQL은 임시 클러스터에 현재 schema를 적용한 직후 P1이 확정되어 fixture 생성 없이 중단·삭제했습니다.
- 비밀키는 probe 프로세스 메모리에서 임시 생성했으며 값, 요청 서명과 Authorization을 출력하거나 보관하지 않았습니다.

## 차단 결함

### QA-70CA-01 - 취소 POST 모순 상태쌍을 성공 응답으로 수용

- 심각도: **P1**
- 상태: **OPEN**
- 영향 범위: LAONPAY 등록카드 취소 POST 응답 파싱과 초기 로컬 취소 상태 확정
- 현재 운영 영향: env/schema 미적용으로 경로가 fail-closed여서 즉시 실사용 영향 없음
- 활성화 영향: 원격 취소 상태와 라온샵 주문·취소 원장이 불일치할 수 있어 활성화 차단

관련 코드:

- `lib/laonpay/billing-contract.ts:123`의 `billingCancelRequestResponseSchema`는 strict object이지만 cancel request/charge 상태쌍 `superRefine`가 없습니다.
- `app/order/actions.ts:224`의 accepted 분기는 `REQUESTED|PROCESSING + CANCEL_REQUESTED`만 허용합니다.
- `app/order/actions.ts:230`의 rejected 분기는 same charge ID와 `cancelRequest.status === "REJECTED"`만 보고 `charge.status === "PAID"`를 결박하지 않습니다.
- `app/order/actions.ts:283`에서 위 분기를 terminal 로컬 `REJECTED`로 기록합니다.

#### 재현 절차

1. 유효한 임시 Ed25519 key와 HTTPS API origin을 주입해 실제 `createLaonpayBillingClient`를 생성합니다.
2. `createCancelRequest()`의 HTTP 200 응답을 다음 네 상태쌍으로 각각 반환합니다.
3. client 결과와 Action 분기 조건을 확인합니다.

| cancelRequest.status | charge.status | 기대 client 결과 | 실제 client 결과 | 현재 Action 결과 |
| --- | --- | --- | --- | --- |
| `REJECTED` | `CANCELED` | `UNKNOWN` | `ok: true` | 로컬 cancel request를 `REJECTED`로 기록 |
| `REJECTED` | `CANCEL_REQUESTED` | `UNKNOWN` | `ok: true` | 로컬 cancel request를 `REJECTED`로 기록 |
| `REQUESTED` | `PAID` | `UNKNOWN` | `ok: true` | 로컬 `UNKNOWN`으로 보류 |
| `DONE` | `PAID` | `UNKNOWN` | `ok: true` | 로컬 `UNKNOWN`으로 보류 |

#### 기대 결과

- POST 응답도 signed GET과 동일하게 아래 상태쌍만 허용해야 합니다.
  - `REQUESTED|PROCESSING` ↔ `CANCEL_REQUESTED`
  - `DONE` ↔ `CANCELED`
  - `REJECTED` ↔ `PAID`
- 모순 상태쌍은 `ok: false, outcome: "UNKNOWN"`으로 보류해야 합니다.
- terminal `REJECTED`, `CANCELED` 또는 주문 상태를 모순 응답만으로 확정하면 안 됩니다.
- 저장된 provider cancel request ID가 있다면 signed GET만 source of truth로 사용해야 합니다.

#### 실제 결과와 위험

- 네 모순 응답이 모두 strict parser를 통과해 `ok: true`가 됐습니다.
- 특히 `REJECTED+CANCELED`와 `REJECTED+CANCEL_REQUESTED`는 Action이 terminal `REJECTED`로 분류합니다.
- charge/order를 즉시 취소 또는 실패로 바꾸지는 않지만, 실제 원격 취소 가능성이 있는 주문을 고객에게 반려로 표시하고 로컬 원장을 terminal 상태로 기록합니다.
- provider ID가 있으면 후속 signed GET으로 복구할 수 있으나 사용자의 명시적 상태 조회에 의존하며, 그 전까지 결제·주문·취소 원장이 서로 어긋납니다.
- 결제 취소 상태를 잘못 표시하는 금전 상태 일관성 문제이므로 P1로 판정했습니다.

## seller-first 정상 범위 코드리뷰

이번 변경의 의도 자체는 다음 경계에서 유지됩니다.

- signed GET에서 cancel request ID, charge ID, external order ID, amount와 payment ID를 재검증합니다.
- 원격 reason은 `REQUESTED`, `PROCESSING`, `DONE`에서 cancel request와 진행/완료 주문에 반영됩니다.
- 원격 `PROCESSING`을 늦은 `REQUESTED`로 되돌리지 않습니다.
- `DONE+CANCELED` signed GET은 cancel request, charge와 order를 같은 transaction에서 `DONE/CANCELED/CANCELED`로 확정합니다.
- `REJECTED+PAID` signed GET은 원격 reason/rejectReason/processedAt을 저장하고 charge/order는 `PAID`, 주문 cancel field는 null로 유지합니다.
- 외부 cancel request ID가 없을 때만 charge GET fallback을 사용하며 원격 reason이 없으므로 기존 로컬 reason을 유지합니다.
- charge fallback의 `PAID`를 취소 반려로 추론하지 않습니다.
- 취소 POST는 상태 조회 Action에서 재호출하지 않습니다.

seller-first `DONE+CANCELED`의 `POST → 로컬 UNKNOWN+provider ID → signed GET → CANCELED` 경로는 코드와 기존 source 회귀 테스트에서 확인했습니다. 실제 DB transaction 상태행렬은 P1 조기 종료 지침에 따라 **NOT EXECUTED**이며 수정 SHA에서 필수 재검증해야 합니다.

## 정적·클라이언트 검증

Node 22.23.1, pnpm 11.5.3 기준으로 현재 SHA에서 재실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| focused billing/client | PASS | 50/50, fail 0, skip 0 |
| `pnpm test` | PASS | 101/101, fail 0, skip 0 |
| 이미지 gate | PASS | 329상품/1,316장, 큐레이션 20상품/100장 |
| `pnpm lint` | PASS | 오류·경고 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| 모순 POST 상태쌍 probe | **FAIL** | 네 조합 모두 client `ok: true` |

기존 focused test가 모두 통과한 이유는 POST 응답의 cancel request/charge 모순 상태쌍을 실제 parser에 주입하는 케이스가 없기 때문입니다. source 정규식 테스트는 소유권·금액 결박을 확인하지만 이 parser 계약 누락을 탐지하지 못합니다.

## 배포·운영 상태

- Vercel production 배포 `dpl_27TAHvFGXvsVrYndU5eqkCg1Z5WR`은 `READY`, region `sin1`입니다.
- 배포 Git SHA는 local/origin HEAD `70ca87bfe1d6629193fcba10815b7763ffc5725f`와 일치합니다.
- `laonshop.com`, `www.laonshop.com`이 production alias이며 alias error는 없습니다.
- 최근 1시간 runtime error cluster 0건, 해당 배포 error/fatal 로그 0건입니다.
- LAONPAY env/schema는 의도적으로 미적용 상태이므로 현재 운영 hosted/oneclick은 fail-closed입니다.

## 필수 수정·회귀

1. `billingCancelRequestResponseSchema`에 signed GET과 같은 상태쌍 검증을 추가합니다.
2. `requestCancelAction`의 rejected 판정도 `charge.status === "PAID"`를 독립 방어로 요구합니다.
3. 위 네 모순 POST 응답이 client `UNKNOWN`이며 terminal DB 상태를 만들지 않는 회귀 테스트를 추가합니다.
4. 격리 DB와 stub에서 seller-first 원격 reason A/B 차이를 다음 전체 행렬로 검증합니다.
   - `REQUESTED`, `PROCESSING`, `DONE`, `REJECTED`
   - `DONE+CANCELED`의 POST 응답유실 대사
   - `PROCESSING → REQUESTED` 비회귀
   - ID·owner·externalOrderId·amount·paymentId 불일치 no-write
   - provider cancel ID 유실 charge fallback과 `PAID` 비추론
5. 320/360/390/412px와 확대 환경에서 REJECTED 안내·조회 버튼을 재검증합니다.

## 미실행

- seller-first 네 상태의 실제 DB transaction 원자 상태행렬
- 인증 브라우저의 REJECTED 조회 버튼, 320~412px와 200% UI
- Android/iOS 인증 상태 UI
- LAONPAY 실제 hosted/API 상호운용
- 실카드, 실 PG 승인·취소·해지

P1 확정 후 불필요한 추가 하네스 시간을 줄이고 수정 SHA에서 전체 행렬을 재검증하라는 제어 지침에 따라 조기 종료했습니다. 미실행 항목은 별도 제품 결함으로 계산하지 않았습니다.

## Cleanup

- 임시 HTTP probe 파일을 삭제했습니다.
- 격리 PostgreSQL은 fixture 생성 전 schema 적용만 확인한 뒤 정상 종료했습니다.
- 임시 DB cluster, database와 log를 삭제했고 port 55432 listener가 없는 것을 확인했습니다.
- 운영 DB, Vercel env, LAONPAY/PG 상태와 제품 코드를 변경하지 않았습니다.
- 최종 저장소는 QA 문서 작성 전 `main=origin/main=70ca87b`, clean 상태였습니다.

## 최종 판정

seller-first 원격 reason 대사 로직은 signed GET 경계에서 의도대로 보강됐지만, 그 앞의 취소 POST parser가 모순 상태쌍을 성공으로 수용합니다. `REJECTED` 모순 조합은 Action에서 terminal 반려로 기록될 수 있어 결제 취소 원장 일관성을 깨뜨립니다.

현재 비활성 운영 배포는 유지할 수 있으나 LAONPAY 빌링 활성화는 **FAIL / NO-GO**입니다. 제품 수정 후 client parser, Action 독립 방어와 격리 DB 상태행렬을 모두 통과해야 합니다.
