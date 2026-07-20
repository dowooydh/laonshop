# LAONPAY 등록카드 연동 준비 회귀 보고서

작성일: 2026-07-21

검증 제품 SHA: `d987441eac4ad4dc4fcdb2eee68e54c0976566d0`

비교 기준: 제품 `cc19a4b82544f73703990a5dcf5f266e4add6d4d` / QA `969ed0ab892401a6eb55c74494831d67d5d4510c`

운영 배포: `dpl_8yZRvLa5WcxtYA9im8GsgyNsF5dM` / `https://laonshop.com`

결과: **PARTIAL**

## 판정

- 신규 P0/P1/P2 제품 결함: **없음**
- Ed25519 계약, strict parser, schema gate, 격리 생명주기: **PASS**
- 첫 charge POST 동시성, UNKNOWN 대사, stale 단일 claim: **PASS**
- LAONPAY 비활성 운영과 일반 KSPAY 경로: **GO**
- LAONPAY hosted 등록·원클릭 실제 활성화: **HOLD**
- 실제 모바일 인증 설정·체크아웃 전 과정과 실 LAONPAY/KSNET 상호운용: **미실행**

핵심 계약과 동시성은 격리 환경에서 통과했습니다. 다만 운영 schema/env/key가 의도적으로 닫혀 있고 Android/iOS의 인증된 등록카드 화면 전 과정 및 실제 hosted/API 상호운용을 실행하지 않았으므로 전체 PASS로 판정하지 않습니다.

## 검증 환경

| 구분 | 환경 |
| --- | --- |
| 저장소 | `/Users/donghyuk/Projects/laonshop`, `main=origin/main=d987441` |
| 런타임 | Node 22.23.1, pnpm 11.5.3 |
| 로컬 앱 | Next 15.5.19 production build, HTTPS custom server |
| 격리 DB | 임시 PostgreSQL 17, 현재 Prisma schema 및 additive SQL |
| LAONPAY 대역 | 로컬 HTTPS Ed25519 검증 stub, 실제 PG 호출 없음 |
| 데스크톱 브라우저 | Chromium/Chrome, 320/360/375/390/412/768/1280px, 루트 글자 100%/200% |
| Android | Android 16/API 36 emulator, Chrome 133.0.6943.137, CSS 412px, font scale 1.0 |
| iOS | iOS 26.5 Simulator, 실제 MobileSafari, 논리 화면 약 402x874 |
| 운영 | Vercel production `dpl_8yZRvLa5WcxtYA9im8GsgyNsF5dM`, sin1 |

## 실행 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 전체 테스트 | PASS | `pnpm test` 125/125, fail 0, skip 0 |
| HTTP 상호운용 | PASS | `pnpm test:billing:interop` 2/2 |
| schema harness | PASS | additive SQL 2회 적용, post-verify, negative checks |
| 운영 gate preflight | PASS | `--allow-closed`, 모든 gate CLOSED, 값 출력 없음 |
| 정적 검증 | PASS | lint, typecheck, Prisma validate, production audit 0건 |
| production build | PASS | Next 15.5.19, static generation 20/20 |
| 이미지 gate | PASS | 상품 329개/1,316장, 큐레이션 20상품/100장 |
| 첫 charge 병렬 | PASS | 900ms 지연, 외부 POST 1, 최대 동시 활성 1, 최종 `PAID+attempts=1` |
| checkout/refresh 교차 | PASS | 6초 in-flight 중 POST 1, 최종 `PAID+attempts=1` |
| UNKNOWN 대사 | PASS | 첫 503 후 `UNKNOWN+1`, 병렬 대사 중 한 claim, 총 POST 2·최대 동시 1, 최종 `PAID+2` |
| stale/provider 경계 | PASS | fresh·5분-1초 POST 0, 5분+1초 claim 1; provider ID는 POST 0/GET 1 |
| 비활성 UI | PASS | 14개 폭/글자 조합, 등록카드·수기 미노출, 일반 KSPAY 4수단 유지 |
| 운영 배포 | PASS | READY/production, SHA·alias 일치, runtime error와 배포 error/fatal 0 |
| Android 공개 스모크 | PARTIAL | 공개 5경로와 상품 DOM PASS, 뒤로가기 완료 신호 timeout |
| iOS 공개 스모크 | PARTIAL | 홈 렌더와 guest checkout→login 시각 PASS, 인증 UI 미실행 |
| Cleanup | PASS | 격리 DB 9종 0, listener·포워드·임시 파일 0 |

## 계약과 보안 경계

