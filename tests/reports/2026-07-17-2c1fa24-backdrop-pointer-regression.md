# 2c1fa24 빌링 Mock backdrop 포인터 회귀 QA 보고서

작성일: 2026-07-17

담당: Codex QA/테스트 세션

비교 범위: `60af9451b13992a20a23c20fb1a6290ab58efd2f..2c1fa2413b0fae6a62865b37040d897526541b06`

대상 제품 SHA: `2c1fa2413b0fae6a62865b37040d897526541b06`

대상 배포: `dpl_8kfuZ9coJkCdfsohU11E1gfsjT9e` / `https://laonshop-ipgoo3n7c-customorder.vercel.app`

운영 URL: `https://laonshop.com`, `https://www.laonshop.com`

자동 수정 회차: **2/2**

결과: **FAIL**

출시 판정: **NO-GO - backdrop 더블클릭이 배경 링크로 관통함**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 시작 시 `main=origin/main=2c1fa24`, clean 상태와 대상 diff 2개 파일만 확인했습니다.
- 지정 심사 계정의 기존 운영 Chrome 인증 세션만 재사용했습니다.
- 실제 카드정보, 실 KSNET, 주문·결제 submit, 운영 DB write, Vercel env 변경을 실행하지 않았습니다.
- 세션 쿠키, 비밀번호, 환경변수, 카드 원문과 PG 인증값을 읽거나 출력하지 않았습니다.
- 정확한 Chrome 200% 확대와 인증된 Android/iOS Mock은 이번 회차에 실행하지 않고 도구·세션 제약으로 분리했습니다.

## 변경 검토

변경은 `app/mypage/settings/billing-card-review-mock.tsx`와 `tests/api/billing-review-mock.test.ts`에 한정됩니다.

- backdrop `mousedown`에서 기본 포커스 이동을 `preventDefault()`로 차단합니다.
- 실제 닫기는 `click`에서 실행합니다.
- 소스 계약 테스트는 `onMouseDown`과 `onClick` 배치를 단정합니다.
- API, Server Action, DB, 주문, 실 PG, 인증·세션 로직 변경은 없습니다.

단일 클릭의 포커스 수정은 실제 운영 Chrome에서 통과했습니다. 다만 첫 `click`으로 backdrop이 제거된 뒤 같은 좌표의 두 번째 `click`을 흡수할 계층은 없어, 배경 명령 관통 가능성이 남아 있습니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3 기준입니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| focused billing Mock | PASS | 7/7, fail 0, skip 0 |
| `pnpm test` | PASS | 61/61, fail 0, skip 0 |
| 이미지 gate | PASS | 상품 329/1,316장, 큐레이션 20/100장, 모두 1200x1500 |
| `pnpm lint` | PASS | warning/error 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 경고만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |

최초 focused 실행은 sandbox의 tsx IPC 소켓 `EPERM`으로 중단됐습니다. 같은 명령을 승인된 실행 경계에서 재실행해 7/7 PASS를 확인했으며 제품 실패와 분리했습니다.

## 운영 Chrome 표적 회귀

### 단일 backdrop 포커스 수정

412x915 운영 Chrome에서 실제 pointer down/up/click을 수행했습니다.

| 상태 | 닫힌 직후 activeElement | 다음 Tab | 결과 |
| --- | --- | --- | --- |
| 등록 전 모달 | `카드 등록하기` trigger | 해당 trigger 다음 순서 | PASS |
| 등록 성공 모달 | lifecycle `div[tabindex=-1]` | `등록 정보 조회` | PASS |

이전 `QA-CBDE-01`의 `main[tabindex=-1]` 포커스 유실은 재현되지 않았습니다.

### 기존 닫기·중복 입력 회귀

- `등록 화면 닫기` submit, X, Escape는 모두 lifecycle `div[tabindex=-1]`로 포커스를 복원했습니다.
- locator `dblclick()`은 결제수단 표시 1개를 유지하고 초기화 안내를 만들지 않았습니다.
- 412px 고정 좌표 `(206, 861)` submit 더블클릭도 결제수단 표시 1개, 조회 버튼 1개, 초기화 안내 0으로 수렴했습니다.
- 연속 Enter는 첫 입력에서 성공 모달을 유지하고 두 번째 입력에서 모달만 닫았습니다.
- 위 경로의 URL은 `/mypage/settings`를 유지했고 activeElement는 lifecycle 컨테이너였습니다.

### 발견 결함: backdrop 더블클릭 배경 관통

성공 모달을 다시 연 뒤 모바일 헤더 `남성의류` 링크 위 backdrop 좌표를 실제 더블클릭했습니다.

- viewport: `412x915`
- dialog 시작 Y: `179.86`
- 배경 `남성의류` 링크 rect: `x=64.01..126.39`, `y=69..113`
- 실행 좌표: `(95, 91)`
- 재현율: **2/2**

첫 클릭은 성공 모달을 닫았고, 두 번째 클릭은 같은 좌표의 배경 `남성의류` 링크에 전달됐습니다. 실제 URL은 두 번 모두 `https://laonshop.com/shop/men`으로 이동했습니다.

뒤로가기로 설정 화면에 복귀하면 같은 결제수단 ID 표시와 `등록 정보 조회` 상태가 유지됐습니다. 따라서 Mock 스냅샷, DB, 주문과 PG 상태는 바뀌지 않았지만, backdrop 아래 명령을 실행하지 않아야 한다는 수용 조건은 실패했습니다.

## 기존 Mock 생명주기

