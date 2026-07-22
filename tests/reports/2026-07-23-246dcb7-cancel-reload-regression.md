# 246dcb7 취소 접수 hard reload 최종 회귀 QA 보고서

작성일: 2026-07-23

담당: Codex QA/테스트 세션

이전 QA 기준: `1737eae0956cc2d27ab1743e15dffa076ed90735`

검증 제품 SHA: `246dcb7b62d05afbc4c28be3e6a094f11ba67980`

비교 범위: `1737eae0956cc2d27ab1743e15dffa076ed90735..246dcb7b62d05afbc4c28be3e6a094f11ba67980`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-gbqw8fyi6-customorder.vercel.app`
- Deployment: `dpl_F2ZJXVF4H3B4LXtBa5Ckk7TZXmTj`

## 판정

- 전체 결과: **PARTIAL**
- `QA-F52-01` 취소 접수 화면 갱신 비결정성: **PASS / CLOSED**
- 취소 성공 반복·네트워크·중복·오류 경계: **PASS**
- 직전 수기결제 dialog 입력 guard/focus/200% 수정: **PASS 유지**
- 신규 제품 결함: **없음**
- 웹/Chrome 심사 시연: **GO**
- Android/iOS 인증 touch 전체 흐름: **HOLD, 실제 플랫폼 미실행**

수정 대상은 격리 PostgreSQL과 local production Chrome에서 실제 Server Action, DB, 전체 GET navigation을 함께 계측해 통과했습니다. 취소 성공 10회 모두 506ms 이내에 `CANCEL_REQUESTED`, 접수 heading·badge, 취소 form 제거로 수렴했고 Action POST와 전체 GET은 각 1회, 외부 PG 요청은 0회였습니다.

다만 현재 Android 기기가 연결되지 않았고 iOS QA Simulator도 종료 상태이며 인증 세션이 없어, 요청된 실제 모바일 인증 흐름을 실행하지 못했습니다. Chrome touch context 증거를 실제 Android/iOS PASS로 대체하지 않았습니다.

## 범위와 안전 경계

- 제품 코드를 수정하지 않았습니다.
- 실카드, 실 KSNET/KSPAY/WEBFEP/LAONPAY 호출, 운영 DB write, Vercel env/schema 변경을 실행하지 않았습니다.
- `/private/tmp`의 일회용 PostgreSQL cluster에 현재 Prisma schema를 적용했습니다.
- 일회용 심사 계정, 일반 고객, stock=1 상품, 주문만 만들었습니다.
- 외부 결제 요청은 URL 분류와 횟수만 기록했고 카드값, 계정 비밀번호, session secret을 출력하거나 저장하지 않았습니다.
- 이전 실패 러너와 최종 성공 러너의 브라우저, Next, PostgreSQL, fixture, log, 임시 스크립트를 모두 제거했습니다.

## 변경 독립 검토

실제 diff는 아래 두 파일뿐입니다.

- `app/order/[id]/cancel-request.tsx`
- `tests/api/billing-ui-accessibility.test.ts`

성공 경로는 `router.refresh()` 대신 `window.location.reload()`로 현재 주문 URL을 전체 GET 요청합니다. `reloading=true`인 동안 `submittingRef`와 `pending`을 해제하지 않아 문서 교체 전 후속 클릭을 막습니다. 명시 오류는 기존처럼 잠금을 풀고 인라인 재시도를 허용하며, `retryBlocked`와 예외는 기존처럼 잠금과 상태조회 안내를 유지합니다.

`f52d081..246dcb7`에서 dialog, checkout form, demo 정책, 멱등키, 재고 guard 파일은 byte diff가 0이었습니다. 따라서 직전 실제 mouse/touch/keyboard 및 14개 반응형 조합 증거를 불변 회귀 근거로 사용하고, 이번 변경 경로는 별도 런타임으로 검증했습니다.

## 정적·빌드 검증

Node 22.23.1, pnpm 11.5.3 기준으로 독립 실행했습니다.

| 항목 | 결과 |
| --- | --- |
| focused billing/manual/accessibility | PASS 31/31, skip 0 |
| `pnpm test` | PASS 132/132, fail 0, skip 0 |
| 이미지 gate | PASS, 상품 329/1,316장 및 큐레이션 20상품/100장 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma 7 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm build` | PASS, Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS |
| `AGENTS.md` / `CLAUDE.md` | PASS, byte-identical |

## 실제 브라우저·DB 검증

