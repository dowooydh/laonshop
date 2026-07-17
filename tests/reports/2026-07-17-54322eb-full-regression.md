# 54322eb 전체 회귀·출시/시연 준비 QA 보고서

작성일: 2026-07-17

담당: Codex QA/테스트 세션

대상 HEAD: `54322eb6cca456efcadf9e3f9d8cd9ddb71b89f3`

제품 기준: `cb3ce8107509ceb36e4f9765e65b829a3d9bef7b` + QA 문서 커밋 `54322eb`

대상 배포: `dpl_7ZstF18BrWiiJuwwNJnWLpeYnrJS` / `https://laonshop-mtydkop8c-customorder.vercel.app`

운영 URL: `https://laonshop.com`, `https://www.laonshop.com`

결과: **PARTIAL**

출시 판정: **조건부 GO - 웹/Android 심사 시연 가능, 실제 빌링 출시와 플랫폼 전체 완료 주장은 NO-GO**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 KSNET 승인·취소·영수증, 운영 DB write, Vercel env 변경을 실행하지 않았습니다.
- 지정 심사 계정의 빌링 화면은 브라우저 탭 한정 Mock만 실행했습니다.
- checkout은 결제수단 선택과 disabled submit까지 확인했고 실제 주문·PG submit은 실행하지 않았습니다.
- 비밀번호, 카드 원문, 세션 쿠키, PG 키와 환경변수 실제 값은 출력하거나 문서화하지 않았습니다.
- 시작 시 `main=origin/main=54322eb`, clean, `AGENTS.md=CLAUDE.md` 바이트 동일을 확인했습니다.

## 정적 전체 회귀

Node 22.23.1, pnpm 11.5.3 기준으로 현재 HEAD에서 재실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 61/61, fail 0, skip 0 |
| 이미지 gate | PASS | 329상품/1,316장, 큐레이션 20상품/100장, 1200x1500 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |

정적 회귀는 카드 원문 수집 부재, stale oneclick 선차단, WEBFEP 이중 가드, HMAC·PG 결과 결박, 재고·주문 멱등성, 관리자 결제 확인 정책, 빌링 Mock 상태 파서·소유권 노출 경계를 포함합니다.

## 운영 Chrome 빌링 Mock

지정 심사 계정의 기존 인증 세션에서 실제 UI를 실행했습니다.

### 승인 생명주기

- 카드 등록 모달의 4개 값은 read-only 마스킹 예시이고 카드 원문 입력 name과 전송 경로가 없습니다.
- 등록 → 등록 조회 → 승인 → 등록 해지를 완료했습니다.
- 검증금액은 고정 1,004원이며 성공 화면에 `PG TID는 생성하지 않았습니다`가 표시됐습니다.
- 라온샵 취소 버튼은 없고 LAONPAY 관리자 전체취소·부분취소 금지 안내만 표시됐습니다.
- 조회·승인·해지에 빠른 이중 클릭을 적용해 상태가 한 번만 종결되는 것을 확인했습니다.

### 거절·결과미상

- 별도 초기화 후 명시적 거절은 `DECLINED` 단일 종결 상태가 됐고 등록 해지가 가능했습니다.
- 결과미상은 `PENDING_REVIEW`로 고정됐습니다.
- 결과미상 상태에는 결제 재실행과 등록 해지 버튼이 모두 없습니다.
- reload, 마이페이지 이동, 뒤로가기 뒤에도 자동 재시도 없이 같은 확인대기 상태를 유지했습니다.
- 운영 Chrome console error/warning은 0건이었습니다.

### 저장·서버 경계

- strict v2 파서는 허용 10개 키와 가능한 상태 조합만 수용하며 extra key·잘못된 마스크·불가능한 상태를 폐기합니다.
- 코드에 카드 원문, KSNET `billingToken`, PG TID 필드, pgapi·Authorization, Mock용 fetch·Server Action·DB write가 없습니다.
- Mock 조작 전후 DB가 `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`으로 정확히 불변입니다.
- 따라서 Mock은 제품 직접 API 또는 KSNET 개발계 호출이 아니라 현재 탭의 비민감 UI 상태만 바꿉니다.

## 웹 기능 회귀

### Desktop Chrome

