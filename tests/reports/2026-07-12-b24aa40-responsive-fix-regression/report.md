# b24aa40 모바일·200% 확대 수정 회귀 QA 보고서

작성일: 2026-07-12

담당: Codex QA/테스트 세션

대상 제품 커밋: `b24aa40a2ee169ad7d8c8f1251db24bd04f24a51`

비교 범위: `79efe2d155a78af927898070b97515bf385793dc..b24aa40a2ee169ad7d8c8f1251db24bd04f24a51`

결과: **PASS**

출시 판정: **GO - QA-C695-01~04 수정 및 인접 회귀 통과**

## 범위와 환경

- Node.js 22.23.1, pnpm 11.5.3, Next.js 15.5.19
- 로컬 production build: `http://localhost:3003`
- Chromium: 320/360/390/412px, 100%/200% 루트 글자 크기, desktop 1280px
- Android Emulator Android 16, Chrome 133.0.6943.137, 412px, `adb reverse` localhost 인증 환경
- 운영: `https://laonshop.com`
- 배포: `dpl_86qQJ5qjM4uXrLUoXdvvEJtawU1t`, `READY`, production SHA `b24aa40`

## 요약

- 제품 코드는 수정하지 않았습니다.
- test 24/24, skip 0, lint, typecheck, Prisma validate, production audit, build와 diff check가 모두 통과했습니다.
- 이전과 같은 긴 이메일·이름·상품명·주소·주문번호·승인번호·등록 카드 fixture를 사용했습니다.
- 320/360/390/412px의 100%/200%에서 마이페이지, 설정, 장바구니, checkout 기본·원클릭·수기, 주문 4개 상태, 재결제 기본·원클릭을 실제 탐색했습니다.
- 모든 조합에서 document width가 viewport와 일치하고 visible descendant outside 및 버튼·링크 내부 clipping이 0입니다.
- 가장 위험한 320px·200%의 9개 핵심 상태는 overflow-hidden/clip 조상 침범을 별도로 단정해 모두 0임을 확인했습니다.
- 실제 Android Chrome 인증 후 같은 핵심 화면을 412px·200%로 재검증해 outside/clipped 0과 `aria-pressed` 및 CTA 내부 비클리핑을 확인했습니다.
- 결제·재결제 submit, 운영 로그인 이후 쓰기, 실 KSNET 호출은 실행하지 않았습니다.

## 정적 검증

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 24/24, fail 0, skip 0 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | 스키마 유효, 기존 Prisma 7 설정 이전 안내만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 원 결함 회귀

| ID | 이전 결과 | 현재 결과 | 핵심 비교 |
| --- | --- | --- | --- |
| QA-C695-01 | checkout `sw529`, settings `sw488` | PASS | 둘 다 320px·200% `sw305=vw305`, 주소·CTA 내부 비클리핑 |
| QA-C695-02 | mypage 정상 `sw328`, 200% `sw655` | PASS | 정상·200% 모두 `sw305=vw305`, 긴 계정값과 설정 링크 내부 |
| QA-C695-03 | cart 200% `sw451`, 증가 버튼 right 450 | PASS | `sw305`, 증가 right 166, 삭제 right 260, 각 44px |
| QA-C695-04 | retry 200% `sw363`, 카드·CTA clipping | PASS | `sw305`, 카드 `165/165×152/152`, CTA `199/199×136/136` |

## 모바일 실제 결과

### 마이페이지

- 320/360/390/412px × 100%/200% 전 조합에서 outside/clipped 0입니다.
- 320px·100%는 `vw=sw=305`, 이메일 right 226, 이름 right 226, 설정 right 289입니다.
- 320px·200%는 `vw=sw=305`, 이메일·이름 right 273, 설정 right 273입니다.
- 긴 이름은 가용 폭의 여러 행으로 reflow되며 한 글자 세로열이나 숨김이 없습니다.

증거: [mypage-320-font200-fixed.png](mypage-320-font200-fixed.png)

### 설정·주소·카드 폼

