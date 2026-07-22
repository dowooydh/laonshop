# 1c078a9 심사용 수기결제 시연 회귀 QA 보고서

작성일: 2026-07-22

담당: Codex QA/테스트 세션

이전 QA 기준: `97e81a52d17c9aed2d1fe4af94946cd733ba572e`

검증 제품 SHA: `1c078a94d81a47378106d3381a2c857dca72f636`

비교 범위: `97e81a52d17c9aed2d1fe4af94946cd733ba572e..1c078a94d81a47378106d3381a2c857dca72f636`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-tjm2snwo2-customorder.vercel.app`
- Deployment: `dpl_EpsJPjeckHsbWG8qjyYSudS4jvBK`

## 판정

- 전체 결과: **FAIL**
- 심사 계정 수기결제 시연 출시: **NO-GO**
- 기존 일반 KSPAY 운영: **GO, 이번 변경 귀책 회귀 없음**
- 서버 권한·멱등·재고 제외·무 PG 경계: **PASS**
- `QA-1C0-01` 수기결제 dialog 닫힘 입력 관통·키보드 재열림: **P2 / OPEN**
- `QA-1C0-02` dialog Tab 순환 중 `body` 포커스 이탈: **P2 / OPEN**

실제 결제·주문 무결성 결함은 발견하지 못했습니다. 그러나 인계의 필수 조건인 연속 click/Enter와 배경 관통 0을 실제 Chrome 런타임에서 충족하지 못했으므로 전체 PASS로 판정하지 않았습니다.

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 KSNET/KSPAY/WEBFEP 호출, 운영 DB write, Vercel env 변경을 실행하지 않았습니다.
- `/private/tmp`의 일회용 PostgreSQL 클러스터에 현재 Prisma schema를 적용했습니다.
- 일회용 심사 계정, 일반 고객, 재고 1개 상품만 만든 뒤 로컬 production Next 서버와 Chrome에서 검증했습니다.
- 브라우저 요청 본문은 금지 필드의 포함 여부만 검사했으며 카드값, 비밀번호, 세션 비밀을 출력하거나 보고서에 남기지 않았습니다.

## 변경 독립 검토

- 심사 계정 판정은 서버의 정확한 이메일 비교를 사용하며 일반 계정 직접 요청은 주문 transaction 전에 차단됩니다.
- `manual_demo` 요청 allowlist에는 `demoIssuer`만 있고 카드 원문 필드는 없습니다.
- 시연 주문은 서버가 상품 가격·수량·사이즈·재고를 재검증한 뒤 기존 주문/항목만 생성합니다.
- 완료 값은 `PAID`, `DEMO-` 식별자, `pgTrno=null`, `카드사 (수기결제 시연)` sentinel입니다.
- `DEMO-%` 주문은 실제 재고 예약 집계에서 제외됩니다.
- 시연 취소는 `CANCEL_REQUESTED`만 기록하며 승인취소·환불·PG 호출을 실행하지 않습니다.
- 기존 KSPAY와 WEBFEP live 이중 gate는 변경되지 않았습니다.

## 정적·빌드 검증

Node 22.23.1, pnpm 11.5.3 기준으로 독립 실행했습니다.

| 항목 | 결과 |
| --- | --- |
| focused manual/billing/accessibility | PASS 31/31, skip 0 |
| `pnpm test` | PASS 132/132, fail 0, skip 0 |
| 이미지 gate | PASS, 상품 329/1,316장 및 큐레이션 20상품/100장 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm build` | PASS, Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS |
| `AGENTS.md` / `CLAUDE.md` | PASS, byte-identical |

정적 테스트 전체 통과는 아래 실제 hit-test와 키보드 결함을 상쇄하지 않습니다.

## 실제 E2E 결과

환경:

- macOS Chrome, Playwright 실제 브라우저
- 로컬 production Next 15.5.19
- 격리 PostgreSQL
- 기본 viewport `412x915`, 반응형 `320/360/375/390/412/768/1280px`
- root 글자 `100%/200%`

