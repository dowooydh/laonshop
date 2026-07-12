# c695ea9 모바일·200% 확대 회귀 QA 보고서

작성일: 2026-07-12

담당: Codex QA/테스트 세션

대상 커밋: `c695ea97e739faabfd84b2c3913cfd12f67950d2`

비교 범위: `4eec28dbaafcf49c5183f9a502d8678a871bf8b6..c695ea97e739faabfd84b2c3913cfd12f67950d2`

결과: **FAIL**

출시 판정: **NO-GO - 체크아웃·장바구니·재결제의 200% 확대 조작 결함 수정 필요**

## 범위와 환경

- Node.js 22.23.1, pnpm 11.5.3, Next.js 15.5.19
- 로컬 production build: `http://localhost:3003`
- Chromium: 320/360/390/412px, 100%/200% 루트 글자 크기, desktop 1280px
- Android Emulator Android 16, Chrome 133.0.6943.137, 412px
- 운영: `https://laonshop.com`
- 배포: `dpl_Byd5QpJFjbjLT1B2T8s4rA5DCWT1`, `READY`, production SHA `c695ea9`

## 요약

- 제품 코드는 수정하지 않았습니다.
- 정적 검증과 build는 모두 통과했고 skip/soft-fail은 없습니다.
- 공개 13개 경로와 404를 모바일 4개 폭, 100%/200%로 검사한 112개 조합은 문서 및 실제 descendant 경계 오버플로 0으로 통과했습니다.
- 정상 글자 모바일 홈 제목 1줄, 설명 2줄, CTA 한 줄 라벨을 확인했습니다.
- 로그인 fixture로 마이페이지, 설정, 체크아웃, 장바구니, 상품 상세, 검색, 주문 4개 상태를 실제 탐색했습니다.
- 인증 화면 200% 확대에서 체크아웃, 설정, 장바구니, 마이페이지, 재결제에 수평 오버플로와 컨트롤 잘림이 재현됐습니다.
- Android Chrome의 공개 홈과 로그인 이동은 통과했습니다. 로컬 production의 `Secure` 세션 쿠키가 HTTP `10.0.2.2`에 유지되지 않아 Android 인증 화면은 미실행으로 분리했습니다.

## 정적 검증

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 24/24, fail 0, skip 0 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | 스키마 유효, 설정 deprecation 안내만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 실제 브라우저 결과

| 영역 | 결과 | 실제 확인 |
| --- | --- | --- |
| 공개 13개 경로 | PASS | 320/360/390/412px × 100%/200%, 104조합 |
| 404 | PASS | 같은 폭·확대 8조합, 예상 404 외 콘솔 오류 없음 |
| 홈 히어로 | PASS | 정상 글자 제목 1줄, 설명 2줄, CTA 2개 한 줄 |
| 상품 목록 | PASS | 정상 글자 2열, 200% 1열, 카드 가격·배지 잘림 없음 |
| 상품 상세 | PASS | 긴 제목, 수량, CTA, 상세 이미지, 표, 고시 실제 경계 통과 |
| 키보드 | PASS | FAQ summary Enter/Space, 결제수단 Tab/Space, focus-visible 확인 |
| desktop 1280px | PASS | 결제수단·빌링·재결제 2열, 상품 4열 유지 |
| 뒤로가기·새로고침 | PASS | 홈 복귀·재로드 후 overlay/오류 없음 |
| Android Chrome 공개 화면 | PASS | 412px 100%/200%, 홈 오버플로 0, guest checkout→login |
| 인증 모바일 100% | PARTIAL | 360/390/412px 통과, 320px 마이페이지 긴 값에서 소폭 오버플로 |
| 인증 모바일 200% | FAIL | 체크아웃·설정·장바구니·마이페이지·재결제 오버플로 |

## 발견 결함

### QA-C695-01 - P1 - 체크아웃·설정 주소 행과 결제 CTA가 200%에서 화면 밖으로 밀림

재현 절차:

1. 320~412px Chromium에서 테스트 고객으로 로그인합니다.
2. 루트 글자 크기를 200%로 설정합니다.
3. `/checkout` 또는 `/mypage/settings`를 엽니다.
4. 주소 검색 행과 체크아웃 하단 결제 버튼의 실제 경계를 확인합니다.

