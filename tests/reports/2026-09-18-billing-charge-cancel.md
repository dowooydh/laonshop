# 등록카드 승인·전체취소 실검증

## 범위

사용자가 등록카드 결제·취소 검증을 명시적으로 요청했다. 기존 LAONSHOP 계정과 등록한 카드로 정상 상품 주문 1건(21,000원)을 만들고 사용자가 결제 버튼을 직접 실행했다. 추가 청구·카드 해지·지급대행은 범위에 포함하지 않는다. 실제 카드정보·provider token·개인정보는 기록하지 않는다.

## 실제 승인 확인 — 2026-09-18 22:27 KST

- 정상 LAONSHOP checkout에서 등록카드를 선택했고 완료 화면에 21,000원·삼성카드(등록카드)를 확인했다.
- LAONPAY 운영 DB의 읽기 전용 검사에서 BillingCharge PAID, Payment PAID/BILLING/BAUM, 승인번호와 PG 거래번호 존재, BAUM CHARGE SUCCEEDED 1건을 확인했다. 실제 승인 API 완료까지 약 2초다.
- 바움 승인 통보를 22:27:48 KST에 실제 수신했다. 서버의 제한된 진단 로그는 COMMITTED·HTTP 200·20ms를 기록하며 코드의 commit 후 `0000` ACK 경로와 일치한다.
- worker의 거래조회 대사는 MATCHED·APPROVED·0000·21,000원이고 22:27:59 KST 통보 APPLIED/LEDGER_BOUND로 종료했다. 서명 없는 원본 통보를 신뢰한다는 뜻은 아니며 `sourceVerified=false`와 별개로 인증된 거래조회 결과와 원장을 대조한다.
- 해당 셀러 당일 정산은 결제 21,000원·취소 0원·지급예정 21,000원이었다. 수수료/VAT 스냅샷은 기존 계약 설정에 따른 0원이며 임의 변경하지 않았다.

## 전체취소 진행

22:36 KST 정상 주문 화면에서 전체취소 요청을 접수했다. LAONSHOP 취소 접수 UI, LAONPAY BillingCharge/Payment CANCEL_REQUESTED와 단일 CancelRequest REQUESTED가 일치한다. 관리자 로그인 후 같은 21,000원 거래의 Baum PG 전체취소 창에 사유를 입력했다. 마지막 취소 비밀번호 입력·실행은 사용자에게 넘겼으며 이 시점에는 실제 취소 성공으로 보고하지 않는다.

## 검증 중 발견한 시간 표시 수정

주문 완료/취소 접수 화면이 서버 기본 시간대를 사용해 운영 UTC에서 한국 시간보다 9시간 이르게 표시됐다. `app/order/[id]/page.tsx`의 결제일시·취소접수일에 `Asia/Seoul`을 명시했다. 결제 처리, 저장 시각, 상태 전이, 금액은 변경하지 않는다.

- 변경 파일 ESLint PASS.
- UTC 환경에서 결제일시가 22:27:48로 표시되고 15:30Z의 취소 접수일이 한국 다음날로 표시되는 경계 확인 PASS.
- 운영 설정 없는 소스 snapshot과 자체 PostgreSQL의 production build PASS. 자체 DB 종료·삭제 완료.
- 배포 및 실제 취소 후속 결과는 아래에 추가한다.