최종 전체 러너는 50개 단정 중 42개 PASS, 8개 FAIL로 종료됐습니다. 제품 요청 이후 fatal/soft-fail/skip은 없었습니다.

### 심사 계정·일반 계정 권한

| 시나리오 | 결과 |
| --- | --- |
| 정확한 심사 계정 | 상위 `카드·간편결제 / 수기결제` 타일 2개 노출 PASS |
| 일반 고객 UI | 결제방식 상위 그룹과 수기결제 버튼 0개 PASS |
| 일반 고객 직접 Server Action 재전송 | HTTP 응답에 비활성 안내, 주문 0건 PASS |
| 일반 고객 결제수단 | 카드·카카오·네이버·계좌이체 4개 유지 PASS |

캡처한 정상 `manual_demo` Action 요청을 일반 고객의 인증 context에서 그대로 재전송했습니다. 서버는 주문을 만들지 않았고 수기결제 비활성 안내를 반환했습니다.

### 카드정보·네트워크·원장

| 단정 | 결과 |
| --- | --- |
| dialog 내부 `name` 속성 | 0개 PASS |
| 합성 카드번호 | 16자리, Luhn 비유효 PASS |
| Action POST | 2건, `demoIssuer=SHINHAN`만 포함 PASS |
| `manualCard/cardNo/expMm/expYy/pw2/birth6` | 요청 본문 0건 PASS |
| 카드번호·생년월일 합성값 | 요청 본문 0건 PASS |
| KSNET/KSPAY/WEBFEP/LAONPAY 외부 요청 | 0건 PASS |
| Billing Card/Method/Registration/Charge/Cancel 원장 | 모두 0건 PASS |
| Admin audit | 0건 PASS |
| 브라우저 console/page error | 0건 PASS |
| 서버 log의 카드값·fixture 비밀번호 | 0건 PASS |

### 멱등성과 서버 가격

동일 카트·동일 checkout nonce를 공유한 두 탭에서 수기결제 시연을 동시에 제출했습니다.

| 증거 | 결과 |
| --- | --- |
| 두 탭 주문 페이지 이동 | 2/2 성공 |
| 두 탭 최종 URL | 동일 주문 ID |
| 생성 주문 | 정확히 1건 |
| 주문 상태 | `PAID` |
| 주문 항목 | 정확히 1건 |
| 결제금액 | DB 상품 가격 12,345원과 일치 |
| 승인 식별자 | `DEMO-` prefix |
| `pgTrno` | `null` |
| 결제수단 | `신한카드 (수기결제 시연)` |

빠른 중복 제출은 주문 한 건으로 수렴했고 외부 승인 호출은 없었습니다.

### 재고 제외

- 재고 1개 상품의 첫 시연 주문이 `PAID`가 된 뒤 실제 예약 집계는 0개였습니다.
- 새 nonce로 두 번째 시연 주문을 만들었고 두 주문 모두 `PAID`였습니다.
- 두 주문 뒤에도 실제 예약 집계는 0개였습니다.
- 주문·항목은 각각 2건이며 중복 행은 없었습니다.

시연 주문은 실제 판매 재고를 소비하지 않는다는 계약을 동적으로 확인했습니다. 일반 주문 재고 guard는 기존 정적·회귀 테스트를 통과했습니다.

### 완료·취소 화면

- 완료 화면에 수기결제 시연과 실제 카드 승인·청구·PG 거래가 없다는 안내가 표시됐습니다.
- `시연 식별번호`가 표시되고 영수증 링크는 0개였습니다.
- `시연 주문 취소`를 제출하면 DB는 `CANCEL_REQUESTED`와 입력 사유를 기록했습니다.
- 새로고침 뒤 실제 승인취소·환불·PG 거래가 없다는 안내가 유지됐습니다.
- 취소 전후 외부 결제 요청은 계속 0건이었습니다.

## 발견 결함

