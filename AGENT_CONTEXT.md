# 라온샵 에이전트 현재 상태

> 마지막 정리: 2026-07-18. 제품·결제 규칙은 `AGENTS.md`, 구현 사실은 현재 코드와 git 기록을 우선한다.

## 읽기 순서

1. `AGENTS.md`
2. 이 파일
3. 작업 영역의 코드·테스트·최근 git 기록
4. 환경변수·외부 서비스·미완료 계약 항목은 `ENV_INVENTORY.md`
5. 카드사 심사 자료 작업이면 `reference/`가 gitignore 대상인지 먼저 확인

## 현재 기준선

- 라온샵은 라온페이와 데이터·배포가 분리된 독립 Next.js 15 쇼핑몰이다. 라온페이 모노레포로 다시 합치지 않는다.
- 운영 주소는 `laonshop.com`과 `www.laonshop.com`, Vercel 프로젝트는 `customorder/laonshop`이다. main 푸시는 자동 배포된다.
- KSPAY 테스트 MID 인증결제창이 동작한다. 원클릭 빌링의 브라우저 전용 Mock은 제거하고, LAONPAY 호스팅 카드 등록과 서버 간 파트너 API를 사용하는 integration-ready 경로로 교체했다. `LAONPAY_BILLING_API_BASE`·`LAONPAY_PARTNER_KEY_ID`·`LAONPAY_PARTNER_PRIVATE_KEY`와 전용 빌링 DB 스키마가 모두 준비되지 않으면 신규 등록·조회·승인·해지는 서버에서도 fail-closed다. 고정 apex 복귀 URL과 등록 쿠키 범위를 지키기 위해 LAONPAY env 3종은 Vercel Production scope에만 설정하며, 코드도 Preview·Development 런타임 외부 호출을 차단한다. 과거 mock 카드 레코드는 설정에서 삭제만 가능하다.
- 빌링 개발 시연 MID는 KSNET 공용 테스트 MID `2999199999`를 사용한다. 공식 개발계 문서 콘솔에서 등록→조회→결제→취소→해지 전 과정은 검증했지만, 이는 라온샵 계정·서버 연동 완료를 뜻하지 않는다. 공용 MID의 외부 사용 정책 확인은 개발 구현 blocker가 아니라 정식 출시 전 확인사항으로 관리한다.
- 라온샵은 등록 시작·고객/주문 원장·결과 표시만 담당하고, 카드 입력·KSNET `billingToken` 암호화 vault·조회·결제·해지·취소 요청은 LAONPAY가 담당한다. 카드 원문·KSNET `billingToken`·`pgapi`는 라온샵 브라우저·서버·DB·로그를 통과하지 않으며, 라온샵에는 opaque `paymentMethodId`와 카드사·끝 4자리·안전 상태만 저장한다. 공식 문서의 샘플 인증 문자열은 코드·Vercel 환경변수에 사용하지 않는다.
- 호스팅 카드 등록 완료 고정 복귀 URL은 `https://laonshop.com/mypage/settings/billing/return`이다. 복귀 query는 힌트일 뿐이며, 시작 시 저장한 등록 ID와 대조한 뒤 Ed25519 서명된 LAONPAY 상태 조회 응답만 최종 근거로 사용한다.
- 파트너 API와 hosted 등록 화면은 LAONPAY seller의 같은 고정 HTTPS origin을 사용한다. `hostedUrl`은 `LAONPAY_BILLING_API_BASE`와 `URL.origin`이 정확히 같을 때만 열고, 별도 hosted origin env나 응답 기반 동적 allowlist는 두지 않는다.
- 파트너 서명 canonical은 `v1·METHOD·PATH_WITH_QUERY·TIMESTAMP·NONCE·IDEMPOTENCY_KEY_OR_EMPTY·SHA256_BODY` 7줄이다. POST 멱등키는 UUID 소문자로 header와 canonical에 동일하게 넣고, GET은 해당 줄을 비우며 멱등키 header를 보내지 않는다. 취소요청은 저장된 opaque 취소요청 ID의 signed GET을 최종 근거로 삼아 `REQUESTED/PROCESSING/DONE/REJECTED`를 대사하고, 외부 ID를 잃은 응답유실에서만 charge GET을 제한적으로 사용하되 `PAID`를 거절로 추론하지 않는다.
- 등록 intent와 결제 생성 응답을 잃은 경우에는 같은 `Idempotency-Key`와 바이트상 동일한 요청 본문으로 reconciliation POST를 한 번 수행해 기존 ID·상태만 회수할 수 있다. LAONPAY는 새 resource나 새 KSNET 호출을 만들지 않아야 하며, 키가 같고 본문이 다르면 `IDEMPOTENCY_CONFLICT`로 거절한다. 계속 `UNKNOWN`이면 새 결제나 자동 재호출 없이 확인 대기로 고정한다.
- 수기결제 WEBFEP 운영 호출은 `KSPAY_API_KEY`와 `KSPAY_REST_LIVE=1`이 모두 있어야 UI와 서버가 활성화된다. `KSPAY_REST_LIVE=1`은 운영 `pay.ksnet.co.kr`용이며 paydev 빌링 시연에는 사용하지 않는다. 계약 전 테스트 계정 mock 승인과 합성 승인번호 경로는 제거했으며, 실 MID·API 키·개인정보처리 고지까지 확인한 뒤에만 운영 활성화한다.
- KSPAY 최종 결과는 주문 ID·주문번호·금액에 결박한 HMAC 토큰과 PG 응답 `ordno`·금액·승인번호·거래번호를 모두 검증한 뒤 주문에 반영한다. 사용자 취소값이나 주문 ID만으로 상태를 바꾸지 않는다.
- KSNET `reCommConId`/`reHash`를 주문에 서버에서 사전 결박하는 공식 규격을 받기 전에는 테스트 MID `2999199999`만 서버승인한다. 실 MID로 바꾸면 안전하게 승인 차단되며, 스펙 구현·회귀 후에만 이 가드를 변경한다.
- `/admin`은 DB의 `ADMIN` 역할만 접근한다. 결제 결과가 불명확한 `PENDING + __KSPAY_PROCESSING__` 주문은 구매자가 재승인하지 않고, PG 자동 처리 보호 구간(5분)이 지난 뒤 운영자가 KSTA 대조 후 결제완료/실패를 확정하며 모든 변경을 감사 로그에 남긴다.
- 사업자 footer의 대표자와 주소는 ㈜커스텀오더 기준으로 복원됐다. 카드사 심사에서 남은 핵심 외부 항목은 통신판매업신고번호 확정·반영이다.
- 공개 화면에 `더미`, `테스트`, `심사용` 같은 표현을 다시 노출하지 않는다.
- 상품 이미지는 전체 329개 중 앞선 20개를 같은 SKU의 독립 5컷(대표·라이프스타일·실루엣·제품 단독·디테일)으로 큐레이션했다. 모든 확정 자산은 1200x1500 WebP이며, 나머지 309개는 10개 단위로 교체·QA한다.
- 큐레이션 생성 프롬프트는 역할별 구도를 분리한다. 분할 패널·재활용 크롭·다른 색/상품·명세에 없는 무늬를 허용하지 않으며, 빌드 게이트가 역할 순서·파일 수·크기·중복·인공 패딩/중앙 gutter를 검사한다.

