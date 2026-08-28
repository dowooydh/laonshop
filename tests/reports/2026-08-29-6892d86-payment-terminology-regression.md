# 6892d86 등록카드 용어·보안 패치 회귀 QA 보고서

작성일: 2026-08-29

담당: Codex QA/테스트 세션

이전 QA 기준: `8c8ff7452048ca913909abd09bc4032842f2810a`

검증 제품 SHA: `6892d86a8751e26a9480969dc2d1e0aa613a0a23`

비교 범위: `8c8ff7452048ca913909abd09bc4032842f2810a..6892d86a8751e26a9480969dc2d1e0aa613a0a23`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-3rof6x0na-customorder.vercel.app`
- Deployment: `dpl_eWXuWZa5FfwBqJZenqcsBfa5cBo2`

## 판정

- 전체 결과: **FAIL**
- 등록카드(BILLING)·일반 인증결제(AUTH) 용어 분리: **PASS**
- 과거 `(LAONPAY 원클릭)` 주문 표시·취소 호환: **PASS**
- 일반 KSPAY 4개 결제수단 회귀: **PASS**
- Next/Prisma/PostCSS 보안 패치: **PASS**
- `QA-6892-01` 200% 글자 확대 전역 헤더 겹침·잘림: **P2 / OPEN**
- 결제 용어 변경 자체: **GO**
- 현재 필수 반응형 gate 및 전체 출시 판정: **NO-GO**

결제 용어, 과거 주문 호환, KSPAY 선택, 공개 법정 문구, provider 중립 보안 계약은 모두 통과했습니다. 다만 인증 사용자의 `768px`·루트 글자 `200%`에서 헤더 내비게이션이 서로 겹치고, `1280px`·`200%`에서도 마이페이지 사용자명이 잘립니다. 이번 비교 범위에서 해당 헤더 코드는 바뀌지 않았지만, 인계의 필수 `200% overflow/clipping` 기준을 만족하지 못하므로 전체 결과를 FAIL로 판정합니다.

## 범위와 안전 경계

- 제품 코드를 수정하지 않았습니다.
- 운영 브라우저에서는 공개 GET과 guest 보호 화면만 확인했습니다.
- 실 KSNET/KSPAY/LAONPAY 호출, 카드 입력, 운영 DB write, Vercel env/schema/gate 변경을 실행하지 않았습니다.
- 인증·주문 검증은 로컬 PostgreSQL의 일회용 DB와 local production Next에서 수행했습니다.
- fixture에는 합성 사용자 2명, 상품 329개 시드, opaque 결제수단 1개, 과거/신규 표식 주문 2개만 사용했습니다.
- 비밀번호, session secret, signing key 값을 보고서·스크린샷·Git에 남기지 않았습니다.

## 변경 독립 검토

실제 diff를 코드와 대조한 결과는 다음과 같습니다.

- `lib/billing.ts`는 신규 표식 `(LAONPAY 등록카드)`와 과거 표식 `(LAONPAY 원클릭)`을 모두 등록카드 주문으로 인식하고, 화면 표시만 신규 용어로 정규화합니다.
- `app/checkout/actions.ts`와 `app/order/actions.ts`는 신규 주문·상태 대사에 신규 표식을 기록합니다.
- `app/order/[id]/page.tsx`와 취소 액션은 과거/신규 표식을 모두 등록카드 원장 경로로 유지합니다.
- 일반 카드·카카오페이·네이버페이·실시간 계좌이체의 KSPAY 런타임 파일과 LAONPAY canonical/client 계약 파일은 변경되지 않았습니다.
- 개인정보처리방침·약관·footer·FAQ는 KSPAY 인증결제와 LAONPAY 등록카드 경로를 구분하며, 계약 미확정 Baum 법인명·위탁범위를 추측해 공개하지 않습니다.
- diff secret/env 검사에서 Baum/GID/MID/RID/PG 자격정보 신규 할당은 0건입니다.
- 의존성은 Next `15.5.24`, Prisma `6.19.3`, PostCSS `8.5.23`으로 해석되며 프로덕션 audit은 0건입니다.

## 정적·빌드 검증

독립 환경은 Node 22.23.1, pnpm 11.5.3입니다. 인계의 Node 22.23.2와 같은 Node 22 계열이며 이 호스트에 설치된 고정 런타임을 사용했습니다.

| 항목 | 결과 |
| --- | --- |
| focused `payment-method-copy` | PASS 4/4, skip 0 |
| `pnpm test` | PASS 136/136, fail 0, skip 0 |
| 이미지 gate | PASS, 상품 329개/1,316장 및 큐레이션 20상품/100장 |
| `pnpm test:billing:interop` | PASS 2/2 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma 7 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm build` | PASS, Next 15.5.24, static generation 20/20 |
| `pnpm billing:preflight --allow-closed` | PASS, 모든 LAONPAY 운영 gate CLOSED, 값 노출 0 |
| `git diff --check` | PASS |
| `AGENTS.md` / `CLAUDE.md` | PASS, byte-identical |

