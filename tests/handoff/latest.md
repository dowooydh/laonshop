# QA 핸드오프 최신본

작성일: 2026-07-22

검증 제품 SHA: `1c078a94d81a47378106d3381a2c857dca72f636`

비교 기준: `97e81a52d17c9aed2d1fe4af94946cd733ba572e`

운영 배포: `dpl_EpsJPjeckHsbWG8qjyYSudS4jvBK` / `https://laonshop.com`

결과: **FAIL**

## 판정

- 심사 계정 수기결제 시연: **NO-GO**
- 기존 일반 KSPAY 운영: **GO, 이번 변경 귀책 회귀 없음**
- 서버 권한·멱등·재고 제외·무 PG 경계: **PASS**
- `QA-1C0-01` dialog 닫힘 입력 관통·키보드 재열림: **P2 / OPEN**
- `QA-1C0-02` Tab 순환 중 `body` 포커스 이탈: **P2 / OPEN**

상세 증거는
[`2026-07-22-1c078a9-manual-payment-demo-regression.md`](../reports/2026-07-22-1c078a9-manual-payment-demo-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | focused 31/31, 전체 132/132, skip 0, lint/typecheck/prisma/audit/build |
| 계정 경계 | PASS | 심사 계정만 타일 2개, 일반 고객 UI 0·Action 재전송 주문 0 |
| 카드정보 경계 | PASS | dialog `name` 0, Action은 issuer만, 카드 원문 필드·값 0 |
| 동일 key 두 탭 | PASS | 두 탭 동일 URL, PAID 주문 1건·항목 1건 |
| 외부 결제·원장 | PASS | PG 요청 0, Billing/Audit 원장 전부 0 |
| 재고 | PASS | stock=1에서 시연 PAID 2건, 실제 예약 합계 0 |
| 완료·취소 | PASS | 영수증/TID 0, CANCEL_REQUESTED, 무 승인취소·환불 안내 |
| dialog 연속 pointer | FAIL | 완료 double-click 두 번째 click이 배경 `#co-address`에 전달 |
| dialog 연속 keyboard | FAIL | 닫힘 80ms 뒤 Enter가 trigger를 실행해 dialog 재열림 |
| focus trap | FAIL | 완료 다음 Tab에서 activeElement가 `BODY`로 이탈 |
| 반응형 | PARTIAL | 외부 overflow/clipping·44px 문제 0, 320~412px·200% input 내부 scroll 관찰 |
| 운영 배포 | PASS | READY/production/SHA·alias 일치, runtime/error/fatal 0 |
| Cleanup | PASS | 격리 DB·fixture·서버·브라우저 삭제, 운영 write/PG/env 변경 0 |

## 개발 작업 전달

`app/checkout/manual-payment-dialog.tsx:56`의 닫힘은 dialog 상태를 즉시 제거하고 다음 animation frame에 trigger를 focus합니다. 닫힘 event sequence를 흡수하는 guard가 없어 실제 double-click의 두 번째 click이 배경 주소 input으로 전달되고, 연속 Enter는 `app/checkout/checkout-form.tsx:404`의 trigger를 다시 실행합니다.

닫힘 직후 짧은 입력 guard를 유지하되 dialog/focus trap/body scroll은 즉시 정리하고, pointer/click/dblclick 및 keyboard repeat을 흡수한 뒤 정상 배경 조작을 복구하는 방향을 권장합니다. Tab/Shift+Tab의 처음·마지막 순환도 명시적으로 보강해야 합니다.

수정 후 완료/X/취소/Escape 각각에 대해 mouse double-click, touch double-tap, Enter/Space 반복, 배경 주소·구매동의·결제 submit sentinel, trigger focus 복원과 보호 종료 후 정상 조작을 실제 브라우저로 재검증해야 합니다.

서버·DB 핵심 경계는 통과했지만 이번 기능의 필수 상호작용 조건이 실패했으므로 제품 전체 결과는 **FAIL**입니다.
