# fbc2312 Safari·에뮬레이터·KSNET 개발계 빌링 추가 QA 보고서

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상 제품 커밋: `fbc2312d0ded7a66ebab4a929a15a08fdf16e63f`

QA 시작 HEAD: `15cb38ceb166e51597b57bfc444289709313d83a`

결과: **PASS**

출시 판정: **GO - 현재 fail-closed 결제 정책과 Safari·모바일 공개 흐름 통과**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다. `fbc2312..15cb38c`의 차이는 기존 QA 보고서와 핸드오프 문서뿐입니다.
- 운영 공개 페이지는 읽기 전용으로 검증했고 운영 DB, Vercel env·도메인, 실 MID·실카드·운영 결제를 변경하지 않았습니다.
- 보호 화면은 로컬 QA 전용 사용자와 과거 mock 카드 1건으로 검증한 뒤 시작 기준선으로 복원했습니다.
- KSNET 공식 문서의 개발계 테스트요청, 테스트 MID `2999199999`, 공식 테스트 데이터만 사용했습니다.
- 카드번호·유효기간·비밀번호 앞자리·사용자 식별정보·Authorization 값은 보고서·스크린샷·커밋에 남기지 않았습니다. billingToken, TID, 승인번호, aid는 필요한 경우에만 일부 마스킹했습니다.

## 기준 상태와 정적 검증

- 기존 QA 커밋 `15cb38c`에서 Vercel production deployment `dpl_5CMGXFRSMUG9LDSeFe71mhrgmKRX`가 `READY`, 제품 Git SHA `fbc2312`, apex/www alias 일치로 검증돼 있었습니다.
- 이번 추가 회귀 직전 `HEAD=origin/main=15cb38c`, 작업 트리는 clean이었고 제품 커밋 이후 제품 코드 변경은 없었습니다.
- fresh public smoke에서 `https://laonshop.com`, `https://www.laonshop.com`은 HTTP 200이었습니다.
- Node 22.23.1, pnpm 11.5.3에서 `pnpm test` 50/50, skip 0, 이미지 파이프라인 2/2, lint, typecheck, Prisma validate, production audit, build, `git diff --check`가 통과했습니다.
- `AGENTS.md`와 `CLAUDE.md`는 바이트 단위로 동일합니다.

## iOS Simulator Mobile Safari

환경: iPhone 17 Pro Simulator, iOS 26.5, 실제 MobileSafari/WebKit, 논리 화면 약 402x874.

| 시나리오 | 결과 | 증거 |
| --- | --- | --- |
| 홈·남성·여성·검색·로그인 | PASS | 모든 공개 화면 로드, 헤더·카드·내비·검색 결과의 가로 잘림 없음 |
| 검색→상품 상세→뒤로가기 | PASS | 실제 탭으로 이동, 뒤로가기 후 검색어·결과 복원 |
| 상품 상세 갤러리 | PASS | 대표컷과 상세 4장 로드, 피사체 비율 왜곡·깨짐·명백한 crop 결함 없음 |
| 새로고침 | PASS | 현재 상품 화면 정상 재로딩, 흰 화면·오류 overlay 없음 |
| guest checkout | PASS | `/checkout` 접근 시 `/login`으로 이동 |
| 큰 글자 | PASS | 시스템 콘텐츠 크기를 접근성 최대 단계로 올려 공개 핵심 화면을 확인, 가로 overflow·조상 clipping 없음 |

테스트 뒤 시스템 콘텐츠 크기는 기본 `large`로 복원하고 이번 QA용 Simulator를 종료했습니다. 기존 `LAON QA iPhone 17 Pro` Simulator 상태는 변경하지 않았습니다.

## macOS Safari

환경: macOS Safari 26.5.2, desktop viewport.

- 홈, 남성·여성 목록, 검색, 상품 상세, 로그인, guest checkout을 실제 Safari UI로 검증했습니다.
- desktop 상품 그리드와 상세 2열 레이아웃, 이미지 비율, 뒤로가기, 새로고침이 통과했습니다.
- 화면에 오류 overlay, broken image, 가로 clipping이 없었습니다.
- Safari의 `Allow Remote Automation`이 비활성이라 SafariDriver console/network 수집은 실행하지 않았습니다. 실제 UI·내비게이션 결과로 보완했으며 이는 제품 실패가 아닙니다.

