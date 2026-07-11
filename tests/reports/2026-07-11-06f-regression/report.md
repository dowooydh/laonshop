# LAONSHOP `06f0e08` 회귀 QA 보고서

실행일: 2026-07-11

담당: Codex QA/테스트 세션

대상 저장소: `/Users/donghyuk/Projects/laonshop`

대상 브랜치/커밋: `main` / `06f0e084b6dbcd5f2221e09ecb483058a354fb1a`

비교 범위: `5fe1417369f12e71328f221a34604f7a9229a07a..06f0e084b6dbcd5f2221e09ecb483058a354fb1a`

최종 결과: **FAIL**

출시 판정: **NO-GO - P1 결함 수정 전 실결제 출시 금지**

## 1. 결론

- 인계된 재고 합산, 마지막 재고 동시성, 일반 KSPAY callback 멱등 처리, 이메일 동시 가입, 모바일 overflow, 결제 스크립트 장애 복구는 실제 검증에서 통과했습니다.
- 수기결제의 불명확한 503 응답 뒤 동일 주문을 재전송하면 외부 승인 API가 다시 호출됩니다. 첫 승인이 PG에서 성립하고 응답만 유실된 경우 중복 승인될 수 있습니다.
- 일반 KSPAY의 `__KSPAY_PROCESSING__` 주문도 30분이 지나면 재고 예약 집계에서 빠져, 승인 여부가 불명확한 마지막 재고를 다른 주문이 다시 확보할 수 있습니다.
- 체크아웃 멱등키가 고정 30분 시간 버킷을 포함해, 같은 요청도 버킷 경계 전후에는 서로 다른 키가 됩니다.
- 제품 코드는 수정하지 않았습니다. 변경 범위는 이 보고서, 최신 핸드오프와 QA 증적뿐입니다.

## 2. 환경과 기준선

| 항목 | 검증값 |
| --- | --- |
| Git | `main`, HEAD와 `origin/main` 모두 `06f0e084...`, 시작 시 clean |
| Node / pnpm | Node `22.23.1`, pnpm `11.5.3` |
| Next / Prisma | Next `15.5.19`, Prisma `6.19.3` |
| 서버 | production build 후 `next start -p 3003`, `http://localhost:3003` |
| DB | 제공된 Neon 테스터 브랜치, 실제 URL 미기록 |
| 데스크톱 | Chromium/in-app browser, 1280x720 |
| 모바일폭 자동화 | Chromium 320x800, 390x844, 412x800 |
| Android | `emulator-5554`, Chrome `133.0.6943.137`, 실제 CSS 폭 약 320/390/412px |

운영 `https://laonshop.com`, Safari/WebKit, iOS와 실 MID는 검증하지 않았습니다. 결과는 위 로컬 HEAD와 테스터 DB에 적용합니다.

## 3. 정적·빌드 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test` | PASS | 11/11, skip 0, fail 0 |
| `pnpm lint` | PASS | 오류 없음 |
| `pnpm typecheck` | PASS | TypeScript 오류 없음 |
| `pnpm prisma validate` | PASS | 스키마 유효, Prisma 설정 폐기 예정 안내만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | static generation 19/19 |

모든 명령은 Node 22로 고정해 실행했습니다.

## 4. 중점 회귀 결과

| 시나리오 | 결과 | 실제 단정 |
| --- | --- | --- |
| 같은 상품 `stock=1`, S 1 + M 1 | PASS | UI 재고 오류, 주문/주문항목 0건 |
| 허용되지 않은 사이즈 제출 | PASS | 서버 거부 |
| 서로 다른 사용자 마지막 재고 동시 주문 | PASS | 성공 1, 재고 거부 1, 주문 1건 |
| 같은 사용자·동일 키 동시 요청 | PASS | 같은 주문 ID, 주문 1건 |
| 두 탭 체크아웃 재전송 | PASS | 동일 order ID/moid, DB 주문 1건 |
| 동일 이메일 대소문자 변형 동시 가입 | PASS | 성공 1, 중복 안내 1, DB 1건, 저장 이메일 소문자 |
| 대문자 변형 이메일 로그인 | PASS | 동일 계정 로그인 성공 |
| KSPAY 처리 마커가 있는 result 재전송 | PASS | 외부 승인 재호출 없이 PENDING/마커 유지 |
| 사용자 취소 result 병렬 제출 | PASS | 두 요청 303, 최종 FAILED |
| PENDING/FAILED 주문 화면 | PASS | 확인 중에는 재결제 숨김, FAILED에는 재결제 노출 |
| KSPAY 스크립트 차단 | PASS | spinner 종료, 오류와 `다시 시도` 노출, PG 요청 1회 |
| KSPAY 스크립트 8초 지연 | PASS | 로딩 관찰 후 약 9.2초에 오류/재시도 전환, overflow 없음 |
| 오류 화면 `다시 시도` | PASS | 체크아웃 폼 복귀, 추가 PG 요청 없음 |
| 타 사용자 주문 URL | PASS | 404, 주문번호·배송정보 비노출 |
| 네트워크 offline 후 복구 | PASS | `ERR_INTERNET_DISCONNECTED` 확인 후 검색 페이지 정상 복구 |
| 320/390/412px 주요 6개 화면 | PASS | 홈·남성·여성·검색·카트·체크아웃 모두 `scrollWidth=innerWidth` |
| 320/390/412px 200% root font | PASS | 동일 6개 화면 overflow 0, Application Error 0 |
| Android Chrome 실제 폭 | PASS | 320 헤더, 390 카테고리, 412 검색/빈 상태 렌더·조작 정상 |

