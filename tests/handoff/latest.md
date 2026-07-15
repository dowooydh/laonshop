# QA 핸드오프 최신본

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상: `main` / `fbc2312d0ded7a66ebab4a929a15a08fdf16e63f`

비교 범위: `1308b919478dc2f930ad6d369c1046864c310bda..fbc2312d0ded7a66ebab4a929a15a08fdf16e63f`

결과: **PASS**

출시 판정: **GO - 전 상품 에디토리얼 5장 갤러리 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 50/50, skip 0, 이미지 파이프라인, lint, typecheck, Prisma validate, production audit, build, diff check를 통과했습니다.
- 상품 329개·로컬 WebP 1,316개를 전수 검사해 상품별 `01`~`04` 4장, 1200x1500, exact duplicate 0, `05.webp` 잔존·참조 0을 확인했습니다.
- 로컬 상세 HTML 329개와 정적 이미지 1,316개 응답이 모두 200이었고 대표 Unsplash 스마트 크롭 + 버전된 상세 4장 구성이 일치했습니다.
- 카테고리 균형 표본 52개와 지정 SKU 3개의 시각 감사에서 왜곡·과도한 여백·다른 SKU 혼입을 발견하지 못했습니다.
- 로컬 Chrome 27조합, 운영 Chrome 6조합, Android Chrome 133 엔진 4조합에서 5장·4:5·반응형·overflow·콘솔 회귀가 통과했습니다.
- 구버전 카트·최근상품 URL과 null 이미지 복구에서 상품·수량·사이즈·nonce가 보존됐습니다.
- Vercel production은 `READY`, Git SHA `fbc2312`, apex/www alias 일치, 최근 1시간 error/fatal 0입니다.
- 상세 보고서: [2026-07-15 `fbc2312` 에디토리얼 상품 갤러리 회귀 QA 보고서](../reports/2026-07-15-fbc2312-editorial-gallery-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 50/50, skip 0, image pipeline/lint/typecheck/prisma/audit/build/diff check PASS |
| 자산 전수 검사 | PASS | 329상품, 1,316 WebP, 1200x1500, unique 1,316, 05 잔존 0 |
| 품질 gate | PASS | 인공 패딩 평균 0.019%·최대 1.667%, 12% 초과 0, 빈 이미지 0 |
| 로컬 HTML·HTTP | PASS | 상품 HTML 329/329, 정적 이미지 1,316/1,316 HTTP 200 |
| 로컬 반응형 | PASS | 핵심 SKU 3개 x 9프로필 = 27조합, 100%·200%·DPR2, overflow 0 |
| 저장 데이터 | PASS | 구버전 URL·null 복구, 상품·수량·사이즈·checkout nonce 보존 |
| 운영 공개 회귀 | PASS | 3 roots, 3 product HTML, 12 WebP, 3 removed 05=404, optimizer, Chrome 6조합 |
| Android | PASS | Android 15·Chrome 133 엔진·412px, 4조합, 5장·4:5·1열·오류 0 |
| 운영 배포 | PASS | Vercel READY, production SHA·aliases 일치, error/fatal 0 |

## 결함과 위험

- 이번 변경의 신규 P0/P1/P2 제품 결함은 발견하지 못했습니다.
- 상세 자산이 약 84.0MiB에서 149.38MiB로 증가해 배포 크기와 최초 optimizer 비용·지연을 관찰해야 합니다.
- 원본 AI 시트와 상품 매핑이 저장소 밖에 있어 저장소만으로 동일 일괄 재생성이 불가능합니다.
- 대표컷은 외부 Unsplash 가용성에 의존합니다.
- 전수 기계 검사는 329개 상품 모두 수행했지만 직접 시각 감사는 52개 상품의 카테고리 균형 표본입니다.
- Safari/WebKit/iOS 실제 기기와 실 KSNET 승인·취소·영수증은 실행하지 않았습니다.

## cleanup

- DB fixture를 생성하지 않았고 로컬·운영 DB 데이터 변경은 없습니다.
- 로컬 3013 서버, 임시 QA 러너·감사 시트, Android CDP 포워딩을 종료·삭제했습니다.
- Android 기존 탭 URL·UA를 복원했고 테스트 localStorage를 비웠습니다.
- 운영·마스터 데이터, Vercel 설정, 실 PG 상태 변경은 없습니다.

## 개발 회귀 요청

제품 커밋 `fbc2312`을 상품 이미지 출시 후보로 유지합니다. 배포 후 자산 용량·optimizer cold latency·Unsplash 실패율을 관찰하고, 실제 판매 전에는 저장소에 재생성 가능한 원본·매핑을 보관하며 SKU별 실사진으로 교체하는 절차를 마련해야 합니다.
