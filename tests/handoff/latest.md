# QA 핸드오프 최신본

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상 제품: `main` / `fbc2312d0ded7a66ebab4a929a15a08fdf16e63f`

QA 시작 HEAD: `15cb38ceb166e51597b57bfc444289709313d83a`

결과: **PASS**

출시 판정: **GO - 현재 일반 KSPAY + 빌링·수기 fail-closed 정책 통과**

## 요약

- 제품 코드는 수정하지 않았습니다. 제품 이후 HEAD 차이는 QA 문서뿐입니다.
- 기존 Node 22 정적 검증 50/50, skip 0, 이미지 pipeline/lint/typecheck/prisma/audit/build와 329상품·1,316 WebP 전수검사를 유지했습니다.
- iOS 26.5 Simulator MobileSafari, macOS Safari 26.5.2, Android 16 Chrome 133에서 홈·목록·검색·상품·로그인·guest checkout, 뒤로가기·새로고침·이미지·overflow를 실제 검증했습니다.
- 로컬 QA 계정에서 신규 카드 원문 등록 폼, 원클릭, 수기결제가 노출되지 않고 일반 KSPAY 4개 수단만 유지됨을 확인했습니다.
- 사용자가 승인한 KSNET 공식 개발계 테스트에서 카드 등록→조회→빌링 결제→취소→해지→해지 후 재조회까지 실행하고 취소·해지 cleanup을 완료했습니다.
- 공식 문서 테스트 콘솔은 PASS지만, 라온샵 서버 직접 호출에는 별도 `pgapi` Authorization이 필요하고 라온샵 빌링 UI·서버 연동은 구현되지 않았습니다.
- 상세 보고서: [Safari·에뮬레이터·KSNET 개발계 빌링 추가 QA](../reports/2026-07-15-fbc2312-safari-emulator-ksnet-billing/report.md)
- 기존 전수 보고서: [fbc2312 에디토리얼 상품 갤러리 회귀](../reports/2026-07-15-fbc2312-editorial-gallery-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적·자산 | PASS | test 50/50, skip 0, build/audit PASS, 329상품·1,316 WebP·1200x1500·중복 0 |
| iOS MobileSafari | PASS | iOS 26.5 Simulator, 약 402x874, 공개 핵심 흐름·큰 글자·뒤로가기·새로고침 |
| macOS Safari | PASS | Safari 26.5.2, desktop 레이아웃·이미지·guest checkout |
| Android Chrome | PASS | Android 16/API 36, Chrome 133, 412x786, overflow 0·이미지 5/5·console error 0 |
| 카드 관리 | PASS | 신규 원문 등록 폼 0, 과거 mock 카드 마스킹·삭제 전용 |
| 결제 fail-closed | PASS | oneclick/manual 미노출, stale 요청 사전 거부, 일반 KSPAY 4개 수단 유지 |
| KSNET 개발계 등록·조회 | PASS | `A0200/0000`, 동일 token, 마스킹 카드 결박 |
| KSNET 개발계 승인·취소 | PASS | 1,004원 `A0200/0000`, 동일 TID 취소 `A0200/P10Q` |
| KSNET 개발계 해지 | PASS | 해지 `A0200/0000`, 재조회 `A0201/P106`, 카드정보 미반환 |
| 직접 API 인증 경계 | PASS | Authorization 없는 개발 API 조회는 HTTP 200 본문 `A0403` 거부 |
| cleanup | PASS | KSNET 취소·해지·재조회, DB 기준선 복원, 서버·포워딩·Simulator·임시 파일 정리 |

## 결함과 위험

- 이번 추가 회귀의 신규 P0/P1/P2 제품 결함은 발견하지 못했습니다.
- 공식 문서 테스트 콘솔의 성공은 라온샵 자체 빌링 연동 성공이 아닙니다. 라온샵 빌링은 계약, 안전한 `pgapi` 서버 보관, 전용 API 구현 전까지 NO-GO입니다.
- SafariDriver의 Remote Automation이 비활성이라 macOS Safari console/network는 수집하지 못했습니다. 실제 Safari UI와 iOS MobileSafari로 기능·시각 결과를 검증했으며 제품 실패로 보지 않습니다.
- 실 iOS 기기, 실 MID·실카드·운영 승인·영수증은 미실행입니다.
- 이미지 자산 149.38MiB, 저장소 밖 원본 AI 시트·상품 매핑, 외부 Unsplash 의존 위험은 기존과 동일합니다.

## cleanup

- KSNET 개발계 승인 거래는 동일 TID로 취소하고 카드 token을 해지했으며 해지 후 조회 실패를 확인했습니다.
- 로컬 QA 사용자 1명·mock 카드 1건을 삭제해 users 10/orders 9/items 9/cards 4/audits 0/products 329/wishlists 0 기준선으로 복원했습니다.
- 3003 서버, Android CDP 포워딩, 이번 QA용 iOS Simulator, 브라우저 제어 세션, `/private/tmp/laonshop-fbc-*`를 종료·삭제했습니다.
- 운영 DB·마스터 데이터·Vercel 설정·실 PG 상태는 변경하지 않았습니다.

## 개발 회귀 요청

제품 커밋 `fbc2312`을 현재 출시 후보로 유지합니다. 라온샵 빌링을 추진할 때는 공식 문서 콘솔 시연 결과를 제품 연동으로 간주하지 말고, 계약된 `pgapi`를 브라우저에 노출하지 않는 서버 전용 등록·조회·승인·취소·해지 경로와 멱등성·감사·cleanup 테스트를 별도 구현·검증해야 합니다.