다음 항목을 코드, 단위 테스트, loopback HTTP 상호운용으로 대조했습니다.

- POST canonical은 7줄이며 lowercase UUID `Idempotency-Key`가 header와 서명에 동일하게 결박됩니다.
- GET canonical의 멱등키 줄은 비어 있고 `Idempotency-Key` header를 보내지 않습니다.
- 응답 유실 대사는 같은 key와 byte-identical body를 사용하고 timestamp, nonce, 서명만 새로 만듭니다.
- API base와 hosted URL은 exact HTTPS origin 및 허용 path/token/registration ID에 결박됩니다.
- 408/425/5xx/timeout, malformed JSON, 64KiB 초과, UNKNOWN은 새 등록·승인·해지·취소를 자동 실행하지 않습니다.
- 카드 원문, KSNET `billingToken`, provider envelope, MID/pgapi/private key는 브라우저와 일반 DB 필드에 저장하지 않는 구조입니다.
- 등록 return query는 힌트로만 취급하고 HttpOnly cookie와 local registration ID 대조 뒤 signed GET을 source of truth로 사용합니다.
- 결제수단 최대 10개, 성공하지 않은 registration의 `paymentMethod=null`, cancel 상태쌍 strict 검증을 유지합니다.

금지된 실제 카드정보, 실 PG, 운영 DB write, Vercel env/schema 변경은 실행하지 않았습니다.

## 격리 생명주기

`pnpm test:billing:interop`의 loopback HTTPS 서버에서 다음 순서를 실제 HTTP로 실행했습니다.

1. 등록 intent 생성
2. signed registration status 조회
3. opaque payment method 목록 조회
4. charge 생성과 charge status 조회
5. 전체취소 요청과 cancel request signed GET
6. payment method 등록 해지

정상 흐름은 각 resource ID와 상태 결박을 통과했습니다. 503, timeout, UNKNOWN 흐름에서는 자동 POST 재시도가 발생하지 않았습니다.

schema harness는 임시 PostgreSQL에 additive SQL을 두 번 적용하고 exact post-verify와 누락/잘못된 schema negative check를 통과했습니다. destructive SQL은 발견되지 않았고 기존 legacy `billingToken` 물리 컬럼은 유지됐습니다.

## 청구 동시성

### 첫 요청 in-flight

1. order와 charge를 최초 claim 가능한 상태로 준비했습니다.
2. LAONPAY charge POST 응답을 900ms 지연했습니다.
3. 같은 주문 상태 조회를 병렬 두 건 실행했습니다.
4. stub 요청 수, 활성 요청 수, DB attempts와 최종 상태를 직접 조회했습니다.

결과:

- 첫 응답 전과 완료 뒤 charge POST 총 1회
- 최대 동시 활성 POST 1회
- 최종 order `PAID`
- 최종 charge `PAID`, `requestAttempts=1`
- 중복 order/charge 0

checkout 최초 POST를 6초 지연하고 주문 refresh를 교차 실행한 경우에도 POST는 1회였고 최종 `PAID+attempts=1`로 수렴했습니다.

### UNKNOWN과 stale

- 첫 POST 503 뒤 원장은 `PENDING + UNKNOWN + attempts=1`, provider ID 없음으로 남았습니다.
- 병렬 reconciliation은 한 요청만 claim했고, 최초 포함 총 POST 2회·최대 동시 활성 1회였습니다.
- 동일 idempotency key와 request fingerprint를 유지해 최종 `PAID+attempts=2`로 수렴했습니다.
- fresh `REQUESTING+1`과 5분-1초 상태는 POST 0회였습니다.
- 5분+1초 stale 상태는 한 reconciliation claim만 획득했습니다.
- provider charge ID가 이미 있으면 POST 0회, signed GET 1회였으며 GET에는 멱등키 header가 없었습니다.

여러 시나리오에서 stub이 같은 remote charge ID를 재사용하면서 발생한 로컬 unique 충돌은 실제 계약에 없는 QA stub 데이터 오류로 분리했습니다. 시나리오별 초기화 후 핵심 POST 횟수와 동시성 판정에는 영향을 주지 않았습니다.

## 비활성 운영과 UI

LAONPAY env를 주입하지 않은 로컬 production 서버와 인증 fixture에서 설정·체크아웃을 검증했습니다.

