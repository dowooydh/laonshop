# b79c803 헤더 44px 타깃 최종 회귀 QA 보고서

작성일: 2026-08-29

담당: Codex QA/테스트 세션

이전 QA 기준: `5d38515f2d1c1f4b9547fdd8208488671fd317c6`

검증 제품 SHA: `b79c8032220b9f3bd92cec29e26543cbe77f2f87`

비교 범위: `5d38515f2d1c1f4b9547fdd8208488671fd317c6..b79c8032220b9f3bd92cec29e26543cbe77f2f87`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-jugvzjp2h-customorder.vercel.app`
- Deployment: `dpl_DgffRi9T9NVUSvbeMgdJB9MEcfsp`

## 판정

- 전체 결과: **PASS**
- `QA-60D-01` 헤더 링크 44px 미만: **PASS / CLOSED**
- `QA-6892-01` 200% 글자 확대 헤더 겹침·잘림: **PASS / CLOSED 유지**
- guest·CUSTOMER·ADMIN 56개 인증 행렬: **PASS**
- 실제 44px 경계 `elementFromPoint` 귀속: **PASS 1,568/1,568**
- 키보드 Tab·focus-visible·focus clipping: **PASS**
- 결제 용어·과거 주문·KSPAY 4수단·법무 문구: **PASS**
- 운영 배포·공개 hit-test·runtime 관찰: **PASS**
- 이 변경 범위 출시: **GO**

정상 글자에서 이전에 약 `39x44px`이던 모바일 검색·역할 링크는 최소 `44x44px`, 약 `72x37px`이던 데스크톱 카테고리 링크는 최소 높이 44px이 됐습니다. 링크의 중심뿐 아니라 좌·우·상·하 실제 경계 안쪽을 `elementFromPoint`로 측정했으며 모두 해당 링크에 귀속됐습니다. 200% 확대 시 flex-wrap, 내부 문구, 장바구니 badge, 역할별 명령과 Tab 순서도 유지됩니다.

## 범위와 안전 경계

- 제품 코드를 수정하지 않았습니다.
- 운영 브라우저에서는 공개 GET과 guest 내비게이션만 실행했습니다.
- 인증 역할 검증은 일회용 로컬 PostgreSQL과 local production Next에서 수행했습니다.
- 실 KSNET/KSPAY/LAONPAY 호출, 카드 입력, 결제 submit, 운영 DB write, Vercel env/schema/gate 변경을 실행하지 않았습니다.
- fixture는 합성 CUSTOMER/ADMIN 각 1명, 상품 시드 329개, 과거/신규 등록카드 표식 PAID 주문 각 1건입니다.
- 비밀번호, session secret, Vercel 임시 접근 토큰, provider 자격정보를 보고서·스크린샷·Git에 남기지 않았습니다.

## 변경 독립 검토

실제 비교 범위는 `app/layout.tsx`, `tests/api/header-responsive.test.ts` 두 파일입니다.

- desktop 남성·여성·검색 링크에 `inline-flex`, `min-h-11`, `min-w-11`, 중앙정렬을 적용했습니다.
- mobile 남성·여성·검색 링크에 `min-w-11`, 중앙정렬을 적용했습니다.
- CUSTOMER 마이/마이페이지와 ADMIN 관리 링크에 `min-w-11`, 중앙정렬을 적용했습니다.
- 이전 수정의 `flex-wrap`, `max-w-full`, `shrink-0`, 고정 마이페이지 라벨을 유지합니다.
- href, logout Action, 장바구니 badge, 모바일/데스크톱 DOM 순서는 변경하지 않았습니다.
- 결제·API·DB·인증·세션·법무·의존성 파일은 변경되지 않았습니다.
- 구조 테스트가 desktop category, mobile category, role link의 최소 44px class를 고정합니다.

독립 코드리뷰에서 신규 P0/P1/P2 결함을 찾지 못했습니다.

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
| `pnpm billing:preflight --allow-closed` | PASS, LAONPAY gate 전부 CLOSED, 값 노출 0 |
| `git diff --check` | PASS |
| `AGENTS.md` / `CLAUDE.md` | PASS, byte-identical |

## 격리 인증 브라우저 회귀

환경:

- local production Next 15.5.24
- 일회용 PostgreSQL
- Google Chrome 실제 실행 파일
- guest, 합성 CUSTOMER, 합성 ADMIN
- CUSTOMER 장바구니 수량 2 badge
- 폭 `320/360/375/390/412/768/1280px`
- 루트 글자 `100%/200%`

guest 14개, CUSTOMER settings/checkout 28개, ADMIN 14개로 총 56개 조합을 검사했습니다.

### 실제 rect와 hit area

| 대상 | 100% 최소 rect | 200% 최소 rect | 결과 |
| --- | ---: | ---: | --- |
| mobile 검색 | `44x44px` | `88x88px` | PASS |
| mobile CUSTOMER 마이 | `44x44px` | `88x88px` | PASS |
| mobile ADMIN 관리 | `44x44px` | `88x88px` | PASS |
| mobile 남성·여성 | `61.92x44px` | `123.83x88px` | PASS |
| desktop 검색 | `48.13x44px` | `94.25x88px` | PASS |
| desktop 남성·여성 | `72.23x44px` | `140.48x88px` | PASS |
| desktop CUSTOMER 마이페이지 | `84.30x44px` 이상 | `163.61x88px` 이상 | PASS |
| desktop ADMIN 관리 | `48.13x44px` 이상 | `94.25x88px` 이상 | PASS |

- visible header control 전체의 최소 rect는 `44x44px`입니다.
- 각 control의 왼쪽·오른쪽·위·아래 `0.5px` 안쪽 경계를 측정한 1,568개 hit-test가 모두 본래 링크/버튼에 귀속됐습니다.
- control overlap, viewport outside, 내부 `scrollWidth/scrollHeight`, overflow 조상 clipping, document horizontal overflow는 모두 0입니다.
- `768x900`과 `1280x900`의 CUSTOMER settings/checkout 200% 원 재현에서 좌·우 명령 그룹이 안전하게 다음 행으로 이동했습니다.

증거:

- [CUSTOMER settings 768px·200%](./2026-08-29-b79c803-header-target-regression/customer-settings-768-font200.png)
- [CUSTOMER settings 1280px·200%](./2026-08-29-b79c803-header-target-regression/customer-settings-1280-font200.png)
- [CUSTOMER 320px·200% focus-visible](./2026-08-29-b79c803-header-target-regression/customer-320-font200-focus.png)
- [ADMIN 390px](./2026-08-29-b79c803-header-target-regression/admin-390-normal.png)
- [guest 390px](./2026-08-29-b79c803-header-target-regression/guest-home-390-normal.png)

### 키보드·클릭·상태

- 320px/200%와 768px/200%에서 세 역할을 각각 Tab 순회해 총 6개 키보드 흐름을 검증했습니다.
- 모바일은 `본문 바로가기 → LAONSHOP → 장바구니 → 역할/인증 → 로그아웃 → 남성 → 여성 → 검색`, desktop은 카테고리가 장바구니보다 앞서는 기존 DOM 순서를 유지합니다.
- guest 로그인/가입, 세 역할 공통 남성/여성/검색/장바구니, CUSTOMER 마이페이지, ADMIN 관리와 CUSTOMER/ADMIN 로그아웃까지 18개 실제 click 경로가 기대 URL·세션 상태로 수렴했습니다.
- 장바구니 badge `2`가 유지됐습니다.
- 320px·768px의 200%에서 카테고리/검색/CUSTOMER/ADMIN 역할 링크 8개를 직접 focus했습니다. 모두 `:focus-visible=true`, outline 2px, activeElement 일치, viewport·overflow 조상 clipping 0입니다.
- 브라우저 console error, page error, 외부 PG/LAONPAY 요청은 각각 0건입니다.

## 결제·주문·법무 비회귀

- checkout의 카드결제·카카오페이·네이버페이·실시간 계좌이체를 각각 click해 `aria-pressed=true`를 확인했습니다.
- LAONPAY gate가 CLOSED인 일반 합성 고객에게 등록카드 결제 tile이 노출되지 않고 외부 호출도 0입니다.
- 과거 `테스트카드 (LAONPAY 원클릭)` 주문과 신규 `테스트카드 (LAONPAY 등록카드)` 주문은 모두 화면에서 `테스트카드 (LAONPAY 등록카드)`로 표시됐고 `원클릭` 문구는 0건입니다.
- 검증 전후 격리 DB는 users 2, orders 2, items 2, products 329, billing cards 0, audits 0으로 동일했고 두 주문은 PAID 상태를 유지했습니다.
- 약관·개인정보처리방침·FAQ·footer가 KSPAY 일반 인증결제와 LAONPAY 등록카드 처리 경로를 구분합니다.
- 개인정보처리방침은 일반 KSPAY 승인·정산과 LAONPAY hosted/partner 경로를 별도 문단으로 표시합니다.
- FAQ 결제수단 `<details>`를 실제로 열어 KSPAY(KSNET) 인증결제창과 LAONPAY 등록카드 문구를 확인했습니다.
- 공개 문구의 계약 미확정 `Baum/바움` 추측 표기는 0건입니다.

## 운영 배포 검증

- deployment는 `READY`, `production`, `sin1`, Git SHA `b79c8032220b9f3bd92cec29e26543cbe77f2f87`입니다.
- apex/www/fixed alias가 연결됐고 `aliasError`는 null입니다.
- 고정 배포는 Deployment Protection 403을 반환해 Vercel의 만료형 read-only 공유 접근으로 확인했으며 접근 토큰은 저장하지 않았습니다.
- apex 7개 폭 x 100%/200% 14조합과 fixed 390px/200% 1조합을 검사했습니다.
- 운영 visible header의 최소 rect는 `44x44px`, 경계 hit-test는 420/420입니다.
- 운영 남성·여성·검색·장바구니·로그인·회원가입 6개 실제 click 경로가 정상입니다.
- document overflow, overlap, control 내부 scroll, console/page error, 외부 PG 요청은 모두 0입니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal log 0입니다.

증거:

- [운영 guest 390px](./2026-08-29-b79c803-header-target-regression/production-guest-390-font100.png)
- [운영 guest 768px·200%](./2026-08-29-b79c803-header-target-regression/production-guest-768-font200.png)

## 도구 오탐 구분

- 첫 로컬 행렬에서 CUSTOMER 역할 링크가 누락됐다는 결과는 반응형용 hidden `<span>` 두 개의 `textContent`를 합쳐 읽은 러너 오탐이었습니다. href 기준으로 수정한 뒤 동일 56조합 전체 재실행에서 PASS했습니다.
- 첫 로그아웃 검사도 시작·종료 URL이 모두 `/`라 URL wait가 즉시 끝난 러너 오탐이었습니다. 로그인 링크의 실제 재등장을 대기하도록 바꾼 뒤 CUSTOMER/ADMIN 모두 PASS했습니다.
- 첫 운영 fixed 검사 403은 제품 runtime 실패가 아니라 Deployment Protection입니다. 임시 read-only 접근으로 재실행해 PASS했습니다.
- FAQ 답변은 닫힌 native `<details>`라 최초 `innerText`에서 제외됐습니다. summary를 실제 click한 뒤 문구를 확인했습니다.

최종 판정에는 오탐을 포함하지 않았습니다.

## 발견 결함

신규 P0/P1/P2/P3 제품 결함을 발견하지 못했습니다.

## 외부 blocker

- 실제 LAONPAY env/schema/key/feature gate와 PG 상호운용은 계속 CLOSED/HOLD입니다.
- Baum 수탁 법인명·위탁범위는 계약 확정 전이며 공개 문구에 추측하지 않은 현재 상태가 안전합니다.
- 이 두 항목은 `QA-60D-01`과 무관하며 이번 헤더 수정의 출시를 막지 않습니다. 등록카드 실활성화는 별도 준비 완료 전까지 NO-GO입니다.

## Cleanup

- 검증 종료 전 격리 DB baseline과 최종 counts가 일치함을 확인했습니다.
- local Next, Chrome context를 종료했습니다.
- 일회용 PostgreSQL DB를 삭제하고 같은 이름의 DB 존재 개수 0을 확인했습니다.
- 임시 fixture·브라우저 러너·결과 JSON을 삭제하고 `/private/tmp/laonshop-b79*` 잔여 0을 확인했습니다.
- 포트 3003 listener 0을 확인했습니다.
- 운영 DB, Vercel env/schema/gate, PG 설정, 제품 코드는 변경하지 않았습니다.

## 최종 의견

`b79c803`은 `QA-60D-01`을 해결했고 이전 `QA-6892-01`의 200% reflow도 유지합니다. 세 역할·모든 지정 폭에서 실제 rect, hit ownership, focus-visible, 내비게이션과 인접 결제/법무 회귀가 모두 통과했습니다.

따라서 제품 SHA `b79c8032220b9f3bd92cec29e26543cbe77f2f87`과 현재 운영 배포는 이번 범위에서 **PASS / GO**입니다. 실제 LAONPAY 등록카드 활성화는 별도의 외부 readiness HOLD를 유지합니다.
