# cbde44d 빌링 Mock 등록 더블클릭 회귀 QA 보고서

작성일: 2026-07-17

담당: Codex QA/테스트 세션

비교 범위: `cf888ecaf1f64c78020d3daf74172dc051bb109c..cbde44d0aaeb9706ba35cf992b8ec3053b8f8ea0`

대상 제품 SHA: `cbde44d0aaeb9706ba35cf992b8ec3053b8f8ea0`

대상 배포: `dpl_14b131UqtY3uCMGHrg2zAxC5PYHS` / `https://laonshop-jtvd3qxl1-customorder.vercel.app`

운영 URL: `https://laonshop.com`, `https://www.laonshop.com`

결과: **FAIL**

출시 판정: **NO-GO - 더블클릭 관통 결함은 해소됐으나 backdrop 닫기 포커스 회귀 수정 필요**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 지정 심사 계정의 기존 운영 Chrome 인증 세션만 재사용했습니다.
- 실제 카드정보, 실 KSNET, 주문·결제 submit, 운영 DB write, Vercel env 변경을 실행하지 않았습니다.
- 세션 쿠키, 비밀번호, 환경변수, 카드 원문과 PG 인증값을 읽거나 출력하지 않았습니다.
- 시작 시 `main=origin/main=cbde44d`, clean, 대상 diff 2개 파일만 확인했습니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3 기준입니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 61/61, fail 0, skip 0 |
| 이미지 gate | PASS | 상품 329/1,316장, 큐레이션 20/100장, 모두 1200x1500 |
| `pnpm lint` | PASS | warning/error 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |

변경 컴포넌트와 상태 모듈에는 Mock 조작용 `fetch`, Server Action, DB write, 카드 원문, `billingToken`, pgapi·Authorization 필드가 없습니다. `paymentMethodId`와 고정 마스킹 정보만 현재 탭 상태에 사용됩니다.

## 운영 Chrome 표적 회귀

### 등록 입력 경합

- 배포 전부터 열려 있던 탭은 이전 JavaScript 번들을 유지하고 있어 첫 실행에서 기존 현상이 보였습니다.
- 운영 URL을 명시적으로 reload한 뒤 최신 배포 번들로 같은 시나리오를 재실행했습니다.
- 단일 등록 클릭은 모달을 유지하고 성공 안내와 `등록 화면 닫기`를 표시했습니다.
- locator `dblclick()`은 등록 상태 1건을 유지하고 두 번째 입력을 열린 모달의 닫기 동작으로 소비했습니다.
- 412px 고정 좌표 `(206, 861.10)` 실제 mouse double-click도 같은 결과였습니다.
- 두 경우 모두 결제수단 ID 표시가 1개였고 `브라우저 Mock 초기화` 안내나 상태 소실은 없었습니다.
- Enter 첫 입력은 성공 모달을 유지했고 두 번째 Enter는 모달만 닫았습니다. 등록 상태와 같은 결제수단 ID가 유지됐습니다.

따라서 기존 `QA-543-OBS-01`의 초기화 버튼 입력 관통은 **재현되지 않았고 수정 확인 PASS**입니다.

### 닫기 경로와 포커스

| 닫기 경로 | 닫힌 뒤 activeElement | 다음 Tab | 결과 |
| --- | --- | --- | --- |
| `등록 화면 닫기` submit | lifecycle `div[tabindex=-1]` | `등록 정보 조회` | PASS |
| 우측 X | lifecycle `div[tabindex=-1]` | `등록 정보 조회` | PASS |
| Escape | lifecycle `div[tabindex=-1]` | `등록 정보 조회` | PASS |
| backdrop pointer click | `main[tabindex=-1]` | `← 마이페이지` | **FAIL** |

backdrop 실패는 412px에서 서로 다른 등록 상태를 만든 뒤 2회 동일하게 재현했습니다. 초기화 버튼 관통이나 등록 상태 소실은 없었지만, 등록 조회를 이어가도록 한 포커스 계약은 충족하지 못했습니다.

### 반응형

성공 모달을 320/360/390/412px에서 각각 실제 DOM rect로 측정했습니다.

- 모든 폭에서 `document.scrollWidth=clientWidth`였습니다.
- dialog와 visible descendant의 viewport 이탈은 0건입니다.
- dialog 내부 `scrollWidth=clientWidth`였습니다.
- submit은 각 폭에서 약 57~58px, X는 44px였습니다.
- input은 48px이고 버튼 내부 `scrollWidth<=clientWidth`, `scrollHeight<=clientHeight`였습니다.
- 콘솔 warning/error는 0건입니다.

정확한 Chrome 200% 확대는 제어 viewport에서 확대 단축키가 적용되지 않아 미실행입니다.

### 기존 생명주기 회귀

- 등록 조회 → 승인 → 등록 해지: PASS
- 별도 초기화 → 등록 조회 → 명시적 거절 → 등록 해지: PASS
- 별도 초기화 → 등록 조회 → 결과미상: `PENDING_REVIEW` 유지 PASS
- 결과미상에서 재결제·등록 해지 버튼 비노출: PASS
- 결과미상 reload와 `/checkout` 뒤로가기·forward 복귀 후 같은 결제수단 ID와 확인대기 유지: PASS
- 승인 버튼 이중 입력은 한 번만 종결됐고 라온샵 취소 액션은 노출되지 않았습니다.
- Mock 조작 전후 브라우저 resource의 fetch/XHR 증가 0, console warning/error 0이었습니다.

