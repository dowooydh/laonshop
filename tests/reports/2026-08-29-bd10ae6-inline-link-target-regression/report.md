# bd10ae6 인라인 링크 터치 영역 회귀 QA 보고서

작성일: 2026-08-29

담당: Codex QA/테스트 세션

- 이전 QA 기준: `ec4375d30d91d52f3c45e2a5003cc1b587740dad`
- 검증 제품 SHA: `bd10ae6407bac775bc7da6fbf5ba332b078909d8`
- 비교 범위: `ec4375d30d91d52f3c45e2a5003cc1b587740dad..bd10ae6407bac775bc7da6fbf5ba332b078909d8`
- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-9ufo1x4th-customorder.vercel.app`
- Vercel: `dpl_613qJehUc8N537ekMMifSYm32Vc7`

## 판정

- 전체 결과: **PASS**
- `QA-5A753-01` 인라인 링크 44px 미달: **FIXED / CLOSED**
- 운영 실제 anchor 최소 크기: **`49.25x44px`**
- 격리 checkout 실제 anchor 최소 크기: **`55.31x44px`**
- 네 경계 1px 안쪽 hit ownership: **560/560 PASS**
- 링크 간 양의 면적 overlap: **0건**
- 정책 링크 클릭과 구매동의 checkbox 독립성: **12/12 PASS**
- 등록카드 문구·legacy 주문·KSPAY 4수단: **PASS**
- gate OFF/ON 외부 요청·DB 변화: **0건**
- 신규 제품 결함: **0건**
- 출시 판단: **GO**

직전 QA에서 `16~38px`로 확인된 checkout, FAQ, 고객센터, footer 인라인 링크가 모두 최소 `44x44px`의 실제 클릭 영역을 갖습니다. 200% 확대에서도 줄바꿈, hit-test, 키보드 포커스, checkbox 독립성까지 통과했습니다.

실제 LAONPAY 등록카드 활성화는 partner env/key/readiness와 외부 상호운용이 남아 있어 이번 UI PASS와 별도로 **HOLD**입니다.

## 안전 경계

- 제품 코드를 수정하지 않았습니다.
- 운영에서는 공개 GET, 배포 메타데이터와 runtime 로그만 읽었습니다.
- 운영 로그인·DB write, Vercel env/schema/gate 변경, 실제 KSPAY/KSNET/LAONPAY 호출, 카드정보 입력을 수행하지 않았습니다.
- 인증 checkout과 gate ON 검증은 local socket PostgreSQL 일회용 DB, 합성 review 계정·세션·Ed25519 키, local production Next에서 수행했습니다.
- fixture는 사용자 1명, 결제수단 1개, 신규/legacy 주문·항목·charge 각 2개만 포함했습니다.
- 합성 세션값, 키와 provider 식별자 전체값을 보고서·스크린샷·Git에 남기지 않았습니다.

## 변경 독립 검토

실제 diff는 다음 네 파일로 한정됩니다.

- `app/checkout/checkout-form.tsx`
- `app/support/page.tsx`
- `app/layout.tsx`
- `tests/api/inline-link-targets.test.ts`

checkout 구매동의 정책 3개, support FAQ 정책 2개·고객센터 연락 3개, footer 연락 2개 링크에 `inline-flex`, `min-h-11`, `min-w-11`, 줄바꿈 안전영역과 focus ring이 적용됐습니다. 클릭 handler, checkbox 상태, 결제 submit, Server Action, API, Prisma schema, env와 결제 계약은 변경되지 않았습니다.

신규 구조 테스트는 class 계약을 고정하고, 실제 런타임 크기와 hit ownership은 별도 브라우저에서 검증했습니다. `git diff --check`와 `AGENTS.md`/`CLAUDE.md` byte parity도 통과했습니다.

## 정적·빌드 검증

지원 런타임 Node 22.23.1, pnpm 11.5.3을 사용했습니다. 기본 shell Node 25에서 나온 engine warning run은 판정에서 제외하고 전 항목을 Node 22로 다시 실행했습니다.

| 항목 | 결과 |
| --- | --- |
| focused inline-link + payment copy | PASS 7/7, skip 0 |
| `pnpm test` | PASS 140/140, fail 0, skip 0 |
| `pnpm test:billing:interop` | PASS 2/2 |
| 이미지 gate | PASS, 상품 329개/1,316장 및 큐레이션 20상품/100장 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma config deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm billing:preflight --allow-closed` | PASS, 운영 LAONPAY gate 전부 CLOSED, 값 노출 0 |
| `pnpm build` | PASS, Next 15.5.24, static generation 20/20 |
| diff check·AGENTS/CLAUDE parity | PASS |

## 운영 support·footer 링크

`https://laonshop.com/support`를 `320/360/375/390/412/768/1280px x 100%/200%` 14조합으로 검사했습니다.

- 대상: FAQ 배송·환불, 고객센터 전화·이메일·카카오, footer 전화·이메일
- 실제 anchor instance 98개
- 상·우·하·좌 각 경계 중앙 1px 안쪽 hit-test 392회
- 최소 크기 `49.25x44px`
- hit ownership `392/392`
- overlap, anchor 내부 scroll, document overflow, visible descendant 이탈, overflow 조상 clipping: 모두 0건
- focus 활성·명시적 ring·Tab/Shift+Tab 복귀 실패: 0건
- HTTP 4xx/5xx, console warning/error, page error: 0건

직전 결함의 `390px/100%` 수치는 다음과 같이 개선됐습니다.

