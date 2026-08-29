# QA 핸드오프 최신본

작성일: 2026-08-29

검증 제품 SHA: `5a753a96e4a740f924448f97c84797484c63ca24`

비교 기준: `7212162aec318b589626df361158aaa64c4f726d`

운영 배포: `dpl_9WPYGUyVdrn88hy1K5YdL73kDFXi` / `https://laonshop.com`

결과: **FAIL**

## 판정

- 등록카드 문구 단순화: **PASS**
- 과거/신규 주문 `(등록카드)` 정규화와 billing 취소 분기: **PASS**
- 일반 KSPAY 4수단·`aria-pressed`: **PASS**
- gate OFF/ON 외부 요청·운영 쓰기 0: **PASS**
- 126개 반응형 조합의 document overflow·ancestor clipping: **PASS**
- `QA-5A753-01` checkout·FAQ·고객센터·footer 링크 44px 미만: **P2 / OPEN**
- 문구 변경 자체: **GO**
- 현재 전체 접근성 gate: **NO-GO**

상세 증거는 [`report.md`](../reports/2026-08-29-5a753a9-registration-card-copy-regression/report.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | focused 61/61, 전체 137/137, interop 2/2, skip 0, lint/typecheck/prisma/audit/build |
| 배포 | PASS | READY/production/sin1, SHA·apex/www/fixed alias 일치, runtime error 0 |
| 사용자 문구 | PASS | settings/checkout/order/support/terms/privacy/footer에서 긴 제품명·내부 표식·`원장` 노출 0 |
| 주문 호환 | PASS | 신규/legacy DB 표식을 화면에서 모두 `QA 카드 (등록카드)`로 표시, `전체 주문 취소 요청` 유지 |
| KSPAY | PASS | 카드·카카오·네이버·계좌이체 및 등록카드 선택의 `aria-pressed`, 선택 네트워크 0 |
| gate OFF | PASS | hosted CTA·등록카드 결제 미노출, KSPAY 4수단 유지, provider/write 0 |
| gate ON | PASS | masked method만 표시, 카드 원문/token/secret 0, non-GET/provider 0, DB 기준선 불변 |
| 반응형 | PASS | 격리 84 + 운영 42 = 126조합, `320~1280px x 100%/200%`, overflow/clipping 0 |
| 44px 타깃 | FAIL | support 전화·이메일·카카오 `16px`, FAQ `38px`, checkout 정책 `19px`, footer 전화 `16px`/이메일 `22px` |
| Cleanup | PASS | 격리 DB·서버·임시 key/runner 삭제, 포트 3003/3004 listener 0 |

## 결함

### QA-5A753-01 P2 — 인라인 링크 타깃 44px 미달

`390px/100%`에서 다음을 재현했습니다.

- support FAQ 링크: `349x38px`, `358x38px`
- support 고객센터 전화·이메일·카카오: `98x16px`, `201x16px`, `73x16px`
- checkout 동의문 개인정보·환불 링크: `111x19px`, `119x19px`
- 공용 footer 전화·이메일: `98x16px`, `201x22px`

관련 위치:

- `app/checkout/checkout-form.tsx:580-591`
- `app/support/page.tsx:14-29`
- `app/support/page.tsx:77-94`
- `app/layout.tsx:199-211`

문구 diff가 새로 만든 회귀는 아니지만 이번 인계의 필수 44px gate를 실패시킵니다. 각 링크에 최소 44px 클릭 영역을 제공한 뒤 전 폭·200%·hit ownership·Tab/focus를 재검증해야 합니다.

## 개발 작업 전달

`5a753a9`의 등록카드 문구·주문 호환·결제 경계는 추가 수정 없이 유지할 수 있습니다. `QA-5A753-01` 링크 타깃만 제품 코드에서 보강한 뒤 표적 QA를 다시 요청해 주세요. 실제 LAONPAY env/schema/key/PG 활성화는 이번 문구 PASS와 별개인 외부 HOLD입니다.