기대 결과:

- 우편번호 입력과 주소 검색 버튼이 화면 안에서 재배치됩니다.
- 결제 버튼의 금액과 `결제하기` 문구가 모두 보이고 수평 스크롤이 없습니다.

실제 결과:

- 320px에서 viewport client width `305` 대비 체크아웃 `scrollWidth=529`, 설정 `scrollWidth=488`입니다.
- 체크아웃 주소 검색 버튼 right `529`, 설정 주소 검색 버튼 right `488`로 화면 밖에 놓입니다.
- 결제 버튼은 `scrollWidth=298 > clientWidth=241`로 내부 문구가 잘립니다.
- 360/390/412px에서도 200% 확대 시 같은 문서 폭이 유지되어 수평 스크롤이 발생합니다.

원인 후보:

- `components/address-input.tsx:90`의 고정 가로 `flex`, `w-32` 입력과 줄바꿈 없는 버튼 조합
- `app/checkout/checkout-form.tsx:340`의 공용 `Button size="xl"` 한 줄 레이블
- 결제 카드 행도 `app/checkout/checkout-form.tsx:234`에서 고정 가로 배치를 사용합니다.

증거:

- [checkout-320-font200-address-overflow.png](checkout-320-font200-address-overflow.png)
- [checkout-320-font200-manual.png](checkout-320-font200-manual.png)
- [settings-320-font200-address-overflow.png](settings-320-font200-address-overflow.png)

### QA-C695-02 - P2 - 마이페이지의 긴 계정 값이 모바일 폭과 200% 확대에서 헤더를 확장함

재현 절차:

1. 긴 이메일·이름의 테스트 고객으로 로그인합니다.
2. 320px에서 `/mypage`를 열고 100%와 200%를 각각 확인합니다.
3. 360/390/412px 200%에서도 이메일, 이름, 설정 링크 경계를 확인합니다.

기대 결과:

- 긴 이메일과 이름은 가용 폭 안에서 줄바꿈되며 설정 링크가 화면 안에 유지됩니다.

실제 결과:

- 320px 정상 글자에서도 client width `305` 대비 `scrollWidth=328`입니다.
- 200%에서는 모든 모바일 폭에서 `scrollWidth=655`이며 설정 링크 right `656`, 긴 사용자 값 right `553`입니다.

원인 후보:

- `app/mypage/page.tsx:56`의 고정 가로 헤더에서 사용자 정보 child에 `min-w-0`과 긴 문자열 줄바꿈 규칙이 없습니다.

증거:

- [mypage-320-font200-overflow.png](mypage-320-font200-overflow.png)

### QA-C695-03 - P1 - 장바구니 수량 조작부가 200%에서 모든 지원 모바일 폭을 넘음

재현 절차:

1. 긴 상품명의 상품을 장바구니에 담습니다.
2. 320/360/390/412px에서 `/cart`를 열고 루트 글자를 200%로 설정합니다.
3. 감소·수량·증가·삭제 조작부 경계를 확인합니다.

기대 결과:

- 상품 정보와 수량·삭제 컨트롤이 카드 안에서 줄바꿈 또는 재배치됩니다.

실제 결과:

- 모든 폭에서 문서 `scrollWidth=451`로 유지됩니다.
- 320px에서 수량 증가 버튼 right `450`으로 화면 밖에 놓여 수평 이동 없이는 조작할 수 없습니다.

원인 후보:

- `app/cart/page.tsx:59`의 이미지·상품정보·삭제 고정 가로 행과 `app/cart/page.tsx:67`의 고정 rem 수량 컨트롤 조합

증거:

- [cart-320-font200-quantity-overflow.png](cart-320-font200-quantity-overflow.png)

### QA-C695-04 - P1 - 재결제 등록 카드와 결제 CTA가 320~360px·200%에서 잘림

재현 절차:

1. 결제 실패 주문 상세에서 재결제 영역을 엽니다.
2. 원클릭 결제와 등록 카드를 선택합니다.
3. 320px 또는 360px, 200%에서 카드 행과 결제 버튼 경계를 확인합니다.