| 위치 | 링크 | 수정 전 | 수정 후 |
| --- | --- | --- | --- |
| FAQ | 배송 안내 | `349x38px` | `49.63x44px` |
| FAQ | 청약철회·교환·환불 안내 | `358x38px` | `125.80x44px` |
| 고객센터 | 전화 | `98x16px` | `98.39x44px` |
| 고객센터 | 이메일 | `201x16px` | `201.16x44px` |
| 고객센터 | 카카오톡 | `73x16px` | `72.75x44px` |
| footer | 전화 | `98x16px` | `98.39x44px` |
| footer | 이메일 | `201x22px` | `201.16x44px` |

`320px/200%`의 긴 환불 링크는 `249.70x88px`, 이메일은 `174x129.47px`로 줄바꿈됐고 내부 scroll·clipping은 없었습니다.

증거: [운영 support 390px 포커스](./production-support-390-targets.png)

## 격리 인증 checkout 링크

local production Next와 일회용 DB의 gate OFF checkout을 같은 14개 viewport 조합으로 검사했습니다.

- 대상: 이용약관·개인정보처리방침·청약철회/환불 정책
- 실제 anchor instance 42개, 경계 hit-test 168회
- 최소 크기 `55.31x44px`
- hit ownership `168/168`
- overlap, document overflow, visible outside, ancestor clipping, 내부 scroll: 모두 0건
- focus 활성·Tab/Shift+Tab 복귀 실패: 0건
- 순방향 순서: checkbox → 이용약관 → 개인정보처리방침 → 환불 정책

| 조합 | 이용약관 | 개인정보처리방침 | 환불 정책 |
| --- | --- | --- | --- |
| `390px/100%` | `55.31x44px` | `110.63x44px` | `118.70x44px` |
| `320px/200%` | `110.63x88px` | `204x104px` | `204x104px` |

checkbox가 꺼진 상태와 켜진 상태에서 정책 3개를 `390px/100%`, `320px/200%`로 실제 새 탭 클릭했습니다. 12/12 모두 기존 checkbox 상태를 유지했고 popup 경로도 `/policy/terms`, `/policy/privacy`, `/policy/refund`와 일치했습니다. 결제 Action과 외부 요청은 0건입니다.

증거: [checkout 320px·200% 정책 링크 포커스](./gate-on-checkout-320-font200-targets.png)

## 등록카드·KSPAY 회귀

gate OFF:

- settings는 `등록카드 연동을 준비하고 있습니다`를 표시했습니다.
- hosted 카드 등록 CTA와 LAONPAY 외부 링크는 0건입니다.
- checkout은 등록카드 tile 없이 카드·카카오페이·네이버페이·실시간 계좌이체 4수단을 유지했습니다.
- 각 수단의 `aria-pressed=true`, provider/non-GET 요청 0건을 확인했습니다.

gate ON 격리 fixture는 `320px/200%`, `390px/100%`, `1280px/200%`에서 settings, checkout, 신규 주문, legacy 주문 12개 화면을 검사했습니다.

- settings 기본 명칭은 `등록카드 관리`, `등록카드 상태`입니다.
- checkout은 `KSPAY 인증결제·등록카드`, label `등록카드`, 설명 `등록된 카드로 결제`를 표시했습니다.
- KSPAY 4수단과 등록카드 선택의 `aria-pressed=true`를 확인했습니다.
- 신규/legacy 내부 표식 주문은 모두 `QA 카드 (등록카드)`로 표시됐습니다.
- 두 주문의 `전체 주문 취소 요청`이 유지돼 billing 취소 경로를 사용합니다. Action은 실행하지 않았습니다.
- 금지 문구 `LAONPAY 등록카드 결제`, `등록카드(정기결제)`, 내부 주문 표식 2종, 사용자 노출 `원장`은 0건입니다.
- 카드 원문, `billingToken`, pgapi, Authorization 노출은 0건입니다.
- 외부 LAONPAY/KSPAY/KSNET 요청, non-GET, console/page error, overflow/clipping은 모두 0건입니다.
- DB 시작/종료는 users 1, products 329, orders 2, items 2, methods 1, charges 2, cancels 0, audits 0으로 일치했습니다.

증거:

- [gate ON settings 320px](./gate-on-settings-320.png)
- [legacy 주문 320px·200% 정규화](./gate-on-legacy-order-320-font200.png)

## 운영 배포·관측

- deployment는 `READY`, `production`, `sin1`입니다.
- deployment SHA, local HEAD, origin/main은 모두 `bd10ae6407bac775bc7da6fbf5ba332b078909d8`입니다.
- apex/www/fixed alias가 연결됐고 `aliasError`는 null입니다.
- 최근 1시간 runtime error cluster와 해당 deployment error/fatal log는 모두 0건입니다.

## 발견 결함

신규 결함이 없습니다. `QA-5A753-01`은 실제 크기, 경계 hit ownership, overlap, 키보드 포커스, checkbox 독립성까지 모두 통과해 **CLOSED**로 판정합니다.

## Cleanup

- local Next 3003/3004와 Chrome context를 종료했습니다.
- 일회용 PostgreSQL DB를 삭제하고 동일 DB명 존재 개수 0을 확인했습니다.
- 합성 fixture/session/key, DNS preload, browser runner와 결과 JSON을 삭제했습니다.
- `/private/tmp/laonshop-bd10-*` 잔여 0개, 포트 3003/3004 listener 0을 확인했습니다.
- 운영 DB, Vercel env/schema/gate, 결제 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

직전 P2의 원 재현 범위가 모두 수정됐고 등록카드 문구·legacy 호환·KSPAY 4수단·gate OFF/ON 경계도 퇴행하지 않았습니다. 제품 SHA `bd10ae6`은 이번 인계 범위에서 **PASS / GO**입니다.

실제 LAONPAY 등록카드 활성화는 운영 partner key/readiness와 외부 상호운용·실 PG QA 전까지 별도 **HOLD**입니다.
