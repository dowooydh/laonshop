# QA 핸드오프 최신본

작성일: 2026-07-21

검증 제품 SHA: `d987441eac4ad4dc4fcdb2eee68e54c0976566d0`

비교 기준: 제품 `cc19a4b82544f73703990a5dcf5f266e4add6d4d` / QA `969ed0ab892401a6eb55c74494831d67d5d4510c`

운영 배포: `dpl_8yZRvLa5WcxtYA9im8GsgyNsF5dM` / `https://laonshop.com`

결과: **PARTIAL**

## 판정

- 신규 P0/P1/P2 제품 결함: **없음**
- LAONPAY 계약·격리 생명주기·청구 동시성: **PASS**
- 현재 LAONPAY 비활성 운영과 일반 KSPAY 경로: **GO**
- LAONPAY hosted 등록·원클릭 실제 활성화: **HOLD**
- Android/iOS 인증 등록카드 전 과정과 실 hosted/API·KSNET 상호운용: **미실행**

상세 증거는
[`2026-07-21-d987441-laonpay-billing-integration-regression.md`](../reports/2026-07-21-d987441-laonpay-billing-integration-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | 전체 125/125, skip 0, lint/typecheck/prisma/audit/build |
| HTTP 상호운용 | PASS | 등록→status→목록→charge/status→cancel GET→해지 2/2 |
| schema harness | PASS | additive SQL 2회, post-verify, negative checks |
| preflight | PASS | 운영 gate 모두 CLOSED, 값 출력 없음 |
| 첫 charge 병렬 | PASS | 900ms 지연 중 POST 1, 최대 동시 1, 최종 `PAID+attempts=1` |
| checkout/refresh 교차 | PASS | 6초 in-flight 중 POST 1, 최종 `PAID+attempts=1` |
| UNKNOWN 대사 | PASS | 첫 503 후 `UNKNOWN+1`, 총 POST 2·최대 동시 1, 최종 `PAID+2` |
| stale/provider 경계 | PASS | fresh·5분-1초 POST 0, 5분+1초 claim 1, provider ID는 POST 0/GET 1 |
| fail-closed UI | PASS | 7폭 × 100%/200%, LAONPAY 요청 0, 일반 KSPAY 4수단 유지 |
| Android Chrome | PARTIAL | 공개 경로·상품 DOM PASS, back 완료 신호 도구 timeout |
| iOS MobileSafari | PARTIAL | 홈 및 guest checkout→login 시각 PASS, 인증 UI 미실행 |
| 운영 배포 | PASS | READY, SHA·alias 일치, runtime/error/fatal 0 |
| Cleanup | PASS | 격리 DB 9종 0, listener·forward·임시 파일 0 |

## 계약·동시성

- Ed25519 7줄 canonical, POST lowercase UUID 멱등키 결박, GET 빈 멱등키 줄/no header를 대조했습니다.
- 응답 유실 대사는 same key + byte-identical body와 fresh timestamp/nonce/signature를 사용합니다.
- exact HTTPS origin, hosted path/token/registration intent, strict response/status parser가 변조를 fail-closed 합니다.
- 408/425/5xx/timeout/malformed/64KiB 초과/UNKNOWN은 자동 재등록·재승인·재해지·재취소를 만들지 않습니다.
- 첫 charge POST를 900ms 지연하고 병렬 조회 두 건을 실행해 외부 POST 1회와 최대 동시 활성 1회를 직접 확인했습니다.
- checkout POST 6초 지연과 order refresh 교차에서도 POST는 1회였습니다.
- `UNKNOWN+attempts=1` 병렬 대사는 한 요청만 claim했고 총 attempts 2로 수렴했습니다.
- fresh `REQUESTING+1`과 5분-1초는 POST 0, 5분+1초는 claim 1이었습니다.
- provider ID가 있으면 새 POST 없이 signed GET 1회만 수행했습니다.

## 운영 fail-closed

LAONPAY env를 주입하지 않은 local production과 인증 fixture에서 아래를 확인했습니다.

- 320/360/375/390/412/768/1280px × 루트 글자 100%/200%
- 설정의 연동 준비 안내, 카드 등록 명령과 카드 원문 입력 0
- 체크아웃의 카드·카카오페이·네이버페이·실시간계좌이체 유지
- 등록카드 결제·수기결제 미노출
- document/descendant 가로 overflow 0, target console error 0
- LAONPAY stub POST 0/GET 0, DB count 불변

Vercel production은 `d987441`과 일치하며 최근 1시간 runtime error cluster와 해당 배포 error/fatal log가 0입니다.

## 모바일

- Android 16/API 36 Chrome 133: 홈, 남성/여성, 검색, 로그인, 상품 상세의 CSS width 412, broken image 0, document overflow 0을 확인했습니다.
- 상품 상세는 5장 이상 이미지를 로드하고 새로고침을 통과했습니다.
- Android 뒤로가기는 `/shop/men` 이동을 확인했지만 CDP 완료 대기가 timeout됐습니다. 제품 실패가 아닌 도구 제약으로 분리했습니다.
- iOS 26.5 MobileSafari: 홈의 헤더·히어로·CTA가 화면 안에 표시되고 guest checkout이 login으로 이동했습니다.
- 인증된 Android/iOS 설정·체크아웃, 플랫폼 200%, 가로모드, BFCache/background, offline/reconnect는 미실행입니다.

## 외부 blocker

- 운영 additive migration과 post-verify 미실행
- LAONPAY partner key/public key/API base/readiness env 미설정
- LAONPAY hosted/API와 KSNET billing 권한·개발 pgapi 상호운용 미실행
- 실카드, 실 PG, 운영 DB write, Vercel env/schema 변경 미실행

위 항목은 이번 제품 결함이 아니라 활성화 선행 조건입니다. 실제 LAONPAY 기능은 완료 전까지 HOLD입니다.

## Cleanup

- 격리 DB user/product/order/item/registration/payment method/charge/cancel request/audit를 모두 0건으로 복원했습니다.
- Next server, HTTPS stub, PostgreSQL을 종료했습니다.
- 일회성 key/cert, fixture, runner, DB cluster, screenshot, cache를 삭제했습니다.
- port 3453/3454/55434/9222가 닫혔고 adb forward가 없는 것을 확인했습니다.
- Android font scale 1.0과 자동 회전 활성 상태를 확인했습니다.
- 운영 DB/env/schema/PG와 제품 코드는 변경하지 않았습니다.

## 개발 작업 전달

제품 `d987441`은 정적 125/125, loopback 생명주기, 실제 임시 PostgreSQL schema harness, 지연 병렬 charge/UNKNOWN/stale/provider 경계와 비활성 UI 회귀를 통과했습니다. 신규 차단 결함은 없습니다.

따라서 현재 fail-closed 운영과 일반 KSPAY는 **GO**입니다. 다만 실제 등록카드 활성화는 외부 readiness와 양측 hosted/API·KSNET 상호운용, 인증 모바일 전 과정이 끝날 때까지 **HOLD**입니다.
