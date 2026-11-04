# QA 핸드오프 최신본

검증일: 2026-11-04

제품 SHA: `d62fc447d762cce04132288e83a5a8d4dde3c7e3`

비교: `83ac36c9cd56e716a95b262a57b9dd58163a68f5..d62fc447d762cce04132288e83a5a8d4dde3c7e3`

브랜치: `codex/shop-upgrade-20261104`

판정: **독립 코드·격리 실행 검증 GO**. 실제 운영 배포 후 public 검증은 root 담당의 별도 결과로 확인합니다. 기존 WebKit 자동화 경고와 실기기 미실행 범위를 유지합니다.

| 검증 축 | 결과 |
|---|---|
| DEV | 186/186 skip0, 이미지 게이트·lint warning0·typecheck·production build static19/19 PASS. 기존 Prisma deprecation 유지 |
| 독립 서비스 | 격리37/37 PASS. 후기·배송 소유권/중복/관리자 권한·CHECK/불변 trigger·readiness·결제 상태/금액 불변 |
| 실제 HTTP | 공개36 + 인증/실제 후기·송장·배송 액션10 = 46범위 PASS. 초기 QA 대기 실패는 별도 기록 |
| Chromium | production228 + preview60 = 288조합 PASS. 320/390/1280px ×100/200%, 넘침·필드 잘림·페이지 오류·운영 예시 후기 노출0 |
| 공개 준비상품 | 양 런타임32종 상세64회, 원본 사진32 HTTP200·WebP1200×1500·manifest SHA/고유성 PASS. 실제 판매329/준비32 분리 |
| 위조 주문 | prepared ID·catalog-draft ID 조작 후 실제 로컬 POST2건 거절. 주문/후기/재고 원장 증분0 |
| WebKit 신규 페이지 | 목록/대표상세 ×390/1280 ×100/200 = 8조합 PASS·targeted 오류0. broader probe RSC20→6 WARN 보존; 이전 RSC5와 합산하지 않음 |

준비상품은 운영에서도 AI·예상 가격·판매 준비 중을 표시하며 구매할 수 없습니다. 전체361개(남성171/여성190)는 판매329개(155/174)와 준비32개(16/16)를 분리해 안내합니다. 구매 가능 필터는 준비상품을 제외합니다. preview 예시 후기는 실제 후기 원장에 합산하지 않고 production에서는 숨깁니다.

운영 담당의 승인된 additive3테이블 적용·기존11테이블 불변·새원장0·readiness true는 독립 QA와 다른 실행 범위입니다. 독립 QA는 운영 DB·환경·PG를 변경하지 않았습니다. 운영 배포·공개 확인과 실판매 활성화를 같은 뜻으로 보고하지 않습니다.

세부 결과·경고·비교 화면·정리: [운영 공개 후속 독립 QA](../reports/2026-11-04-production-release/independent-report.md).

기존 사이트 전수288조합·정렬·참고사이즈·카테고리 검증과 이전 RSC5 WARN: [직전 보고서](../reports/2026-11-04-layout-catalog-followup/report.md). 새 릴리스 수치와 중복 합산하지 않습니다.

운영 담당 후속 확인(독립 격리 QA와 별도): 제품d62fc44 main배포 READY·실제apex/www 연결, public43검사 PASS·독립 fresh6페이지 오류0 확인. 최초 React#418 1건은 재현되지 않았지만 원인 미확정 WARN으로 보존하고 해결 완료로 판정하지 않습니다. 초기 스트리밍 대기 보완·fetch취소·Vercel 빌드 경고와 남은 외부 업무까지 [운영 출시 기록](../reports/2026-11-04-production-release/release-report.md)에 구분했습니다.
