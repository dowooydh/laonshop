# QA 핸드오프 최신본

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상: `main` / `cc80f578da0a626c9407c64d9b92567bd2739909`

비교 범위: `d4653f6ced7ee30d55939669b025db95ad95895c..cc80f578da0a626c9407c64d9b92567bd2739909`

결과: **PASS**

출시 판정: **GO - 전 상품 5장 갤러리·4:5 비율·캐시 버전 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 35/35, skip 0, 이미지 파이프라인 2/2, lint, typecheck, Prisma validate, production audit, build, diff check를 통과했습니다.
- 상품 329개와 slug 329개를 전수 비교했고 1,645개 WebP가 모두 상품별 5장·1200x1500이며 누락·추가·decode 실패·exact duplicate가 0임을 확인했습니다.
- 남녀 17개 카테고리의 329개 상품 5컷을 모두 시각 감사해 색상·실루엣 불일치, 다른 상품 혼입, 빈 패널, 가로 늘어짐을 발견하지 못했습니다.
- 로컬 production 상품 상세 329/329가 HTTP 200과 버전된 01~05 URL을 반환했습니다.
- Vercel production은 `READY`, Git SHA `cc80f57`, 최근 1시간 runtime 오류와 error/fatal 로그 0입니다.
- 상세 보고서: [2026-07-15 `cc80f57` 상품 상세 5장 갤러리 회귀 QA 보고서](../reports/2026-07-15-cc80f57-detail-gallery-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 35/35, pipeline 2/2, lint/typecheck/prisma/audit/build/diff check PASS |
| 자산 전수 검사 | PASS | products/slugs 329, WebP 1,645, 1200x1500, 실패 0 |
| 전 상품 시각 감사 | PASS | 17개 카테고리 329개 상품, 5컷 일관성·왜곡·혼입 검사 PASS |
| HTML 전수 검사 | PASS | 329/329 HTTP 200, 버전된 01~05 URL 누락 0 |
| 저장 URL 경계 | PASS | 무버전 URL 마이그레이션, 수량·사이즈·nonce 보존, 비 HTTP(S) 제거 |
| 실제 브라우저 교차 | PASS | 320/390/412/1280px, 5장, natural ratio 0.8, broken·overflow·console 오류 0 |
| 운영 배포 | PASS | Vercel READY, production SHA `cc80f57`, aliases 일치, 오류 0 |

## 결함과 위험

- 이번 변경의 신규 제품 결함은 발견하지 못했습니다.
- 원본 330개 생성 시트와 폐기본 1개의 원시 매칭 과정은 저장소 외 원본이 없어 QA가 재현하지 못했고, 최종 manifest·배포 자산 329개를 대신 전수 대조했습니다.
- 실제 촬영본이 아닌 AI 생성 시트이므로 실제 판매 이미지 교체 시 색상·소재·상표·인물 표현을 별도 검수해야 합니다.
- headless CDP 스크롤이 한 표본의 native lazy 요청을 깨우지 못했으나 파일·HTML·optimizer와 DEV 실제 브라우저가 모두 정상이라 QA 도구 제약으로 분리했습니다.
- Safari/WebKit/iOS 실제 기기와 실 KSNET 승인·취소·영수증은 실행하지 않았습니다.

## cleanup

- DB fixture를 생성하지 않았고 운영·테스트 DB 데이터 변경도 없습니다.
- 로컬 3003 서버와 임시 브라우저·HTML·이미지 감사 스크립트·감사 시트를 삭제했습니다.
- 운영·마스터 데이터, Vercel 설정, 실 PG 상태 변경은 없습니다.

## 개발 회귀 요청

제품 커밋 `cc80f57`을 출시 후보로 유지합니다. 실제 판매 상품 이미지로 교체하거나 갤러리 fallback 기준을 바꿀 때 상품별 5장·4:5·버전 URL·storage 마이그레이션 전수 회귀를 다시 실행합니다.