## 운영 공개 브라우저 검증

macOS Google Chrome 실제 실행 파일을 Playwright로 제어했습니다.

- apex와 www를 각각 열어 정상 응답을 확인했습니다.
- 홈·개인정보처리방침·약관·FAQ·남성 목록·상품 상세·검색·장바구니·guest checkout 보호를 확인했습니다.
- 공개 문구에 KSPAY 인증결제와 LAONPAY 등록카드가 각각 명시되고 `Baum/바움`, `신고 예정` 노출은 0건입니다.
- `320px/200%`, `390px/100%`, `412px/200%`, `1280px/100%`에서 정책·FAQ의 document width, visible descendant rect, control 내부 scroll을 확인해 문제 0건입니다.
- 상품 목록→상세, 검색, 빈 장바구니, guest checkout→로그인 이동을 확인했습니다.
- 비주입 console/page error는 0건입니다.

## 격리 인증·결제 UI 검증

환경:

- local production Next 15.5.24
- 일회용 PostgreSQL
- LAONPAY env/schema/feature gate OFF
- review 계정과 일반 고객 합성 fixture
- 운영/외부 PG 요청 없음

### 용어와 일반 KSPAY

- 설정 화면은 `LAONPAY 등록카드 관리`와 연동 준비 안내를 표시했습니다.
- gate OFF 체크아웃은 등록카드 tile을 노출하지 않고 일반 KSPAY 카드·카카오페이·네이버페이·실시간 계좌이체만 표시했습니다.
- 네 결제수단을 차례로 선택해 각 버튼의 `aria-pressed=true`를 확인했습니다.
- feature ON에서 사용할 `등록카드 결제`, `LAONPAY 등록카드(정기결제)` 문구와 AUTH/BILLING 구분은 focused test와 소스 계약으로 검증했습니다. 운영 gate가 CLOSED이므로 실 tile과 외부 호출은 의도대로 실행하지 않았습니다.

### 과거/신규 주문 호환

과거 `QA 카드 (LAONPAY 원클릭)` 주문과 신규 `QA 카드 (LAONPAY 등록카드)` 주문을 각각 생성했습니다.

- 두 주문 모두 화면에는 `LAONPAY 등록카드`만 표시되고 `LAONPAY 원클릭` 노출은 0건입니다.
- 두 주문 모두 `전체 주문 취소 요청` UI를 표시했습니다.
- gate OFF에서 취소 Action을 각각 한 번 제출하자 같은 fail-closed 안내와 재신청 잠금이 표시됐습니다.
- Action POST는 2회, 주문 상태는 두 건 모두 `PAID`, `cancelRequestedAt/cancelReason`은 null, BillingCancelRequest는 0건입니다.
- 과거 주문이 일반 KSPAY 수동 취소로 오분류되어 `CANCEL_REQUESTED`로 바뀌는 회귀는 없었습니다.

### 반응형 행렬

`/mypage/settings`, `/checkout`을 다음 28개 조합에서 검사했습니다.

- 폭: `320/360/375/390/412/768/1280px`
- 루트 글자: `100%/200%`
- 단정: document width, visible descendant rect, control 내부 scroll, console/page error

`320~412px`의 100%/200%와 모든 폭의 100%는 통과했습니다. 결제·설정 본문 자체도 전 조합에서 overflow/clipping이 없었습니다. 전역 헤더만 아래 P2에서 실패했습니다.

## 발견 결함

### QA-6892-01 P2 — 200% 글자 확대에서 전역 헤더 내비게이션 겹침·잘림

재현:

1. 인증 사용자로 현재 제품 SHA의 `/mypage/settings` 또는 `/checkout`을 엽니다.
2. viewport를 `768x900`으로 설정합니다.
3. 루트 글자 크기를 `200%`로 확대합니다.
4. 전역 헤더의 성별 내비게이션, 장바구니, 마이페이지, 로그아웃을 확인합니다.

실제 결과:

