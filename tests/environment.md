# 로컬 테스트 환경

최종 갱신: 2026-07-20

## 저장소/브랜치

- 저장소: `github.com/dowooydh/laonshop`
- QA 허용 경로: `/Users/donghyuk/Projects/laonshop`
- 현재 기준 브랜치: `main`
- 2026-07-11 검증 HEAD: `5fe1417369f12e71328f221a34604f7a9229a07a`
- 런타임 기준: Node 22.x
- 패키지 매니저: pnpm 11.5.3 (`packageManager` 고정)
- 시스템 기본 Node가 22가 아니면 `npx --yes node@22 /opt/homebrew/bin/pnpm <command>`로 검증할 수 있다.

## 환경변수

`.env` 파일은 보안상 저장소에 없다. 실제 값은 출력하거나 QA 문서에 기록하지 않는다.

- `DATABASE_URL`: 테스터 전용 Neon 브랜치
- `DIRECT_URL`: 테스터 전용 Neon 브랜치 direct URL
- `SESSION_SECRET`: 32자 이상 문자열
- `PG_MODE`: `kspay`
- `KSPAY_STORE_ID`: KSNET 테스트 MID
- `SHOP_APP_URL`: `http://localhost:3003`

계약 전 선택 변수 `KSPAY_API_KEY`, `KSPAY_REST_LIVE`, `KSPAY_STORE_KEY`는 현재 의도적으로 미설정이다. LAONPAY 파트너 env 3종과 `LAONPAY_BILLING_SCHEMA_READY`, `LAONPAY_BILLING_FEATURE_ENABLED`도 운영 활성화 전까지 미설정/`0`으로 유지한다. 실값은 `ENV_INVENTORY.md`의 원본 위치에서만 관리한다.

## 셋업 순서

```bash
pnpm install --frozen-lockfile
pnpm prisma db push
pnpm db:seed
pnpm test
pnpm test:billing:interop
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

- 개발/production 로컬 서버 포트: `3003`
- Android emulator 접근: `http://10.0.2.2:3003`
- 현재 시드 상품 수: 329개
- 시드 재실행 시 상품 ID가 바뀌므로 브라우저 장바구니에 죽은 ID가 남을 수 있다. 이때 판매 종료 오류는 정상이다.

## 결제 테스트 안전

- 결제 왕복은 callback URL 때문에 로컬에서만 수행한다.
- Vercel Preview 결제 플로우는 callback이 운영으로 갈 수 있어 금지한다.
- 테스트 MID도 실제 카드 승인이 발생할 수 있으므로 명시적 승인 없이는 카드번호를 입력하거나 승인하지 않는다.
- 원클릭 카드 등록·결제 코드는 LAONPAY hosted/API 계약에 맞춰 integration-ready 상태지만, additive schema·파트너 env·readiness gate·실 상호운용 승인 전에는 운영에서 fail-closed다.
- loopback HTTP harness는 실제 LAONPAY·KSNET·운영 DB에 접속하지 않으며 등록→조회→청구→조회→전체취소요청→해지 계약만 검증한다.
- 수기 실호출은 계약 키와 live switch가 모두 준비되기 전에는 금지한다.
- QA는 기본적으로 주문 생성과 KSPAY 결제창 진입까지만 확인한다.

## 2026-07-11 실제 실행 환경

- Node `v22.23.1`로 모든 정적·빌드 검증을 실행했다.
- pnpm `11.5.3`, Next.js `15.5.19`, Prisma `6.19.3`이다.
- Android emulator는 1080x2400, density 420, Chrome `133.0.6943.137`이다.
- Android Chrome 후속 자동조작에서 ANR이 발생해 홈·검색 이후는 PARTIAL로 판정했다.
- Neon 무료 티어 cold wake-up 때 첫 동적 요청 15.55초, direct DB 조회 약 65초 지연 사례가 있다.