환경:

- macOS Google Chrome 실제 실행 파일, Playwright 제어
- local production Next 15.5.19
- 일회용 PostgreSQL
- 기본 viewport `412x915`
- LAONPAY/실수기/외부 PG gate OFF

### QA-F52-01 원 재현 10회

각 반복은 독립 demo `PAID` 주문에서 취소 form을 열고 사유를 입력한 뒤 한 번 제출했습니다. 성공 기준은 클릭 후 3초 안에 DB와 화면이 동시에 수렴하고 Action POST 1회, document GET 1회, PG 요청 0회인 것입니다.

| 반복 | 상태 수렴 | 소요 | Action POST | 전체 GET | PG |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | PASS | 394ms | 1 | 1 | 0 |
| 2 | PASS | 238ms | 1 | 1 | 0 |
| 3 | PASS | 268ms | 1 | 1 | 0 |
| 4 | PASS | 267ms | 1 | 1 | 0 |
| 5 | PASS | 370ms | 1 | 1 | 0 |
| 6 | PASS | 506ms | 1 | 1 | 0 |
| 7 | PASS | 456ms | 1 | 1 | 0 |
| 8 | PASS | 307ms | 1 | 1 | 0 |
| 9 | PASS | 342ms | 1 | 1 | 0 |
| 10 | PASS | 282ms | 1 | 1 | 0 |

10/10 모두 다음을 만족했습니다.

- DB `status=CANCEL_REQUESTED`, `cancelRequestedAt` 존재
- heading `취소·반품 신청이 접수되었습니다`
- badge `취소 접수`
- 기존 `시연 주문 취소` form 제거
- 실제 승인취소·환불·PG 거래 없음 안내 유지

### 중복 입력과 두 탭

| 시나리오 | 결과 |
| --- | --- |
| DOM 연속 click 2회 | Action POST 1, GET 1, DB 1건 수렴, pending disabled 및 `aria-busy=true` |
| Enter 연속 2회 | Action POST 1, GET 1, DB 1건 수렴, pending disabled 및 `aria-busy=true` |
| 같은 주문 두 탭 동시 제출 | Action POST 2, 성공 GET 1, DB 상태 변경 1건, 다른 탭 명시 오류, PG 0 |

두 탭은 브라우저별 요청이므로 POST 자체는 2회였지만 서버의 조건부 `PAID` 갱신은 정확히 한 번만 성공했습니다. 성공 탭은 접수 화면으로 이동했고 다른 탭은 `취소 신청할 수 없는 주문입니다.`를 표시했습니다. 추가 주문, 결제, 감사로그, Billing 원장은 생성되지 않았습니다.

### 오류·불명확 결과

| 시나리오 | 결과 |
| --- | --- |
| Action 전 주문을 `FAILED`로 바꾼 명시 오류 | reload 0, 인라인 오류, 버튼 재활성, DB 불변, `PAID` 복원 뒤 재시도 성공 |
| Action 요청 connection reset fault | reload 0, DB `PAID`, textarea·submit 잠금, 상태조회 버튼 노출 |
| LAONPAY labeled 주문 + integration OFF | 외부 요청 0, reload 0, DB `PAID`, 재신청 잠금·상태조회 안내 |
| 다른 고객의 주문 URL | 404 화면, 주문·원장 변화 0 |

connection reset 시 Chrome console의 `ERR_CONNECTION_RESET` 한 건은 의도한 fault injection 증거이며 제품의 비주입 console 오류로 분류하지 않았습니다.

### 새로고침·뒤로가기·앞으로가기

- 취소 완료 주문을 reload하고 `/mypage`로 이동한 뒤 back/forward/back을 실행했습니다.
- 최종 주문 URL과 접수 heading이 유지됐고 취소 form은 복원되지 않았습니다.
- 이 과정의 Action POST는 0회였습니다.

### 일반 KSPAY·등록카드 경계

- demo 주문은 취소 Action에서 billing label이 없어 일반 KSPAY와 같은 `requestKspayCancel` 경로를 사용합니다.
- 일반 KSPAY 취소의 `PAID -> CANCEL_REQUESTED` 조건부 갱신과 hard reload를 실제 10회 검증했습니다.
- LAONPAY labeled 주문은 integration OFF에서 KSPAY 취소로 우회하지 않고 retryBlocked로 닫혔으며 외부 요청은 0회였습니다.
- LAONPAY 상태쌍·멱등 계약은 전체 테스트 132/132에서 회귀 통과했습니다. 실제 LAONPAY/PG 호출은 금지 범위로 실행하지 않았습니다.