### QA-1C0-01 P2: dialog 닫힘 직후 연속 입력이 배경으로 관통하거나 dialog를 다시 엽니다

재현 환경: Chrome `412x915`, 심사 계정 checkout, 수기결제 dialog

재현 A, pointer:

1. 수기결제를 선택합니다.
2. 시연용 카드정보 자동 입력을 누릅니다.
3. `카드정보 입력 완료` 버튼의 고정 좌표를 실제 mouse double-click 합니다.
4. 캡처 단계에서 동일 동작을 독립적으로 다시 실행합니다.

실제 결과:

- 첫 click 대상은 dialog의 `카드정보 입력 완료` 버튼입니다.
- 첫 click으로 dialog가 사라진 뒤 두 번째 click 대상은 배경의 `input#co-address[aria-label="기본 주소"]`입니다.
- 구매 동의가 자동 변경되지는 않았지만, dialog 외부 hit-test와 포커스 이동이 실제 발생했습니다.

재현 B, keyboard:

1. `카드정보 입력 완료`에 포커스를 둡니다.
2. Enter로 완료한 뒤 닫힘·trigger 포커스 복원 직후 80ms에 Enter를 다시 입력합니다.

실제 결과:

- 두 번째 Enter가 수기결제 trigger를 실행해 dialog가 다시 열립니다.

기대 결과:

- 하나의 완료 동작에 딸린 연속 두 번째 pointer/keyboard 입력은 흡수되어야 합니다.
- dialog가 닫힌 뒤 배경 입력·링크·명령이 실행되거나 dialog가 즉시 다시 열리지 않아야 합니다.

원인 후보:

- `app/checkout/manual-payment-dialog.tsx:56`의 `close()`는 상태를 닫은 뒤 다음 animation frame에 trigger를 즉시 focus합니다.
- 닫힘 직후 pointer/click/keyboard 연속 입력을 흡수하는 phase 또는 guard가 없습니다.
- `app/checkout/checkout-form.tsx:404`의 trigger는 복원된 포커스에서 Enter를 받으면 dialog를 다시 엽니다.

필수 회귀:

1. 완료, X, 취소, Escape 각각의 단일 입력과 double-click/연속 Enter를 검증합니다.
2. 닫힘 직후 두 번째 입력의 hit target이 배경 요소가 아닌 guard인지 단정합니다.
3. 보호 시간이 끝난 뒤 trigger·주소·구매동의·결제 버튼이 정상 조작되는지 확인합니다.
4. mouse, touch double-tap, keyboard Enter/Space를 각각 검증합니다.
5. 상태·issuer·checkout nonce·구매 동의가 닫힘 연속 입력으로 바뀌지 않는지 확인합니다.

### QA-1C0-02 P2: Tab 순환 중 포커스가 dialog에서 `body`로 빠집니다

재현:

1. dialog가 열린 뒤 카드사 select의 초기 포커스를 확인합니다.
2. Tab을 연속 입력해 마지막 `카드정보 입력 완료` 다음 위치를 확인합니다.

실제 순서:

`카드번호 → 유효기간 월 → 유효기간 연도 → 비밀번호 → 생년월일 → 취소 → 완료 → body → dialog → X`

- native modal top layer 때문에 배경 버튼이 실행되지는 않았습니다.
- 그러나 한 단계에서 `document.activeElement`가 `BODY`가 되어 엄격한 focus trap 계약을 충족하지 못했습니다.
- Shift+Tab의 단일 역방향 확인은 dialog 내부에 유지됐습니다.

기대 결과:

- 마지막 제어 다음 Tab은 첫 제어로 순환하고 `body`나 배경 컨트롤로 포커스가 빠지지 않아야 합니다.

원인 후보:

- `showModal()`과 초기 focus만 사용하며 명시적 focus 순환 또는 sentinel 처리가 없습니다.

필수 회귀:

- 처음/마지막 focusable element에서 Tab/Shift+Tab을 각각 3회 이상 반복하고 매 단계 activeElement가 dialog descendant인지 단정합니다.
- Escape와 모든 닫기 경로 뒤에는 trigger focus가 정확히 한 번 복원되는지 확인합니다.

