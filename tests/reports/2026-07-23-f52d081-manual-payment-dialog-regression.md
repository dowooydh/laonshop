# f52d081 수기결제 dialog 수정 회귀 QA 보고서

작성일: 2026-07-23

담당: Codex QA/테스트 세션

이전 QA 기준: `3d4de53f39698021a5d84cc56a92ea92095fcea7`

검증 제품 SHA: `f52d08126446fd6b21589958bb4c7cdb1de6fbdd`

비교 범위: `3d4de53f39698021a5d84cc56a92ea92095fcea7..f52d08126446fd6b21589958bb4c7cdb1de6fbdd`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-abs8pqt1d-customorder.vercel.app`
- Deployment: `dpl_F8ud1zQkBP8XTbH32PgeiTwnKAeW`

## 판정

- 전체 결과: **FAIL**
- `QA-1C0-01` dialog 닫힘 연속 입력 관통: **PASS / CLOSED**
- `QA-1C0-02` dialog focus trap: **PASS / CLOSED**
- 200% 확대 고정 시연정보 내부 scroll: **PASS / CLOSED**
- `QA-F52-01` 취소 접수 후 화면 갱신 비결정성: **P2 / OPEN**
- 심사 계정 수기결제 시연 전체 출시: **NO-GO**
- 기존 일반 KSPAY 운영: **GO, 이번 변경 귀책 회귀 없음**

이번 변경의 직접 수정 대상 세 건은 실제 Chrome 런타임에서 모두 해소됐습니다. 다만 인계가 요구한 완료부터 취소 접수까지의 핵심 회귀에서 서버 접수 뒤 화면 갱신이 3회 중 2회 누락되는 인접 결함을 발견했습니다. 명시적 새로고침으로는 3회 모두 수렴했으며 주문·PG·재고 무결성 문제는 없지만, 사용자가 처리 결과를 바로 단정할 수 없어 전체 PASS로 판정하지 않았습니다.

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 KSNET/KSPAY/WEBFEP 호출, 운영 DB write, Vercel env 변경을 실행하지 않았습니다.
- `/private/tmp`의 일회용 PostgreSQL cluster에 현재 Prisma schema를 적용했습니다.
- 일회용 심사 계정, 일반 고객, 재고 1개 상품만 만든 뒤 local production Next와 실제 Chrome에서 검증했습니다.
- 브라우저 요청 본문은 금지 필드 포함 여부만 검사했으며 카드값, 계정 비밀번호, session secret을 출력하거나 기록하지 않았습니다.
- 제품 실패 확인 뒤 Android Emulator와 iOS MobileSafari 인증 세션 확장은 조기 종료했습니다.

## 변경 독립 검토

`app/checkout/manual-payment-dialog.tsx`와 `app/checkout/checkout-form.tsx`를 실제 diff와 대조했습니다.

- dialog 닫기 전에 guard ref가 동기 활성화됩니다.
- document capture가 pointer, mouse, touch, click, dblclick과 Enter/Space를 흡수하고 매 입력마다 700ms timer를 재무장합니다.
- 전면 shield는 guard 동안 새 hit-test를 받으며 dialog/focus trap은 즉시 정리됩니다.
- Tab/Shift+Tab은 첫 요소와 마지막 요소 사이를 명시적으로 순환합니다.
- 상단 수기결제 타일, `카드사·카드정보 입력`, `정보 수정`, submit validation fallback의 실제 opener를 별도 ref로 보존합니다.
- 심사 시연 카드번호는 `aria-readonly=true`인 wrapping textbox이며 네 자리 그룹을 별도 span으로 표시합니다.
- 이번 diff에는 Server Action, DB schema, 일반 KSPAY, LAONPAY, 관리자 로직 변경이 없습니다.

## 정적·빌드 검증

Node 22.23.1, pnpm 11.5.3 기준으로 독립 실행했습니다.

| 항목 | 결과 |
| --- | --- |
| focused manual/billing/accessibility | PASS 31/31, skip 0 |
| `pnpm test` | PASS 132/132, fail 0, skip 0 |
| 이미지 gate | PASS, 상품 329/1,316장 및 큐레이션 20상품/100장 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma 7 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm build` | PASS, Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS |
| `AGENTS.md` / `CLAUDE.md` | PASS, byte-identical |

정적 계약 테스트는 실제 hit-test를 증명하지 않으므로 아래 브라우저 이벤트 계측을 최종 근거로 사용했습니다.

## 실제 브라우저 환경

- macOS Google Chrome 실제 실행 파일, Playwright 제어
- local production Next 15.5.19
- 격리 PostgreSQL
- 기본 viewport `412x915`, 반응형 `320/360/375/390/412/768/1280px`
- root 글자 `100%/200%`
- Chrome `hasTouch` context의 실제 touch event dispatch

### QA-1C0-01 입력 guard

완료, 닫기 X, 취소 각각에서 mouse double-click과 touch double-tap을 실행했습니다.