- 320/360/375/390/412/768/1280px × 루트 글자 100%/200%, 총 14조합
- 설정: 연동 준비 안내 노출, 카드 등록 명령·카드 원문 입력 0
- 체크아웃: 카드·카카오페이·네이버페이·실시간계좌이체 노출
- 등록카드 결제와 수기결제 미노출
- 모든 조합 document 가로 overflow 0, 조작 가능한 descendant viewport 이탈 0
- target page console/page error 0
- LAONPAY stub POST 0, GET 0
- DB count 전후 불변

로컬 로그인 redirect 직후 과거 Vercel deployment query를 가진 chunk를 잠시 요청한 현상은 custom HTTPS host 변환 하네스에서만 재현됐습니다. 새 target page를 직접 연 뒤 현재 빌드 chunk와 기능을 검증했고, 운영 Vercel runtime 오류는 0이므로 제품 결함으로 판정하지 않았습니다.

## 모바일 스모크

### Android Emulator Chrome

- 홈, 남성/여성 목록, 검색, 로그인과 상품 상세를 실제 Chrome 133에서 열었습니다.
- 공개 5경로의 document `scrollWidth=clientWidth=412`, visible descendant 이탈 0, broken image 0을 확인했습니다.
- 상품 상세는 5장 이상 이미지를 로드했고, 문서 가로 overflow와 broken image가 없었습니다.
- 새로고침은 성공했습니다.
- 뒤로가기는 실제 `/shop/men`으로 이동했으나 CDP의 `domcontentloaded` 완료 대기가 timeout되어 도구 제약으로 분리했습니다.
- QA가 만든 탭만 닫고 adb forward를 제거했습니다. 기존 사용자 탭과 데이터는 건드리지 않았습니다.

### iOS Simulator MobileSafari

- 실제 MobileSafari에서 홈을 열어 402x874 논리 화면 기준 헤더, 히어로, CTA가 viewport 안에 표시되는 것을 확인했습니다.
- guest `/checkout`은 로그인 화면으로 이동했고 입력·버튼이 화면 안에 표시됐습니다.
- 인증된 설정·체크아웃, DOM 기반 200% 측정, product detail, BFCache/background 전 과정은 실행하지 않았습니다.

## 운영 배포

- Vercel deployment `dpl_8yZRvLa5WcxtYA9im8GsgyNsF5dM`
- fixed URL `https://laonshop-3loawevt1-customorder.vercel.app`
- state `READY`, target `production`, region `sin1`
- Git SHA `d987441eac4ad4dc4fcdb2eee68e54c0976566d0`
- `laonshop.com`, `www.laonshop.com` alias 연결, aliasError 없음
- 최근 1시간 runtime error cluster 0
- 해당 배포 error/fatal log 0

## 미실행 및 외부 blocker

- 운영 additive migration, exact post-verify, LAONPAY partner key/public key, API base와 feature readiness env는 미적용입니다.
- LAONPAY hosted 카드 입력, 실제 partner API 상호운용, KSNET billing 권한·개발 pgapi와 실 PG 승인은 미실행입니다.
- Android/iOS 인증 설정·체크아웃 전 과정, 정확한 플랫폼 200% 글자, 가로모드, background/복귀, 강제종료/재실행, 모바일 네트워크 단절/복구는 미실행입니다.
- 실제 카드, 실 PG, 운영 DB write, env/schema 변경, 메시지 발송은 실행하지 않았습니다.

위 항목은 이번 SHA에서 발견한 제품 결함이 아니라 활성화 및 플랫폼 최종 검증 선행 조건입니다.

## Cleanup

- 격리 DB의 user/product/order/item/registration/payment method/charge/cancel request/audit count를 모두 0으로 복원했습니다.
- custom Next server, LAONPAY HTTPS stub, PostgreSQL을 정상 종료했습니다.
- 일회성 Ed25519/TLS 키, fixture, preload, browser runner, DB cluster, screenshot과 cache를 삭제했습니다.
- port 3453, 3454, 55434, 9222 listener가 모두 닫힌 것을 확인했습니다.
- Android font scale 1.0, 자동 회전 활성 상태를 확인했고 adb forward를 제거했습니다.
- 운영 DB, Vercel env/schema, LAONPAY/PG 상태와 제품 코드는 변경하지 않았습니다.

## 출시 판단

현재 운영처럼 LAONPAY 등록카드 기능을 닫고 일반 KSPAY만 제공하는 배포는 **GO**입니다. 이번 회귀에서 신규 차단 결함은 발견하지 못했습니다.

LAONPAY 등록카드 기능의 실제 활성화는 운영 migration/env/key, 양측 readiness, 실제 hosted/API·KSNET 격리 상호운용과 인증 모바일 전 과정이 끝날 때까지 **HOLD**입니다.
