# LAONSHOP `588e845` 수정 회차 1/2 회귀 QA 보고서

실행일: 2026-07-11

담당: Codex QA/테스트 세션

대상 저장소: `/Users/donghyuk/Projects/laonshop`

대상 브랜치/커밋: `main` / `588e845e66e8887461e1faf9714d760d31391e25`

비교 대상: 제품 수정 커밋 `588e845` 단일

최종 결과: **PASS**

출시 판정: **GO - 이번 수정 범위의 P1/P2 회귀 통과**

## 1. 결론

- 수기결제 503와 8초 timeout 뒤 동일 폼을 재제출해도 WEBFEP 요청은 1회로 유지됐고, 주문은 `PENDING + __KSPAY_PROCESSING__`으로 보류됐습니다.
- 명시적 승인 거절은 `FAILED + approvalNo=null`로 전환되어 같은 주문의 재시도를 허용했습니다.
- 성공 응답은 외부 요청 1회와 PAID 주문 1건으로 확정됐습니다.
- 승인 성공 뒤 DB 확정 실패를 22초 advisory lock으로 주입했을 때 화면은 안전 오류를 표시하고 DB는 `PENDING + marker`, WEBFEP 요청은 1회로 유지됐습니다.
- processing marker 주문은 29분, 30분, 31분, 24시간 경과 모두 재고를 계속 예약했고 일반 PENDING만 31분에 해제됐습니다.
- 체크아웃 키는 시간 경계와 무관하게 동일하고, 카트의 상품·사이즈·수량이 실제 변경될 때만 nonce가 회전했습니다.
- 제품 코드는 수정하지 않았습니다. 변경 범위는 이 QA 보고서와 최신 핸드오프뿐입니다.

## 2. 환경

| 항목 | 검증값 |
| --- | --- |
| Git | `main`, HEAD/origin 모두 `588e845`, 시작 시 clean |
| Node / pnpm | Node `22.23.1`, pnpm `11.5.3` |
| Next / Prisma | Next `15.5.19`, Prisma `6.19.3` |
| 서버 | production build 후 `next start -p 3003` |
| DB | 제공된 Neon 테스터 브랜치, 실제 URL 미기록 |
| PG fault | `127.0.0.1:3999` 로컬 전용 WEBFEP stub |
| 브라우저 | Chromium, 390x844 |

실 KSNET, 운영 Vercel, 운영 DB에는 요청하거나 변경하지 않았습니다.

## 3. 정적·빌드 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test` | PASS | 14/14, skip 0, fail 0 |
| `pnpm lint` | PASS | 오류 없음 |
| `pnpm typecheck` | PASS | TypeScript 오류 없음 |
| `pnpm prisma validate` | PASS | 스키마 유효 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |

Prisma의 `package.json#prisma` 설정 폐기 예정 안내만 남았으며 현재 검증을 막지 않습니다.

## 4. 실제 검증 결과

### 수기결제 외부 호출 멱등성

| 시나리오 | 결과 | UI·DB·stub 단정 |
| --- | --- | --- |
| WEBFEP HTTP 503 | PASS | 첫 요청 1회, 재제출 뒤에도 총 1회, PENDING+marker |
| 8초 timeout | PASS | 약 9.9초에 안전 오류, 재제출 뒤에도 총 1회, PENDING+marker |
| 명시적 승인 거절 | PASS | FAILED+marker 해제, 재시도 허용, stub 1회→2회 |
| 승인 성공 | PASS | stub 1회, PAID 1건, approvalNo/pgTrno 저장 |
| 승인 성공 후 DB 확정 실패 | PASS | 22초 order advisory lock, 제품 tx 15초 timeout, 안전 오류, PENDING+marker, stub 1회 |

503 브라우저 검증에서 첫 오류 뒤 동일 결제 버튼을 다시 눌렀을 때 `결제 결과를 확인 중입니다`가 노출됐고 stub 요청 수는 증가하지 않았습니다. timeout도 같은 결과였습니다.

명시적 거절은 같은 moid 주문 한 건을 유지한 채 `FAILED`, `approvalNo=null`이 됐고 두 번째 제출에서만 외부 요청이 한 번 더 발생했습니다.

성공 응답은 다음 상태로 확인했습니다.

```text
status=PAID
approvalNo=QA-APP-1
pgTrno=QA-TID-1
cardName=QA CARD (수기)
```

### DB 확정 실패 증거 출처

