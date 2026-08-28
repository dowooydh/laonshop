# QA 핸드오프 최신본

작성일: 2026-08-29

검증 제품 SHA: `60d10fc21c0aac72bbca244920369a7d11453b86`

비교 기준: `9d3c98c2ee578574d2227c96b0af3d336e697f81`

운영 배포: `dpl_4D8Gb8bS4GfQSnGTk2nGRRh4gWpM` / `https://laonshop.com`

결과: **FAIL**

## 판정

- `QA-6892-01` 200% 헤더 겹침·잘림: **PASS / CLOSED**
- CUSTOMER·ADMIN·guest 반응형/클릭/Tab 회귀: **PASS**
- 결제 용어·과거 주문·KSPAY·법무·보안 패치: **PASS**
- `QA-60D-01` 정상 글자 일부 헤더 링크 44px 미만: **P2 / OPEN**
- 원 수정 자체: **GO**
- 전체 출시: **NO-GO**

상세 증거는 [`2026-08-29-60d10fc-header-responsive-regression.md`](../reports/2026-08-29-60d10fc-header-responsive-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | focused 5/5, 전체 137/137, billing interop 2/2, skip 0, lint/typecheck/prisma/audit/build |
| 운영 배포 | PASS | READY/production/sin1, SHA·apex/www/fixed alias 일치, runtime error 0 |
| 원 재현 768/200 | PASS | font 32px, header 217px, settings/checkout overlap·clip·internal scroll 0 |
| 원 재현 1280/200 | PASS | 마이페이지 `scrollWidth/clientWidth=167/167`, 전체 명령 완전 표시 |
| 역할 행렬 | PASS | guest 14 + CUSTOMER 28 + ADMIN 14 = 56조합, 문서 overflow 0 |
| 내비게이션 | PASS | click 18경로, Tab 순서, badge 2, CUSTOMER/ADMIN 로그아웃 |
| KSPAY/주문 | PASS | 4수단 aria-pressed, 과거/신규 표식 모두 등록카드로 정규화, PG 요청 0 |
| 법무 문구 | PASS | KSPAY/LAONPAY 경로 구분, FAQ details 6개, Baum 추측 0 |
| 44px 타깃 | FAIL | 모바일 검색·마이·관리 폭 약 39px, 데스크톱 카테고리 높이 약 37px |
| Cleanup | PASS | 격리 DB·fixture·서버·브라우저·임시 파일 삭제, 포트 3003 0 |

## 발견 결함

### QA-60D-01 P2 — 정상 글자에서 헤더 링크의 실제 클릭 영역이 44px 미만

재현:

1. `390x844`, 루트 글자 `100%`로 홈을 엽니다.
2. 모바일 header의 `검색` 링크 실제 rect와 hit area를 측정합니다.
3. `768x900`, `100%`에서 데스크톱 남성·여성·검색 링크 높이를 측정합니다.

실제:

- 모바일 검색 `39.14x44px`, CUSTOMER 마이·ADMIN 관리도 약 `39x44px`
- 데스크톱 남성·여성 `72.23x36.92px`, 검색 `48.13x36.92px`
- 44px 가상 경계점 hit-test는 대상 링크가 아니라 부모 `NAV`/`DIV`를 반환
- [모바일 증거](../reports/2026-08-29-60d10fc-header-responsive-regression/guest-home-390-normal-focus.png)
- [데스크톱 증거](../reports/2026-08-29-60d10fc-header-responsive-regression/guest-home-768-normal-focus.png)

원인 후보는 모바일 역할/검색 링크의 `min-w-11` 부재와 데스크톱 카테고리 링크의 `min-h-11` 부재입니다. 이번 변경이 새로 만든 회귀는 아니지만 인계의 필수 44px gate를 실패시킵니다.

## 개발 작업 전달

`QA-60D-01`만 보강한 뒤 guest/CUSTOMER/ADMIN의 `320/360/375/390/412/768/1280px x 100%/200%`를 재검증해 주세요. 각 visible link/button의 `width>=44 && height>=44`, 44px 경계 hit-test, control overlap, 문서 폭, focus outline, Tab 순서를 함께 단정해야 합니다.

실제 LAONPAY env/schema/key/PG 활성화와 Baum 법무 확정은 이 UI 결함과 분리된 외부 HOLD입니다.
