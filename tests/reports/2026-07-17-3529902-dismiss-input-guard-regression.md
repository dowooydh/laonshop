# 3529902 빌링 Mock 닫힘 입력 guard 회귀 QA 보고서

작성일: 2026-07-17

담당: Codex QA/테스트 세션

제품 SHA: `352990211fa631a549b847c792784dab525eda9b`

비교 범위: `8073b1cc571b95bdf28fe65d088d67ad6db183df..352990211fa631a549b847c792784dab525eda9b`

대상 배포:

- Production: `https://laonshop.com`, `https://www.laonshop.com`
- Fixed: `https://laonshop-hwqtun2nr-customorder.vercel.app`
- Deployment: `dpl_5QTS9kpxgEKkQx5AUuZxukaDEEj3`

## 판정

- 전체 결과: **PARTIAL**
- `QA-2C1-01`: **FIXED**
- 운영 Chrome 표적 gate: **PASS**
- 운영 Chrome 웹 심사 시연: **조건부 GO**
- 플랫폼 전체 PASS: **보류**
- 실제 원클릭 빌링: **미구현·fail-closed / NO-GO**

정확한 Chrome 200% 확대와 인증된 Android/iOS의 실제 touch double-tap을 실행하지 못했으므로 전체 PASS로 판정하지 않았습니다. 이번 수정의 원 결함인 Chrome mouse double-click 배경 관통은 원 재현 좌표에서 2/2 차단됐습니다.

## 변경 독립 검토

- 제품 코드는 수정하지 않았습니다.
- 변경은 Billing Mock 모달의 `closed/open/dismiss-input-guard` 상태, 700ms 입력 guard, timer 정리에 한정됩니다.
- guard는 `pointerdown`, `pointerup`, `mousedown`, `click`, `dblclick`을 흡수하고 각 입력마다 700ms를 재무장합니다.
- Escape는 guard 없이 즉시 닫히며, 성공 후 lifecycle 포커스 계약은 유지됩니다.
- API, Server Action, DB, 주문, 실제 PG, 인증·세션 로직 변경은 없습니다.
- 카드 원문, `billingToken`, PG TID, pgapi, Authorization, fetch, DB write 경계도 그대로 부재합니다.
- 독립 코드리뷰에서 신규 P0~P3 결함은 발견하지 못했습니다.

## 정적·빌드 검증

| 항목 | 결과 |
| --- | --- |
| focused Billing Mock | PASS 7/7 |
| `pnpm test` | PASS 61/61, skip 0 |
| 이미지 gate | PASS, 상품 329/1,316장 및 큐레이션 20상품/100장 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma 7 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 취약점 0 |
| `pnpm build` | PASS, Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS |

## Chrome 원 결함 표적 회귀

환경: 운영 Chrome, 지정 심사 계정 인증 탭, viewport `412x915`

### 헤더 링크 위 backdrop double-click

- 모바일 헤더 `남성의류` 링크 실제 영역: `x=64.01..126.39`, `y=69..113`
- 이전 결함 재현 좌표: `(95, 91)`
- 실제 mouse double-click을 독립적으로 2회 실행했습니다.
- 두 번 모두 모달은 닫히고 guard가 남았으며 URL은 `/mypage/settings`를 유지했습니다.
- `/shop/men` 이동 0회, Mock 초기화 0회, `paymentMethodId` 변경 0회였습니다.
- 결과: **PASS 2/2, QA-2C1-01 FIXED**

### guard 재무장과 정상 복구

| 순서 | 관찰 결과 |
| --- | --- |
| backdrop 닫기 입력 직후 | dialog 0, guard 1, URL 불변 |
| 400ms 뒤 동일 좌표 입력 | guard 1, URL 불변 |
| 다시 400ms 뒤 동일 좌표 입력 | guard 1, URL 불변 |
| 마지막 입력 750ms 뒤 | guard 0 |
| guard 만료 뒤 동일 좌표 단일 클릭 | `/shop/men` 정상 이동 |

연속 입력은 guard가 재무장되어 배경으로 관통하지 않았고, 보호 시간이 끝난 뒤 배경 UI가 정상 복구됐습니다.

### 닫기 경로별 회귀

