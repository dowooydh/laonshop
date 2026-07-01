# 회귀 테스트 매트릭스

| 영역 | 핵심 경로 | P0 | P1 | 비고 |
| --- | --- | --- | --- | --- |
| 홈 | `/` |  | O | 히어로/게이트/푸터 |
| 상품 목록 | `/shop/men`, `/shop/women` |  | O | active 상품만 |
| 상품 상세 | `/product/[id]` |  | O | 사이즈/수량 |
| 장바구니 | `/cart` |  | O | localStorage |
| 인증 | `/login`, `/register` | O |  | 세션/검증 |
| 체크아웃 | `/checkout` | O |  | 로그인, 서버 금액 |
| PG callback | `/api/pg/kspay/callback` | O |  | HTML escape, 취소 |
| PG result | `/api/pg/kspay/result` | O |  | 멱등, DB 금액 |
| 주문 결과 | `/order/[id]` | O |  | 소유권, 상태 |
| 마이페이지 | `/mypage` |  | O | 목록/빈 상태 |
| 정책 | `/policy/*` | O |  | 카드사 심사 |
| 모바일 | 주요 경로 |  | O | 390px 기준 |

## 변경 유형별 필수 회귀

인증/세션 변경:
- 회원가입, 로그인, 로그아웃
- 보호 페이지 redirect
- 본인/타인 주문 접근

상품/장바구니 변경:
- 상품 목록, 상세, 사이즈, 수량
- 장바구니 저장/삭제/새로고침
- checkout 상품 요약

주문/결제 변경:
- 배송정보 검증
- 서버 금액 재계산
- PENDING 주문 생성
- KSPAY 폼 필드
- callback/result 상태 전이

UI/디자인 변경:
- 홈, 목록, 상세, 장바구니, checkout, order, mypage
- 모바일/데스크톱
- 텍스트 겹침, 버튼 크기, focus 기본 동작