- 기본 viewport 약 1435px에서 홈 `scrollWidth=clientWidth`, 주요 descendant viewport 이탈 0이었습니다.
- 남성 목록 20개, 카테고리·정렬, 상품 상세, 검색 빈 상태를 확인했습니다.
- 상품 상세의 대표 이미지가 로드되고 4:5 비율이며 깨진 이미지가 없었습니다.
- 장바구니 2개 상품·수량·사이즈·총액 84,000원이 체크아웃과 일치했습니다.
- 체크아웃 배송지는 저장 정보로 자동 입력됐습니다.
- 카드·카카오페이·네이버페이·실시간 계좌이체의 `aria-pressed` 전환이 정상입니다.
- oneclick과 수기결제는 노출되지 않았고 구매 동의 전 결제 버튼은 disabled입니다.
- 존재하지 않는 검색어는 안내가 있는 빈 상태, 임의 경로는 404와 홈 복귀 링크를 표시했습니다.

### Mobile web

375/390/412px에서 홈·상품 상세·장바구니·체크아웃 12개 조합을 측정했습니다.

- 모든 조합에서 `document.scrollWidth=clientWidth`였습니다.
- 주요 button/link/input의 viewport 이탈과 내부 텍스트 clipping은 0건입니다.
- 빌링 등록 모달도 각 폭에서 모든 input·submit이 dialog 안에 있고 44px 이상이었습니다.
- 기존 브라우저 chrome 폭 때문에 문서 clientWidth는 지정값보다 15px 작았지만 문서 overflow는 없었습니다.

## 인증·오류 경계

- 운영 Chrome의 기존 로그인 세션에서 `/mypage`, `/mypage/settings`, `/cart`, `/checkout` 접근이 유지됐습니다.
- Android guest `/checkout`은 `/login`으로 이동했습니다.
- 존재하지 않는 일회용 이메일로 로그인 실패를 1회 실행했습니다.
- `이메일 또는 비밀번호가 올바르지 않습니다`의 generic 오류가 표시되고 이메일·비밀번호 입력이 유지됐습니다.
- 공개 이미지 API의 빈 ID와 51개 고유 ID 요청은 400이었습니다.
- 존재하지 않는 페이지는 404 화면을 표시했습니다.
- 운영 500 fault injection은 운영 부작용을 피하기 위해 실행하지 않았습니다. 5xx 의미는 Mock 결과미상과 정적 WEBFEP 503 회귀로 검증했습니다.

## Android Emulator

환경: Android 16/API 36, Chrome 133.0.6943.137, portrait CSS 412px.

- 홈·남성 목록·검색 빈 상태·상품 상세·로그인·guest checkout을 실제 Chrome에서 실행했습니다.
- 모든 경로에서 `scrollWidth=clientWidth`, 주요 컨트롤 viewport 이탈 0, 깨진 이미지 0이었습니다.
- 상품 상세는 reload와 목록 왕복 뒤로가기를 통과했습니다.
- font scale 2.0에서 홈·상품 상세·로그인 overflow·clipping 0이었습니다.
- 가로모드 CSS 866px에서 같은 세 경로 overflow·clipping 0이었습니다.
- Chrome 강제종료·재실행 후 페이지가 정상 복구됐습니다.
- background→foreground 후 상품 상세 URL과 화면이 유지됐습니다.
- 네트워크 offline에서 요청이 차단되고 복구 후 홈이 정상 로드됐습니다. offline 중 console의 `ERR_INTERNET_DISCONNECTED`와 RSC fallback 오류는 주입된 네트워크 실패 증거이며 제품 결함으로 판정하지 않았습니다.

## iOS Simulator MobileSafari

환경: iOS 26.5, `LAON QA iPhone 17 Pro`, 실제 MobileSafari/WebKit, 논리 폭 약 402px.

- 상품 상세의 동일 타탄 SKU 대표컷, 로그인, guest checkout→login을 실제 화면으로 확인했습니다.
- 헤더·내비·입력·CTA·상품 이미지에서 가로 잘림이나 겹침을 발견하지 못했습니다.
- 시스템 content size `accessibility-extra-extra-extra-large`에서도 로그인 화면의 입력·CTA·가입 링크가 잘리지 않았습니다.
- Safari 원격 자동화가 꺼져 있어 WebDriver 세션을 생성할 수 없었습니다. 관리자 암호를 요구하는 활성화는 시도하지 않았습니다.
- 따라서 iOS의 인증 Mock 전체 생명주기, 자동 DOM 치수, 뒤로가기·가로모드·네트워크 단절은 **NOT EXECUTED**입니다.

## 앱·WebView 범위

