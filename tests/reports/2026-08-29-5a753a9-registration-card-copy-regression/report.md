# 5a753a9 등록카드 문구 단순화 회귀 QA 보고서

작성일: 2026-08-29

담당: Codex QA/테스트 세션

비교 기준: `7212162aec318b589626df361158aaa64c4f726d`

검증 제품 SHA: `5a753a96e4a740f924448f97c84797484c63ca24`

비교 범위: `7212162aec318b589626df361158aaa64c4f726d..5a753a96e4a740f924448f97c84797484c63ca24`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-psxg294vh-customorder.vercel.app`
- Vercel deployment: `dpl_9WPYGUyVdrn88hy1K5YdL73kDFXi`
- GitHub Production deployment record: `6150433708`

## 판정

- 전체 결과: **FAIL**
- 등록카드 사용자 문구 단순화: **PASS**
- 과거·신규 주문 표식 정규화와 billing 취소 경로: **PASS**
- 일반 KSPAY 4개 결제수단과 `aria-pressed`: **PASS**
- LAONPAY gate OFF/ON 무외부호출·민감정보 경계: **PASS**
- 반응형 overflow/clipping: **PASS**
- `QA-5A753-01` 인라인 링크 44px 미만: **P2 / OPEN**
- 문구 변경 자체: **GO**
- 현재 인계의 전체 접근성 gate: **NO-GO**

`5a753a9`의 등록카드 문구 변경과 내부 주문 표식 호환은 의도대로 동작합니다. 다만 인계가 명시한 44px 타깃 검사에서 checkout 동의문, FAQ·고객센터, 전역 footer의 인라인 링크가 실제 높이 `16~38px`로 확인되어 전체 판정은 FAIL입니다. 해당 class는 이번 비교 범위에서 새로 도입된 것은 아니지만 현재 배포의 필수 gate를 충족하지 않습니다.

## 안전 경계

- 제품 코드를 수정하지 않았습니다.
- 운영에서는 공개 GET과 read-only 배포·로그 확인만 수행했습니다.
- 운영 DB write, Vercel env/schema/gate 변경, 실 KSPAY/KSNET/LAONPAY 호출, 카드정보 입력을 수행하지 않았습니다.
- 인증·gate ON 검증은 로컬 일회용 PostgreSQL, 합성 세션, 합성 Ed25519 키와 local production Next에서 수행했습니다.
- fixture는 합성 사용자 2명, 결제수단 1개, 과거/신규 표식 주문 2개만 추가했습니다.
- 키, 세션값, 비밀번호, provider token을 보고서·스크린샷·Git에 남기지 않았습니다.

## 변경 독립 검토

실제 diff와 코드를 대조한 결과는 다음과 같습니다.

- settings와 checkout은 기본 명칭을 `등록카드`로, checkout 설명을 `등록된 카드로 결제`로 표시합니다.
- 사용자 화면의 `LAONPAY 등록카드 결제`, `등록카드(정기결제)`, 기술 용어 `원장`은 제거됐습니다.
- 내부 저장 표식 `(LAONPAY 등록카드)`와 legacy `(LAONPAY 원클릭)`은 유지되며 `lib/billing.ts:15-29`에서 모두 billing 주문으로 판별한 뒤 화면에서 `(등록카드)`로 정규화합니다.
- 신규 내부 주문 표식 생성, method id `oneclick`, 소유권·서버 금액·멱등·UNKNOWN 계약은 변경되지 않았습니다.
- 일반 카드·카카오페이·네이버페이·실시간 계좌이체의 KSPAY 선택 및 submit 경계는 변경되지 않았습니다.
- 약관·개인정보처리방침·FAQ·footer는 KSPAY 인증결제와 LAONPAY 등록카드 처리 경계를 계속 구분합니다.
- env, Prisma schema, DB migration, PG 설정 변경은 0건입니다.

## 정적·빌드 검증

호스트에 설치된 Node 22.23.1과 pnpm 11.5.3을 사용했습니다. 인계의 Node 22.23.2와 같은 Node 22 계열입니다.

| 항목 | 결과 |
| --- | --- |
| focused billing/copy/client | PASS 61/61, skip 0 |
| `pnpm test` | PASS 137/137, fail 0, skip 0 |
| `pnpm test:billing:interop` | PASS 2/2 |
| 이미지 gate | PASS, 상품 329개/1,316장 및 큐레이션 20상품/100장 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma 7 config deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm billing:preflight --allow-closed` | PASS, 운영 LAONPAY gate 전부 CLOSED, 값 노출 0 |
| `pnpm build` | PASS, Next 15.5.24, static generation 20/20 |
| `git diff --check` | PASS |
| `AGENTS.md` / `CLAUDE.md` | PASS, byte-identical |

