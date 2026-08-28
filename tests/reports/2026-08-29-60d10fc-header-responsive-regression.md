# 60d10fc 헤더 큰 글자 수정 회귀 QA 보고서

작성일: 2026-08-29

담당: Codex QA/테스트 세션

이전 QA 기준: `9d3c98c2ee578574d2227c96b0af3d336e697f81`

검증 제품 SHA: `60d10fc21c0aac72bbca244920369a7d11453b86`

비교 범위: `9d3c98c2ee578574d2227c96b0af3d336e697f81..60d10fc21c0aac72bbca244920369a7d11453b86`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-e8vll2qlq-customorder.vercel.app`
- Deployment: `dpl_4D8Gb8bS4GfQSnGTk2nGRRh4gWpM`

## 판정

- 전체 결과: **FAIL**
- `QA-6892-01` 200% 글자 확대 헤더 겹침·잘림: **PASS / CLOSED**
- CUSTOMER·ADMIN·guest 56개 인증 행렬의 overlap/clipping/내부 scroll: **PASS**
- 헤더 내비게이션·장바구니 badge·역할 링크·로그아웃 Tab/click: **PASS**
- 결제 용어·과거 주문 호환·일반 KSPAY 4수단·법무 문구·보안 패치: **PASS**
- `QA-60D-01` 정상 글자 크기 일부 헤더 링크 44px 미만: **P2 / OPEN**
- 원 결함 수정 자체: **GO**
- 현재 필수 헤더 접근성 gate 및 전체 출시: **NO-GO**

원 결함은 실제 `32px` 루트 글자에서 해소됐습니다. 인증 CUSTOMER의 settings/checkout `768x900`과 settings `1280x900`에서 모든 헤더 명령이 추가 행으로 안전하게 재배치됐고, 겹침·잘림·내부 scroll·문서 overflow가 0입니다. 다만 인계가 함께 요구한 44px 타깃을 정상 글자 크기에서 일부 링크가 충족하지 못합니다. 모바일 `검색`·`마이`·`관리`는 폭 약 39px이고, 데스크톱 성별/검색 내비게이션은 높이 약 37px입니다. 실제 hit-test에서도 44px 가상 경계점이 링크가 아닌 부모 요소에 닿아 전체 결과를 FAIL로 판정합니다.

## 범위와 안전 경계

- 제품 코드를 수정하지 않았습니다.
- 운영 브라우저에서는 공개 GET과 guest UI만 확인했습니다.
- 실 KSNET/KSPAY/LAONPAY 호출, 카드 입력, 운영 DB write, Vercel env/schema/gate 변경을 실행하지 않았습니다.
- 인증·주문 표식 검증은 로컬 PostgreSQL 일회용 DB와 local production Next에서 수행했습니다.
- fixture에는 합성 CUSTOMER/ADMIN 각 1명, 상품 329개 시드, 과거/신규 등록카드 표식 주문 각 1건만 사용했습니다.
- 비밀번호, session secret, provider key 값을 보고서·스크린샷·Git에 남기지 않았습니다.

## 변경 독립 검토

실제 diff는 `app/layout.tsx`와 `tests/api/header-responsive.test.ts` 두 파일뿐이며 제품 변경은 다음 계약과 일치합니다.

- 최상위 header flex의 `sm:flex-nowrap`이 제거돼 가용 폭에 따라 행을 나눕니다.
- 좌·우 명령 그룹은 `max-w-full`과 `flex-wrap`을 사용합니다.
- 장바구니·역할 링크·로그아웃 form·guest 링크는 `shrink-0`으로 내부 문구 축소를 막습니다.
- CUSTOMER 데스크톱 라벨은 가변 사용자명과 truncate 대신 고정 `마이페이지`를 표시합니다.
- ADMIN `관리`, guest 로그인/가입, 장바구니 badge, 로그아웃과 기존 href/action은 유지됩니다.
- 신규 구조 테스트는 nowrap/truncate 회귀와 고정 라벨을 검증하지만 실제 계산 rect와 44px hit area는 검증하지 않습니다.
- 결제·API·DB·인증 세션·PG·법무 문구·의존성 파일은 비교 범위에서 변경되지 않았습니다.

## 정적·빌드 검증

Node 22.23.1, pnpm 11.5.3으로 독립 실행했습니다.

| 항목 | 결과 |
| --- | --- |
| focused `header-responsive` + `payment-method-copy` | PASS 5/5, skip 0 |
| `pnpm test` | PASS 137/137, fail 0, skip 0 |
| 이미지 gate | PASS, 상품 329개/1,316장 및 큐레이션 20상품/100장 |
| `pnpm test:billing:interop` | PASS 2/2 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma 7 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm build` | PASS, Next 15.5.24, static generation 20/20 |
| `pnpm billing:preflight --allow-closed` | PASS, 모든 LAONPAY gate CLOSED, 값 노출 0 |
| package resolution | Next 15.5.24, Prisma 6.19.3, PostCSS 8.5.23 |
| `git diff --check` | PASS |
| `AGENTS.md` / `CLAUDE.md` | PASS, byte-identical |

