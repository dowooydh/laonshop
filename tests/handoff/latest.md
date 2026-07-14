# QA 핸드오프 최신본

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상: `main` / `b234b3204d205c2d75b322894dfb6049593b932c`

비교 범위: `a51524dfda96604e818e1019303af05aa1587a61..b234b3204d205c2d75b322894dfb6049593b932c`

결과: **PASS**

출시 판정: **GO - 테스트 MID 카드사 심사 범위 / 실 MID는 공식 사전 결박 스펙 전 NO-GO**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 49/49, skip 0, 이미지 gate, lint, typecheck, Prisma validate, production audit, build, diff check를 통과했습니다.
- 실제 route+DB+provider stub에서 변조·취소·실 MID 외부 호출 0회/DB 무변경, PG 필드 불일치 `PENDING+marker`, 병렬 valid result 외부 호출 1회·`PAID` 1건을 확인했습니다.
- WEBFEP redirect/timeout/503/connection close/파싱·식별자 오류 9종이 모두 불명확 결과로 보류되고 재호출되지 않는 경계를 확인했습니다.
- 상품 329개·자산 1,645개·로컬 HTML 329개를 전수 확인했고 구형 cart/recent 이미지 복구와 수량·사이즈·nonce 보존을 확인했습니다.
- 로컬 Chrome 320/360/390/412px 100%·200%, 실제 Android Chrome 412px, 운영 공개 배포가 모두 통과했습니다.
- Vercel production은 `READY`, Git SHA `b234b32`, 최근 1시간 runtime 오류와 error/fatal 로그 0입니다.
- 상세 보고서: [2026-07-15 `b234b32` 결제 승인 경계·상품 이미지 복구 회귀 QA 보고서](../reports/2026-07-15-b234b32-payment-image-security-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 49/49, skip 0, image gate/lint/typecheck/prisma/audit/build/diff check PASS |
| result 보안 경계 | PASS | invalid·타 주문·취소·길이 초과·실 MID provider 0회/DB 변화 0 |
| PG 결과 결박 | PASS | moid/금액/승인번호/거래번호 불일치 `PENDING+marker`, 재호출 0 |
| 병렬 멱등성 | PASS | 동일 valid result 2개 병렬 제출, 외부 승인 1회·`PAID` 1건 |
| WEBFEP fault | PASS | 307/308/503/timeout/close/parse/식별자 9종 모두 indeterminate, redirect error |
| 미계약 결제 차단 | PASS | checkout 수기·원클릭 0개, 카드 원문 등록 0개, mock 승인 경로 0 |
| 이미지 전수 검사 | PASS | 329상품, 1,645 고유 자산, 329 HTML 모두 버전된 5장 |
| 저장 복구 | PASS | null·악성 URL 복구, API 503·quota에서 항목/수량/사이즈/nonce 보존 |
| 모바일·Android | PASS | Chrome 8조합 + Android Chrome 133, overflow·console 제품 오류 0 |
| 운영 배포 | PASS | Vercel READY, production SHA·aliases 일치, 공개 WebP 5장 1200x1500, 오류 0 |

## 결함과 위험

- 이번 변경의 신규 P0/P1/P2 제품 결함은 발견하지 못했습니다.
- KSNET `reHash`/`reCommConId` 주문 사전 결박 공식 스펙이 없어 테스트 MID의 악의적 교차 comm ID는 사후 보류·KSTA 대조가 필요합니다.
- 실 MID는 코드가 fail-closed이며 공식 스펙 구현과 실 KSNET 검증 전까지 NO-GO입니다.
- 공개 이미지 복구 API 반복 요청 비용은 P2 운영 관찰 항목입니다.
- Safari/WebKit/iOS 실제 기기와 실 KSNET 승인·취소·영수증은 실행하지 않았습니다.

## cleanup

- `qa.b234.*` 사용자·주문·상품 잔존 0입니다.
- 최종 DB는 users 10/active 9/products 329/orders 9/items 9/audits 0/cards 4/wishlists 0입니다.
- 로컬 3013 서버, 임시 QA 러너, Android CDP 포워딩을 종료·삭제했습니다.
- 운영·마스터 데이터, Vercel 설정, 실 PG 상태 변경은 없습니다.

## 개발 회귀 요청

제품 커밋 `b234b32`을 테스트 MID 카드사 심사 출시 후보로 유지합니다. 실 MID 전환 전에는 KSNET 공식 사전 결박 스펙을 확보해 `reHash`/`reCommConId` 교차 주문 방지와 실제 승인·취소·영수증 회귀를 별도 수행해야 합니다.
