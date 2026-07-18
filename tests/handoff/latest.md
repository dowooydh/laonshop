# QA 핸드오프 최신본

작성일: 2026-07-18

검증 제품 SHA: `90b7255d8de35c12d31a81f12fbde47911a4ae2b`

비교 범위: `eba4c3417418805b96738fe5313e93dec4132ea2..90b7255d8de35c12d31a81f12fbde47911a4ae2b`

운영 배포: `dpl_4hKy3FWShAnjZR81U4wX68nsoJFh` / `https://laonshop.com`

결과: **PARTIAL**

## 판정

- `QA-70CA-01` 취소 POST 모순 상태쌍 수용: **PASS / CLOSED**
- 현재 LAONPAY 비활성 fail-closed 운영: **GO**
- LAONPAY hosted 등록·원클릭·취소 활성화: **NO-GO**
- `QA-90B-01` 주문 제목 360px·200% reflow: **P2 / OPEN**

상세 증거는
[`2026-07-18-90b7255-cancel-status-pair-regression.md`](../reports/2026-07-18-90b7255-cancel-status-pair-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 취소 POST 상태쌍 | PASS | 실제 billing client 24조합 중 허용 4개만 `ok:true`, 모순 20개 모두 `UNKNOWN` |
| 이전 P1 재현 4종 | PASS | terminal `REJECTED/CANCELED` 미생성, order·charge `PAID`, 취소 원장 `UNKNOWN` |
| seller-first 상태행렬 | PASS | REQUESTED·PROCESSING·DONE·REJECTED가 signed GET 원격 원장으로 원자 수렴 |
| Action 독립 방어 | PASS | same charge ID + `charge=PAID` + `cancelRequest=REJECTED` 결박 |
| 불일치·IDOR·fallback | PASS | 소유권·ID·금액·paymentId 불일치 no-write, `PAID`를 반려로 추론하지 않음 |
| 중복·비회귀 | PASS | 취소 신청 POST는 시나리오당 1회, 늦은 REQUESTED가 PROCESSING을 되돌리지 않음 |
| fail-closed 운영 경계 | PASS | env 미설정에서 hosted/oneclick/manual 미노출, 일반 KSPAY 유지, 외부 호출·DB 변화 0 |
| 정적 검증 | PASS | focused 51/51, 전체 102/102, lint/typecheck/prisma/audit/build 통과 |
| 운영 배포 | PASS | READY, production, SHA·apex/www alias 일치, error/fatal 0 |
| 주문 상세 200% reflow | PARTIAL | 320·390·412px 통과, 정확히 360px에서 12px 문서 가로 스크롤 |
| Cleanup | PASS | 격리 DB·서버·브라우저·키·인증서·stub·로그 삭제, listener·임시 파일 0 |

## 발견 결함

### QA-90B-01 - 주문 제목이 360px·글자 200%에서 문서 폭을 확장함

- 심각도: **P2**
- 상태: **OPEN**
- 대상 취소 수정 귀책: **아님**
- 대상 범위에서 `app/order/[id]/page.tsx`, `app/globals.css`, `tailwind-preset.js` 변경: 0

재현:

1. 로그인 고객의 등록카드 `REJECTED` 주문 상세를 엽니다.
2. viewport를 `360x915`, 루트 글자 크기를 `200%`로 설정합니다.
3. 문서와 주문 완료 제목의 scroll/client 폭을 측정합니다.

기대:

- `document.scrollWidth=clientWidth=360`
- 제목이 부모 폭 안에서 줄바꿈

실제:

- document `scrollWidth=372`, `clientWidth=360`
- H1 parent `clientWidth=296`, H1 `scrollWidth=340`
- 관련 class: `text-balance break-keep ... min-[360px]:text-step-2`
- 반려 안내와 조회 버튼은 보이고 조작 가능하며 버튼 높이·내부 clipping은 통과

권장 회귀:

- `min-[360px]:text-step-2`가 확대 환경에서 문서 폭을 늘리지 않도록 수정
- 360px·200%에서 H1 `scrollWidth<=clientWidth`와 document `scrollWidth=clientWidth`를 함께 단정
- PAID, PENDING, FAILED, CANCEL_REQUESTED, CANCELED 제목 교차 확인

## 실행하지 못한 항목

- 실제 Android/iOS 인증 주문 상세와 정확한 플랫폼별 글자 확대
- LAONPAY hosted/API 상호운용과 실제 schema/env/key readiness
- 실카드, KSNET 승인·취소·해지, 운영 인증 계정 쓰기

위 항목은 제품 실패가 아니라 미실행 또는 외부 readiness blocker입니다.

## Cleanup

- 격리 PostgreSQL 17 fixture와 custom HTTPS server를 종료·삭제했습니다.
- 일회성 Ed25519 key, TLS 인증서, env, stub, browser runner와 요청 로그를 삭제했습니다.
- port 3003, 3443, 55432 listener와 `/private/tmp/laonshop-90b-*` 잔존 파일이 없습니다.
- 운영 DB, Vercel env, LAONPAY/PG 상태와 제품 코드는 변경하지 않았습니다.

## 개발 작업 전달

취소 상태쌍 수정은 실제 client와 격리 DB 상태행렬에서 통과했으므로 `QA-70CA-01`을 닫을 수 있습니다. 다음 제품 회차에서는 `QA-90B-01`의 360px·200% 제목 reflow와 별도 claim 경합 안전성 보강을 검증 대상으로 삼습니다.