## Android Emulator Chrome

환경: `emulator-5554`, Android 16/API 36, Chrome/WebView 133.0.6943.137, CSS viewport 412x786, font scale 1.0.

- 홈, 남성, 여성, 검색, 상품 상세, 로그인에서 `scrollWidth=clientWidth=innerWidth=412`, 의미 있는 viewport 이탈 0, console error 0을 확인했습니다.
- 검색 결과 10개, 남성·여성 목록 각 20개가 로드됐고 검색→상품→뒤로가기·새로고침이 정상 동작했습니다.
- 상품 상세는 대표 1장 + 상세 4장 모두 자연 비율 0.8로 디코딩됐습니다.
- guest checkout은 최종적으로 `https://laonshop.com/login`에 도달했습니다.
- 첫 자동 스크롤에서 화면 밖 lazy image가 아직 요청되지 않아 누락으로 보였으나, 각 이미지를 viewport에 넣고 decode 완료를 기다린 재검증에서 5/5가 통과했습니다. 러너 타이밍 문제이며 제품 결함이 아닙니다.
- 내비게이션 중 발생한 RSC prefetch abort 외 제품 request failure는 없었습니다.

## 카드·결제 안전 경계

로컬 QA 전용 사용자와 과거 mock 카드 1건으로 실제 화면과 DB 무변경을 함께 확인했습니다.

| 항목 | 결과 | 실제 확인 |
| --- | --- | --- |
| 설정 카드 화면 | PASS | 카드번호·유효기간·비밀번호·생년월일 입력 폼과 등록 버튼 없음 |
| 과거 mock 카드 | PASS | 마스킹 번호, `등록 · 결제 사용 중지`, 본인 삭제 명령만 노출 |
| checkout 수단 | PASS | 카드·카카오페이·네이버페이·실시간계좌이체 4개만 노출 |
| oneclick/manual | PASS | 원클릭·수기결제 미노출, 실제 결제 submit 없음 |
| 일반 KSPAY 안내 | PASS | 결제정보가 KSPAY 인증결제창에서 처리된다는 안내 유지 |
| DB 부작용 | PASS | UI 검증 전후 QA 주문 0건, 감사로그 0건 |
| stale oneclick | PASS | 현재 50/50 회귀에서 checkout/retry 가드가 트랜잭션·주문 상태 변경 전에 공통 거부됨을 단정 |

일반 KSPAY 수단은 선택 화면까지만 확인했고 구매동의·결제 submit·실승인은 실행하지 않았습니다.

## KSNET 공식 개발계 빌링 전 과정

공식 문서: `https://paydev.ksnet.co.kr/kspay/webfep/doc`

문서의 테스트요청 페이지가 사용하는 KSNET 개발계 프록시와 내장 개발키 경계를 그대로 사용했습니다. 각 단계는 이전 단계에서 받은 동일 토큰·거래를 결박해 순서대로 실행했습니다.

| 순서 | 단계 | 결과 | 마스킹 증거 |
| --- | --- | --- | --- |
| 1 | 카드 등록 6.1 | PASS | aid `WFVB...5346`, `code=A0200`, `respCode=0000`, billingToken 발급 |
| 2 | 등록 조회 6.2 | PASS | aid `WFVB...5347`, `code=A0200`, `respCode=0000`, 동일 token, 카드번호 6자리 마스킹 |
| 3 | 빌링 결제 6.3 | PASS | aid `WFVB...5348`, `code=A0200`, `respCode=0000`, 금액 1,004원, TID `1969...0041`, 승인번호 존재 |
| 4 | 카드결제 취소 1.1 | PASS | aid `WFVC...5349`, `code=A0200`, `respCode=P10Q`, 원 승인과 동일 TID |
| 5 | 카드 등록 해지 6.4 | PASS | aid `WFVB...5350`, `code=A0200`, `respCode=0000`, 동일 token 결박 |
| 6 | 해지 후 재조회 6.2 | PASS | aid `WFVB...5351`, `code=A0201`, `respCode=P106`, 카드정보 미반환 |

KSNET 문서는 `A0200`만 처리 성공값으로 정의합니다. 취소 응답은 상위 `code=A0200`, `message=Success`였고 거래 TID도 원 승인과 일치했습니다. 해지 후 재조회는 의도대로 `A0201`이었으며 마스킹 카드정보가 반환되지 않아 개발계 토큰 정리를 확인했습니다.