| 닫기 경로 | mouse | touch | 배경 interactive hit | opener focus | 700ms 후 해제 |
| --- | --- | --- | --- | --- | --- |
| 카드정보 입력 완료 | PASS | PASS | 0 | PASS | PASS |
| 닫기 X | PASS | PASS | 0 | PASS | PASS |
| 취소 | PASS | PASS | 0 | PASS | PASS |

- 각 연속 입력에서 첫 dialog click 뒤 후속 guard/prevented event가 4개 관찰됐습니다.
- 주소 input, 구매동의 checkbox, 결제 submit, 상단 수기결제 타일로 전달된 interactive background target은 0개였습니다.
- Enter와 Space는 닫힘 80ms 뒤 반복 입력이 각각 흡수됐고 dialog 재열림은 0회였습니다.
- guard 종료 760ms 뒤 동일 opener의 Enter/Space로 dialog가 정상 재개방됐습니다.
- guard 시작 400ms 뒤 후속 pointer 입력을 보내고 다시 400ms 기다렸을 때 shield가 유지됐습니다.
- 마지막 입력 760ms 뒤 shield가 제거되고 주소 input을 정상 focus할 수 있었습니다.
- Escape 닫힘 직후 Enter도 흡수됐습니다.

원 결함이던 두 번째 click의 `#co-address` 관통과 80ms 뒤 Enter 재열림은 재현되지 않았습니다.

### QA-1C0-02 focus trap과 opener 복귀

- dialog에서 Tab 30회, Shift+Tab 30회를 연속 실행했습니다.
- `document.activeElement`가 `BODY`이거나 dialog 밖인 단계는 0회였습니다.
- 상단 수기결제 타일, `카드사·카드정보 입력`, `정보 수정`에서 연 dialog는 닫기 뒤 각각 정확한 opener로 focus가 복귀했습니다.
- 미완성 수기결제 submit validation으로 열린 dialog도 닫기 뒤 상단 수기결제 타일로 복귀했습니다.
- Escape 닫힘도 상단 타일 focus와 즉시 반복 Enter 차단을 유지했습니다.

### 반응형·200% 확대

`320/360/375/390/412/768/1280px` 각각을 root `100%/200%`로 검증한 14개 조합이 모두 통과했습니다.

- document horizontal overflow: 0
- dialog/descendant viewport 또는 dialog 경계 이탈: 0
- control internal horizontal/vertical scroll: 0
- 44px 미만 주요 control: 0
- 읽기 전용 카드번호: 네 자리 그룹 4개, 16자리 전체 표시
- 생년월일과 유효기간 grid: 200%에서 한 열로 자연스럽게 reflow

이전 P3 관찰이던 고정 합성값 input 내부 가로 scroll은 재현되지 않았습니다.

## 서버·결제 안전 회귀

### 권한과 카드정보

| 단정 | 결과 |
| --- | --- |
| 정확한 심사 계정 | 수기결제 시연 UI 노출 PASS |
| 일반 고객 UI | 수기결제 상위 group 0 PASS |
| 일반 고객이 캡처 Action을 직접 재전송 | 비활성 안내, 주문 0 PASS |
| 일반 고객 결제수단 | 카드·카카오·네이버·계좌이체 4개 유지 PASS |
| Action POST | `demoIssuer`만 포함 PASS |
| `manualCard/cardNo/expMm/expYy/pw2/birth6` | 요청 본문 0 PASS |
| KSNET/KSPAY/WEBFEP/LAONPAY 외부 요청 | 0 PASS |
| Billing Card/Method/Registration/Charge/Cancel 원장 | 모두 0 PASS |
| Admin audit | 0 PASS |

### 두 탭 멱등성과 재고

- 같은 cart와 checkout nonce를 공유한 두 탭이 동일 주문 URL로 수렴했습니다.
- 생성 주문은 정확히 1건, 상태 `PAID`, 항목 1건, 금액 12,345원으로 DB 상품 가격과 일치했습니다.
- `approvalNo`는 demo prefix이고 `pgTrno`는 null이었습니다.
- Action 요청 2건 동안 외부 결제 요청은 0건이었습니다.
- stock=1 상품으로 서로 다른 nonce의 demo `PAID` 주문 2건을 만들었지만 실제 예약 합계는 0이었습니다.

## 발견 결함

### QA-F52-01 P2: 취소 접수 성공 뒤 주문 화면 갱신이 비결정적입니다

변경 귀책: **이번 f52d081 dialog diff 밖에서 발견된 인접 기존 경로**

재현 환경: local production Chrome, 격리 PostgreSQL, 심사 계정 demo 주문

재현 절차:

1. 수기결제 시연 주문을 완료합니다.
2. `시연 주문 취소`를 열어 사유를 입력합니다.
3. `신청하기`를 한 번 누릅니다.
4. DB 상태와 화면 heading을 함께 관찰합니다.
5. 화면이 바뀌지 않으면 명시적으로 새로고침합니다.

3회 반복 결과:

