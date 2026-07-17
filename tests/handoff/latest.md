# QA 핸드오프 최신본

작성일: 2026-07-17

담당: Codex QA/테스트 세션

제품 SHA: `2c1fa2413b0fae6a62865b37040d897526541b06`

비교 범위: `60af9451b13992a20a23c20fb1a6290ab58efd2f..2c1fa2413b0fae6a62865b37040d897526541b06`

대상 배포: `dpl_8kfuZ9coJkCdfsohU11E1gfsjT9e` / `https://laonshop.com`

자동 수정 회차: **2/2**

결과: **FAIL**

출시 판정: **NO-GO - backdrop 더블클릭 배경 링크 관통 수정 필요**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22에서 focused 7/7, 전체 test 61/61, lint, typecheck, Prisma validate, audit, build를 모두 통과했습니다.
- 이전 `QA-CBDE-01`의 단일 backdrop 포커스 유실은 수정 확인 PASS입니다.
- 등록 성공 backdrop 단일 클릭 뒤 lifecycle `div[tabindex=-1]`에 포커스가 놓이고 다음 Tab은 `등록 정보 조회`였습니다.
- submit·X·Escape와 등록 submit locator/고정 좌표 더블클릭, 연속 Enter도 상태 1건 유지와 포커스 복원을 통과했습니다.
- 그러나 성공 모달 backdrop을 모바일 헤더 링크 위에서 더블클릭하면 두 번째 입력이 배경 링크로 전달돼 `/shop/men`으로 이동하는 P2 결함을 2/2 재현했습니다.
- 승인·거절·결과미상·해지와 결과미상 reload 회귀는 통과했습니다.
- 320/360/390/412px 정상 글자에서 모달 overflow·clipping 0, 주요 타깃 44px 이상입니다.
- Mock resource fetch/XHR/beacon 0, Chrome console warning/error 0, DB count 불변입니다.
- 상세 보고서: [2c1fa24 빌링 Mock backdrop 포인터 회귀](../reports/2026-07-17-2c1fa24-backdrop-pointer-regression.md)

## 핵심 결과

| 영역 | 결과 | 증거 |
| --- | --- | --- |
| 정적 전체 회귀 | PASS | focused 7/7, test 61/61, skip 0, lint/typecheck/prisma/audit/build |
| 등록 전 backdrop 포커스 | PASS | 원래 `카드 등록하기` trigger 복원 |
| 등록 성공 backdrop 단일 클릭 | PASS | lifecycle → 다음 Tab `등록 정보 조회` |
| submit/X/Escape 포커스 | PASS | lifecycle 컨테이너 복원 |
| locator·좌표 submit 더블클릭 | PASS | 결제수단 표시 1개, 초기화 안내 0 |
| 연속 Enter | PASS | 첫 입력 등록, 두 번째 모달 닫기, 상태 유지 |
| backdrop 헤더 위 더블클릭 | **FAIL** | `(95, 91)`에서 `/shop/men` 이동, 2/2 |
| 기존 Mock 생명주기 | PASS | 조회·승인·거절·결과미상·해지·reload |
| 모바일 320~412px | PASS | document/dialog/control overflow·clipping 0, 44px+ |
| 정확한 Chrome 200% | NOT EXECUTED | 이번 회차 도구 제약으로 분리 |
| Android/iOS 인증 Mock | NOT EXECUTED | 인증 세션·도구 제약, touch double-tap 미실행 |
| DB·서버 무접촉 | PASS | DB 불변, fetch/XHR/beacon 0, console error 0 |
| cleanup | PASS | Mock 초기화, 모달·viewport·브라우저 제어 탭 정리 |

## 발견 결함

### QA-2C1-01 - 성공 모달 backdrop 더블클릭이 배경 링크로 관통

- 심각도: **P2**
- 재현: 지정 심사 계정에서 카드 등록 완료 → 성공 모달 열기 → 모바일 헤더 `남성의류` 위 backdrop `(95, 91)` 더블클릭
- 기대: 모달만 닫히고 연속 입력이 배경 링크·버튼으로 전달되지 않음
- 실제: 첫 클릭으로 모달이 닫힌 뒤 두 번째 클릭이 배경 링크에 전달돼 `/shop/men` 이동
- 재현율: **2/2**
- 관련 파일: `app/mypage/settings/billing-card-review-mock.tsx`
- 원인 후보: `mousedown.preventDefault()`는 포커스만 보호하고, 첫 `click`에서 overlay가 제거된 뒤 두 번째 pointer sequence를 흡수하지 못함
- 영향: Mock·DB·주문·PG 상태는 유지되지만 사용자가 예기치 않은 배경 명령을 실행하거나 흐름에서 이탈할 수 있음

## 안전·운영 증거

- 직전 기준과 이번 read-only 확인 DB는 모두 `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`입니다.
- Mock 조작과 reload 후 resource fetch/XHR/beacon 0, Chrome console warning/error 0입니다.
- 카드 원문, `billingToken`, PG TID 필드, pgapi·Authorization, Mock용 Action/DB write는 없습니다.
- 실제 카드, 실 KSNET, 주문·결제 submit, 운영 DB write와 Vercel 설정 변경을 실행하지 않았습니다.
- 인계된 Vercel 배포는 READY, production, Git SHA `2c1fa24`이며 local/origin HEAD와 일치합니다.

## 미실행·외부 blocker

- 정확한 Chrome 200% 확대는 이번 회차에 미실행입니다.
- Android/iOS는 인증 Mock과 실제 touch double-tap을 실행하지 않았습니다.
- 실제 빌링은 전용 개발 pgapi, LAONPAY 호스팅 등록/API, opaque `paymentMethodId` 계약, 서버 소유권·멱등성·UNKNOWN 대사와 토큰 보안 저장 전까지 NO-GO입니다.
- 통신판매업신고번호 확정은 별도 외부 항목입니다.

## 개발 회신

`QA-CBDE-01`의 단일 backdrop 포커스는 수정 확인됐습니다. 하지만 자동 수정 2/2의 필수 추가 조건인 연속 입력 관통 차단이 실패했으므로 대상 커밋은 **FAIL / NO-GO**입니다. 제품 코드는 QA에서 수정하지 않으며 `QA-2C1-01`의 재현 좌표와 필요한 회귀를 개발 작업으로 전달합니다.