- 이 저장소에는 Android/iOS 네이티브 앱, Flutter, React Native 또는 WebView 셸이 없습니다.
- `ENV_INVENTORY.md`도 App Store/Google Play와 모바일 앱을 해당 없음으로 명시합니다.
- 실제 검증 대상은 desktop web, Android Chrome, iOS MobileSafari입니다.
- 앱/WebView 항목은 제품 실패가 아니라 **NOT APPLICABLE**입니다. 별도 LAON 앱에서 WebView를 제공한다면 해당 저장소와 빌드의 독립 인계가 필요합니다.

## 배포·운영 상태

- Vercel production 배포 `dpl_7ZstF18BrWiiJuwwNJnWLpeYnrJS`는 `READY`입니다.
- 배포 Git SHA는 현재 HEAD `54322eb6cca456efcadf9e3f9d8cd9ddb71b89f3`와 일치합니다.
- `laonshop.com`, `www.laonshop.com`이 production alias입니다.
- 최근 1시간 runtime error cluster 0건, 해당 배포 error/fatal 로그 0건입니다.

## 발견 사항

### QA-543-OBS-01 - 등록 submit 자동화 더블클릭 후 초기화 관찰

- 우선순위: P3 관찰, 미확정
- 재현: 412px 빌링 등록 모달의 `카드 등록하기`에 locator 기반 `dblclick()`을 실행했습니다.
- 실제: 첫 등록 뒤 같은 좌표에 나타난 초기화 명령이 두 번째 합성 클릭을 받은 것으로 보이며 상태가 초기화됐습니다.
- 기대: 빠른 이중 입력에서도 등록 상태가 유지돼야 합니다.
- 코드 근거: `registrationLockedRef`가 같은 등록 handler의 재진입은 차단하지만 DOM 교체 뒤 노출되는 초기화 버튼의 별도 클릭은 막지 않습니다.
- 독립 재현: 고정 좌표 입력은 브라우저 제어 좌표 제약으로 완료하지 못했습니다. 일반 단일 클릭, 조회·승인·해지 이중 클릭은 모두 정상입니다.
- 판정: 실제 사용자 결함으로 확정하지 않고 후속 실제 터치/마우스 더블클릭 회귀 대상으로 남깁니다. 출시 차단 근거로 사용하지 않습니다.

신규 확정 제품 결함 P0/P1/P2/P3는 0건입니다.

## 외부 blocker와 시연 표현

- KSNET 공식 문서 콘솔의 공용 테스트 MID 등록→조회→결제→취소→해지 PASS는 별도 개발계 시연 증거입니다.
- 라온샵 Mock PASS 또는 공식 콘솔 PASS를 라온샵 서버 직접 빌링 연동 PASS로 표현하면 안 됩니다.
- 실제 빌링 준비 blocker는 전용 개발 pgapi의 안전한 전달, LAONPAY 호스팅 등록/API, opaque `paymentMethodId` 계약, 서버 소유권·멱등성·UNKNOWN 대사와 토큰 보안 저장입니다.
- 통신판매업신고번호 `신고 예정`도 카드사 심사·정식 판매 전 외부 완료 항목입니다.

## cleanup

- 빌링 Mock sessionStorage를 초기화하고 모달을 닫았습니다.
- Android font scale 1.0, portrait 자동 회전과 user rotation 0으로 복구했습니다.
- Android CDP 포워딩을 제거했습니다.
- iOS content size를 원래 `large`로 복구했습니다.
- SafariDriver 서버와 Chrome QA 제어 세션을 종료했습니다.
- QA 임시 스크립트·API 응답·스크린샷을 삭제했습니다.
- DB fixture를 만들지 않았고 최종 DB 기준선이 시작값과 일치합니다.
- 운영 데이터, Vercel 설정, PG 상태 변경은 없습니다.

## 최종 판정

현재 HEAD는 정적 전체 회귀, 운영 desktop/mobile web, 지정 계정의 빌링 Mock 세 상태, Android 실제 Chrome과 DB/Vercel 무변경 경계를 통과했습니다. 따라서 **운영 Chrome 또는 Android Chrome을 이용한 브라우저 Mock 심사 시연은 조건부 GO**입니다.

그러나 iOS 인증 Mock과 일부 iOS 상호작용을 실행하지 못했고 실제 빌링 서버 연동은 외부 blocker로 미구현입니다. 필수 규칙에 따라 전체 결과는 **PARTIAL**이며, 실제 원클릭 결제 출시와 플랫폼 전체 PASS 표기는 **NO-GO**입니다.
