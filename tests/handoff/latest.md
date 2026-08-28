# QA 핸드오프 최신본

작성일: 2026-08-29

검증 제품 SHA: `6892d86a8751e26a9480969dc2d1e0aa613a0a23`

비교 기준: `8c8ff7452048ca913909abd09bc4032842f2810a`

운영 배포: `dpl_eWXuWZa5FfwBqJZenqcsBfa5cBo2` / `https://laonshop.com`

결과: **FAIL**

## 판정

- 등록카드(BILLING)·일반 인증결제(AUTH) 용어 분리: **PASS**
- 과거 `(LAONPAY 원클릭)` 주문 표시·취소 호환: **PASS**
- 일반 KSPAY 4개 결제수단: **PASS**
- Next/Prisma/PostCSS 보안 패치: **PASS**
- `QA-6892-01` 200% 글자 확대 전역 헤더 겹침·잘림: **P2 / OPEN**
- 결제 용어 변경 자체: **GO**
- 전체 출시: **NO-GO**

상세 증거는 [`2026-08-29-6892d86-payment-terminology-regression.md`](../reports/2026-08-29-6892d86-payment-terminology-regression.md)에 정리했습니다.

## 핵심 결과

| 범위 | 결과 | 핵심 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | focused 4/4, 전체 136/136, billing interop 2/2, skip 0, lint/typecheck/prisma/audit/build |
| 운영 배포 | PASS | READY/production/sin1, SHA·apex/www alias 일치, runtime error 0 |
| 공개 문구 | PASS | 홈·약관·개인정보·FAQ에서 KSPAY와 LAONPAY 등록카드 구분, Baum 추측 문구 0 |
| KSPAY UI | PASS | 카드·카카오·네이버·계좌이체 선택 및 aria-pressed 확인 |
| LAONPAY fail-closed | PASS | 운영 gate CLOSED, 등록카드 tile/실호출 0, 준비 안내 표시 |
| 과거/신규 주문 | PASS | 두 표식 모두 화면은 등록카드, 취소 Action 2회 후 DB PAID 2·cancel ledger 0 |
| 반응형 본문 | PASS | settings/checkout 28조합에서 본문 overflow/clipping 0 |
| 공용 헤더 200% | FAIL | 768px 내비 겹침, 장바구니 116/88, 마이 206/48; 1280px 마이 211/187 |
| Cleanup | PASS | 격리 DB·fixture·서버·브라우저·임시 키 삭제, 포트 3003/3443 0 |

## 발견 결함

### QA-6892-01 P2 — 인증 헤더가 768/1280px·200%에서 겹치거나 잘림

재현:

1. 인증 사용자로 `/mypage/settings` 또는 `/checkout` 진입
2. viewport `768x900`, 루트 글자 `200%`
3. 전역 헤더의 성별 내비·장바구니·마이페이지·로그아웃 확인

실제:

- `768px`: 장바구니 `scrollWidth/clientWidth=116/88`, 마이페이지 `206/48`, 주변 내비와 겹침
- `1280px`: 마이페이지 `211/187`, 사용자명 truncate
- [재현 스크린샷](../reports/2026-08-29-6892d86-payment-terminology-regression/header-768-font200-overlap.png)

원인 후보는 [`app/layout.tsx`](../../app/layout.tsx)의 `sm:flex-nowrap`, 긴 데스크톱 라벨, `max-w-[7rem] truncate whitespace-nowrap` 조합입니다. 이번 제품 범위의 layout diff는 footer 문구 한 줄뿐이므로 신규 결제 용어 변경 귀책은 아니지만, 현재 필수 반응형 gate는 실패합니다.

## 개발 작업 전달

`QA-6892-01`만 수정한 뒤 인증/비인증 헤더를 `320/360/375/390/412/768/1280px x 100%/200%`로 표적 재검증해 주세요. visible control rect 비중첩, `scrollWidth<=clientWidth`, focus ring, 44px 타깃, 긴 CUSTOMER/ADMIN 라벨을 함께 단정해야 합니다.

결제 용어, KSPAY 선택, 과거 주문 취소 분기, 보안 패치에는 신규 결함이 없습니다. Baum 법인명·위탁범위 확정과 실제 LAONPAY env/schema/key/PG 활성화는 제품 결함과 분리된 외부 HOLD입니다.