기대 결과:

- 마스킹 카드번호, 선택 배지, 결제 CTA가 컨테이너 안에서 줄바꿈 또는 재배치됩니다.

실제 결과:

- 320px에서 문서 `scrollWidth=363`입니다.
- 선택 배지 right `363`, 카드 버튼 `scrollWidth=257 > clientWidth=93`, 결제 CTA `scrollWidth=225 > clientWidth=159`로 내용이 잘립니다.
- 390px 이상에서는 해소되지만 최소 지원 폭과 360px에서 재현됩니다.

원인 후보:

- `app/order/[id]/retry-payment.tsx:103`의 `justify-between` 고정 카드 행과 `app/order/[id]/retry-payment.tsx:127`의 한 줄 공용 버튼

증거:

- [retry-320-font200-card-overflow.png](retry-320-font200-card-overflow.png)

## 운영 배포 확인

- Vercel deployment `dpl_Byd5QpJFjbjLT1B2T8s4rA5DCWT1`은 `READY`, target `production`입니다.
- Git SHA는 `c695ea97e739faabfd84b2c3913cfd12f67950d2`로 local HEAD와 `origin/main`에 일치합니다.
- `laonshop.com`, `www.laonshop.com` 별칭을 확인했습니다.
- 최근 1시간 해당 배포 error/fatal runtime log는 0건입니다.
- 운영 412px 홈은 `scrollWidth=clientWidth=397`, guest `/checkout`은 `/login`으로 정상 이동했습니다.

## 도구·환경 이슈

- 최초 `tsx` 테스트 실행은 sandbox IPC `EPERM`으로 중단됐고, 승인된 Node 22 환경에서 동일 명령을 다시 실행해 24/24 통과했습니다. 제품 실패가 아닙니다.
- 직접 headless 자동화 대신 Playwright MCP로 동일 로컬 production 화면과 실제 DOM 경계를 검증했습니다.
- Android 로컬 production은 세션 쿠키가 `Secure`이고 대상이 HTTP `10.0.2.2`라 로그인 세션이 유지되지 않았습니다. 공개 화면은 실제 Android Chrome으로 검증했고 인증 화면은 Chromium 모바일 폭 결과로 판정했습니다.
- 검증 종료 뒤 로컬 서버, Playwright 세션, Android CDP 포트 포워딩을 종료했습니다.

## 미실행·잔여 위험

- Android Chrome 인증 후 체크아웃·마이페이지·주문 화면
- Safari/WebKit과 iOS 실제 기기
- 실 KSNET 승인·취소·영수증
- 운영 계정 로그인 이후 쓰기 흐름
- JS·jQuery 차단 결제 오류 회귀는 이번 UI 전용 diff에서 재실행하지 않았습니다.

## cleanup

- QA 사용자 1명, 주문 4건, 주문항목 4건, 등록카드 1건, 찜 1건, QA 상품 1개를 삭제했습니다.
- 최종 DB는 사용자 10, 활성 사용자 9, 주문 4, 주문항목 4, 상품 329, 감사로그 0, 등록카드 4, 찜 0입니다.
- QA 사용자·상품·주문의 잔존 조회 결과는 모두 0건입니다.
- 운영·마스터 데이터, 실결제, PG/Vercel 설정 변경은 없었습니다.

## 개발 회귀 요청

1. 주소 검색 행을 200% 확대에서 세로 배치 또는 `minmax(0, 1fr)` 기반으로 재배치합니다.
2. 결제·재결제 CTA와 카드 선택 행이 긴 금액·큰 글자에서 줄바꿈되도록 합니다.
3. 장바구니 행을 200%에서 상품 정보와 수량·삭제 컨트롤의 2행 구조로 전환합니다.
4. 마이페이지 헤더의 긴 이메일·이름에 `min-w-0`, `overflow-wrap:anywhere`를 적용하고 설정 링크를 보존합니다.
5. 수정 후 320/360/390/412px 200%에서 document뿐 아니라 각 컨트롤의 right와 `scrollWidth<=clientWidth`를 다시 단정합니다.
