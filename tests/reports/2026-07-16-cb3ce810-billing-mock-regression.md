# cb3ce810 심사용 빌링 Mock 생명주기 회귀 QA 보고서

작성일: 2026-07-16

담당: Codex QA/테스트 세션

대상 제품 커밋: `cb3ce8107509ceb36e4f9765e65b829a3d9bef7b`

비교 범위: `bf06436cf2e6f1e08b2db7f74feaefad0dc63e0a..cb3ce8107509ceb36e4f9765e65b829a3d9bef7b`

대상 배포: `https://laonshop.com` / `dpl_HrgnA9SKbgFfcFWPELwb12nAvkYf`

결과: **PARTIAL**

출시 판정: **조건부 GO - 운영 Chrome 심사 시연은 가능, 플랫폼 전체 완료 주장은 보류**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 실카드, 실 PG, 운영 DB write, Vercel env 변경을 실행하지 않았습니다.
- 지정 심사 계정의 브라우저 탭 한정 Mock만 검증했습니다.
- 카드 원문, 토큰, 세션 쿠키, 비밀번호와 환경변수 실제 값은 출력하거나 문서화하지 않았습니다.
- 검증 종료 시 `main`, `HEAD=origin/main=cb3ce8107509ceb36e4f9765e65b829a3d9bef7b`, clean 상태를 확인했습니다.

## 정적·코드 검토

Node 22.23.1, pnpm 11.5.3 기준입니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 61/61, fail 0, skip 0 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | 기존 Prisma 7 경고 외 오류 0 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| 이미지 gate | PASS | 329상품/1,316장, 큐레이션 20상품/100장 |

- 서버 컴포넌트의 exact 이메일 비교로 지정 계정에만 Mock이 노출됩니다.
- sessionStorage v2 파서는 허용된 10개 키와 상태 조합만 수용하고 extra key, 잘못된 마스크와 불가능한 상태 전이를 폐기합니다.
- Mock 코드에는 `fetch`, Server Action, DB write, 카드 원문, `billingToken`, PG TID, pgapi 또는 Authorization 경로가 없습니다.
- 결과미상은 `PENDING_REVIEW`로 고정되고 결제 재실행과 등록 해지가 모두 차단됩니다.
- paymentMethodId 충돌 재생성, 중복 클릭 잠금과 종결 상태 멱등 처리를 확인했습니다.

## 운영 Chrome 회귀

지정 심사 계정의 기존 인증 탭에서 실제 사용자 흐름을 검증했습니다.

### 등록·조회·승인·해지

- 등록 모달의 4개 예시 필드는 `readOnly`, `aria-readonly`, autocomplete off이며 name 속성과 카드 원문 전송 경로가 없습니다.
- Escape와 닫기, Tab/Shift+Tab 순환, 최초 포커스와 trigger 포커스 복귀를 확인했습니다.
- 등록 후 조회, 빠른 이중 클릭 승인에서 요청 ID와 상태가 한 번만 확정됐습니다.
- 승인 금액은 고정 검증금액 1,004원이고 성공 화면에 PG TID 미생성 문구가 표시됐습니다.
- 라온샵 취소 명령은 없고 향후 LAONPAY 관리자 전체취소 및 부분취소 금지 안내만 표시됐습니다.
- 등록 해지 후 `NOT_FOUND`, reload 유지, 초기화 후 표시 제거를 확인했습니다.

### 거절·결과미상

- 별도 초기화 후 명시적 거절은 `DECLINED` 단일 종결 상태가 됐고 해지가 가능했습니다.
- 결과미상은 `PENDING_REVIEW`를 유지하며 재결제·해지 버튼이 노출되지 않았습니다.
- reload, 마이페이지 왕복과 뒤로가기 이후에도 자동 재시도 없이 확인대기 상태를 유지했습니다.
- console error/warning은 0건이었습니다.

### 반응형

320/360/390/412px 정상 글자에서 모달과 모든 실제 descendant rect를 검사했습니다.

| 폭 | 문서 overflow | 모달/컨트롤 clipping | 44px 미만 주요 타깃 | 결과 |
| --- | --- | --- | --- | --- |
| 320 | 0 | 0 | 0 | PASS |
| 360 | 0 | 0 | 0 | PASS |
| 390 | 0 | 0 | 0 | PASS |
| 412 | 0 | 0 | 0 | PASS |