DB 동시성 검증 출력은 다음과 같았습니다.

```text
aggregateRejected true
invalidSizeRejected true
concurrentSuccesses 1
concurrentRejected 1
concurrentOrderCount 1
idempotentSameOrder true
idempotentOrderCount 1
```

## 5. 발견 결함

### P1-01 수기결제 503/timeout 뒤 재시도하면 외부 승인이 다시 호출됩니다

재현:

1. `KSPAY_REST_LIVE=1`과 로컬 전용 WEBFEP 503 stub으로 production server를 실행합니다.
2. QA 상품 1개를 수기결제로 제출합니다.
3. 첫 503 뒤 `결제 서버가 요청을 처리하지 못했습니다`가 표시되는 것을 확인합니다.
4. 같은 체크아웃을 그대로 다시 제출합니다.

기대 결과: 승인 성립 여부가 불명확하면 주문 처리 마커를 먼저 저장하고 같은 주문의 외부 승인 재호출을 차단해야 합니다.

실제 결과:

- 첫 제출 후 stub `REQ 1`, 같은 주문은 `PENDING`, `approvalNo=null`이었습니다.
- 재제출 후 stub가 `REQ 2`로 증가했습니다.
- DB 주문은 한 건의 `PENDING`으로 유지됐지만 외부 승인 요청은 두 번 발생했습니다.

영향: 첫 요청이 PG에서 승인되고 503/응답 유실만 발생했다면 재시도로 동일 주문이 중복 승인될 수 있습니다.

원인 후보:

- `app/checkout/actions.ts:181-233`이 외부 `payOldCert` 호출을 DB interactive transaction 안에서 실행합니다.
- `app/checkout/actions.ts:216-220`은 `indeterminate`일 때 FAILED 전환만 피하고 처리 마커를 남기지 않습니다.
- 같은 멱등 주문의 다음 요청은 `PENDING`으로 다시 진입해 `payOldCert`를 재호출합니다.
- PG 승인 후 DB commit 실패/transaction timeout이 발생해도 같은 불일치가 가능합니다.

권고 회귀:

- 외부 호출 전에 수기결제 전용 processing marker를 별도 transaction으로 commit합니다.
- 동일 order/moid의 503, timeout, 연결 종료, commit 실패 뒤 외부 요청 수가 정확히 1인지 검증합니다.
- 조회 API 또는 운영 보정 없이는 불명확 주문을 자동 재승인하지 않습니다.

증적: [수기결제 503 오류 화면](manual-503-retry.jpg)

### P1-02 승인 확인 중 주문의 재고 예약이 30분 뒤 해제됩니다

재현:

1. `stock=1` QA 상품과 `PENDING + approvalNo=__KSPAY_PROCESSING__` 주문 1건을 만듭니다.
2. 해당 주문의 `updatedAt`을 31분 전으로 설정합니다.
3. 다른 사용자가 같은 상품 1개를 주문하는 재고 guard를 실행합니다.

기대 결과: 외부 승인 결과가 불명확한 처리 마커 주문은 운영 확인 전까지 재고를 계속 예약해야 합니다.

실제 결과: `processingMarkerExpiredReservationAccepted=true`로 두 번째 주문이 허용됐습니다.

영향: 첫 결제가 실제 승인됐지만 callback 확정만 실패한 경우 마지막 재고가 다른 주문에도 판매되어 결제·재고 상태가 불일치합니다.

원인 후보:

