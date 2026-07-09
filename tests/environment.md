# 로컬 테스트 환경

최종 갱신: 2026-07-03

## 저장소/브랜치

- 저장소: `github.com/dowooydh/laonshop`
- 브랜치: `feat/redesign-3d`
- 런타임 기준: Node 22.x
- 패키지 매니저: pnpm 11.5.3 (`packageManager` 고정)
- 권장: `corepack enable`

## 환경변수

`.env` 파일은 보안상 저장소에 없다. 별도 채널로 전달받은 아래 6종을 사용한다.

- `DATABASE_URL`: 테스터 전용 Neon 브랜치
- `DIRECT_URL`: 테스터 전용 Neon 브랜치 direct URL
- `SESSION_SECRET`: 32자 이상 문자열
- `PG_MODE`: `kspay`
- `KSPAY_STORE_ID`: `2999199999`
- `SHOP_APP_URL`: `http://localhost:3003`

## 셋업 순서

```bash
pnpm install
pnpm prisma db push
pnpm db:seed
pnpm dev
pnpm build
```

- 개발 서버: `http://localhost:3003`
- `pnpm db:seed`는 현재 코드 기준 상품 329개를 생성한다.
- 시드 재실행 시 상품 ID가 바뀌므로 브라우저 localStorage 장바구니에 죽은 상품이 남을 수 있다.
- 이때 `"판매가 종료된 상품"` 오류가 뜨면 정상 동작으로 보고, localStorage를 비운 뒤 재시도한다.

## 결제 테스트 주의

- KSPAY 테스트 MID는 `2999199999`다.
- 테스트 MID라도 실카드 승인 후 몇 분 뒤 자동취소되는 방식이다.
- 결제 왕복은 callback URL 때문에 로컬에서만 테스트한다.
- Vercel Preview에서 결제 플로우를 밟으면 callback이 프로덕션으로 갈 수 있으므로 금지한다.

## 로컬 상태 메모

- 2026-07-03 현재 이 세션에서 직접 확인한 `node -v`는 `v25.9.0`, pnpm은 `11.7.0`이었다.
- 같은 세션의 `pnpm build` 경고에는 Node `v24.14.0`, pnpm `11.7.0`으로 표시됐다.
- 즉 현재 셸/패키지 실행 경로의 Node 버전이 테스트 기준과 일치하지 않는다.
- 실제 검증은 안내 기준인 Node 22.x/pnpm 11.5.3 환경에서 수행해야 한다.