Chrome 200% 글자 확대는 브라우저 보안 정책이 `chrome://settings/appearance` 접근과 설정 변경을 차단해 실행하지 못했습니다. 우회 CDP나 외부 설정 변경은 하지 않았습니다.

## Safari·Android Emulator

### iOS Simulator MobileSafari

- iOS 26.5, 실제 MobileSafari/WebKit, CSS 약 402x714에서 운영 홈과 guest 보호 경계를 확인했습니다.
- `/mypage/settings`와 `/checkout`은 guest를 `/login`으로 이동시켰습니다.
- 홈·로그인에서 `scrollWidth=clientWidth`, viewport 이탈 0, clipping 0이었습니다.
- 심사 계정 자격정보를 Simulator로 옮기지 않아 인증 후 Mock 생명주기는 **NOT EXECUTED**입니다.

### Android Emulator Chrome

- Android 16/API 36, Chrome 133, CSS 약 411x914에서 시스템 font scale 2.0을 적용했습니다.
- `/mypage/settings`와 `/checkout`의 guest→login 이동, 로그인 화면의 200% 확대 reflow와 주요 입력·CTA 비클리핑을 확인했습니다.
- Chrome 자체 알림 안내와 번역 팝업은 브라우저 UI로 구분해 닫은 뒤 제품 화면을 재확인했습니다.
- 심사 계정 자격정보를 Emulator로 옮기지 않아 인증 후 Mock 생명주기는 **NOT EXECUTED**입니다.

## 서버 무접촉·배포 증거

- Mock 조작 전 DB 기준선: users 10, active 9, cards 2, orders 11, items 11, audits 0.
- Mock 조작 후 DB 최종값: users 10, active 9, cards 2, orders 11, items 11, audits 0.
- 사용자·카드·주문·항목·감사로그 수가 모두 불변입니다.
- Vercel 배포는 `READY`, production, Git SHA `cb3ce810`이며 apex/www alias가 연결돼 있습니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal 로그 0을 확인했습니다.
- 코드 검토와 DB 불변을 함께 근거로 Mock 조작이 서버·DB·결제 상태를 만들지 않았음을 판정했습니다.

## 발견 결함

신규 제품 결함은 발견하지 못했습니다.

## 미실행·잔여 위험

- Chrome 320/360/390/412px의 200% 정확한 전 폭 매트릭스는 브라우저 설정 보안 정책으로 미실행입니다.
- iOS MobileSafari와 Android Emulator의 인증 후 Mock 생명주기는 자격정보 비전달 원칙으로 미실행입니다.
- 실제 LAONPAY 호스팅 등록, partner API, KSNET billingToken 발급과 결제는 구현되지 않았으며 계속 fail-closed여야 합니다.
- 심사 시연 전용 UI를 실제 PG 연동으로 표현하거나 오인시키면 안 됩니다.

## cleanup

- Android 시스템 font scale을 `1.0`으로 복구했습니다.
- SafariDriver WebDriver 세션을 DELETE하고 서버를 종료했습니다.
- Chrome viewport override를 reset하고 QA 생성 탭을 finalize했습니다.
- DB fixture를 만들지 않았으며 삭제할 테스트 데이터가 없습니다.
- 운영 데이터, Vercel 설정, PG 상태는 변경하지 않았습니다.

## 최종 판정

운영 Chrome에서 등록·조회·승인·거절·결과미상·해지 생명주기, 접근성 모달, 중복 입력 방지와 탭 내 상태 복구가 통과했습니다. 코드 검토와 DB 기준선 불변으로 실제 카드·PG·DB·주문 연결이 없다는 안전 경계도 확인했습니다.

다만 인증된 Safari/Android Mock 흐름과 Chrome 200% 전 폭을 완료하지 못했으므로 전체 PASS는 부여하지 않습니다. 제품 결함 없는 **PARTIAL / 조건부 GO**이며, 운영 Chrome을 사용한 심사 시연은 가능하지만 플랫폼 전체 검증 완료라고 표현하면 안 됩니다.
