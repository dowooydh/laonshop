# QA 핸드오프 최신본

작성일: 2026-08-29

검증 제품 SHA: `bd10ae6407bac775bc7da6fbf5ba332b078909d8`

이전 QA 기준: `ec4375d30d91d52f3c45e2a5003cc1b587740dad`

운영 배포: `dpl_613qJehUc8N537ekMMifSYm32Vc7` / `https://laonshop.com`

결과: **PASS**

## 판정

- `QA-5A753-01` 인라인 링크 44px 미달: **FIXED / CLOSED**
- 운영 support/footer 최소 실제 anchor: `49.25x44px`
- 격리 checkout 최소 실제 anchor: `55.31x44px`
- 네 경계 hit ownership: **560/560 PASS**
- 링크 overlap·document overflow·clipping: **0건**
- checkout 정책 링크 클릭과 checkbox 상태 독립성: **12/12 PASS**
- 등록카드 문구·legacy 주문 호환·KSPAY 4수단: **PASS**
- gate OFF/ON 외부 요청·DB 변화: **0건**
- 신규 제품 결함: **0건**
- 출시 판단: **GO**
- 실제 LAONPAY 활성화: 외부 readiness 완료 전 **HOLD**

상세 증거는 [`report.md`](../reports/2026-08-29-bd10ae6-inline-link-target-regression/report.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | Node 22.23.1, focused 7/7, 전체 140/140, interop 2/2, skip 0, lint/typecheck/prisma/audit/preflight/build |
| 배포 | PASS | READY/production/sin1, SHA·apex/www/fixed alias 일치, runtime error·deployment error/fatal 0 |
| 운영 링크 | PASS | 14조합, anchor 98개, hit point 392개, 최소 `49.25x44px`, overlap/overflow/clipping 0 |
| checkout 링크 | PASS | 14조합, anchor 42개, hit point 168개, 최소 `55.31x44px`, focus/Tab 실패 0 |
| checkbox 독립성 | PASS | 꺼짐/켜짐에서 정책 3링크를 2개 viewport로 실제 클릭, 상태 변화 0/12 |
| gate OFF | PASS | hosted CTA·등록카드 tile 미노출, KSPAY 4수단 유지, provider/write 0 |
| gate ON | PASS | 3 viewport x 4화면, 기본 `등록카드`, 신규/legacy `(등록카드)` 정규화, billing 취소 분기 유지 |
| 민감정보·외부 경계 | PASS | 카드 원문/token/secret 노출 0, non-GET/provider 0, DB 기준선 불변 |
| Cleanup | PASS | 격리 DB·서버·합성 key/session/runner 삭제, 포트 3003/3004·temp 잔여 0 |

## 수정 전후

`390px/100%`에서 직전 `16~38px` 높이였던 대상은 모두 `44px`가 됐습니다.

- FAQ 배송·환불: `38px` → `44px`
- 고객센터 전화·이메일·카카오: `16px` → `44px`
- footer 전화·이메일: `16~22px` → `44px`
- checkout 정책 링크: `19px` → `44px`

`320px/200%` 긴 이메일과 환불 정책명은 높이가 `88~129.47px`로 자연스럽게 줄바꿈됐으며 내부 scroll과 clipping이 없습니다.

## 개발 작업 전달

제품 SHA `bd10ae6`은 이번 QA 범위에서 추가 수정 없이 출시 가능합니다. 실제 등록카드 결제 활성화는 LAONPAY partner env/key/readiness, 외부 hosted/API 상호운용과 실 PG 검증 전까지 별도 HOLD를 유지해야 합니다.
