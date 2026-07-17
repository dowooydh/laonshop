# QA 핸드오프 최신본

작성일: 2026-07-17

담당: Codex QA/테스트 세션

제품 SHA: `cbde44d0aaeb9706ba35cf992b8ec3053b8f8ea0`

비교 범위: `cf888ecaf1f64c78020d3daf74172dc051bb109c..cbde44d0aaeb9706ba35cf992b8ec3053b8f8ea0`

대상 배포: `dpl_14b131UqtY3uCMGHrg2zAxC5PYHS` / `https://laonshop.com`

결과: **FAIL**

출시 판정: **NO-GO - backdrop 닫기 포커스 회귀 수정 필요**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22에서 test 61/61, lint, typecheck, Prisma validate, audit, build를 모두 통과했습니다.
- 단일 등록은 성공 모달을 유지했습니다.
- locator·고정 좌표 더블클릭과 연속 Enter는 등록 1건을 유지했고 초기화 버튼으로 관통하지 않았습니다.
- submit·X·Escape 닫기는 lifecycle 포커스와 다음 `등록 정보 조회` Tab을 통과했습니다.
- backdrop 닫기만 activeElement가 `main`으로 이동하고 다음 Tab이 `← 마이페이지`로 가는 P2 결함을 2회 재현했습니다.
- 승인·거절·결과미상·해지와 reload/back 회귀는 통과했습니다.
- 320/360/390/412px에서 모달 overflow·clipping 0, 주요 타깃 44px 이상입니다.
- DB count는 전후 불변이고 Vercel READY/SHA 일치, runtime error 0입니다.
- 상세 보고서: [cbde44d 빌링 Mock 등록 더블클릭 회귀](../reports/2026-07-17-cbde44d-billing-doubleclick-regression.md)

## 핵심 결과

| 영역 | 결과 | 증거 |
| --- | --- | --- |
| 정적 전체 회귀 | PASS | test 61/61, skip 0, lint/typecheck/prisma/audit/build |
| 단일 등록 성공 모달 유지 | PASS | 성공 안내와 `등록 화면 닫기` 표시 |
| locator 더블클릭 | PASS | 결제수단 ID 1개, 초기화 안내 0 |
| 412px 고정 좌표 더블클릭 | PASS | `(206, 861.10)`, 등록 상태 유지, 입력 관통 0 |
| 연속 Enter | PASS | 첫 입력 성공 모달, 두 번째 닫기, 등록 상태 유지 |
| submit/X/Escape 포커스 | PASS | lifecycle → 다음 Tab `등록 정보 조회` |
| backdrop 포커스 | **FAIL** | `main` → 다음 Tab `← 마이페이지`, 2/2 재현 |
| 기존 Mock 생명주기 | PASS | 조회·승인·거절·결과미상·해지·reload/back |
| 모바일 320~412px | PASS | document/dialog/control overflow·clipping 0 |
| Android 인증 Mock | NOT EXECUTED | 세션 없음, 200% Chrome ANR은 도구 제약 |
| iOS 인증 Mock | NOT EXECUTED | 세션 없음, 공개 login 렌더만 PASS |
| DB·Vercel | PASS | DB 불변, READY/SHA 일치, error/fatal 0 |
| cleanup | PASS | Mock·viewport·emulator 설정·임시 증거 정리 |

## 발견 결함

### QA-CBDE-01 - backdrop 닫기 뒤 등록 조회 포커스 유실

- 심각도: **P2**
- 재현: 지정 심사 계정에서 Mock 초기화 → 카드 등록 → 단일 submit → 성공 모달 backdrop 클릭
- 기대: lifecycle `div[tabindex=-1]`에 포커스, 다음 Tab은 `등록 정보 조회`
- 실제: `main[tabindex=-1]`에 포커스, 다음 Tab은 `← 마이페이지`
- 재현율: 2/2
- 관련 파일: `app/mypage/settings/billing-card-review-mock.tsx`
- 원인 후보: `onMouseDown={close}` cleanup의 `flowRef.focus()` 뒤 남은 pointer 기본 동작이 포커스를 본문으로 덮어씁니다.
- 영향: 등록 상태와 결제 안전 경계는 보존되지만 backdrop 사용자의 키보드 연속 흐름이 페이지 시작으로 이탈합니다.

## 안전·운영 증거

- Mock 전후 DB는 `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`으로 불변입니다.
- Mock 조작 중 fetch/XHR 증가 0, Chrome console warning/error 0입니다.
- 카드 원문, `billingToken`, PG TID 필드, pgapi·Authorization, Mock용 Action/DB write는 없습니다.
- 실제 카드, 실 KSNET, 주문·결제 submit, 운영 DB write와 Vercel 설정 변경을 실행하지 않았습니다.

## 미실행·외부 blocker

- 정확한 Chrome 200% 확대는 제어 viewport에서 적용되지 않아 미실행입니다.
- Android/iOS는 심사 계정 세션 부재로 인증 Mock과 touch double-tap을 실행하지 않았습니다.
- Android font scale 2.0의 Chrome ANR은 제품 응답 오류 증거가 없어 에뮬레이터 제약으로 분리했습니다.
- 실제 빌링은 전용 개발 pgapi, LAONPAY 호스팅 등록/API, opaque `paymentMethodId` 계약, 서버 소유권·멱등성·UNKNOWN 대사와 토큰 보안 저장 전까지 NO-GO입니다.
- 통신판매업신고번호 확정은 별도 외부 항목입니다.

## 개발 회신

기존 더블클릭 초기화 관통은 수정 확인됐습니다. 다만 필수 수용 조건인 backdrop 닫기 포커스가 실패했으므로 이번 커밋은 **FAIL**입니다. `QA-CBDE-01` 수정 후 네 가지 닫기 경로와 412px 고정 좌표 더블클릭을 함께 회귀해 주세요.
