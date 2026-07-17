# QA 핸드오프 최신본

작성일: 2026-07-17

담당: Codex QA/테스트 세션

제품 SHA: `352990211fa631a549b847c792784dab525eda9b`

비교 범위: `8073b1cc571b95bdf28fe65d088d67ad6db183df..352990211fa631a549b847c792784dab525eda9b`

대상 배포: `dpl_5QTS9kpxgEKkQx5AUuZxukaDEEj3` / `https://laonshop.com`

결과: **PARTIAL**

출시 판정:

- 운영 Chrome 웹 심사 시연: **조건부 GO**
- 플랫폼 전체 PASS: **보류**
- 실제 원클릭 빌링: **미구현·fail-closed / NO-GO**

## 요약

- 제품 코드는 수정하지 않았습니다.
- 이전 P2 `QA-2C1-01`의 성공 모달 backdrop double-click 배경 링크 관통을 원 좌표 `(95, 91)`에서 2/2 재검증해 수정 확인했습니다.
- 첫 닫기 입력 뒤 투명 guard가 연속 입력을 흡수하고, 입력마다 보호 시간을 재무장하며, 만료 뒤 배경 UI가 정상 복구됐습니다.
- backdrop·X·`등록 화면 닫기`·등록 submit double-click에서 Mock 상태 1건 유지, 초기화·배경 관통 0을 확인했습니다.
- 단일 backdrop 뒤 lifecycle `div[tabindex=-1]`에 포커스가 놓이고 다음 Tab은 `등록 정보 조회`였습니다.
- 등록→조회→승인→해지와 결과미상→reload→재시도·해지 차단 회귀를 통과했습니다.
- focused 7/7, 전체 test 61/61, lint, typecheck, Prisma validate, audit, build를 모두 통과했습니다.
- 320/360/390/412px 정상 글자에서 overflow·clipping 0, 주요 타깃 44px 이상입니다.
- Mock resource fetch/XHR/beacon 0, console warning/error 0, DB count 불변입니다.
- 정확한 Chrome 200%와 인증된 Android/iOS touch double-tap은 미실행이므로 전체 결과는 PARTIAL입니다.
- 상세 보고서: [3529902 빌링 Mock 닫힘 입력 guard 회귀](../reports/2026-07-17-3529902-dismiss-input-guard-regression.md)

## 핵심 결과

| 영역 | 결과 | 증거 |
| --- | --- | --- |
| 정적 전체 회귀 | PASS | focused 7/7, test 61/61, skip 0, lint/typecheck/prisma/audit/build |
| 원 재현 좌표 double-click | PASS | `(95, 91)` 2/2, `/shop/men` 이동 0 |
| guard 재무장 | PASS | 400ms 간격 연속 입력 흡수, 마지막 입력 후 700ms 보호 재시작 |
| guard 만료 뒤 복구 | PASS | 만료 후 동일 좌표 단일 클릭이 `/shop/men` 정상 이동 |
| X·닫기 submit double-click | PASS | 상태 1건 유지, 초기화·배경 관통 0 |
| 등록 submit double-click | PASS | 등록 1건, lifecycle 포커스 |
| 단일 backdrop 포커스 | PASS | lifecycle → 다음 Tab `등록 정보 조회` |
| Escape | PASS | 즉시 close, guard 0, lifecycle 포커스 |
| 기존 Mock 생명주기 | PASS | 승인·해지, 결과미상·reload·차단 |
| 모바일 320~412px | PASS | 정상 글자 기준 overflow·clipping 0, 44px+ |
| 정확한 Chrome 200% | NOT EXECUTED | 도구 제약으로 분리 |
| Android/iOS 인증 Mock | NOT EXECUTED | 인증 세션·도구 제약, touch double-tap 미실행 |
| DB·서버 무접촉 | PASS | DB 불변, fetch/XHR/beacon 0, console error 0 |
| cleanup | PASS | Mock 초기화, dialog·guard·브라우저 제어 세션 정리 |

## 결함 상태

### QA-2C1-01 - 성공 모달 backdrop double-click 배경 링크 관통

- 이전 심각도: **P2**
- 현재 상태: **FIXED**
- 재현 환경: 운영 Chrome `412x915`, 지정 심사 계정 인증 탭
- 재현 좌표: 모바일 헤더 `남성의류` 위 `(95, 91)`
- 결과: 실제 mouse double-click 2/2에서 URL·Mock 상태·`paymentMethodId` 불변
- 신규 제품 결함: 없음

잔여 위험으로 700ms가 모든 OS의 사용자 설정 double-click 간격을 포괄하는 보편적 상한은 아닙니다.

## 안전·운영 증거

- DB 기준선 전후는 모두 `users 10 / active 9 / cards 2 / orders 11 / items 11 / audits 0`입니다.
- Mock 조작 중 resource fetch/XHR/beacon 0, Chrome console warning/error 0입니다.
- 카드 원문, `billingToken`, PG TID, pgapi·Authorization, Mock용 Action/DB write는 없습니다.
- 실제 카드, 실 KSNET, 주문·결제 submit, 운영 DB write와 Vercel 설정 변경을 실행하지 않았습니다.
- Vercel 배포는 READY, production, Git SHA `3529902`이며 local/origin HEAD와 apex/www alias가 일치합니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal log 0입니다.

## 미실행·외부 blocker

- 정확한 Chrome 200% 확대
- 인증된 Android/iOS Billing Mock 전체 생명주기와 touch double-tap
- Mock 초기화 버튼 바로 위 backdrop의 정확한 좌표 관통
- 이번 SHA의 브라우저 거절 분기와 연속 Enter
- 실제 빌링은 전용 개발 pgapi, LAONPAY 호스팅 등록/API, opaque `paymentMethodId` 소유권·멱등성, UNKNOWN 대사와 토큰 보안 저장 전까지 NO-GO입니다.
- 미실행 항목은 제품 결함이 아니라 도구·인증 세션 제약으로 분리했습니다.

## Cleanup

- 브라우저 Mock 초기화, dialog 0, guard 0, 저장된 Mock 결제수단 0을 확인했습니다.
- Chrome viewport와 제어 세션을 정리했습니다.
- QA fixture와 DB write를 생성하지 않았습니다.
- 운영 데이터, Vercel env, PG 설정은 변경하지 않았습니다.

## 개발 회신

`QA-2C1-01`은 운영 Chrome 원 재현 좌표에서 수정 확인됐습니다. Chrome 웹 심사 시연은 조건부 GO입니다. 정확한 200%와 인증된 Android/iOS touch double-tap이 미실행이므로 플랫폼 전체 판정은 PARTIAL로 유지합니다. 제품 코드는 QA에서 수정하지 않았습니다.
