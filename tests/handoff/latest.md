# QA 핸드오프 최신본

작성일: 2026-07-14

담당: Codex QA/테스트 세션

대상: `main` / `07916d402c8bea72668ae8ddbeac682a7b963fc2`

비교 범위: `30321c1b2450524fda2a79e8b493ce4dbe931673..07916d402c8bea72668ae8ddbeac682a7b963fc2`

결과: **PASS**

출시 판정: **GO - 미연동 원클릭 차단과 원본 상품 이미지 전환 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 33/33, skip 0, 이미지 파이프라인 1/1, lint, typecheck, Prisma validate, production audit, build, diff check를 통과했습니다.
- checkout/retry stale oneclick은 주문·상태 변경 전에 동일 안내로 차단됐고 주문·항목·재고 예약·감사로그 변경이 없었습니다.
- raw 카드 등록, mock billing token, PG 호출 없는 합성 PAID 경로는 제거됐고 설정에는 과거 mock 카드의 본인 삭제만 남았습니다.
- 본인 카드 삭제와 타인 `cardId` IDOR 차단을 UI·DB로 확인했습니다.
- legacy cart/recent는 상품·수량·사이즈·nonce를 보존하고 이미지 URL만 제거했습니다. storage write 실패에서도 현재 장바구니는 유지됐습니다.
- 원본 상품 이미지는 로컬과 운영 320/412px에서 4:5 frame, `object-fit: cover`, 가로 overflow 0, legacy URL 0으로 확인됐습니다.
- 상세 보고서: [2026-07-14 `07916d4` 원클릭 차단·상품 이미지 회귀 QA 보고서](../reports/2026-07-14-07916d4-billing-image-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 33/33, 이미지 pipeline 1/1, lint/typecheck/prisma/audit/build/diff check PASS |
| 신규 카드 등록 제거 | PASS | raw 카드 입력·등록 버튼·mock token·합성 PAID 경로 0 |
| stale oneclick | PASS | checkout/retry 공통 거부, 주문·상태·audit 변경 0 |
| 카드 소유권 | PASS | 본인 삭제 성공, 타인 `cardId` DB 보존 |
| 일반 KSPAY | PASS | 카드·카카오·네이버·계좌이체 UI 및 인증 폼 생성, 외부 승인 미실행 |
| cart/recent 마이그레이션 | PASS | 구매 의미·nonce 보존, legacy image URL만 제거 |
| 로컬 반응형 | PASS | 320/390/412px, 100%/200%, 주요 화면 overflow/clipping 0 |
| 운영 이미지 | PASS | 320/412px 4:5 frame, 원본 로드, legacy URL 0, console error 0 |
| 배포 | PASS | Vercel READY, production SHA `07916d4`, 최근 1시간 runtime 오류 0 |

## 결함과 위험

- 신규 제품 결함은 발견하지 못했습니다.
- `QA-079-OBS-01` P3 기존 UX: 과거 카드 삭제 중 네트워크 실패 시 DB 카드는 보존되고 reload로 복구되지만 인라인 오류 안내가 없습니다. 후속 개선과 offline/500 회귀 테스트를 권장합니다.
- 제한 계정의 수기결제 mock PAID는 기존 정책 위험이며 이번 변경의 신규 결함이 아닙니다.
- 기존 왜곡 파일 1,645개는 직접 URL 접근 가능하지만 제품 렌더링 참조에서는 제외됐습니다.
- 실 PG 승인·취소·영수증, Safari/WebKit/iOS 실제 기기는 실행하지 않았습니다.

## cleanup

- QA 사용자 2명, 주문 2건과 항목, 카드 3개를 삭제했습니다.
- 최종 DB `users 10 / orders 9 / items 9 / cards 4 / audits 0 / wishlists 0`으로 시작 기준선과 일치합니다.
- 로컬 3003 서버, 임시 fixture·브라우저 스크립트·스크린샷·secret 파일을 정리했습니다.
- 브라우저 viewport override와 QA 탭을 정리했습니다.
- 운영·마스터 데이터, Vercel 설정, 실 PG 상태 변경은 없습니다.

## 개발 회귀 요청

제품 커밋 `07916d4`를 출시 후보로 유지합니다. 후속 변경에서는 카드 삭제 offline/500 오류 안내를 보강하고 row 유지·버튼 재활성·DB 보존을 자동 회귀로 추가합니다.