## 격리 인증 헤더 회귀

환경:

- local production Next 15.5.24
- 일회용 PostgreSQL
- Google Chrome 실제 실행 파일
- 합성 CUSTOMER·ADMIN 및 guest
- 장바구니 수량 2 badge
- 폭 `320/360/375/390/412/768/1280px`
- 루트 글자 `100%/200%`

검사한 행렬은 guest 14개, CUSTOMER settings/checkout 28개, ADMIN 14개로 총 56개입니다.

### QA-6892-01 원 재현 결과

| 화면 | 글자/폭 | 핵심 결과 |
| --- | --- | --- |
| CUSTOMER settings | 768px/200% | font 32px, header 217px, document 768/768, overlap 0, 내부 overflow 0 |
| CUSTOMER checkout | 768px/200% | font 32px, header 217px, document 768/768, overlap 0, 내부 overflow 0 |
| CUSTOMER settings | 1280px/200% | font 32px, header 217px, document 1280/1280, overlap 0, 내부 overflow 0 |

`768px/200%`에서 첫 행은 LAONSHOP·남성·여성·검색, 둘째 행은 장바구니·마이페이지·로그아웃으로 분리됐습니다. 장바구니는 `scrollWidth/clientWidth=192/192`, 마이페이지 `164/164`, 로그아웃 `140/140`으로 이전 `116/88`, `206/48` 잘림이 사라졌습니다. `1280px/200%`에서도 마이페이지 `167/167`로 완전 표시됩니다.

증거:

- [CUSTOMER settings 768px·200%](./2026-08-29-60d10fc-header-responsive-regression/customer-settings-768-font200.png)
- [CUSTOMER settings 1280px·200%](./2026-08-29-60d10fc-header-responsive-regression/customer-settings-1280-font200.png)
- [guest 홈 320px·200%](./2026-08-29-60d10fc-header-responsive-regression/guest-home-320-font200.png)
- [ADMIN 768px·200%](./2026-08-29-60d10fc-header-responsive-regression/admin-768-font200.png)

### 내비게이션·키보드

- 320px/200%에서 Tab 순서는 `본문 바로가기 → LAONSHOP → 장바구니 → 역할/인증 명령 → 로그아웃 → 남성 → 여성 → 검색`으로 유지됐습니다.
- 768px/200%에서는 `본문 바로가기 → LAONSHOP → 남성 → 여성 → 검색 → 장바구니 → 역할/인증 명령 → 로그아웃` 순서입니다.
- CUSTOMER `마이페이지`, ADMIN `관리`, guest `로그인/가입`, 세 역할 공통 남성/여성/검색/장바구니와 CUSTOMER·ADMIN 로그아웃을 실제 click했습니다.
- 18개 click 경로가 기대 URL에 도달했고 로그아웃 두 역할 모두 guest 헤더로 전환됐습니다.
- 장바구니 badge `2`, visible control focus rect, focus outline clipping은 정상입니다.
- console error, page error, 외부 PG/LAONPAY 요청은 모두 0건입니다.

## 결제·주문·법무 비회귀

- 체크아웃의 카드결제·카카오페이·네이버페이·실시간 계좌이체를 각각 선택해 `aria-pressed=true`를 확인했습니다.
- LAONPAY gate가 CLOSED인 합성 일반 고객에게 등록카드 tile이 미노출되고 실제 외부 호출이 0인 상태를 확인했습니다.
- 과거 `테스트카드 (LAONPAY 원클릭)`과 신규 `테스트카드 (LAONPAY 등록카드)` 주문은 모두 화면에서 `LAONPAY 등록카드`로 정규화되고 `원클릭` 문구는 노출되지 않았습니다.
- 두 주문 모두 취소/반품 UI를 유지했습니다. 제품 변경이 헤더에 한정되므로 취소 Action POST는 재실행하지 않았고 focused/full 계약 테스트로 분기 유지 여부를 검증했습니다.
- 브라우저 검증 후 격리 DB는 users 2, orders 2, items 2, products 329, audits 0, billing methods/charges/cancel requests 0이었고 두 주문은 PAID·취소 필드 null로 유지됐습니다.
- 운영 홈·약관·개인정보·FAQ에서 KSPAY 인증결제와 LAONPAY 등록카드 경로가 구분됩니다. FAQ details 6개를 열어 두 문구가 실제 표시됨을 확인했습니다.
- 공개 화면의 `Baum/바움` 추측 법무 문구는 0건이고 footer 정책 링크 4개, 전화·이메일 링크를 유지합니다.

## 운영 배포 검증

- deployment는 `READY`, `production`, `sin1`, Git SHA `60d10fc21c0aac72bbca244920369a7d11453b86`입니다.
- apex/www/fixed alias가 연결됐고 `aliasError`는 null입니다.
- 최근 1시간 runtime error cluster와 해당 배포 error/fatal log는 각각 0건입니다.
- 운영 홈·약관·개인정보·FAQ를 7개 폭과 100%/200%의 56개 조합으로 검사했습니다.
- HTTP 200, document overflow 0, visible header rect overlap 0, control 내부 scroll 0, console/page error 0, 외부 PG 요청 0입니다.
- 정상 글자 44px 타깃 실패는 운영에서도 로컬과 같은 값으로 재현됐습니다.