QA의 첫 두 잠금 주입 시도는 `pg_sleep()` void 역직렬화 오류 때문에 잠금이 즉시 풀려 주문이 정상 PAID가 됐습니다. 이 두 브라우저 timeout은 제품 실패가 아니라 **fault-injection 도구 실패**로 판정했습니다.

이후 연결된 DEV 작업이 같은 로컬 QA 환경에서 새 `finalize3` 주문을 사용해 다음 절차를 한 번 신뢰성 있게 재실행했습니다.

1. processing marker를 100ms polling으로 확인합니다.
2. 즉시 `order:<id>` advisory transaction lock을 획득합니다.
3. 제품 transaction timeout 15초보다 긴 22초 동안 잠금을 유지합니다.
4. 화면 오류, DB 상태, stub 요청 수를 직접 확인합니다.

최종 결과는 `PENDING + __KSPAY_PROCESSING__`, WEBFEP 총 1회였고 재제출 뒤에도 요청 수가 증가하지 않았습니다. 이 항목은 DEV의 `[AUTO_QA_EVIDENCE]`와 QA의 최종 DB/cleanup 교차 확인을 근거로 PASS 처리했습니다.

### 재고 예약 경계

실제 DB fixture 결과:

```text
marker29Rejected=true
marker30Rejected=true
marker31Rejected=true
marker24hRejected=true
ordinary29Rejected=true
ordinary31Released=true
```

processing marker는 시간과 무관하게 예약에 포함되고, 일반 미결제 PENDING만 기존 30분 정책에 따라 해제됩니다.

### 동시성·체크아웃 키

실제 DB 동시성 결과:

```text
lastStockFulfilled=1
lastStockRejected=1
lastStockOrderCount=1
sameOrderId=true
sameOrderCount=1
```

단위 회귀에서는 같은 payload/nonce가 30분 경계와 24시간 뒤에도 같은 키를 만들었습니다. 동일 카트 재저장과 항목 순서 변경은 nonce/key를 유지하고, 상품·사이즈·수량 변경은 새 nonce를 발급했습니다.

## 5. 코드리뷰 결과

이번 커밋에서 신규 출시 차단 결함은 발견하지 못했습니다.

- `app/checkout/actions.ts`는 marker commit, 외부 `payOldCert`, 후속 확정을 별도 transaction으로 분리했습니다.
- 불명확 결과와 후속 DB 확정 실패는 marker를 지우지 않습니다.
- 명시적 거절만 FAILED로 바꾸며 marker를 해제합니다.
- `lib/order-guard.ts`는 marker PENDING을 30분 조건 밖에서도 예약량에 포함합니다.
- `lib/checkout-idempotency.ts`는 wall-clock 버킷을 해시에서 제거했습니다.
- `lib/cart.ts`는 가격·이름·이미지 같은 표시 정보가 아니라 상품·사이즈·수량 의미만 nonce 변경 기준으로 사용합니다.

## 6. 미실행·잔여 위험

- 실 KSNET 승인, 실제 통신 장애, 자동취소, 실영수증은 실행하지 않았습니다.
- 불명확 주문의 marker는 자동 해제되지 않으며 거래조회 API가 없어 운영자 KSTA 확인이 필요합니다.
- 운영 Vercel 배포 커밋 일치, Safari/WebKit, iOS 실제 기기는 미검증입니다.
- 일반 KSPAY result 경합과 실제 두 탭 UI는 직전 `06f0e08` 회귀 결과를 유지했습니다. 이번에는 신규 단위 테스트와 동일 키 DB 병렬 테스트로 변경 경계를 재검증했습니다.
- 구조는 유효한 JSON이지만 성공 식별자가 누락된 WEBFEP 응답 같은 PG별 비정상 envelope는 실제 스펙 확인이 추가로 필요합니다.

## 7. cleanup

이번 수정 회차에서 만든 `qa.588.*` QA 사용자 7명, 주문 8건, 주문항목 8건, QA 상품 1개를 삭제했습니다.

최종 집계:

```text
users=9, activeUsers=8, orders=4, items=4,
products=329, wishlists=0, cards=4,
qaUsers=0, qaProducts=0
```

3003/3999 서버와 임시 브라우저 컨텍스트를 종료했습니다. 작업 트리는 QA 문서 작성 전 clean이었고, 운영·시드 상품과 기존 사용자·주문은 변경하지 않았습니다.

## 8. 출시 권고

이번 수정 회차의 P1/P2는 모두 회귀를 통과했습니다. 실결제 활성화 전에는 기존 운영 가드에 따라 실 MID·WEBFEP 계약 상태, KSTA 운영 확인 절차와 운영 배포 커밋 일치를 별도로 확인합니다.
