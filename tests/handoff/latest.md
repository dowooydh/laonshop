# QA 핸드오프 최신본

작성일: 2026-07-23

검증 제품 SHA: `f52d08126446fd6b21589958bb4c7cdb1de6fbdd`

비교 기준: `3d4de53f39698021a5d84cc56a92ea92095fcea7`

운영 배포: `dpl_F8ud1zQkBP8XTbH32PgeiTwnKAeW` / `https://laonshop.com`

결과: **FAIL**

## 판정

- `QA-1C0-01` dialog 닫힘 연속 입력 관통: **PASS / CLOSED**
- `QA-1C0-02` focus trap: **PASS / CLOSED**
- 200% 확대 시연정보 internal scroll: **PASS / CLOSED**
- `QA-F52-01` 취소 접수 후 화면 갱신 비결정성: **P2 / OPEN**
- 심사 계정 수기결제 시연 전체: **NO-GO**
- 기존 일반 KSPAY 운영: **GO, 이번 변경 귀책 회귀 없음**

상세 증거는
[`2026-07-23-f52d081-manual-payment-dialog-regression.md`](../reports/2026-07-23-f52d081-manual-payment-dialog-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | focused 31/31, 전체 132/132, skip 0, lint/typecheck/prisma/audit/build |
| pointer/touch guard | PASS | 완료/X/취소 mouse·touch 전부 배경 hit 0, 후속 guard event 4개씩 |
| keyboard guard | PASS | Enter/Space 80ms 반복 재열림 0, 760ms 뒤 정상 복구 |
| guard 재무장 | PASS | 400ms 후 입력으로 연장, 마지막 입력 760ms 뒤 shield 제거·배경 focus 복구 |
| focus trap | PASS | Tab 30회+Shift+Tab 30회, BODY/dialog 외 이탈 0 |
| opener focus | PASS | 상단 타일·입력·정보 수정·validation fallback 정확 복귀 |
| 반응형 | PASS | 7폭 x 100/200%=14조합, overflow/clipping/internal scroll/44px 문제 0 |
| 두 탭 멱등 | PASS | 동일 nonce 두 탭, PAID 주문 1·항목 1·동일 URL |
| 카드정보·PG | PASS | 카드 필드 body 0, PG 요청 0, pgTrno null, Billing/Audit 0 |
| 재고 | PASS | stock=1에서 demo PAID 2건, 실제 예약 0 |
| 일반 고객 | PASS | demo UI 0, Action 재전송 주문 0, 일반 KSPAY 4수단 유지 |
| 취소 DB·PG | PASS | CANCEL_REQUESTED 3/3, 외부 PG 0 |
| 취소 화면 자동 갱신 | FAIL | 반복 3회 중 1회만 접수 화면, 명시적 reload는 3/3 수렴 |
| 운영 배포 | PASS | READY/production/SHA·alias 일치, runtime error cluster 0 |
| Cleanup | PASS | 격리 DB·fixture·서버·브라우저 삭제, 운영 write/PG/env 변경 0 |

## 개발 작업 전달

### QA-F52-01 P2

심사 demo 주문에서 취소 신청을 한 번 제출하면 DB는 `CANCEL_REQUESTED`로 3/3 전환되고 외부 PG 요청은 0이었습니다. 그러나 [`app/order/[id]/cancel-request.tsx`](../../app/order/[id]/cancel-request.tsx)의 `res.ok -> router.refresh()` 이후 접수 heading으로 자동 전환된 것은 1/3뿐이었습니다. 실패 2회에는 8초 동안 기존 결제완료 화면과 취소 form이 남았고, 명시적 reload 뒤에는 3/3 접수 heading과 무 승인취소·환불 안내로 수렴했습니다.

이번 `f52d081`의 dialog 변경 파일 밖에서 발견된 인접 기존 경로입니다. 실제 금전·PG 부작용은 없지만 사용자가 이미 처리된 취소 form을 다시 제출할 수 있으므로, 성공 결과를 화면의 terminal state로 즉시 반영하거나 신뢰할 수 있는 새 GET 전환/fallback을 둔 뒤 반복 브라우저 검증이 필요합니다.

필수 회귀:

1. 취소 성공 10회에서 DB 상태와 접수 heading 10/10 동시 수렴
2. 성공 뒤 form 제거와 double-click·두 탭 중복 접수 0
3. 느린/실패 refresh에서 완료 안내 또는 명확한 recovery 제공
4. 뒤로가기·새로고침 뒤 접수 상태 유지
5. 일반 KSPAY와 demo 취소 경로 교차 회귀

Android/iOS 인증 dialog는 Chrome P2 확정 뒤 미실행했습니다. Chrome touch context는 통과했지만 실제 모바일 브라우저 PASS로 간주하지 않습니다.