- `768px/200%`에서 성별 내비게이션과 우측 명령이 겹칩니다.
- 장바구니 링크는 `scrollWidth=116`, `clientWidth=88`입니다.
- 마이페이지 링크는 `scrollWidth=206`, `clientWidth=48`입니다.
- `1280px/200%`에서도 마이페이지 링크는 `scrollWidth=211`, `clientWidth=187`로 이름이 잘립니다.
- 설정과 체크아웃에서 동일하게 재현되며 제품 본문과 무관한 공용 헤더 문제입니다.

기대 결과:

- 텍스트 확대 시 헤더가 추가 행으로 재배치되거나 짧은 라벨로 전환되어, 겹침·truncate·내부 가로 scroll 없이 모든 명령을 식별하고 조작할 수 있어야 합니다.

증거:

- [768px·200% 재현 스크린샷](./2026-08-29-6892d86-payment-terminology-regression/header-768-font200-overlap.png)
- 관련 코드: `app/layout.tsx:75`, `app/layout.tsx:78`, `app/layout.tsx:87`, `app/layout.tsx:98`

원인 후보:

- `sm` 이상에서 `flex-nowrap`과 긴 데스크톱 라벨을 사용하지만 글자 확대에 따른 가용 폭 감소를 반영하지 않습니다.
- 사용자 링크의 `max-w-[7rem] truncate whitespace-nowrap`가 200%에서도 고정되어 이름을 자릅니다.

비교 범위 귀책:

- `8c8ff745..6892d86`의 `app/layout.tsx` diff는 footer 결제 문구 한 줄뿐입니다.
- 헤더 class와 라벨은 이 범위에서 변경되지 않아 결제 용어 커밋이 새로 만든 회귀는 아니지만, 현재 필수 출시 gate를 실패시키는 기존 결함입니다.

필수 회귀:

- 인증/비인증 각각 `320/360/375/390/412/768/1280px x 100%/200%`
- visible header control의 rect 비중첩, `scrollWidth<=clientWidth`, focus ring 비클리핑
- 장바구니 badge, ADMIN/CUSTOMER 이름, 로그인·가입·로그아웃 긴 라벨
- 키보드 Tab 순서와 44px 터치 타깃 유지

## 운영 배포 확인

- deployment는 `READY`, `production`, `sin1`입니다.
- deployment Git SHA, local HEAD, origin/main이 모두 `6892d86a8751e26a9480969dc2d1e0aa613a0a23`으로 일치했습니다.
- apex/www/fixed alias가 연결됐고 `aliasError`는 null입니다.
- 최근 1시간 runtime error cluster는 0건이고 해당 배포의 error/fatal log도 0건입니다.

## 외부·법무 blocker

- Baum의 법인명·위탁범위는 계약 확정 전이므로 공개 문구에 추측 추가를 하지 않은 현재 구현이 안전합니다.
- 실제 등록카드 활성화 전에는 확정된 수탁자 법인명·처리 범위를 법무/계약 근거로 개인정보 처리 문서에 반영해야 합니다.
- LAONPAY env/schema/key/feature gate와 실 PG 상호운용은 이번 범위에서 의도적으로 CLOSED이며, 이 상태는 제품 결함이 아니라 별도 활성화 HOLD입니다.

## Cleanup

- 검증 직전 격리 DB 기준은 users 2, orders 2, items 2, paymentMethods 1, charges 2, cancelRequests 0, audits 0, products 329였습니다.
- local Next, HTTPS 보조 프록시, Chrome/browser context를 종료했습니다.
- 일회용 PostgreSQL DB를 삭제하고 존재 개수 0을 확인했습니다.
- 임시 fixture/브라우저 러너/인증서/키/스크린샷 원본을 삭제했습니다.
- 포트 3003/3443 listener 0을 확인했습니다.
- 운영 DB, Vercel env/schema, PG 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

`6892d86`의 결제 용어 정렬과 보안 패치는 의도대로 동작합니다. 일반 KSPAY 인증결제와 LAONPAY 등록카드가 화면·정책·과거 주문 호환에서 분리됐고, provider 중립 보안 계약과 취소 원장 분기도 유지됐습니다.

그러나 인계가 필수로 요구한 `200% overflow/clipping` 검증에서 공용 헤더가 실패했습니다. 결제 용어 변경의 직접 귀책은 아니지만 현재 배포 기준 접근성 완료 조건을 충족하지 않으므로 전체 판정은 **FAIL / NO-GO**입니다. `QA-6892-01` 수정 후 헤더 행렬만 표적 재검증하면 됩니다.