## 격리 gate ON 브라우저

환경:

- local production Next 15.5.24
- local PostgreSQL 일회용 DB
- 합성 review 계정 `laontest@laontest.com`
- schema/feature gate ON
- 외부 origin은 계약값으로 설정했으나 Action을 실행하지 않고 모든 요청을 계측

검증 결과:

- `/mypage/settings`는 `등록카드 관리`, `등록카드`, `카드 등록`, `등록카드 상태 조회`를 표시했습니다.
- `/checkout`은 `KSPAY 인증결제·등록카드`, label `등록카드`, 설명 `등록된 카드로 결제`를 표시했습니다.
- 카드결제·카카오페이·네이버페이·실시간 계좌이체·등록카드를 순서대로 선택했고 각 버튼의 `aria-pressed=true`를 단정했습니다.
- 신규 `QA 카드 (LAONPAY 등록카드)`와 legacy `QA 카드 (LAONPAY 원클릭)` 주문은 모두 화면에서 `QA 카드 (등록카드)`로 표시됐습니다.
- 두 주문 모두 `전체 주문 취소 요청`을 표시해 일반 KSPAY 취소가 아닌 billing 취소 분기를 유지했습니다. 취소 Action은 실행하지 않았습니다.
- 사용자 화면에서 금지 문구 네 종류와 카드 원문·`billingToken`·provider token·pgapi·Authorization 노출은 0건입니다.
- 인증 이후 non-GET 0건, LAONPAY/KSPAY/KSNET/partner 요청 0건, console/page error 0건입니다.
- DB 기준은 시작과 종료 모두 users 2, orders 2, items 2, paymentMethods 1, charges 2, cancelRequests 0, audits 0으로 일치했습니다.

과거 주문 320px·200% 증거: [legacy 주문 정규화](./gate-on-order-legacy-320-font200.png)

## gate OFF와 운영 공개 브라우저

gate OFF 격리 환경:

- settings는 `등록카드 연동을 준비하고 있습니다` 안내만 표시하고 hosted `카드 등록` CTA를 노출하지 않았습니다.
- checkout은 등록카드 tile을 노출하지 않고 KSPAY 4개 수단을 유지했습니다.
- 외부 provider 요청 0건, 로그인 이후 write 요청 0건입니다.

운영 production:

- support/terms/privacy를 `320/360/375/390/412/768/1280px x 100%/200%` 42조합으로 확인했습니다.
- KSPAY와 LAONPAY 처리 경계 문구가 모두 존재하고 긴 구문·내부 표식·`원장` 노출은 0건입니다.
- document overflow, visible descendant viewport 이탈, 조상 clipping은 전 조합 0건입니다.
- console/page error 0건입니다.
- 최근 1시간 Vercel runtime error cluster 0건, 해당 deployment error/fatal log 0건입니다.

gate OFF checkout 증거: [KSPAY 4수단과 동의문](./gate-off-checkout-390-targets.png)

운영 support 증거: [FAQ·고객센터·footer](./production-support-390-targets.png)

## 반응형 행렬

격리 gate ON에서 settings/checkout/current order/support/terms/privacy와 공용 footer를 아래 84조합으로 검사했습니다.

- 폭: `320/360/375/390/412/768/1280px`
- 루트 글자: `100%/200%`
- 단정: document width, visible descendant rect, overflow ancestor clipping, 주요 control 내부 clipping

결과:

- document 가로 overflow 0건
- visible descendant viewport 이탈 0건
- overflow ancestor에 의한 좌우 clipping 0건
- 등록카드 label·상태·CTA·과거 주문 결제수단 잘림 0건
- 대표 조합의 Tab 순회에서 포커스된 control viewport 이탈·조상 clipping 0건
- single-line input의 값 스크롤과 focus 순회 종료 후 BODY는 제품 실패에서 제외했습니다.

## 발견 결함

### QA-5A753-01 P2 — checkout·FAQ·고객센터·footer 인라인 링크가 44px보다 작음

재현:

