# 91094a7 LAONPAY 빌링 계약 보강 회귀 QA 보고서

작성일: 2026-07-18

담당: Codex QA/테스트 세션

이전 제품 기준: `78bb51b8f2e779e4bc62fd69a3f9a0c0b956e6d0`

검증 제품 SHA: `91094a76ac97e3c98d73d071515918b58864daf4`

비교 범위: `78bb51b8f2e779e4bc62fd69a3f9a0c0b956e6d0..91094a76ac97e3c98d73d071515918b58864daf4`

대상 배포: `dpl_FkbAehHUJJytLRHRcp9LfZqzQcLN` / `https://laonshop.com`

결과: **PARTIAL**

출시 판정:

- 현재 fail-closed 운영 배포 유지: **GO**
- LAONPAY 연동 준비용 계약 코드: **조건부 GO**
- 실제 hosted 등록·원클릭 결제·취소 활성화: **NO-GO**

## 범위와 안전 경계

- 제품 코드를 수정하지 않았습니다.
- 실카드, 실 PG, paydev, 운영 DB write, Prisma schema push와 Vercel env 변경을 실행하지 않았습니다.
- 운영 브라우저에서는 설정 조회와 checkout 결제수단 표시까지만 확인하고 주문·결제를 제출하지 않았습니다.
- 비밀키, 세션 쿠키, 카드 원문, provider token, MID와 Authorization 값을 출력하거나 보관하지 않았습니다.
- 시작 시 `main=origin/main=91094a7`, clean 상태와 대상 배포 SHA 일치를 확인했습니다.

## 독립 코드리뷰

### 요청 서명과 멱등성

- canonical은 `v1`, method, query 포함 path, timestamp, nonce, idempotency key 또는 빈 줄, body SHA-256의 정확한 7줄입니다.
- POST UUID `Idempotency-Key`는 소문자로 정규화되어 HTTP header와 canonical 양쪽에 같은 값으로 결박됩니다.
- GET은 canonical 여섯 번째 줄을 비우며 `Idempotency-Key` header를 전송하지 않습니다.
- 응답 유실 reconciliation은 최초 요청과 같은 key/body를 사용하고 timestamp, nonce와 서명만 새로 생성합니다.
- key 또는 body가 달라지면 기존 서명을 재사용할 수 없고 strict parser 실패는 외부 상태나 DB 상태를 성공으로 확정하지 않습니다.

### 등록·취소 계약

- hosted URL은 설정된 API base와 exact HTTPS same-origin이며 등록 intent ID와 43자 base64url 서명이 포함된 고정 path만 허용합니다.
- credential, query, hash, 다른 port, 다른 origin, 다른 registration intent는 거부합니다.
- 등록 복귀 query는 힌트로만 사용하며 HttpOnly cookie와 로컬 registration ID를 대조한 뒤 signed GET 결과만 신뢰합니다.
- 외부 cancel request ID가 있으면 전용 signed GET이 source of truth이고, ID가 유실된 경계에서만 charge GET fallback을 사용합니다.
- cancel request와 charge 상태쌍을 strict parser로 검증하며 extra/missing field와 불가능한 조합은 fail-closed입니다.
- `DONE`과 `REJECTED` 대사는 cancel request, billing charge와 주문을 같은 DB transaction에서 갱신합니다.
- 반려 사유는 React text로 렌더되며 빈 값에는 일반 안내가 적용되어 HTML로 삽입되지 않습니다.

### 금액·소유권·재시도

- charge 금액은 브라우저 입력이 아니라 DB의 주문과 상품 가격으로 재계산합니다.
- 사용자, 주문, payment method와 charge 소유권을 서버에서 재검증합니다.
- UNKNOWN, timeout, 5xx와 응답 파싱 실패는 자동 재결제·해지·취소 재호출로 전환하지 않습니다.
- 주문, LAONPAY marker와 charge 생성은 원자 경계에 있고 다른 결제수단의 기존 PENDING 주문도 중복 결제를 차단합니다.

독립 리뷰에서 신규 P0/P1/P2/P3 제품 결함은 발견하지 못했습니다.

## 정적·클라이언트 스텁 검증

Node 22.23.1, pnpm 11.5.3 기준으로 현재 SHA에서 재실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| focused billing tests | PASS | 46/46, fail 0, skip 0 |
| `pnpm test` | PASS | 97/97, fail 0, skip 0 |
| 이미지 gate | PASS | 329상품/1,316장, 큐레이션 20상품/100장 |
| `pnpm lint` | PASS | 오류·경고 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, production build와 BUILD_ID 생성 |

focused test의 실제 HTTP stub은 다음을 단정합니다.

- canonical exact bytes와 POST key/header/signature 결박
- GET idempotency header 부재와 빈 canonical line
- invalid env·hosted URL·응답 shape에서 fetch 또는 성공 확정 차단
- timeout, 503, malformed/64KiB 초과 응답의 UNKNOWN 처리
- same-key/same-body reconciliation과 fresh timestamp/nonce/signature
- cancel-request GET의 strict 상태쌍과 foreign/extra/missing field 거부

## 운영 Chrome 검증

기존 지정 심사 계정 인증 세션을 사용했으며 credential과 cookie는 읽거나 출력하지 않았습니다.

### 설정

- `/mypage/settings`는 LAONPAY 준비 전 안내를 명확히 표시했습니다.
- hosted 카드 등록 버튼, 카드 원문 입력, opaque payment method 목록은 노출되지 않았습니다.
- 브라우저 resource 목록에 LAONPAY/billing API 요청이 없고 console warning/error와 Next error overlay는 0건입니다.

