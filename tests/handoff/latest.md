# QA 핸드오프 최신본

검증일: 2026-11-04

제품 SHA: `7b09a3cc21faab811cda3172f7e60c2f9ecfc318`

비교 범위: `04fb280b0ac1b9d2fdbcb61820793a4645ef5867..7b09a3cc21faab811cda3172f7e60c2f9ecfc318`

브랜치: `codex/shop-upgrade-20261104`

판정: **UI·데이터 경계 코드 검증 GO / WebKit 자동화 경고 WARN**. 운영 반영·실판매 활성화·실기기 완료 판정은 별도입니다.

| 검증 축 | 결과 |
|---|---|
| DEV | 186/186, lint warning 0, typecheck/build PASS |
| 독립 build | Node 22.23.1 / Next 15.5.24 PASS, 기존 Prisma 7 deprecation 유지 |
| Chromium 전수 | 288개 검사. 초기 디자인 시스템 넘침 1건은 보완 후 최종 8조합 PASS; 나머지 상품·구매자·관리자 넘침/클리핑/메뉴겹침 0 |
| WebKit | 핵심 64개 레이아웃 finding 0. 빠른 문서 교체의 RSC 메시지 5건은 WARN 보존. 안정된 실제 링크 2회·같은 RSC 요청 8개는 오류 없이 HTTP 200 |
| 디자인 최종 delta | Chromium 8 + WebKit 8 PASS |
| 색상·정렬 | 활성 CTA 148표본 최소 대비 6.16:1; 구매안내 단일행 113표본 최대 중심 오차 0px |
| 카탈로그·예시·사이즈 | 원본329 전수 검증 5/5, 32초안 격리 CLI 6/6, 실제 표시 수 4/4, 미리보기/production 분리 18/18, 기존 대표사진 9/9 PASS |
| 비교 화면 | 사용자와 같은 반팔 티셔츠의 배송/출고/교환 세 행 44px·글자 중심 오차0, 참고사이즈·신규그리드 crop 기록 |

예시 평가는 36~82개로 다양하고 글 후기 10% 이상이며, 실제 후기 집계·원장에는 합산되지 않습니다. AI 준비상품 12개와 새 초안 32개는 실제 판매·재고로 취급하지 않습니다. 실제 활성329개와 미리보기341개를 구분했습니다.

초기 production 검사에서 canonical redirect를 따라간 검증방법 오류를 폐기하고, 별도 loopback production renderer·redirect 미발생·운영 요청 차단으로 재검증했습니다. WebKit 경고를 숨기거나 모든 엔진 오류0으로 바꾸지 않았습니다.

상세 범위·재현·검증방법 보완·증거·cleanup: [독립 QA 보고서](../reports/2026-11-04-layout-catalog-followup/report.md).