1. 운영 `https://laonshop.com/support`를 `390x860`, 루트 글자 100%로 엽니다.
2. 첫 두 FAQ를 열고 `배송 안내`, `청약철회·교환·환불 안내` 링크와 고객센터 전화·이메일·카카오톡 링크의 실제 rect를 측정합니다.
3. footer의 전화·이메일 링크를 측정합니다.
4. 인증 checkout을 같은 폭으로 열고 구매동의 안의 정책 링크 rect를 측정합니다.

실제 결과:

| 위치 | 링크 | 실제 크기 |
| --- | --- | --- |
| support FAQ | 배송 안내 | `349x38px` |
| support FAQ | 청약철회·교환·환불 안내 | `358x38px` |
| support 고객센터 | 전화 | `98x16px` |
| support 고객센터 | 이메일 | `201x16px` |
| support 고객센터 | 카카오톡 | `73x16px` |
| 공용 footer | 전화 | `98x16px` |
| 공용 footer | 이메일 | `201x22px` |
| checkout 동의문 | 개인정보처리방침 | `111x19px` |
| checkout 동의문 | 청약철회·환불 정책 | `119x19px` |

200% 확대에서도 일부 링크 높이는 `31~38px`로 44px에 미달합니다. 텍스트와 레이아웃은 잘리지 않지만 모바일 터치 타깃 기준을 충족하지 않습니다.

기대 결과:

- 각 링크의 실제 클릭 영역이 최소 `44x44px`이어야 합니다.
- 문장 안 링크는 줄바꿈을 허용하면서 세로 padding 또는 적절한 inline-flex 구조로 타깃을 확장해야 합니다.
- 인접 링크 타깃이 겹치거나 문장·footer reflow를 깨뜨리지 않아야 합니다.

관련 코드:

- `app/checkout/checkout-form.tsx:580-591`
- `app/support/page.tsx:14-29`
- `app/support/page.tsx:77-94`
- `app/layout.tsx:199-211`

원인 후보:

- 대상 anchor에 underline/색상 class만 있고 `min-h-11`, padding 또는 동일 크기의 클릭 wrapper가 없습니다.
- 공용 footer의 주요 정책 링크에는 이미 `min-h-11`이 있으나 전화·이메일 링크에는 적용되지 않았습니다.

비교 범위 귀책:

- 이번 diff는 support의 결제 안내와 footer 저작권 문구를 변경했지만 위 anchor class는 변경하지 않았습니다.
- 문구 단순화가 새로 만든 회귀는 아니며, 이번 필수 44px 전수검사에서 새로 확인된 기존 접근성 결함입니다.

필수 회귀:

- support FAQ·고객센터, checkout 구매동의, footer 전화·이메일을 `320/360/375/390/412/768/1280px x 100%/200%`로 재검사합니다.
- 각 링크 rect `width>=44 && height>=44`, 네 경계 hit ownership, Tab/Shift+Tab, focus ring 비클리핑을 단정합니다.
- 문장·footer 가로 overflow와 링크 타깃 상호 겹침이 0인지 확인합니다.

## 운영 배포 확인

- deployment는 `READY`, `production`, `sin1`입니다.
- deployment Git SHA, local HEAD, origin/main이 모두 `5a753a96e4a740f924448f97c84797484c63ca24`로 일치했습니다.
- apex/www/fixed alias가 연결됐고 `aliasError`는 null입니다.
- 최근 1시간 runtime error cluster와 deployment error/fatal log는 모두 0건입니다.

## Cleanup

- 브라우저 검증 직전·직후 격리 DB 기준선이 동일함을 확인했습니다.
- local Next 3003/3004, Chrome context를 종료했습니다.
- 일회용 PostgreSQL DB를 삭제하고 존재 개수 0을 확인했습니다.
- 임시 fixture/브라우저 러너/DNS preload/서명키를 삭제했습니다.
- 포트 3003/3004 listener 0을 확인했습니다.
- 운영 DB, Vercel env/schema/gate, PG 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

등록카드 문구 단순화, legacy 주문 호환, billing 취소 분기, KSPAY 4수단, gate OFF/ON 무외부호출 경계는 모두 의도대로입니다. 이 제품 변경의 기능 범위는 GO입니다.

다만 현재 인계가 44px를 필수 gate로 지정했고 실제 운영과 격리 checkout에서 미달 링크를 재현했습니다. `QA-5A753-01`을 수정한 뒤 해당 링크 타깃 행렬을 표적 재검증하기 전까지 전체 출시 판정은 **FAIL / NO-GO**입니다.
