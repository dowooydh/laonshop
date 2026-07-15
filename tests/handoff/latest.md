# QA 핸드오프 최신본

작성일: 2026-07-16

담당: Codex QA/테스트 세션

대상 제품: `main` / `054fccee03f491af430cdd8a9aea45ba4dc753cb`

비교 범위: `6a0127358c00f92b7b43081c9c73249e886dee4b..054fccee03f491af430cdd8a9aea45ba4dc753cb`

결과: **PARTIAL**

출시 판정: **조건부 GO - 1차 10개 갤러리 제품 기준 통과, iOS 전체 조작 재실행 필요**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22에서 test 51/51, 이미지 pipeline 3/3, lint/typecheck/prisma/audit/build가 모두 통과했습니다.
- 대상 10개 상품 50장을 전체 크기로 사람이 직접 비교했고 동일 SKU·색·원단·구조와 독립 5구도를 확인했습니다.
- 50/50 운영 자산이 HTTP 200, `image/webp`, 1200x1500이며 로컬 digest와 일치했습니다.
- 로컬·운영 Chrome과 macOS Safari, Android 정상 배율에서 목록·검색·상세 5장·뒤로가기·새로고침·overflow를 확인했습니다.
- iOS MobileSafari 전체 조작과 Android 200% 상세은 환경/자동화 차단으로 미완료해 전체 PASS로 올리지 않았습니다.
- 상세 보고서: [054fcce 남성 상의 1차 큐레이션 갤러리 회귀](../reports/2026-07-16-054fcce-b01-gallery-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적·빌드 | PASS | test 51/51 skip 0, pipeline 3/3, lint/typecheck/prisma/audit/build PASS |
| 자산 무결성 | PASS | 큐레이션 10상품·50장, 1200x1500, exact duplicate 0, manifest 누락 0 |
| 사람 시각 검수 | PASS | 동일 색·원단·단추·포켓·칼라·실루엣, 다른 SKU 혼입·분할·복제 0 |
| 운영 HTTP·HTML | PASS | 50/50 HTTP 200 WebP·digest 일치, 상세 10/10 exact 01~05 |
| Chrome | PASS | 320/390/412/1280px, 10상품 5장, ratio 0.8, overflow 0, console 오류 0 |
| macOS Safari | PASS | 목록 대상 10개, 상세 5장, desktop, 뒤로가기·새로고침 |
| Android Chrome | PASS | Android 16 Chrome 133, 412x786, 10상품 5장·overflow 0 |
| Android 200% | PARTIAL | 목록 확대·overflow 0, 상세 CDP renderer 도구 오류로 미단정 |
| iOS MobileSafari | BLOCKED | 제품 첫 화면은 보였으나 타 앱 modal·host lock으로 전체 조작 미완료 |
| cart/recent migration | PASS/PARTIAL | 계약 테스트 PASS, 브라우저 localStorage 직접 fixture는 정책상 미실행 |
| cleanup | PASS | DB 쓰기 0, 서버·포워딩·임시 Simulator·파일 정리, font scale 복원 |

## 결함과 위험

- 신규 P0/P1/P2/P3 제품 결함은 발견하지 못했습니다.
- iOS MobileSafari 목록·상세·뒤로가기·새로고침을 재실행해야 전체 PASS로 승격할 수 있습니다.
- Android 200% 상세 5컷·lazy-load는 실제 foreground 탭에서 한 번 더 확인해야 합니다.
- 비대상 319개 상품은 기존 레거시 갤러리이며 후속 큐레이션 대상입니다.
- 실제 판매 전에는 생성형 더미 이미지를 SKU 실사진으로 교체하고 재검수해야 합니다.

## cleanup

- fixture를 만들지 않았고 DB·운영 데이터 변경은 없습니다.
- 로컬 3003 서버, Android CDP 포워딩, QA 전용 임시 iOS Simulator와 임시 파일을 정리했습니다.
- Android 글자 배율은 1.0, 기존 iOS Simulator는 원래 booted 상태로 복원했습니다.
- Vercel env·도메인·결제 상태는 변경하지 않았습니다.

## 개발 회귀 요청

제품 커밋 `054fccee`의 1차 10개 갤러리는 제품 기준상 조건부 GO입니다. host가 잠기지 않은 상태에서 iOS 26.5 Simulator MobileSafari의 남성 목록→대상 상세 5장→뒤로가기→새로고침과 Android 200% foreground 상세를 재실행하고, 두 항목이 통과하면 전체 PASS로 승격해 주세요.