- 등록 조회 → 승인 → 등록 해지: PASS
- 별도 등록 → 등록 조회 → 명시적 거절 → 등록 해지: PASS
- 별도 등록 → 등록 조회 → 결과미상: `PENDING_REVIEW` 유지 PASS
- 결과미상에서 재결제·등록 해지 버튼 비노출: PASS
- 결과미상 reload 뒤 확인 대기와 차단 상태 유지: PASS
- 승인 완료 화면에 라온샵 취소 액션이 없고 LAONPAY 관리자 전체취소 안내만 표시: PASS
- Mock 조작과 reload 이후 resource `fetch`/XHR/beacon 0, Chrome console warning/error 0: PASS

## 반응형

성공 모달을 정상 글자 크기의 320/360/390/412px에서 실제 DOM rect로 측정했습니다.

| 폭 | dialog X..right | document overflow | dialog descendant 이탈 | 최소 control 높이 |
| --- | --- | --- | --- | --- |
| 320 | `8..312` | 0 | 0 | 44px |
| 360 | `8..352` | 0 | 0 | 44px |
| 390 | `8..382` | 0 | 0 | 44px |
| 412 | `8..404` | 0 | 0 | 44px |

- 모든 폭에서 `document.scrollWidth=clientWidth`였습니다.
- dialog `scrollWidth=clientWidth`, control 내부 clipping 0건입니다.
- 정확한 Chrome 200% 확대는 이번 회차에 **NOT EXECUTED**입니다.
- 인증된 Android/iOS Mock과 실제 touch double-tap은 세션·도구 제약으로 **NOT EXECUTED**입니다.
- 미실행 플랫폼은 Chrome 결함을 PASS로 대체하지 않으며, 이번 결함의 재현 조건에도 필요하지 않습니다.

## 발견 결함

### QA-2C1-01 - 성공 모달 backdrop 더블클릭이 배경 링크로 관통

- 심각도: **P2**
- URL: `https://laonshop.com/mypage/settings`
- 환경: 운영 Chrome, 412x915
- 계정: 지정 심사 계정의 기존 인증 세션
- 재현율: **2/2**

재현 절차:

1. `브라우저 Mock 초기화` 후 카드 등록을 완료합니다.
2. 성공 모달을 유지하거나 `카드 등록 화면 다시 보기`로 다시 엽니다.
3. backdrop 아래 모바일 헤더 `남성의류` 링크 중심 좌표 `(95, 91)`를 더블클릭합니다.
4. 모달 제거와 현재 URL을 확인합니다.

기대 결과:

- 첫 입력에서 모달만 닫힙니다.
- 연속된 두 번째 입력이 backdrop 아래 링크나 버튼으로 전달되지 않습니다.
- URL, 결제수단 ID, announcement와 Mock 상태가 유지됩니다.

실제 결과:

- 첫 입력에서 모달이 닫힙니다.
- 두 번째 입력이 배경 링크에 전달돼 `/shop/men`으로 이동합니다.
- 뒤로가기로 복귀 시 Mock 상태는 유지되지만 사용자 흐름은 예기치 않게 이탈합니다.

관련 파일과 원인 후보:

- `app/mypage/settings/billing-card-review-mock.tsx:371`
- `onMouseDown(event.preventDefault)`는 포커스 기본 동작만 차단합니다.
- 첫 `onClick={close}` 후 overlay가 제거되므로 두 번째 pointer sequence를 흡수하지 못합니다.
- 배경 명령 비활성화, 닫기 지연, 또는 연속 입력 흡수 정책 중 하나가 필요합니다.

필요 회귀:

- 헤더 링크와 `브라우저 Mock 초기화` 버튼 위 좌표에서 mouse double-click 관통 0
- 가능한 실제 touch double-tap 관통 0
- 단일 backdrop 클릭의 lifecycle 포커스와 다음 Tab 유지
- submit/X/Escape/locator·좌표 더블클릭 기존 PASS 유지

## DB·배포 증거

- 직전 QA 기준 DB: `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`
- 이번 Mock 조작 후 read-only 확인: `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`
- fixture와 DB write는 만들지 않았습니다.
- 인계된 Vercel 배포 `dpl_8kfuZ9coJkCdfsohU11E1gfsjT9e`는 `READY`, target `production`, Git SHA `2c1fa2413b0fae6a62865b37040d897526541b06`입니다.
- local HEAD와 origin/main도 동일 SHA이며 작업 시작 시 clean이었습니다.
- 인계 기준 최근 1시간 runtime error cluster와 해당 배포 error/fatal은 0입니다.

## cleanup

- 운영 Chrome의 Mock 표시를 초기화하고 모달을 닫았습니다.
- Chrome과 in-app browser의 viewport override와 QA 제어 탭을 정리했습니다.
- DB fixture, 임시 계정, 주문, 카드, 감사로그를 만들지 않았습니다.
- 운영 DB·마스터 데이터, Vercel env·도메인, PG 상태 변경은 없습니다.

## 최종 판정

`QA-CBDE-01`의 단일 backdrop 포커스 유실은 수정 확인 PASS입니다. 정적 회귀, 생명주기, 반응형과 서버 무접촉 경계도 통과했습니다.

그러나 자동 수정 2/2 회차의 필수 추가 수용 조건인 backdrop 연속 입력 관통 차단이 실패했습니다. 실제 운영 Chrome에서 배경 링크 이동을 2/2 재현했으므로 대상 커밋은 **FAIL / NO-GO**입니다. 제품 코드는 QA에서 수정하지 않으며, 다음 개발 회차에는 결함 증거와 필요한 회귀만 전달합니다.

실제 원클릭 빌링은 전용 개발 pgapi, LAONPAY 호스팅 등록/API, 서버 소유권·멱등성·UNKNOWN 대사와 토큰 보안 저장이 준비될 때까지 계속 미구현·fail-closed입니다. 이번 Mock 결과를 실제 PG 연동 PASS로 표현하면 안 됩니다.