- 320px·100% 주소 행은 높이 44, 우편번호와 주소 검색이 같은 행에 유지됩니다.
- 320px·200% 주소 행은 높이 166으로 자연스럽게 두 행이 되며 우편번호와 버튼 모두 `left=32`, `right=224`입니다.
- 카드 등록 폼을 연 상태에서도 4개 폭·2개 배율 모두 outside/clipped 0입니다.
- 마이페이지 링크, 주소 검색, 카드 삭제, 저장, 비밀번호 변경, 회원 탈퇴는 320px·100%에서 모두 44px 이상입니다.

증거: [settings-320-font200-address-fixed.png](settings-320-font200-address-fixed.png)

### 장바구니

- 4개 모바일 폭·2개 배율 모두 `scrollWidth=viewport`, outside/clipped 0입니다.
- 320px·200%에서 상품 행 right 272, 수량 조작 right 167, 삭제 right 260입니다.
- 감소·증가 버튼은 각각 44×44, 삭제는 61.9×44입니다.
- 모바일에서는 상품 정보와 조작부가 2행, 1280px에서는 `64px 384px 174px` 3열 1행으로 복귀합니다.

증거: [cart-320-font200-fixed.png](cart-320-font200-fixed.png), [cart-1280-row-fixed.png](cart-1280-row-fixed.png)

### Checkout

- 기본·원클릭·수기 상태를 320/360/390/412px × 100%/200%에서 모두 검사했습니다.
- 320px·200% 주소 행 right 252, 주소 버튼 right 245, 문서 `sw305=vw305`입니다.
- 기본 CTA는 `241/241×216/216`, 원클릭 카드 버튼은 `165/165×152/152`로 내부 scroll/client 치수가 일치합니다.
- 원클릭 결제수단과 등록 카드 모두 `aria-pressed=true`를 확인했습니다.
- 금액은 200% 최소 폭에서 행 전체를 사용해 두 줄로 reflow되고 `결제하기` 문구는 완전한 다음 행으로 표시됩니다.
- 수기결제 입력 그리드도 모든 조합에서 컨테이너 안에 유지됩니다.

증거: [checkout-320-font200-oneclick-fixed.png](checkout-320-font200-oneclick-fixed.png), [checkout-320-font200-cta-fixed.png](checkout-320-font200-cta-fixed.png)

### 주문 상세·재결제

- PAID, FAILED, `PENDING+marker`, CANCEL_REQUESTED의 긴 MOID·승인번호·주소·상품명·금액을 확인했습니다.
- 320/412px·200%에서 네 상태 모두 `scrollWidth=viewport`, outside/clipped 0입니다.
- PAID 취소·반품 폼을 열어 버튼과 내용 경계를 확인했습니다.
- 재결제 기본·원클릭은 4개 폭·2개 배율 모두 outside/clipped 0입니다.
- 320px·200% 카드와 CTA 내부 scroll/client 치수는 각각 `165/165×152/152`, `199/199×136/136`입니다.

증거: [retry-320-font200-oneclick-fixed.png](retry-320-font200-oneclick-fixed.png)

## 키보드·접근성

- checkout 카드결제에서 Tab으로 카카오페이, Shift+Tab으로 카드결제에 복귀했습니다.
- 원클릭 결제에 Space를 사용해 선택했고 `aria-pressed=true`를 확인했습니다.
- 등록 카드 focus-visible은 `2px solid`, offset 2px이며 viewport 안에 완전히 보입니다.
- 설정·주소·수량·삭제 등 변경 대상의 주요 타깃은 44px 이상입니다.
- 브라우저 console error/warning은 0입니다.
- 설정→마이페이지 뒤로가기와 마이페이지 새로고침 후 URL·화면·문서 폭이 유지됩니다.

## 조상 clipping 집중 검사