## 발견 결함

### QA-CBDE-01 - backdrop 닫기 뒤 포커스가 lifecycle 대신 main으로 이동

- 심각도: **P2**
- URL: `https://laonshop.com/mypage/settings`
- 환경: 운영 Chrome, 412x915
- 계정: 지정 심사 계정의 기존 인증 세션

재현 절차:

1. `브라우저 Mock 초기화`를 누릅니다.
2. `카드 등록하기`를 열고 등록 submit을 한 번 누릅니다.
3. 성공 안내가 열린 상태에서 dialog 바깥 backdrop을 클릭합니다.
4. 닫힌 직후 `document.activeElement`와 다음 Tab 대상을 확인합니다.

기대 결과:

- activeElement가 새 lifecycle 컨테이너 `div[tabindex=-1]`입니다.
- 다음 Tab이 `등록 정보 조회`로 이동합니다.

실제 결과:

- activeElement가 `main[tabindex=-1]`입니다.
- 다음 Tab이 페이지 상단 `← 마이페이지` 링크로 이동합니다.

관련 코드와 원인 후보:

- `app/mypage/settings/billing-card-review-mock.tsx:77`
- `app/mypage/settings/billing-card-review-mock.tsx:130`
- `app/mypage/settings/billing-card-review-mock.tsx:371`
- backdrop의 `onMouseDown={close}`가 pointer sequence 중 dialog를 제거합니다.
- effect cleanup에서 `flowRef.focus()`가 실행된 뒤 남은 pointer 기본 동작이 포커스를 `main`으로 다시 이동시키는 순서로 추정됩니다.
- X, Escape, submit 닫기는 모두 정상이라 backdrop pointer 경로에 국한됩니다.

필요 회귀:

- success 상태 backdrop pointerdown/up 전체 sequence 뒤 activeElement 단정
- 다음 Tab이 `등록 정보 조회`인지 단정
- 고정 좌표 double-click이 backdrop 아래 초기화 명령으로 전달되지 않는 기존 회귀 유지

## 플랫폼 교차 검증

### Android Emulator

- Android 16/API 36, Chrome 133, CSS 약 412px입니다.
- 기존 Android Chrome에는 심사 계정 세션이 없어 `/mypage/settings`가 `/login`으로 이동했습니다.
- 인증 Mock과 touch double-tap은 비밀값을 새로 입력하지 않는 정책에 따라 **NOT EXECUTED**입니다.
- font scale 2.0 재시작 뒤 Chrome 자체 ANR이 반복됐습니다. 이는 제품 서버·페이지 오류 증거가 없어 도구/에뮬레이터 제약으로 분리했습니다.
- font scale 1.0, user rotation 0, CDP 제거 후 홈 화면으로 복구했습니다.

### iOS Simulator MobileSafari

- iOS 26.5 `LAON QA iPhone 17 Pro`, 실제 MobileSafari/WebKit입니다.
- `/mypage/settings`는 인증 세션 부재로 `/login`으로 이동했습니다.
- 공개 로그인 화면은 헤더·입력·CTA 겹침이나 가로 잘림 없이 렌더링됐습니다.
- 인증 Mock, backdrop 포커스와 실제 touch double-tap은 **NOT EXECUTED**입니다.

플랫폼 미실행은 확정 Chrome 결함과 별개이며 제품 PASS로 대체하지 않았습니다.

## DB·배포 증거

- Mock 실행 전 DB: `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`
- Mock 실행 후 DB: `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`
- fixture와 DB write는 만들지 않았습니다.
- Vercel `dpl_14b131UqtY3uCMGHrg2zAxC5PYHS`는 `READY`, target `production`입니다.
- Vercel Git SHA는 `cbde44d0aaeb9706ba35cf992b8ec3053b8f8ea0`로 local/origin HEAD와 일치합니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal 로그 0입니다.

## cleanup

- 운영 Chrome Mock 표시를 초기화하고 모달을 닫았습니다.
- Chrome viewport override와 QA 제어 세션을 해제했습니다.
- Android font scale 1.0, rotation 0, CDP forwarding 제거를 확인했습니다.
- Android Chrome을 종료하고 예기치 않은 다른 앱 권한 대화상자에는 응답하지 않은 채 홈으로 복귀했습니다.
- Android/iOS 임시 XML·스크린샷을 삭제했습니다.
- 운영 DB·마스터 데이터, Vercel env·도메인, PG 상태 변경은 없습니다.

## 최종 판정

등록 단일 클릭, locator·고정 좌표 더블클릭, 연속 Enter의 상태 보존과 초기화 관통 차단은 통과했습니다. 기존 핵심 결함은 해결됐습니다.

그러나 인계의 필수 닫기 경로 중 backdrop 포커스가 2회 실패했으므로 대상 커밋 결과는 **FAIL**입니다. `QA-CBDE-01` 수정 후 X·Escape·submit·backdrop 네 경로와 412px 더블클릭을 함께 재검증해야 합니다.

실제 원클릭 빌링은 전용 개발 pgapi, LAONPAY 호스팅 등록/API, 서버 소유권·멱등성·UNKNOWN 대사와 토큰 보안 저장이 준비될 때까지 계속 미구현·fail-closed이며, 이번 Mock 결과를 실제 PG 연동 PASS로 표현하면 안 됩니다.
