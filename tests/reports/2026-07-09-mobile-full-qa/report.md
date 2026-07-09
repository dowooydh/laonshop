# LAON SHOP 모바일 전체 QA 리포트

실행일: 2026-07-09  
대상 브랜치: `main` (`a6c3238 feat(payment): 수기결제(구인증) 수단 추가 + 원클릭 결제 카드 선택`)  
대상 URL: `http://localhost:3003`

## 환경

- Node: `v25.9.0` (`package.json` 요구값은 `22.x`)
- pnpm: `11.5.3`
- DB: `.env`의 Neon 테스터 브랜치
- Android emulator: `emulator-5554`, 1080x2400, density 420
- Android browser: `com.android.chrome`
- 라온샵 네이티브 앱 모듈: 이 저장소에서 확인되지 않음. Android 앱 화면은 라온샵 웹을 Chrome에서 검증했다.

## 실행 명령

- `pnpm prisma db push`: 통과
- `pnpm db:seed`: 통과, 상품 329개 생성
- `pnpm build`: 통과
- `pnpm typecheck`: 통과
- `pnpm lint`: 실패. Next 15의 `next lint`가 ESLint 설정 인터랙티브 프롬프트로 진입
- `pnpm dev`: `http://localhost:3003` 정상 기동

## 통과한 주요 시나리오

- 홈 모바일폭 390px 로드, 모바일 nav 노출
- 여성 상품 목록 카테고리 탭/정렬
- 검색 결과/검색 빈 상태
- 비로그인 찜 클릭 시 로그인 이동
- 회원가입 약관/개인정보 동의 required 차단 및 정상 가입
- 장바구니 추가, 수량 조작, 로그인 후 카트 유지
- 체크아웃 저장 배송지 프리필
- 구매 동의 전 결제 버튼 비활성
- 비 allowlist 계정의 수기결제 준비 중 guard
- 카드결제 선택 후 KSPAY 결제창 로딩 화면 도달
- allowlist 계정의 수기결제 mock 승인 후 주문완료
- PAID 주문 취소·반품 신청 접수
- 카드 등록 후 원클릭 결제 mock 승인
- Android Chrome에서 홈, 검색, 여성 상품 목록 렌더링

## 발견 이슈

| 우선순위 | 제목 | 근거 |
| --- | --- | --- |
| P1 | 회원 탈퇴 후 `zipcode`, `addressDetail` 개인정보가 남음 | `deleteAccountAction`이 `phone`, `address`만 null 처리한다. QA 탈퇴 계정 DB에 `zipcode=12345`, `addressDetail=잔존상세 909` 잔존 확인. |
| P2 | `pnpm lint`가 자동 검증으로 사용할 수 없음 | `next lint`가 deprecated 상태에서 ESLint 설정 선택 프롬프트로 진입하고 exit 1. |
| P2 | 로그인 5회 실패 시 5번째 화면은 일반 오류, 6번째부터 잠금 문구 표시 | 기능상 잠금은 설정되지만 “5회 실패 시 잠금” 안내와 사용자 체감이 한 번 늦다. |
| P3 | Android emulator dev 접속에서 Next `allowedDevOrigins` 경고 | `127.0.0.1`, `10.0.2.2`로 `_next/*` 리소스 요청 시 future major 경고 발생. |
| P3 | above-the-fold 이미지 LCP priority 경고 | 홈 히어로/상품 카드 이미지에 Next Image LCP priority 경고 반복. |

## 증적 파일

- `web-mobile-home.png`
- `web-mobile-checkout-manual-guard.png`
- `web-mobile-kspay-loading.png`
- `web-mobile-cancel-request.png`
- `web-mobile-oneclick-paid.png`
- `android-chrome-home.png`
- `android-chrome-search.png`
- `android-chrome-shop-women.png`
- `web-mobile-focused-results.json`
- `web-mobile-full-raw-results.json`

## 참고

- KSPAY 실카드 승인 왕복은 테스트 카드 정보가 없어 수행하지 않았다.
- 결제창은 로컬에서 KSPAY 로딩 화면 도달까지만 확인했다.
- 수기결제/원클릭 결제 성공은 allowlist 계정과 mock 승인 경로로 검증했다.
- Android Chrome 첫 실행 프롬프트와 번역 제안 버블은 브라우저 UI로, 제품 결함에서 제외했다.