| 증거 | 결과 |
| --- | --- |
| DB `CANCEL_REQUESTED` | 3/3 |
| 외부 PG 요청 | 0/3 |
| 자동 `router.refresh()` 뒤 접수 화면 | 1/3 |
| 명시적 reload 뒤 접수 화면 | 3/3 |
| reload 뒤 무 승인취소·환불·PG 안내 | 3/3 |

실제 결과:

- 실패 2회에는 8초 동안 기존 결제완료 화면과 취소 form이 남았습니다.
- DB는 이미 `CANCEL_REQUESTED`여서 같은 form을 다시 제출하면 서버가 중복 접수를 거부합니다.
- 새로고침하면 `취소·반품 신청이 접수되었습니다`와 `실제 승인취소·환불 및 PG 거래는 발생하지 않습니다` 안내로 즉시 수렴했습니다.

기대 결과:

- 성공 응답 뒤 화면이 항상 접수 상태로 전환되어 사용자가 처리 결과를 바로 확인해야 합니다.
- 중복 제출 가능한 기존 form이 성공 뒤 남아 있지 않아야 합니다.

원인 후보:

- [`app/order/[id]/cancel-request.tsx`](../../app/order/[id]/cancel-request.tsx)의 성공 경로는 `router.refresh()`만 호출하고, 접수 성공을 나타내는 로컬 terminal state 또는 hard GET fallback이 없습니다.
- Server Action은 `revalidatePath`와 DB 갱신을 완료하지만, client refresh가 화면 교체로 이어지지 않은 실행에서 stale form이 그대로 남습니다.
- 이번 변경 파일 네 개에는 이 컴포넌트가 포함되지 않아 `f52d081`의 직접 회귀로 보지는 않습니다.

필수 회귀:

1. 성공 응답 10회 반복에서 DB `CANCEL_REQUESTED`와 화면 접수 heading이 10/10 동시 수렴하는지 확인합니다.
2. 성공 뒤 취소 form 제거, 버튼 재클릭 불가, 뒤로가기·새로고침 상태 유지를 확인합니다.
3. 느린 RSC refresh와 refresh 실패를 주입해 사용자에게 완료 상태 또는 명확한 새로고침 안내가 남는지 확인합니다.
4. 빠른 double-click과 두 탭 취소에서 DB 접수 1건, PG 요청 0, 두 화면 모두 재진입 가능한 stale form 0을 확인합니다.
5. 일반 KSPAY 취소 접수와 demo 취소 접수를 함께 회귀합니다.

## 운영 배포 확인

- deployment `dpl_F8ud1zQkBP8XTbH32PgeiTwnKAeW`는 `READY`, `production`, `sin1`입니다.
- deployment Git SHA, local HEAD, origin/main이 모두 `f52d08126446fd6b21589958bb4c7cdb1de6fbdd`로 일치했습니다.
- apex/www/fixed alias가 연결됐고 `aliasError`는 null입니다.
- 최근 1시간 Vercel runtime error cluster는 0개입니다.
- deployment error/fatal 상세 로그 조회는 도구 time budget을 초과해 미회수했으며, 이를 정상 로그 0으로 오인하지 않았습니다.
- 운영 guest `/checkout`은 HTTP 200 로그인 보호 화면을 반환했고 운영 쓰기는 실행하지 않았습니다.

## 미실행

- Android Emulator 실제 Chrome과 iOS MobileSafari의 인증된 dialog touch double-tap
- 운영 심사 계정 demo 주문 생성과 운영 DB cleanup
- 실 WEBFEP/KSPAY 승인·취소·영수증
- 화면 자동 갱신 누락 시 두 번째 취소 submit의 상세 오류 문구

Chrome에서 P2가 확정되어 플랫폼 범위를 더 넓히지 않았습니다. Chrome touch context의 실제 touch event dispatch는 통과했지만 실제 Android/iOS 브라우저 PASS로 대체하지 않습니다.

## Cleanup

- Chrome과 모든 browser context를 종료했습니다.
- local production Next 서버를 종료했습니다.
- 격리 PostgreSQL을 fast stop하고 임시 cluster, fixture, log를 삭제했습니다.
- 각 실행의 사용자 2명, 상품 1개, 주문·항목은 격리 cluster와 함께 제거됐습니다.
- 운영 DB, Vercel env, PG 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

`f52d081`이 직접 수정한 입력 관통, focus trap, 200% 확대 문제는 실제 mouse/touch/keyboard와 14개 반응형 조합에서 모두 해결됐습니다. 서버 권한, 카드정보 비전송, 두 탭 멱등, 무 PG, 무 Billing/Audit, demo 재고 제외도 유지됩니다.

그러나 취소 접수 성공 뒤 화면이 반복 3회 중 2회 stale 상태로 남는 인접 P2가 확인됐습니다. 새로고침으로 복구되고 실제 결제 부작용은 없지만 심사 시연의 완료 흐름을 신뢰할 수 없으므로 `QA-F52-01` 수정과 반복 브라우저 회귀 전까지 전체 수기결제 시연은 **NO-GO**입니다.
