# 리빌드 출발선 스냅샷 (Phase 0)

> `feat/redesign-3d` 시작 시점의 라우트·서버액션·API·모델 목록.
> [HANDOVER-REDESIGN.md](./HANDOVER-REDESIGN.md) §1 "절대 유지선"을 **실제 파일 경로**에 매핑한다.
> 🔒 = 심사 리스크(로직·경로·계약 유지, **디자인만 교체**) · 🎨 = 프레젠테이션 자유

## 라우트 (app/)

| 경로 | 파일 | 종류 | 유지 등급 |
|---|---|---|---|
| `/` | `app/page.tsx` | 서버(force-dynamic), `prisma.product.findMany` | 🎨 (데이터 로직 유지, UI 자유) |
| `/product/[id]` | `app/product/[id]/page.tsx` (+`add-to-cart.tsx`) | 서버 + 클라 | 🎨 (담기=서버액션 없음, `lib/cart` 유지) |
| `/cart` | `app/cart/page.tsx` | 클라(localStorage) | 🎨 (`lib/cart` API 유지) |
| `/checkout` | `app/checkout/page.tsx` | 클라 → `createOrderAction` | 🔒 결제 진입 |
| `/order/[id]` | `app/order/[id]/page.tsx` (+`clear-cart.tsx`) | 서버(force-dynamic), 소유권 스코프 | 🔒 주문 확정 표시 |
| `/mypage` | `app/mypage/page.tsx` | 서버, `requireShopUser` | 🎨 |
| `/login` `/register` | `app/(auth)/login|register/*` | 서버 + 클라 폼 | 🔒 인증(서버액션·세션 유지, UI 자유) |
| `/policy/terms` `/privacy` `/refund` | `app/policy/*` | 서버(정적) | 🔒 심사 필수 — **내용·항목 유지**, 재조판만 |

## 서버 액션 (유지 — 시그니처·동작 보존)

| 액션 | 파일 | 역할 |
|---|---|---|
| `registerAction` `loginAction` `logoutAction` | `app/(auth)/actions.ts` | 🔒 bcrypt 해시/검증 + iron-session |
| `createOrderAction` | `app/checkout/actions.ts` | 🔒 **DB 상품가로 총액 재계산**, `ShopOrder(PENDING)` 생성, `createAuthOrder` |

## API 라우트 (🔒 KSPAY — 절대 유지)

| 경로 | 파일 | 역할 |
|---|---|---|
| `POST /api/pg/kspay/callback` | `app/api/pg/kspay/callback/route.ts` | rcv 브릿지(`eparamSet`/`goResult`/`mcancel`, jsEscape) |
| `POST /api/pg/kspay/result` | `app/api/pg/kspay/result/route.ts` | 서버승인(`sndActionType=1`), PENDING일 때만(멱등), PAID/FAILED |

## 유지 대상 lib / components

- 🔒 `lib/kspay/*` (`index`·`kspay-provider`·`types`) — PG 프로바이더. 미확보 스펙은 `NEEDS_PG_SPEC` throw + mock 유지.
- 🔒 `components/kspay-checkout.tsx` — 결제창. **jQuery 먼저 로드 → `kspay_web_ssl.js` → `_pay()`** 순서·hidden 폼 필드 보존.
- 🔒 `lib/auth.ts` `lib/session.ts` — `requireShopUser`/`getShopUser`, iron-session(`laonshop_session`).
- 🔒 `lib/db.ts` — Prisma 싱글턴. import는 `@/lib/db`.
- 🎨 `lib/cart.ts` — localStorage 장바구니(`laonshop-cart`). API(`getCart`/`saveCart`/`addToCart`/`clearCart`/`cartTotal`) 유지, UI 자유.
- 🔒 `lib/format.ts` — `generateMoid`(LP+타임스탬프+rand, 특수문자 없음)·`sanitizePgParam`·`formatKrw`.
- 🎨 `lib/ui/*` — 전면 재작성 대상(다크 퍼스트·글로우·글래스).

## DB 모델 (🔒 `prisma/schema.prisma` — 컬럼 추가 OK, 파괴 금지, `db push`는 사용자 확인)

- `ShopUser`(id·email@unique·passwordHash·name·phone?·createdAt)
- `Product`(id·name·description?·price:Int(원)·imageUrl?·category?·sizes?(CSV)·stock·active·sortOrder)
- `ShopOrder`(id·userId·status·totalAmount:Int·moid@unique·approvalNo?·pgTrno?·paidAt?·receiver…·address?·createdAt)
- `ShopOrderItem`(id·orderId·productId·name(스냅샷)·price:Int(스냅샷)·qty·size?)
- enum `ShopOrderStatus` = PENDING | PAID | FAILED | CANCELED

## Footer 사업자정보 (🔒 `app/layout.tsx` — 항목 전부 유지, 디자인만 새로)

㈜커스텀오더 · 대표 유준혁 · 사업자등록번호 864-88-03054 · 통신판매업신고번호 2025-성남분당A-0152 · 소재지(경기 성남 판교) · 개인정보보호책임자 · 고객센터/이메일(준비중) · 정책 3종 링크.

## 베이스라인 검증 (Phase 0 완료 기준)

- ✅ `pnpm build` 통과 · ✅ `pnpm dev`(3003) 부팅
- ✅ 실 Neon DB 연결 → 홈에 상품 10종 렌더
- ✅ 회원가입 → 세션 → 상품 → 장바구니 → 체크아웃 → **KSPAY 인증결제창 렌더(테스트 MID, 금액 29,000원, `_pay $ is not defined` 없음)**
- 🔁 실제 승인→자동취소 전 구간은 **Phase 6 회귀 게이트**에서 재확인.