- `app/api/pg/kspay/result/route.ts:41-45`, `:63-65`는 불명확 결과에 마커와 PENDING을 유지합니다.
- `lib/order-guard.ts:167-171`은 마커 유무와 관계없이 모든 PENDING을 `updatedAt` 30분 조건으로만 집계합니다.

권고 회귀:

- processing marker가 있는 PENDING은 일반 미결제 PENDING과 분리해 만료시키지 않거나, 운영 확인 상태/재고 정책을 별도 모델링합니다.
- 29분/30분/31분 경계에서 일반 PENDING과 불명확 PG PENDING의 예약 동작을 각각 검증합니다.

### P2-01 30분 버킷 경계에서 동일 체크아웃의 멱등키가 달라집니다

재현:

1. 같은 payload와 nonce로 `createCheckoutIdempotencyKey`를 호출합니다.
2. 시각만 30분 버킷 끝 1ms 전과 다음 버킷 시작으로 설정합니다.

실제 결과: `sameRequestAcrossWindowBoundaryHasSameKey=false`였습니다.

영향: 서로 다른 탭의 동일 제출이 버킷 경계를 사이에 두면 서로 다른 moid와 주문을 만들 수 있어, 다중 탭 멱등성 보장이 확률적으로 깨집니다.

원인 후보: `lib/checkout-idempotency.ts:20-22`가 wall-clock 30분 버킷을 해시 입력에 직접 포함합니다. 기존 단위 테스트도 새 시간창을 새 요청으로 분리하는 현재 정책을 명시하므로, 문제는 만료 자체가 아니라 진행 중인 다중 탭 요청까지 고정 시각 경계에서 즉시 갈라지는 점입니다.

권고 회귀:

- 체크아웃 시작 시 생성한 nonce와 만료 시각을 함께 저장해 경계가 진행 중 요청을 갈라놓지 않도록 합니다.
- 경계 전후 1ms, 두 탭 동시 제출, 빈 카트 후 동일 카트 재구성 시나리오를 추가합니다.

## 6. 모바일·접근성 증적

- [Android Chrome 320px + 시스템 글꼴 200%](android-chrome-320-font200.png)
- [Android Chrome 390px 여성 카테고리](android-chrome-390-women.png)
- [KSPAY 스크립트 오류 390px](kspay-script-error-390.png)

카테고리/결제수단은 44px 이상, 장바구니 수량/삭제는 변경된 CSS 기준 44px을 확인했습니다. 보조 텍스트 색상은 변경값 기준 AA 대비를 충족하며, 브라우저 콘솔 오류는 0이었습니다. 홈 이미지 preload 미사용 경고만 3회 관찰했습니다.

## 7. 미실행·제한

- 실카드 승인, KSNET 자동취소, 실영수증 조회는 실행하지 않았습니다.
- 운영 Vercel 배포 커밋 일치와 운영 도메인은 검증하지 않았습니다.
- 실제 KSNET 503/timeout은 호출하지 않고 로컬 stub/브라우저 route로 안전하게 주입했습니다.
- Safari/WebKit과 iOS 실제 기기는 미검증입니다.
- 관리자 화면은 저장소에 존재하지 않습니다.
- 신규 커밋의 인증 변경과 직접 관련 없는 비밀번호 변경·회원탈퇴 전 흐름은 이번 회귀에서 반복하지 않았습니다.
- 401/403/409/429를 별도 HTTP 상태로 반환하는 API가 없어 UI redirect/404/오류 상태로 검증했습니다.

## 8. cleanup

이번 실행에서 만든 QA 사용자 8명, 주문 9건, 주문항목 9건, QA 상품 1개를 식별해 삭제했습니다. 동시성·marker 전용 임시 fixture는 각 스크립트의 `finally`에서도 즉시 정리했습니다.

최종 집계는 시작 전과 동일합니다.

```text
users=9, activeUsers=8, orders=4, items=4,
products=329, wishlists=0, cards=4,
qaUsers=0, qaProducts=0
```

Android는 `1080x2400`, font scale `1.0`으로 복구했고, adb forward와 로컬 3003/3999 서버를 종료했습니다. 운영·시드 상품, 기존 계정, 기존 주문, PG/Vercel 설정은 변경하지 않았습니다.

## 9. 출시 권고

1. P1-01 수기결제 처리 마커와 외부 승인 호출 경계를 수정합니다.
2. P1-02 처리 마커 주문의 재고 예약 정책을 수정합니다.
3. P2-01 체크아웃 시간 버킷 경계 멱등성을 보완합니다.
4. 위 세 항목의 병렬·timeout·31분 경계 회귀가 통과한 뒤 실결제 출시를 재판정합니다.
