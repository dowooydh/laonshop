# QA 핸드오프 최신본

검증일: 2026-11-06. 제품 SHA: `fa2d1aa0b70d07bc2a7522ab9fd8e1fb2a08e060`.
비교 기준: `de41c604602b3ffd75e1e1cddd42845ca93c42ef`. 브랜치: `codex/security-baseline-20261106`.

판정: **독립 소스 검토·필수 격리 전체 QA GO, 콘솔 WARN 유지**. 배포 전 작성한 인계이며 실제 운영 배포·공개 확인은 후속 release receipt와 완료 보고를 대조합니다.

| 구분 | 결과 |
|---|---|
| 제품 동작 | 비밀번호 변경 시 이전 쿠키 거절·현재 쿠키 갱신, bcrypt UTF-8 경계, PG 입력/응답 크기·중복 필드·금액·O/X 검증 |
| 후기·배송 | 저장 전환 뒤 새 GET으로 표시·버튼 대기 해제, 위치 복원. 서버 소유권·관리자 권한·이력 보존·중복 방지 유지 |
| DEV | 저장 UI 인과 실험·실제 GET/POST/hash/storage helper probe 통과. 독립 제품 전체 결과와 구분 |
| 독립 기본 QA | unit202/202 skip0·이미지 게이트·lint(max-warnings0)·typecheck·production build PASS |
| 독립 통합 | 서비스37·쇼핑 브라우저47·보안 브라우저16·실제 PG result route/DB stub5 exact/invariant PASS |
| SCA/격리 | pnpm/Trivy 각각487·취약점0·source secret0·양성 대조 PASS, source SHA 동일·외부 차단·자손/PG/컨테이너/임시 입력 정리 PASS |
| 경고 | 쇼핑 console error616 미분류 WARN, 보안 console count 미수집. 페이지 오류0·겹침0·실제 자체 호스팅 폰트 PASS. Prisma deprecation 유지 |
| 선택 감사·운영 부작용 | PentAGI/Cloudflare not-run/false. 실 PG·운영 DB/schema/env/key/gate 변경 없음 |

최종 QA 커밋은 제품 코드 변경 없이 후기·배송의 자동 navigation GET200·새 문서(timeOrigin 변경)를 확인하고 수동 reload를 제거합니다. 이 커밋에서도 필수 전체 QA와 production build 통과를 푸시 전 조건으로 유지합니다.

배포 후 기존 로그인은 한 번 재로그인이 필요합니다. 로그아웃 복사 쿠키의 전역 폐기·분산 로그인 속도 제한은 이번 범위에서 해결한 것으로 표시하지 않습니다. 실제 PG 활성화나 전체 소스 침투 감사 완료를 주장하지 않습니다.

전체 근거·초기 FAIL/중단·남은 범위: [제품·DEV 기록](../reports/2026-11-06-security-remediation.md), [독립 실행](../reports/2026-11-06-security-independent-execution.md), [독립 소스 검토](../reports/2026-11-06-security-independent-review.md).

11월4일 화면·카탈로그 배포와 독립 QA는 [기존 출시 기록](../reports/2026-11-04-production-release/release-report.md)에 보존합니다. 판매329·공개 준비32·참고 사이즈·AI 사진을 이번에 다시 추가하지 않았고, 준비상품은 실제 공급/가격/실측/재고 확인 전 주문 불가입니다. 예시 후기는 운영에서 숨기며 실제 후기 집계에 합산하지 않습니다. 기존 React#418 미재현 WARN·WebKit 경고·실기기 미실행도 이번 수정으로 소급 해결하지 않습니다.