## 반응형·접근성

- `320/360/375/390/412/768/1280px`의 100%에서 문서 overflow, descendant viewport 이탈, clipping ancestor, 44px 미만 제어는 0개였습니다.
- 같은 전 폭의 200%에서도 dialog와 모든 제어 rect는 viewport 안에 있었고 document overflow는 0이었습니다.
- 768/1280px 200%는 내부 scroll 단정도 통과했습니다.
- 320~412px 200%에서는 고정 합성값을 가진 카드번호·생년월일 입력 일부에 `scrollWidth > clientWidth`가 측정됐습니다. 제어 자체가 잘리거나 조작 불가능하지는 않았으나 전체 값을 한 번에 보려면 input 내부 수평 이동이 필요합니다.

마지막 항목은 별도 P3 관찰로 남깁니다. 수정 시 review-demo의 고정값을 수정 가능한 입력 대신 줄바꿈 가능한 읽기 전용 표현으로 제공하거나, 확대 시 입력 grid가 자연스럽게 한 열로 재배치되는지 함께 검토해야 합니다.

## 운영 배포 확인

- Vercel deployment는 `READY`, `production`, `sin1`입니다.
- deployment Git SHA와 local/origin `main`이 모두 `1c078a94d81a47378106d3381a2c857dca72f636`으로 일치합니다.
- apex/www alias와 fixed deployment가 연결됐고 `aliasError`는 없습니다.
- 최근 1시간 runtime error cluster는 0개입니다.
- 해당 deployment의 최근 1시간 error/fatal log는 0개입니다.
- 비로그인 Chrome `390x844`에서 운영 `/checkout`은 주문 폼 대신 로그인 화면만 표시했고 document overflow와 console error는 0개였습니다.

운영 심사 계정 주문은 만들지 않았습니다. 인증된 전체 흐름은 동일 제품 SHA의 격리 DB·local production에서 검증했습니다.

## 미실행

- Android Emulator와 iOS MobileSafari의 인증된 수기결제 dialog double-tap
- 실제 WEBFEP/KSPAY 승인·취소·영수증
- 운영 심사 계정의 시연 주문 생성과 운영 DB cleanup
- pointer 관통 좌표를 구매동의·결제 submit과 의도적으로 겹치는 파괴적 시나리오

Chrome에서 필수 입력 관통 결함이 확정되어 제품 실패로 판정했으며, 실제 PG·운영 쓰기는 금지 범위로 실행하지 않았습니다.

## Cleanup

- 브라우저 context와 Chrome을 종료했습니다.
- 로컬 production Next 서버를 종료했습니다.
- 격리 PostgreSQL을 fast stop하고 임시 cluster·fixture·log를 삭제했습니다.
- 일회용 사용자 2명, 상품 1개, 주문 2개, 주문항목 2개는 격리 cluster와 함께 제거됐습니다.
- 임시 runner와 결과 파일을 최종 문서 작성 후 삭제했습니다.
- 운영 DB, Vercel env, PG 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

서버 측 수기결제 시연은 지정 계정 제한, 카드 원문 비전송, 서버 가격, 동일 key 멱등, 무 PG, 무 Billing/Audit 원장, 무 재고 예약, 취소 접수까지 기대 계약대로 동작했습니다.

다만 신규 dialog는 실제 연속 입력에서 배경 hit-test와 즉시 재열림이 발생하고 Tab 순환도 한 단계 `body`로 이탈합니다. 카드사 심사자가 반복 click/Enter를 사용할 때 화면이 예측과 다르게 움직일 수 있으므로 `QA-1C0-01`과 `QA-1C0-02`를 수정하고 실제 mouse/touch/keyboard 회귀를 통과하기 전까지 심사용 수기결제 시연은 **NO-GO**입니다. 기존 일반 KSPAY 운영은 계속 가능합니다.