### Checkout

- 기존 카드, 카카오페이, 네이버페이, 실시간 계좌이체 4개 KSPAY 수단이 유지됐습니다.
- oneclick과 수기결제 수단은 0건이었습니다.
- 동의 또는 결제 submit을 실행하지 않아 주문, PG와 DB 상태를 변경하지 않았습니다.

### 반응형

- 설정과 checkout을 320/360/390/412px에서 확인했습니다.
- 모든 폭에서 `document.scrollWidth=clientWidth`, 주요 visible descendant의 viewport 이탈 0, Next error overlay 0이었습니다.
- 설정은 등록 버튼 0, 카드 원문 input 0을 유지했고 checkout은 일반 KSPAY 4수단을 유지했습니다.
- 브라우저 제어에서 exact 200% zoom 상태를 확정하지 못해 Chrome 200%는 **NOT EXECUTED**로 분리했습니다.

## Android Emulator

환경: `emulator-5554`, Android API 36, 실제 Chrome, 화면 약 411x914.

- guest 상태에서 `/mypage/settings` 접근이 `/login`으로 전환됐습니다.
- 기본 font scale에서 로그인 폼, 헤더와 내비가 화면 폭 안에 렌더됐습니다.
- system font scale `2.0`에서 같은 guest 흐름을 재실행했고 로그인 input, 보기 버튼, submit, 회원가입 링크와 내비에서 가로 잘림을 발견하지 못했습니다.
- UIAutomator가 최초 로딩 중 한 번 `null root node`를 반환했으나 대기 후 화면과 accessibility hierarchy가 정상 생성됐습니다. 제품 실패로 판정하지 않았습니다.
- 인증된 등록 복귀·확인대기·취소 상태 UI는 모바일 인증 세션이 없어 **NOT EXECUTED**입니다.

## iOS Simulator MobileSafari

환경: iOS 26.5, `LAON QA iPhone 17 Pro`, 실제 MobileSafari/WebKit, 논리 폭 약 402px.

- guest 상태에서 `/mypage/settings` 접근이 로그인 화면으로 전환됐습니다.
- 기본 content size와 `accessibility-extra-extra-extra-large`에서 헤더, 내비, 로그인 input, 보기 버튼, submit과 가입 링크가 화면 폭 안에 유지됐습니다.
- exact 200% browser zoom과 인증된 등록 복귀·확인대기·취소 상태 UI는 **NOT EXECUTED**입니다.

## 배포·운영 상태

- Vercel production 배포 `dpl_FkbAehHUJJytLRHRcp9LfZqzQcLN`은 `READY`입니다.
- 배포 Git SHA는 local/origin HEAD `91094a76ac97e3c98d73d071515918b58864daf4`와 일치합니다.
- `laonshop.com`, `www.laonshop.com`이 production alias이고 `www`는 apex로 308 전환됩니다.
- 고정 배포 URL은 Vercel SSO 보호가 적용돼 비인증 직접 접근 시 302였으며 제품 결함으로 보지 않았습니다.
- 최근 1시간 runtime error cluster 0건, 해당 배포 error/fatal 로그 0건입니다.

## 발견 결함

신규 확정 제품 결함은 없습니다.

운영에서 hosted 등록과 oneclick이 보이지 않는 것은 LAONPAY env와 schema가 의도적으로 미적용된 현재의 정상 fail-closed 상태입니다.

## 미실행·외부 blocker

- LAONPAY 최종 제품 SHA와 hosted/API readiness를 사용한 실제 상호운용 E2E
- 운영 또는 격리 DB에 신규 Prisma schema를 적용한 주문+marker+charge·취소 대사 transaction E2E
- Vercel LAONPAY 3개 env 설정 뒤 등록 return과 signed API 왕복
- 인증된 Android/iOS의 등록 복귀·UNKNOWN·취소 상태 화면
- Chrome/iOS exact 200% browser zoom
- 실카드, 실 PG 승인·취소·해지와 운영 DB write

미실행 항목은 제품 결함이 아니라 인증 세션, 미적용 schema/env와 외부 LAONPAY readiness 제약입니다.

## Cleanup

- Chrome viewport와 Chrome/in-app Browser 제어 세션을 정리했습니다.
- Android font scale을 원래 `1.0`으로 복구하고 기기·로컬 임시 캡처를 삭제했습니다.
- iOS content size를 원래 `large`로 복구하고 임시 캡처를 삭제했습니다.
- QA DB fixture, 주문, 카드, audit와 외부 LAONPAY resource를 생성하지 않았습니다.
- 운영 데이터, Vercel env, Prisma schema와 PG 상태 변경은 없습니다.

## 최종 판정

제품 SHA `91094a7`은 서명·멱등·hosted URL·취소 조회 계약의 정적/HTTP stub 회귀와 env 미준비 운영의 fail-closed Chrome 동작을 통과했습니다. 현재 운영 배포를 비활성 상태로 유지하는 것은 **GO**이며, 코드 계약은 실제 LAONPAY 통합 검증을 시작할 수 있는 **조건부 GO**입니다.

다만 신규 schema/env가 적용되지 않았고 LAONPAY 양측 실제 상호운용 및 인증 모바일 상태 화면을 실행하지 못했습니다. 필수 핵심 화면을 한 플랫폼이라도 실행하지 못하면 전체 PASS가 아니라는 기준에 따라 결과는 **PARTIAL**이며, 실제 hosted 등록·원클릭 결제·취소 활성화는 **NO-GO**입니다.