- 320px·200%에서 mypage, settings 카드 폼 열림, cart, checkout 원클릭·수기, retry 원클릭, PAID 취소 폼 열림, PENDING, CANCEL_REQUESTED를 검사했습니다.
- 각 visible descendant의 rect를 overflow-x/y가 `hidden` 또는 `clip`인 모든 조상 rect와 비교했습니다.
- 9개 상태 모두 `ancestorClips=[]`, `scrollWidth=viewport=305`입니다.

## Android 실제 Chrome

- `adb reverse tcp:3003`으로 Android의 `http://localhost:3003`에서 production Secure 세션을 유지했습니다.
- 테스트 고객 로그인과 `/mypage` 접근으로 인증 상태를 단정했습니다.
- 412px·200%의 mypage, settings, cart, checkout 기본·원클릭, retry 기본·원클릭이 모두 `scrollWidth=viewport=412`, outside/clipped 0입니다.
- checkout 카드 `273/273×120/120`, CTA `348/348×162/162`입니다.
- retry 카드 `273/273×120/120`, CTA `307/307×136/136`입니다.
- 카드 선택 `aria-pressed=true`, Android console error/warning 0입니다.

## Desktop·운영 배포

- 1280px에서 mypage/settings/cart/checkout/retry의 outside/clipped는 모두 0입니다.
- checkout·retry 결제수단은 `231px 231px` 2열, 설정 카드 입력은 2열입니다.
- Vercel deployment `dpl_86qQJ5qjM4uXrLUoXdvvEJtawU1t`은 `READY`, target `production`입니다.
- 제품 Git SHA는 `b24aa40a2ee169ad7d8c8f1251db24bd04f24a51`이며 검증 시 local HEAD와 `origin/main`에 일치했습니다.
- `laonshop.com`, `www.laonshop.com` 별칭을 확인했습니다.
- 최근 1시간 해당 deployment error/fatal runtime log는 0건입니다.
- 운영 390px·100%, 320px·200% 홈은 outside/clipped 0이며 guest `/checkout`은 `/login`으로 이동했습니다.

## 도구 이슈

- Android 최초 로그인 확인은 좁은 헤더에서 사용자명이 시각적으로 줄바꿈돼 연속 문자열 비교만 실패했습니다. 보호 경로 `/mypage`와 제목으로 재판정해 인증 유지와 실제 화면 동작을 확인했습니다.
- Android locator screenshot은 요소 안정화 대기에서 30초 제한에 걸렸습니다. 같은 흐름을 캡처 없이 재실행해 DOM 수치·콘솔·cleanup을 회수했으며 제품 실패가 아닙니다.

## 미실행·잔여 위험

- Safari/WebKit과 iOS 실제 기기
- 운영 인증 사용자 쓰기 흐름
- 실 KSNET/KSTA 승인·취소·영수증
- 결제·재결제 submit과 설정 저장·삭제 Server Action
- 매우 큰 금액은 200% 최소 폭에서 여러 줄로 표시되지만 이번 검증값은 잘림 없이 의도적으로 reflow됩니다.

## cleanup

- 기본 회귀와 조상 clipping 집중 검사를 독립 fixture로 두 차례 실행해 누적 QA 사용자 2명, 주문 8건, 주문항목 8건, 등록카드 2건, 찜 2건, QA 상품 2개를 삭제했습니다.
- 최종 DB는 사용자 10, 활성 사용자 9, 주문 4, 주문항목 4, 상품 329, 감사로그 0, 등록카드 4, 찜 0입니다.
- QA 사용자·상품·주문의 잔존 조회 결과는 모두 0건입니다.
- 3003 서버, Playwright, Android CDP forward와 reverse를 종료했고 listener·포워딩 잔존은 없습니다.
- 운영·마스터 데이터, 실결제, PG/Vercel 설정 변경은 없었습니다.

## 최종 판정

QA-C695-01~04는 수정 전 수치와 동일 fixture로 모두 해소됐습니다. 핵심 모바일·200% 확대와 정상 모바일·desktop, 실제 Android Chrome, 운영 guest smoke까지 회귀가 통과했으므로 현재 제품 커밋은 **PASS / GO**입니다.
