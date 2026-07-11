# QA 핸드오프 최신본

작성일: 2026-07-11

담당: Codex QA/테스트 세션

대상: `main` / `588e845e66e8887461e1faf9714d760d31391e25`

자동 수정 회차: 1/2

결과: **PASS**

출시 판정: **GO - 이번 수정 범위 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 14/14, lint, typecheck, Prisma validate, production audit, production build가 모두 통과했습니다.
- 수기결제 503·8초 timeout·승인 후 DB 확정 실패에서 외부 승인 요청은 1회로 제한됐고 PENDING+processing marker가 유지됐습니다.
- 명시적 승인 거절은 FAILED+marker 해제 후 재시도를 허용했고, 성공은 PAID 1건으로 확정됐습니다.
- processing marker 주문은 29/30/31분과 24시간 뒤에도 재고를 계속 예약했고 일반 PENDING만 31분에 해제됐습니다.
- 시간 경계 멱등키, 카트 nonce 변경, 마지막 재고와 동일 키 병렬 주문 회귀가 통과했습니다.
- 상세 보고서: [2026-07-11 `588e845` 회귀 QA 보고서](../reports/2026-07-11-588e845-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| WEBFEP 503 | PASS | 첫 요청 1회, 재제출 뒤 총 1회, PENDING+marker |
| WEBFEP timeout | PASS | 약 9.9초 안전 오류, 재제출 뒤 총 1회 |
| 명시적 거절 | PASS | FAILED, approvalNo null, 재시도 stub 1→2 |
| WEBFEP 성공 | PASS | PAID 1건, approvalNo/pgTrno 저장 |
| 성공 후 DB 확정 실패 | PASS | 22초 advisory lock, PENDING+marker, stub 1회 |
| marker 재고 예약 | PASS | 29/30/31분/24시간 모두 두 번째 주문 거부 |
| 일반 PENDING 만료 | PASS | 29분 예약, 31분 해제 |
| 마지막 재고 동시성 | PASS | 성공 1, 거부 1, 주문 1건 |
| 동일 키 동시성 | PASS | 같은 order ID, 주문 1건 |
| 시간 경계/카트 nonce | PASS | 30분·24시간 동일 키, 의미 변경만 nonce 회전 |

## 도구 timeout 판정

QA의 첫 두 DB 확정 실패 주입은 `pg_sleep()` void 역직렬화 오류로 잠금이 풀려 정상 PAID가 됐습니다. 당시 브라우저 timeout은 제품 결함이 아니라 fault-injection 도구 실패입니다.

연결된 DEV 작업이 새 finalize3 주문에서 marker를 100ms polling하고 order advisory lock을 22초 유지해 다시 검증했습니다. 화면 안전 오류, DB PENDING+marker, stub 요청 1회와 재제출 차단을 확인했으며 `[AUTO_QA_EVIDENCE]`로 전달받았습니다. QA는 최종 DB 기준선과 cleanup을 독립 확인했습니다.

## 미실행·잔여 위험

- 실 KSNET 승인·장애·자동취소·실영수증
- 운영 Vercel 배포 커밋 일치, Safari/WebKit, iOS 실제 기기
- 불명확 marker는 자동 해제되지 않아 운영자 KSTA 확인 필요
- 일반 KSPAY result 경합과 실제 두 탭 UI는 직전 회귀를 유지하고 이번에는 단위/DB 병렬 경계로 재검증

## cleanup

- QA 사용자 7명, 주문 8건, 주문항목 8건, QA 상품 1개를 삭제했습니다.
- 최종 DB는 사용자 9, 활성 사용자 8, 주문 4, 주문항목 4, 상품 329, 찜 0, 등록카드 4, QA fixture 0입니다.
- 3003/3999 서버와 임시 브라우저 컨텍스트를 종료했습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없었습니다.

## 다음 운영 확인

1. 운영 배포가 제품 커밋 `588e845`을 가리키는지 확인합니다.
2. 실 MID/WEBFEP 계약 전에는 `KSPAY_REST_LIVE` 이중 가드를 유지합니다.
3. 불명확 주문의 KSTA 확인·marker 해제 운영 절차를 준비합니다.