| 경로 | 결과 |
| --- | --- |
| X double-click | PASS, dialog 0, guard 1, 등록 1건 유지, 초기화 0 |
| `등록 화면 닫기` submit double-click | PASS, 상태 1건 유지, 배경 관통 0 |
| 등록 submit double-click | PASS, 등록 1건, lifecycle 포커스, 초기화 0 |
| 성공 후 Escape | PASS, dialog 0, guard 0, lifecycle 포커스 |
| 단일 backdrop click | PASS, lifecycle `div[tabindex=-1]` 포커스 |
| 단일 backdrop 뒤 다음 Tab | PASS, `등록 정보 조회` |

`브라우저 Mock 초기화` 버튼과 backdrop을 정확히 겹치는 좌표는 autofocus에 따른 스크롤 재배치 때문에 재현하지 못했습니다. 대신 운영 부작용이 없는 헤더 링크를 배경 명령 sentinel로 사용해 실제 hit-test 관통을 검증했습니다.

## 기존 생명주기 회귀

- 등록 → 조회 → 승인 → 해지: PASS
- 승인 뒤 결제 재실행 없음: PASS
- 초기화 → 등록 → 조회 → 결과미상: `PENDING_REVIEW` 유지 PASS
- 결과미상에서 결제 재시도·해지 미노출: PASS
- 결과미상 reload 뒤 상태 유지와 자동 재시도 없음: PASS
- 이번 SHA에서 거절 분기와 연속 Enter는 브라우저로 재실행하지 않았습니다. 동일 상태 전이의 정적 7/7 및 전체 61/61은 통과했습니다.

## 반응형·접근성

정상 글자 크기의 운영 Chrome 모달을 측정했습니다.

| viewport | dialog 가로 경계 | 문서 overflow | descendant outside | control clipping | 최소 타깃 |
| --- | --- | --- | --- | --- | --- |
| 320px | `x=8..312` | 0 | 0 | 0 | 44px |
| 360px | `x=8..352` | 0 | 0 | 0 | 44px |
| 390px | `x=8..382` | 0 | 0 | 0 | 44px |
| 412px | `x=8..404` | 0 | 0 | 0 | 44px |

- 모달 포커스 trap과 닫힘 뒤 lifecycle 포커스 복원을 확인했습니다.
- Mock 조작 중 fetch/XHR/beacon은 각각 0건이었습니다.
- Chrome console warning/error는 0건이었습니다.

## DB·배포 증거

- DB read-only 기준선 전후:
  - users 10
  - active 9
  - cards 2
  - orders 11
  - items 11
  - audits 0
- 전후 count는 모두 동일했습니다.
- Vercel 배포는 `READY`, production, Git SHA `3529902`이며 apex/www alias가 일치했습니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal log 0을 확인했습니다.

## 발견 결함

이번 표적 회귀에서 신규 제품 결함은 발견하지 못했습니다.

잔여 위험:

- 700ms는 검증한 Chrome 연속 입력을 포괄하지만 모든 OS의 사용자 설정 double-click 간격에 대한 보편적 상한은 아닙니다.
- 정확한 Chrome 200%와 인증된 모바일 touch double-tap은 아직 실행 증거가 없습니다.

## 미실행

- 정확한 Chrome 200% 확대
- 인증된 Android Emulator Billing Mock 전체 생명주기와 touch double-tap
- 인증된 iOS Simulator MobileSafari Billing Mock 전체 생명주기와 touch double-tap
- Mock 초기화 버튼 바로 위 backdrop의 정확한 좌표 관통
- 실제 카드, 실 KSNET, 주문·결제 submit, 운영 DB write

도구·인증 세션 제약으로 미실행한 항목이며 제품 실패로 분류하지 않았습니다.

## Cleanup

- 브라우저 Mock을 초기화했습니다.
- dialog 0, guard 0, 저장된 Mock 결제수단 0을 확인했습니다.
- Chrome viewport와 제어 세션을 정리했습니다.
- QA fixture와 DB write는 생성하지 않았습니다.
- 운영 데이터, Vercel env, PG 설정을 변경하지 않았습니다.

## 최종 의견

`QA-2C1-01`의 Chrome mouse double-click 배경 관통은 원 좌표에서 수정 확인됐습니다. 운영 Chrome 웹 심사 시연은 조건부 GO입니다. 다만 정확한 200%와 인증된 Android/iOS touch double-tap이 미실행이므로 플랫폼 전체 결과는 PARTIAL입니다. 실제 원클릭 빌링은 외부 계약과 서버 연동 전까지 계속 fail-closed이며 출시 대상이 아닙니다.