## 발견 결함

### QA-60D-01 P2 — 정상 글자 크기의 일부 헤더 링크가 44px 타깃보다 작음

재현 A:

1. guest 또는 인증 사용자로 홈·settings·checkout·admin 중 하나를 엽니다.
2. viewport를 `390x844`, 루트 글자를 `100%`로 둡니다.
3. 모바일 하단 header nav의 `검색` 링크 rect를 측정합니다.

실제 A:

- `검색`은 `39.14x44px`입니다. `320~412px`에서 폭은 `38.97~39.19px`입니다.
- CUSTOMER `마이`, ADMIN `관리`도 해당 모바일 폭에서 약 `39x44px`입니다.
- `검색` 중심에서 오른쪽 `21.9px` 지점은 44px 타깃 안이어야 하지만 `elementFromPoint`가 링크가 아닌 부모 `NAV`를 반환했습니다.

재현 B:

1. viewport를 `768x900`, 루트 글자를 `100%`로 둡니다.
2. 데스크톱 header nav의 남성·여성·검색 링크 높이를 측정합니다.

실제 B:

- 남성·여성은 각각 `72.23x36.92px`, 검색은 `48.13x36.92px`입니다.
- `1280px`에서도 높이는 `37.61px`입니다.
- 남성 링크 중심에서 아래 `21.9px` 지점은 링크가 아닌 부모 `DIV`를 반환했습니다.

기대 결과:

- 모든 header 명령의 실제 클릭 rect가 가로·세로 모두 최소 44px이어야 합니다.
- 인접 링크 사이 여백만 존재하는 것이 아니라 44px 경계 안의 hit-test가 대상 링크로 귀속돼야 합니다.

증거:

- [모바일 검색 focus](./2026-08-29-60d10fc-header-responsive-regression/guest-home-390-normal-focus.png)
- [데스크톱 남성의류 focus](./2026-08-29-60d10fc-header-responsive-regression/guest-home-768-normal-focus.png)
- 관련 코드: `app/layout.tsx`의 desktop category links, mobile `검색`, CUSTOMER/ADMIN 역할 link

원인 후보:

- 모바일 검색·역할 링크는 `min-h-11`만 있고 `min-w-11`이 없습니다.
- 데스크톱 category links는 `px-3 py-2`만 있고 `min-h-11`이 없습니다.

비교 범위 귀책:

- 검색과 데스크톱 category link의 해당 클래스는 이번 범위에서 바뀌지 않았습니다.
- CUSTOMER/ADMIN 모바일 역할 링크도 이번 변경이 `shrink-0`을 추가했을 뿐 최소 폭은 이전부터 없었습니다.
- `60d10fc`가 새로 만든 회귀는 아니지만, 인계의 필수 44px gate에서 확인된 현재 제품 결함입니다.

필수 회귀:

- guest/CUSTOMER/ADMIN `320/360/375/390/412/768/1280px x 100%/200%`
- 각 visible header link/button의 `width>=44 && height>=44`
- target 확장 뒤 control overlap, 행 높이, document width, focus outline, Tab 순서 비회귀
- `elementFromPoint`로 가로·세로 44px 경계가 대상 링크에 귀속되는지 확인

## 외부 blocker

- Baum 수탁 법인명·위탁범위는 계약 확정 전이며, 현재 공개 문구에 추측하지 않은 상태가 안전합니다.
- 실제 LAONPAY env/schema/key/feature gate와 PG 상호운용은 이번 범위에서 의도적으로 CLOSED입니다. 이는 헤더 제품 결함과 분리된 활성화 HOLD입니다.

## Cleanup

- 검증 종료 전 격리 DB는 users 2, orders 2, items 2, products 329, audits 0, billing 원장 0으로 예상 기준과 일치했습니다.
- local Next, Chrome/browser context를 종료했습니다.
- 일회용 PostgreSQL DB를 삭제하고 존재 개수 0을 확인했습니다.
- 임시 fixture·브라우저 러너·결과 JSON을 삭제했습니다.
- 포트 3003 listener 0을 확인했습니다.
- 운영 DB, Vercel env/schema/gate, PG 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

`60d10fc`는 `QA-6892-01`을 해결했습니다. 200% 글자에서 헤더가 행을 나누고 CUSTOMER 고정 라벨을 완전히 표시하며, 역할별 내비게이션·결제/주문 인접 기능도 퇴행하지 않았습니다.

그러나 정상 글자에서 실제 클릭 rect가 44px보다 작은 링크가 남아 인계의 필수 접근성 gate를 통과하지 못했습니다. 원 수정 자체는 **GO**이지만 현재 배포의 전체 판정은 **FAIL / NO-GO**입니다. `QA-60D-01`만 보강한 뒤 같은 역할·폭 행렬을 표적 재검증해야 합니다.