## 다음 결제 작업

1. `[LAONPAY] DEV`에서 호스팅 카드 등록, 파트너 인증, opaque 결제수단, 등록·조회·결제·취소 요청·해지, 멱등성과 불명확 결과 복구를 완성하고 개발계 자격정보를 LAONPAY에만 설정한다.
2. LAONSHOP에는 전용 빌링 DB 스키마를 적용하고 위 LAONPAY 파트너 env 3종만 안전하게 설정한다. LAONSHOP에 MID·`pgapi`·KSNET token을 추가하지 않는다.
3. env나 DB 스키마 중 하나라도 준비되지 않으면 integration-ready UI와 서버가 fail-closed하는지 유지한다. 준비 후에도 실제 PG 연결 완료로 표현하기 전에 LAONPAY readiness와 서명 계약을 교차 확인한다.
4. 두 제품 변경을 각각 QA 작업에 인계해 등록→조회→결제→취소 요청→해지, 중복 요청, timeout/5xx/`UNKNOWN`, 세션·소유권, Safari·Android 회귀까지 통과한 뒤 개발 시연을 연다.

## 결제·브라우저 검증 가드

- KSPAY 승인과 수기결제처럼 거래나 카드 상태를 만드는 테스트는 사용자가 명시적으로 요청할 때만 한 번 수행한다. 비활성화된 빌링 등록·원클릭·수기결제는 실제 계약과 안전 연동 완료 전까지 테스트 명목으로도 다시 열지 않는다.
- 결제 테스트를 요청받아 수행하면 생성된 주문과 거래 상태를 확인하고, 정리 필요 여부를 사용자에게 보고한다.
- Playwright 계열 브라우저 제어에서 React `type="button"`의 CDP 클릭이 전달되지 않는 경우가 있었다. 앱 버그로 단정하기 전에 실제 이벤트 발생 여부를 확인하고 필요하면 DOM `click()`으로 교차 검증한다.
- 로그인·상품·장바구니·비결제 체크아웃 단계는 거래를 만들지 않는 범위에서 검증할 수 있다.

## 운영 가드

- main 푸시에 따른 Vercel 자동배포는 저장소 워크플로에 포함된다. 별도 env 변경·강제 재배포·운영 DB 변경은 요청 범위와 영향을 확인한다.
- 결제 카드정보, PG 키, 세션 시크릿, 실제 심사 원본 서류를 커밋하지 않는다.
- Neon 무료 티어 오토서스펜드로 첫 요청이 지연·간헐 500 날 수 있다. DB URL의 `connect_timeout`/`pool_timeout`로 완화돼 있고, 완전 제거는 Neon 유료 전환이 필요하다.
- 통신판매업신고번호, 실 MID, 결제수단 계약 상태가 바뀌면 같은 변경의 커밋에서 이 파일과 `ENV_INVENTORY.md`를 갱신한다.