## 직전 dialog·수기결제 회귀 계승

이번 제품 diff에 아래 파일의 변경이 없음을 Git으로 확인했습니다.

- `app/checkout/manual-payment-dialog.tsx`
- `app/checkout/checkout-form.tsx`
- `lib/manual-payment-demo.ts`
- `lib/checkout-idempotency.ts`
- `lib/order-guard.ts`

직전 `f52d081` 실제 런타임의 다음 결과를 유지합니다.

- 완료/X/취소 mouse double-click 및 touch double-tap: 배경 hit 0
- Enter/Space 반복 입력: guard 동안 재열림 0, 760ms 후 정상 복구
- Tab 30회 + Shift+Tab 30회: dialog 밖 이탈 0
- 상단 타일·정보 수정·입력 버튼 opener focus 정확 복귀
- `320/360/375/390/412/768/1280px x 100%/200%` 14개 조합 overflow/clipping/internal scroll/44px 문제 0
- 같은 nonce 두 탭 demo 주문 1건, 카드 원문 필드 0, PG 0, `pgTrno=null`, Billing/Audit 0, demo 재고 예약 0

## 운영 배포 확인

- deployment `dpl_F2ZJXVF4H3B4LXtBa5Ckk7TZXmTj`는 `READY`, `production`, `sin1`입니다.
- deployment Git SHA, local HEAD, origin/main이 모두 `246dcb7b62d05afbc4c28be3e6a094f11ba67980`으로 일치했습니다.
- apex/www/fixed alias가 연결됐고 `aliasError`는 null입니다.
- 최근 1시간 Vercel runtime error cluster는 0개입니다.
- apex는 HTTP 200, www는 apex로 1회 redirect 후 200입니다.
- fixed URL은 Vercel Authentication으로 보호되어 공개 curl이 로그인으로 이동했습니다. deployment metadata로 상태와 SHA를 확인했습니다.
- 운영 guest `/checkout`은 로그인·이메일 보호 화면을 반환했고 운영 쓰기는 실행하지 않았습니다.

## 미실행·도구 제약

- Android Emulator 실제 Chrome의 인증된 demo 주문·취소 touch 전체 흐름: `adb devices`에 연결 기기 없음
- iOS Simulator MobileSafari의 인증된 demo 주문·취소 touch 전체 흐름: LAON QA Simulator 포함 모든 대상이 Shutdown이며 인증 세션 없음
- 실 WEBFEP/KSPAY/LAONPAY 승인·취소·영수증
- 운영 심사 계정의 demo 주문 생성과 운영 DB cleanup

초기 브라우저 러너에서 `waitForNavigation(domcontentloaded)`와 hard reload 완료 신호가 겹치거나 Playwright `dblclick()`이 문서 교체 뒤 종료를 기다리는 문제가 있었습니다. URL/DB는 이미 정상 상태였고 최종 러너는 화면 상태, 문서 GET, DOM 연속 입력을 분리 계측해 완료했습니다. 해당 도구 대기는 제품 실패로 계산하지 않았습니다.

## Cleanup

- 성공·실패 실행의 Chrome과 모든 browser context를 종료했습니다.
- local production Next 서버를 종료했습니다.
- 일회용 PostgreSQL을 fast stop하고 cluster, fixture, log를 삭제했습니다.
- 임시 QA 러너를 삭제했습니다.
- 포트 3003과 55467에 남은 listener가 없음을 확인했습니다.
- 운영 DB, Vercel env/schema, PG 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

`246dcb7`은 `QA-F52-01`을 실제 반복 10/10에서 해결했습니다. 성공 뒤 DB 원장을 전체 GET으로 다시 읽고, 문서 교체 전까지 제출 잠금을 유지해 stale form과 동일 탭 중복 POST를 제거했습니다. 오류·불명확 결과는 reload 없이 기존 복구 UX를 유지했고 일반 KSPAY·LAONPAY fail-closed 경계도 퇴행하지 않았습니다.

웹/Chrome 기준 심사 시연은 **GO**입니다. 다만 실제 Android/iOS 인증 touch 전체 흐름을 실행하지 못했으므로 통합 결과는 **PARTIAL**이며, 모바일 플랫폼 최종 사인은 별도 **HOLD**로 남깁니다.