## A/B/C 판정

### A. 공식 문서 테스트 콘솔

**PASS.** 테스트 MID와 공식 테스트 데이터로 카드 등록→조회→빌링 결제→동일 거래 취소→등록 해지→해지 후 실패 조회를 실제 수행할 수 있습니다.

### B. 라온샵 서버 직접 연동

**NOT IMPLEMENTED / 인증키 필요.** 문서 테스트요청은 `kspay_api_proxy.jsp`가 내장 개발키를 가져와 개발 API를 대행합니다. 같은 개발 API에 Authorization 없이 읽기 전용 가짜 토큰 조회를 직접 보내면 HTTP 200 본문에서 `code=A0403`, `Invalid authorization header format`으로 거부됐습니다. 공식 문서도 가맹점 서버가 KSTA에서 발급받은 `pgapi` 키를 Authorization 헤더에 사용해야 하며 JavaScript에 노출하면 안 된다고 명시합니다.

### C. 라온샵 카드등록·원클릭 UI

**NOT IMPLEMENTED / fail-closed PASS.** 신규 카드 원문 등록 Action과 원클릭 결제 UI는 없고, 과거 mock 카드는 마스킹 조회·본인 삭제만 가능합니다. 현재 상품 주문은 일반 KSPAY 인증결제 수단만 제공합니다.

따라서 외부에는 **“KSNET 공식 개발계 문서 콘솔에서 테스트 MID로 카드 등록·조회·빌링 승인·취소·해지 시연이 가능하다”**고 표현할 수 있습니다. **“라온샵에 빌링이 연동됐다”**, **“pgapi 없이 직접 호출 가능하다”**, **“라온샵 UI에서 원클릭 결제가 된다”**고 표현하면 안 됩니다.

## 결함과 잔여 위험

- 이번 추가 회귀에서 신규 P0/P1/P2 제품 결함은 발견하지 못했습니다.
- 실제 iOS 기기는 아니며 iOS Simulator의 실제 MobileSafari/WebKit입니다. macOS Safari console/network는 SafariDriver 설정 제약으로 수집하지 못했습니다.
- 실 MID·실카드·운영 승인·영수증은 실행하지 않았습니다.
- 라온샵 빌링은 계약·pgapi 보관·서버 전용 등록/조회/승인/취소/해지 구현과 별도 보안 검증 전까지 계속 NO-GO입니다.
- 결제 문서의 개발키가 문서 테스트 페이지 소스에 내장된 사실은 공식 테스트 콘솔의 동작 방식일 뿐, 제품 클라이언트에 키를 포함해도 된다는 뜻이 아닙니다.

## cleanup

- KSNET 개발계 빌링 거래를 동일 TID로 취소하고 billingToken을 해지했으며 해지 후 조회 실패·카드정보 미반환을 확인했습니다.
- 민감 요청·응답 원문은 메모리에서 폐기했고 파일·보고서·스크린샷에 저장하지 않았습니다.
- 로컬 QA fixture 사용자 1명과 mock 카드 1건을 삭제했습니다.
- DB는 시작 기준인 users 10, orders 9, items 9, cards 4, audits 0, products 329, wishlists 0으로 복원됐습니다.
- 로컬 3003 서버 종료, Android CDP 포워딩 제거, 이번 QA용 iOS Simulator 종료, `/private/tmp/laonshop-fbc-*` 임시 파일 삭제를 확인했습니다.
- 운영·마스터 데이터와 기존 사용자의 에뮬레이터·브라우저 상태는 변경하지 않았습니다.

## 최종 판정

제품 커밋 `fbc2312`은 기존 이미지 전수검사에 더해 실제 MobileSafari/WebKit, macOS Safari, Android Chrome의 공개 핵심 흐름과 카드·결제 fail-closed 경계를 통과했습니다. KSNET 공식 개발계에서는 승인된 테스트 범위의 빌링 전 과정과 cleanup까지 성공했습니다.

현재 라온샵 출시 후보는 **PASS / GO**입니다. 단, 이 판정은 일반 KSPAY 인증결제와 계약 전 빌링·수기결제 비활성 정책에 대한 것입니다. 라온샵 자체 빌링 연동은 구현되지 않았으므로 별도 **NO-GO** 상태를 유지합니다.
