# QA 핸드오프 최신본

작성일: 2026-07-22

검증 제품 SHA: `55465ce5cf268a6f897536f6136b9668b6ab6bcc`

비교 기준: `3068c64df156320973f0b28d52888ba03304b6ce`

운영 배포: `dpl_HEvkp7tL2fWt511YcztVS8MLCErG` / `https://laonshop.com`

결과: **PASS**

## 판정

- 통신판매업신고번호 footer 반영: **PASS / GO**
- 신규 P0/P1/P2 제품 결함: **없음**
- 공개 신고증 PDF·대표자 개인정보 노출: **없음**
- API/DB/인증/세션/결제 회귀 영향: **없음**

상세 증거는
[`2026-07-22-55465ce-business-info-regression.md`](../reports/2026-07-22-55465ce-business-info-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 변경 독립 검토 | PASS | 공통 footer 문구와 QA 문서만 변경, 제품 동작 변경 없음 |
| 정적 검증 | PASS | focused 1/1, 전체 126/126, skip 0, lint/typecheck/prisma/audit/build |
| 운영 배포 | PASS | READY/production/sin1, SHA·apex/www alias 일치, runtime/error/fatal 0 |
| footer 내용 | PASS | 정확한 번호 1회, `신고 예정` 0회 |
| 반응형 | PASS | 4경로 x 320/360/390/412/1280px x 100%/200% = 40조합 |
| overflow/clipping | PASS | document·footer descendant 이탈/잘림 0 |
| 링크 | PASS | 정책 5경로 200, 카카오·전화·이메일 href 유지, 정책 링크 44px+ |
| 공개 비노출 | PASS | tracked PDF 0, public/build/network PDF·legal 경로 0, 운영 경로 404 |
| Cleanup | PASS | 임시 runner/screenshot 제거, DB/env/PG/제품 코드 변경 0 |

## 개발 작업 전달

제품 `55465ce`는 발급 번호 `2025-성남분당A-0152`를 홈·정책·로그인·상품 공통 footer에 정확히 표시합니다. 최소 320px와 루트 글자 200%에서도 사업자정보와 연락처가 잘리지 않았고 정책 링크 동작도 유지됐습니다.

신고증 원본은 Git/배포 산출물/운영 네트워크에 포함되지 않았습니다. 개인정보 보호를 위해 로컬 원본 PDF 자체는 열거나 OCR하지 않았으며, 인계된 발급 번호와 저장소 기준 문서만 대조했습니다.

따라서 이번 법정 표시 변경은 **PASS / 출시 가능**입니다.
