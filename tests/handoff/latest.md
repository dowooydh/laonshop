# QA 핸드오프 최신본

작성일: 2026-07-11

담당: Codex QA/테스트 세션

대상: `main` / `06f0e084b6dbcd5f2221e09ecb483058a354fb1a`

비교 범위: `5fe1417369f12e71328f221a34604f7a9229a07a..06f0e084b6dbcd5f2221e09ecb483058a354fb1a`

결과: **FAIL**

출시 판정: **NO-GO**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 11/11, lint, typecheck, Prisma validate, production audit, production build가 모두 통과했습니다.
- 재고 합산·마지막 재고 동시 주문·동일 키 주문 멱등성·일반 KSPAY callback 처리 마커·이메일 동시 가입·320/390/412px 반응형 수정은 실제 회귀에서 통과했습니다.
- 수기결제의 503/timeout 재전송이 외부 승인 API를 다시 호출하는 P1을 확정했습니다.
- KSPAY 처리 마커 주문도 30분 뒤 재고 예약에서 제외되는 P1을 확정했습니다.
- 30분 시간 버킷 경계에서 동일 체크아웃의 멱등키가 달라지는 P2를 확인했습니다.
- 상세 보고서: [2026-07-11 `06f0e08` 회귀 QA 보고서](../reports/2026-07-11-06f-regression/report.md)

## 우선 결함

| 우선순위 | 결함 | 실제 증거 | 관련 위치 |
| --- | --- | --- | --- |
| P1 | 수기결제 불명확 응답 뒤 같은 주문 재시도 시 외부 승인 재호출 | 로컬 503 stub `REQ 1 -> REQ 2`, DB는 주문 1건 PENDING | `app/checkout/actions.ts:181-233` |
| P1 | `__KSPAY_PROCESSING__` PENDING도 30분 뒤 재고 예약 해제 | stock 1/marker 31분 fixture에서 두 번째 주문 guard 허용 | `lib/order-guard.ts:167-171` |
| P2 | 30분 버킷 경계 전후 같은 요청의 멱등키 불일치 | helper 실측 `sameRequestAcrossWindowBoundaryHasSameKey=false` | `lib/checkout-idempotency.ts:20-22` |

## 통과 범위

- 동일 상품 S1+M1 합산 재고 거부, 허용되지 않은 사이즈 거부
- 서로 다른 사용자 마지막 재고 동시 주문: 성공 1, 거부 1, 주문 1건
- 같은 사용자·동일 키 동시 요청과 실제 두 탭 재전송: 동일 order/moid, 주문 1건
- 동일 이메일 대소문자 변형 동시 가입: 성공 1, 중복 안내 1, 500 없음
- 대문자 변형 이메일 로그인 성공
- KSPAY 처리 마커 재전송 차단, 취소 result 병렬 FAILED, PENDING/FAILED 재결제 UI
- KSPAY 스크립트 차단/8초 지연: spinner 종료, 오류·재시도 노출
- 네트워크 offline 실패와 복구, 타 사용자 주문 404
- Chromium 320/390/412px 주요 6개 화면과 200% root font overflow 0
- Android Chrome 133 실제 320/390/412px, 시스템 글꼴 200%, 검색 빈 상태
- `pnpm audit --prod` 취약점 0

## 실행하지 못한 범위

- 실카드 승인, 자동취소, 실영수증
- 운영 Vercel 배포 커밋 일치와 운영 도메인
- Safari/WebKit, iOS 실제 기기
- 실제 KSNET 장애: 로컬 stub/브라우저 route로 대체
- 관리자: 저장소에 화면 없음
- 비밀번호 변경·회원탈퇴 전체 흐름은 이번 변경 범위에서 반복하지 않음

## cleanup

- QA 사용자 8명, 주문 9건, 주문항목 9건, QA 상품 1개를 삭제했습니다.
- 최종 DB는 시작 전과 같은 사용자 9, 활성 사용자 8, 주문 4, 주문항목 4, 상품 329, 찜 0, 등록카드 4입니다.
- Android 해상도 1080x2400, font scale 1.0을 복구하고 adb forward와 로컬 서버를 종료했습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없었습니다.

## 개발 회귀 요청

1. 수기결제도 외부 호출 전에 처리 마커를 별도 transaction으로 commit하고 503/timeout/commit 실패 뒤 외부 호출 1회를 보장합니다.
2. processing marker 주문은 운영 확인 전 재고 예약에서 제외되지 않도록 일반 PENDING과 분리합니다.
3. 체크아웃 버킷 경계 전후 1ms, 다중 탭, 동일 카트 재구성 멱등성을 추가합니다.
4. 수정 뒤 Node 22 정적 검증, DB 병렬 테스트, 로컬 PG fault injection과 모바일 회귀를 다시 수행합니다.
