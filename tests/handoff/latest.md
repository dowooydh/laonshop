# QA 핸드오프 최신본

작성일: 2026-07-09
담당: Codex QA/테스트 세션
상태: 모바일 웹/Android Chrome 전체 QA 실행 완료

## 이번 작업 요약

- 제품 코드는 수정하지 않았다.
- `main` 최신 커밋 기준으로 코드 리뷰, DB 스키마 반영, 시드, 빌드, 타입체크, 모바일폭 브라우저 테스트, Android Chrome 테스트를 수행했다.
- 수기결제/원클릭 결제는 allowlist 계정의 mock 승인 경로로 검증했다.
- KSPAY 실카드 승인 왕복은 테스트 카드 정보가 없어 수행하지 않고, 결제창 로딩 화면 도달까지만 확인했다.
- 상세 리포트: `tests/reports/2026-07-09-mobile-full-qa/report.md`

## 주요 기능 맵

- 쇼핑: 홈, 성별 상품 목록, 검색, 정렬, 상품 상세, 최근 본 상품
- 장바구니: localStorage 저장, 수량 변경, 삭제, 빈 상태
- 인증: 약관 동의 회원가입, 로그인, 로그인 잠금, 로그아웃, 보호 페이지, 회원 탈퇴
- 찜: 상품 상세 토글, 마이페이지 찜 목록
- 주문/결제: 배송지 자동입력, 구매 동의, 서버 주문 생성, KSPAY 인증결제창, callback/result API, 주문 상태 전이
- 주문 사후: 주문 완료, 영수증 링크, 취소/반품 신청 접수
- 마이페이지: 사용자 주문 목록, 찜 목록, 정보 수정, 비밀번호 변경, 탈퇴
- 카드사 심사: 푸터 사업자정보, 이용약관, 개인정보처리방침, 배송/환불 정책

## 실행 결과

- `pnpm prisma db push`: 통과
- `pnpm db:seed`: 통과. 현재 시드 상품 수는 329개
- `pnpm build`: 통과
- `pnpm typecheck`: 통과
- `pnpm lint`: 실패. `next lint`가 ESLint 설정 프롬프트로 진입
- 로컬 dev server: `http://localhost:3003`
- Android emulator: `emulator-5554`, Chrome에서 라온샵 웹 확인

## 통과한 시나리오

- 모바일폭 홈/nav, 상품 목록 카테고리/정렬, 검색 결과/빈 상태
- 비로그인 찜 클릭 시 로그인 이동
- 회원가입 약관/개인정보 동의 required 차단 및 정상 가입
- 장바구니 담기/수량 조작/로그인 후 카트 유지
- 체크아웃 저장 배송지 프리필, 구매 동의 전 결제 버튼 비활성
- 비 allowlist 계정의 수기결제 준비 중 guard
- 카드결제 선택 후 KSPAY 결제창 로딩 화면 도달
- allowlist 계정 수기결제 mock 승인 → 주문완료
- PAID 주문 취소·반품 신청 접수
- 카드 등록 후 원클릭 결제 mock 승인
- Android Chrome 홈/검색/여성 상품 목록 렌더링

## 필요한 계정/서버/기기/권한

### 계정

- 테스트 회원 생성 가능 권한 또는 QA 전용 계정
- 가능하면 `qa+...@example.test` 패턴 사용
- KSPAY 테스트 결제를 실행할 경우 테스트 카드/결제 절차 정보
- 회원 탈퇴 검증용 일회용 테스트 계정

### 서버/환경

- 로컬 개발 서버: `pnpm dev` 기본 포트 `3003`
- 빌드 검증: `pnpm build`
- 테스트 DB 또는 로컬 DB 연결 문자열
- 환경 변수: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `PG_MODE=kspay`, `KSPAY_STORE_ID`
- 추가 환경 변수: `SHOP_APP_URL=http://localhost:3003`
- 셋업: `pnpm install` → `pnpm prisma db push` → `pnpm db:seed` → `pnpm dev`
- 런타임 기준: Node 22.x + pnpm 11.5.3
- 이번 실행 환경: Node `v25.9.0`, pnpm `11.5.3`. Node 엔진 경고 발생

### 기기/브라우저

- 데스크톱 Chromium 계열 브라우저
- 모바일 viewport 390px 전후
- 가능하면 Safari/WebKit 계열 추가 확인
- 결제창 팝업/iframe이 막히지 않는 브라우저 설정

### 권한

- DB read 권한. 테스트 데이터 정리가 필요하면 QA 생성 데이터 한정 write/delete 권한
- 서버 로그 확인 권한
- 브라우저 콘솔/네트워크 확인 권한
- Vercel preview 테스트 시 배포 URL 접근 권한

## 발견 이슈

| 우선순위 | 관찰 | 관련 위치 | 확인 필요 |
| --- | --- | --- | --- |
| P1 | 회원 탈퇴 후 `zipcode`, `addressDetail`이 남는다. 실제 탈퇴 QA 계정에서 `zipcode=12345`, `addressDetail=잔존상세 909` 잔존 확인 | `app/mypage/actions.ts:133` | 탈퇴 익명화 시 두 컬럼도 null 처리 |
| P2 | `pnpm lint`가 `next lint` deprecated/ESLint 설정 프롬프트로 진입해 자동 검증에 실패한다 | `package.json` | ESLint CLI 설정 또는 lint 스크립트 정비 |
| P2 | 로그인 5회 실패 시 5번째 화면은 일반 오류이고, 6번째 시도부터 잠금 문구가 표시된다 | `app/(auth)/actions.ts:71` | 5번째 실패 응답에서 바로 잠금 안내 여부 결정 |
| P3 | Android emulator에서 `127.0.0.1`/`10.0.2.2` dev 접속 시 Next `allowedDevOrigins` future 경고 발생 | `next.config.ts` | 로컬 모바일 테스트 편의용 dev origin 설정 검토 |
| P3 | above-the-fold 이미지에 Next Image LCP priority 경고 반복 | `components/home-hero.tsx`, `components/category-shop.tsx` | 주요 첫 이미지 priority 적용 검토 |

## 버그 보고 제외 항목

- 결제수단 중 계좌이체, 무통장입금, 원클릭 결제 준비 중 비활성
- footer 대표자/주소 없음, 통신판매업신고 `신고 예정`
- 이메일 인증, 비밀번호 재설정 미구현
- 취소/반품 신청이 접수까지만 처리되고 실제 승인취소는 운영자 수동 처리
- 상품 재고 기본 999. 품절 UI는 DB에서 `stock=0`으로 변경해야 노출

## 다음 테스트 요청 시 바로 할 일

1. `git status`와 최근 diff 확인
2. Node 22.x/pnpm 11.5.3 환경 확인
3. 개발 서버 실행 또는 대상 URL 확인. 결제 테스트는 로컬만 허용
4. 테스트 DB/계정 확인
5. `tests/checklists/manual-e2e.md` 기준으로 범위 선택
6. 실행 결과와 결함을 이 문서에 갱신

## QA 데이터

- 이번 테스트에서 `qa-e2e-*`, `qa-focused-*`, `qa-lock-*`, `qa-delete-*` 계정을 생성했다.
- `laontest@laontest.com` allowlist 계정은 mock 결제 검증을 위해 비밀번호/주소를 QA 값으로 맞췄다.
- 주문/카드/탈퇴 상태는 재현 증적 보존을 위해 삭제하지 않았다.
