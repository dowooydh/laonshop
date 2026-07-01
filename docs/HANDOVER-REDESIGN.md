# LAON SHOP — 미래지향 3D/인터랙티브 리디자인 핸드오버

> **대상 실행자:** Claude Code (이 저장소에서 직접 코드 작업)
> **작성 목적:** laonshop을 "말도 안 되게 멋있고 동적인" 미래지향 3D/인터랙티브 의류 쇼핑몰로 **전면 리빌드**하기 위한 단일 지침서.
> **작성일:** 2026-07-01 · **무드:** Futuristic 3D / Interactive (Awwwards급) · **범위:** 프론트 전면 리빌드, **결제·인증·DB 유지**

---

## 0. 이 문서를 읽는 법 (Claude Code용 지침)

1. 먼저 [`CLAUDE.md`](../CLAUDE.md)의 **절대 규칙**을 읽는다. 이 문서는 그 위에 얹는 디자인/구현 계층이다. 규칙이 충돌하면 **CLAUDE.md가 우선**한다.
2. §1 제약(무엇을 절대 건드리지 않는가)을 반드시 지킨 채로, §5 로드맵을 **Phase 순서대로** 실행한다.
3. 각 Phase 끝에는 `pnpm build` 통과 → 커밋·푸시(자동, [`commit.md`](../.claude/rules/commit.md) 규칙). 실패 시 푸시 금지.
4. 큰 시각 결정(무드보드/토큰)은 §4·§6을 SSOT로 삼는다. 애매하면 레퍼런스(§3)를 보고 "더 과감한 쪽"을 택하되 성능 예산(§7)을 깨지 않는다.

---

## 1. 절대 유지 (심사 리스크 = 건드리지 말 것)

이 사이트는 **KSNET 카드결제 카드사 심사용**이자 실판매용이다. 아래는 리빌드해도 **그대로 살려야** 한다. 디자인만 갈아끼우고 로직·경로·계약은 유지한다.

| 영역 | 경로 | 유지 이유 |
|---|---|---|
| KSPAY 결제 흐름 | `app/api/pg/kspay/callback/route.ts`, `app/api/pg/kspay/result/route.ts`, `components/kspay-checkout.tsx`, `lib/kspay/*` | 카드사 심사 대상. 결제창(jQuery 의존 `_pay()`)·rcv 브릿지·서버승인(`sndActionType=1`) 흐름 그대로. |
| 주문 확정 로직 | `app/checkout/actions.ts`, `app/order/[id]/*` | 금액은 정수(원), 돈 계산은 서버에서. 라온페이 계승 규칙. |
| 인증/세션 | `lib/auth.ts`, `lib/session.ts`, `app/(auth)/*` | iron-session 기반. UI는 새로 그리되 서버 액션·세션은 유지. |
| DB 스키마 | `prisma/schema.prisma` (`ShopUser`/`Product`/`ShopOrder`/`ShopOrderItem`) | 실판매 데이터. **컬럼 추가는 OK, 기존 컬럼/관계 파괴 금지.** 마이그레이션은 `db push` 전 사용자 확인. |
| **Footer 사업자정보 + 정책 3종** | `app/layout.tsx` footer, `app/policy/{terms,privacy,refund}` | **카드사 심사 필수 요소.** 상호·사업자등록번호·통신판매업신고·대표·주소·연락처 + 이용약관·개인정보처리방침·청약철회/교환/환불. 디자인은 미래지향으로 새로 그려도 **정보 항목은 전부 유지**. |

> ⚠️ **카드정보 비저장** 원칙 유지(KSPAY 결제창 방식). 로그 마스킹. 미확보 PG 스펙은 `NEEDS_PG_SPEC` 주석 + mock 유지.

**리빌드 대상(자유):** 레이아웃, 디자인 시스템, 홈/상품리스트/상품상세/장바구니/마이페이지 UI, 모션·3D·셰이더·트랜지션, 폰트·컬러·그리드, 컴포넌트 라이브러리(`lib/ui/*`) 전체.

---

## 2. 컨셉 & 아트 디렉션

**한 줄 컨셉:** *"입는 것을 공간(space)에서 만난다"* — 제품을 평면 카탈로그가 아니라 **부유하는 3D 오브젝트 / 몰입형 씬**으로 제시하는 미래지향 편집샵.

**감정 키워드:** 미래적(futuristic) · 매끄러움(seamless) · 촉각적 어둠(tactile dark) · 정밀함(precision) · 살아있는 타이포(kinetic).

**아트 디렉션 원칙 5개**
1. **다크 퍼스트 + 발광.** 딥 잉크/차콜 배경에 발광 악센트(네온 시안·일렉트릭 바이올렛). 라이트 모드는 선택적 토글.
2. **3D는 "순간"에만.** 히어로·상품 상세의 결정적 장면에서만 진짜 WebGL. 나머지는 CSS 그레인·그라디언트 메시로 저비용 깊이감. (성능 리얼리티 체크 — §7)
3. **모든 전환은 이어짐.** 페이지 리로드처럼 보이지 않게. 클릭한 썸네일이 다음 페이지 히어로로 **확장**되는 공유 요소 전환.
4. **타이포가 주인공.** 거대한 가변폰트 헤드라인이 스크롤·호버에 반응. 본문은 정적·가독 우선.
5. **그레인/노이즈로 손맛.** 전체에 미세 필름 그레인 오버레이(`mix-blend`)로 3D가 무균질하게 보이지 않도록.

---

## 3. 최신 레퍼런스 (2025–2026, 실링크)

> 브라우징 시작점으로는 아래 갤러리가 항상 최신. 캠페인 마이크로사이트(구찌·막스마라 등)는 캠페인 종료 후 내려갈 수 있으니 Awwwards 케이스 링크를 함께 참고.

**갤러리(항상 최신)**
- Awwwards Fashion — https://www.awwwards.com/websites/fashion/
- Awwwards E-commerce — https://www.awwwards.com/websites/e-commerce/
- Awwwards WebGL — https://www.awwwards.com/websites/webgl/ · 3D — https://www.awwwards.com/websites/3d/
- FWA — https://thefwa.com/
- CSS Design Awards WOTY 2025 — https://www.cssdesignawards.com/woty2025/

**수상/실제 사이트 (무엇이 특별한지)**
- **Scout Motors** — Awwwards E-commerce Site of the Year 2025(by Locomotive). 시네마틱 스크롤 스토리텔링·영상 주도 제품 공개. https://www.scoutmotors.com/
- **Gucci: Mystery Unfolds** (MONOGRID) — 내러티브 WebGL 미스터리 마이크로사이트. https://www.awwwards.com/sites/gucci-mystery-unfolds
- **Max Mara – The Jacket Circle Game** (Adoratorio) — 시그니처 제품을 게임화한 인터랙티브 경험. https://www.awwwards.com/sites/max-mara-jacket-circle
- **Brunello Cucinelli – AI E-commerce** (makemepulse) — AI 보조 럭셔리 쇼핑 경험. https://www.awwwards.com/sites/brunello-cucinelli-ai-e-com
- **Bulgari Eclettica** — 하이주얼리 몰입형 제품 마이크로사이트. https://www.awwwards.com/sites/bulgari-eclettica
- **Wolverine Worldwide** (Locomotive) — 볼드 에디토리얼 모션 + 스크롤 전환. https://www.awwwards.com/sites/wolverine-worldwide
- **Balmoral Running** (MILL3) — 키네틱 타이포 + 러닝 어패럴 모션. https://www.awwwards.com/sites/balmoral
- **X8 Eyewear** — 실제 3D 아이웨어 제품 뷰어(패션 3D 뷰어 벤치마크). https://x8.adencys.com/
- **GLITCHWEAR Custom Studio** — 브라우저 내 커스텀 어패럴 빌더. https://create.glitchwear.store
- **Odd Ritual (Golf)** (Malvah) — 플레이풀·볼드 인터랙션(SOTD). https://www.awwwards.com/sites/odd-ritual
- **Detroit Paris** — 강한 아트디렉션 + 인터랙션(Developer Award). https://www.awwwards.com/sites/detroit-paris

**이 미감의 스튜디오(기법 레퍼런스)**
- Locomotive — https://locomotive.ca (스크롤 스토리텔링, smooth scroll)
- Lusion — https://lusion.co/ (실시간 3D, 레이마칭/포토리얼 WebGL)
- Active Theory — https://activetheory.net/ (게임형 WebGL/WebGPU)
- Immersive Garden — https://immersive-g.com/ (고임팩트 3D + 성능 규율)
- 14islands — https://www.14islands.com/ · basement.studio — https://basement.studio/ (오픈소스 데모 다수)

**기법 튜토리얼(복붙 가능한 데모 — Codrops)**
- GSAP로 WebGL 셰이더 애니메이트(리플·리빌·블러) — https://tympanus.net/codrops/2025/10/08/how-to-animate-webgl-shaders-with-gsap-ripples-reveals-and-dynamic-blur-effects/
- 다이내믹 이미지 전환 셰이더 기법 — https://tympanus.net/codrops/2025/01/22/webgl-shader-techniques-for-dynamic-image-transitions/
- 스크롤이 스토리가 되는 러닝 사이트 케이스 — https://tympanus.net/codrops/2026/06/23/podium-building-a-website-where-running-becomes-storytelling/
- 심리스 3D 페이지 전환(GSAP + Three.js) — https://tympanus.net/codrops/2026/03/18/building-seamless-3d-transitions-with-webflow-gsap-and-three-js/
- R3F + GLSL 셰이더 기반 리빌 이펙트 — https://tympanus.net/codrops/2024/12/02/how-to-code-a-shader-based-reveal-effect-with-react-three-fiber-glsl/

**3D 상품 뷰어/컨피규레이터 참고**
- 오픈소스 R3F 의류 컨피규레이터(포크해서 학습) — https://github.com/afilahkle/3D-Clothing-Configurator
- Threekit 스니커 데모 — https://www.threekit.com/3d-product-library/sneaker
- Nike By You(벤치마크 개요) — https://www.smartcustomizer.com/inspirations/nike-shoes-visual-cpq-platform

---

## 4. 디자인 시스템 토큰 (초안 — SSOT)

> Tailwind 테마 + CSS 변수로 구현. 아래 값을 `tailwind-preset.js` / `globals.css`의 `:root`에 반영한다. 숫자는 출발점이며, 구현하며 튜닝 가능(단, 다크 퍼스트·발광 악센트 원칙 유지).

### 4.1 컬러
```
/* 배경 (딥) */
--bg-void:      #05060A   /* 최하단 배경 */
--bg-base:      #0A0C12   /* 기본 서피스 */
--bg-raised:    #12151F   /* 카드/상승 서피스 */
--bg-overlay:   #1A1E2B   /* 모달/팝오버 */

/* 텍스트 */
--fg-primary:   #F4F6FB
--fg-muted:     #9AA3B2
--fg-subtle:    #5C6577

/* 발광 악센트 (네온) */
--accent-cyan:    #4FD1FF   /* 주 악센트 (CTA·링크·포커스) */
--accent-violet:  #8B5CFF   /* 보조 악센트 (그라디언트·글로우) */
--accent-lime:    #C6FF4F   /* 희소 하이라이트 (세일·NEW 뱃지) */

/* 그라디언트 메시 (히어로 배경) */
--mesh-a: #4FD1FF; --mesh-b: #8B5CFF; --mesh-c: #0A0C12; --mesh-d: #1A1E2B;

/* 상태 */
--success: #3DDC97; --warning: #FFB84F; --danger: #FF5C7A;

/* 라이트 모드(선택 토글) 는 위를 반전한 팔레트로 별도 정의 */
```
악센트는 **면적을 좁게**. 넓게 칠하지 말고 발광 포인트·글로우·포커스 링에만. 그라디언트 메시는 히어로 배경 한정.

### 4.2 타이포그래피
- **디스플레이(히어로/키네틱):** 가변폰트. 후보 — **Clash Display / Cabinet Grotesk**(Fontshare, 상업 무료) 또는 시스템 sci-fi 무드면 **Orbitron/Workbench**(Google, 가변). Fontshare: https://www.fontshare.com/
- **본문/UI:** 기존 **Pretendard Variable** 유지(한글 가독·이미 로드됨). 라틴 병기 시 Inder/Inter Variable 혼용 가능.
- **모노(스펙/가격 강조):** Google **Space Mono / JetBrains Mono**.
- 스케일(clamp, 반응형):
```
--step--1: clamp(.83rem, .8rem + .15vw, .9rem)
--step-0:  clamp(1rem, .95rem + .25vw, 1.125rem)
--step-1:  clamp(1.33rem, 1.2rem + .6vw, 1.6rem)
--step-2:  clamp(1.8rem, 1.5rem + 1.4vw, 2.5rem)
--step-3:  clamp(2.4rem, 1.9rem + 2.6vw, 4rem)
--step-hero: clamp(3.2rem, 2rem + 7vw, 9rem)   /* 키네틱 헤드라인 */
```
- 헤드라인: `letter-spacing: -0.03em`, 가변 axis(weight/width)를 스크롤·호버로 애니메이트.

### 4.3 간격·라운드·보더
```
--space: 4pt 배수 스케일 (4,8,12,16,24,32,48,64,96,128)
--radius-sm: 8px  --radius-md: 14px  --radius-lg: 22px  --radius-pill: 999px
--border-hairline: 1px solid color-mix(in oklab, var(--fg-primary) 10%, transparent)
--glass: backdrop-blur(16px) + bg color-mix(in oklab, var(--bg-raised) 60%, transparent)
```

### 4.4 엘리베이션 & 글로우
```
--shadow-1: 0 1px 2px rgba(0,0,0,.4)
--shadow-2: 0 8px 30px rgba(0,0,0,.5)
--glow-cyan:   0 0 24px color-mix(in oklab, var(--accent-cyan) 55%, transparent)
--glow-violet: 0 0 32px color-mix(in oklab, var(--accent-violet) 50%, transparent)
```

### 4.5 모션 토큰
```
--ease-out-expo: cubic-bezier(.16,1,.3,1)      /* 진입/리빌 */
--ease-in-out:   cubic-bezier(.65,0,.35,1)     /* 전환 */
--dur-fast: 180ms  --dur-base: 360ms  --dur-slow: 720ms  --dur-cinematic: 1200ms
--stagger: 60ms
```
**규칙:** 모든 모션은 `prefers-reduced-motion` 분기 필수(§7). 저사양/모바일에선 3D→정적 포스터 폴백.

### 4.6 그리드
- 12컬럼, 최대폭 데스크톱 1440px(콘텐츠 1200px), 거터 24px. 상품 그리드는 **벤토(bento)** 로 크기 변주(1x1, 2x1, 2x2 혼합).
- 브레이크포인트: 480 / 768 / 1024 / 1280 / 1536.

---

## 5. 단계별 구현 로드맵 (Phase 순서대로)

> 각 Phase = 독립 커밋 단위. 시작 시 해당 Phase를 `in_progress`로 표시, 끝나면 `pnpm build` → 커밋·푸시. **결제/인증/DB 유지(§1)** 를 매 Phase 확인.

### Phase 0 — 준비 & 안전망 (0.5d)
- [ ] 새 브랜치 `feat/redesign-3d` 생성(프로덕션 결제 흐름 보호).
- [ ] 현재 라우트·서버액션·API 목록 스냅샷 문서화(무엇을 유지하는지 명시).
- [ ] `pnpm dev`(포트 3003) / `pnpm build` 통과 확인 = 리빌드 출발선.
- [ ] `.env` 그대로. secrets 커밋 금지 재확인(`.gitignore`).

### Phase 1 — 디자인 시스템 기반 (1–1.5d)
- [ ] §4 토큰을 `globals.css` `:root`(+ 다크/라이트) 와 `tailwind-preset.js`에 반영.
- [ ] 폰트: `next/font`로 디스플레이 가변폰트 self-host + Pretendard 유지. FOUT 방지.
- [ ] `lib/ui/*` 재작성: Button(글로우 variant), Card(glass), Input, Badge, Modal — 다크 퍼스트·CVA 유지.
- [ ] 전역 **그레인 오버레이** 컴포넌트(고정 위치, `pointer-events:none`, `mix-blend-overlay`).
- [ ] 접근성 기본기: 포커스 링(accent-cyan), 색대비 AA, reduced-motion 유틸.
- ✔ 검증: 스토리 페이지 하나에 모든 컴포넌트 렌더 + 대비 체크.

### Phase 2 — 셸 & 네비게이션 (1d)
- [ ] `app/layout.tsx` 재디자인: glass 헤더, 로고 워드마크(발광), 미니 카트, 로그인 상태. **footer 사업자정보·정책 링크 전부 유지**(디자인만 새로).
- [ ] **Lenis** 스무스 스크롤 프로바이더(`'use client'` 레이아웃 래퍼)를 GSAP ScrollTrigger와 단일 RAF 루프로 연결.
- [ ] 페이지 전환 래퍼(Motion `AnimatePresence` 기반) — 리로드 느낌 제거.
- [ ] 커스텀 커서(선택) + reduced-motion 시 기본 커서.
- ✔ 검증: 스크롤 부드러움, 헤더 sticky/blur, footer 항목 누락 없는지.

### Phase 3 — 홈 히어로 (WebGL 순간) (1.5–2d)
- [ ] R3F `<Canvas>` 히어로: 부유하는 의류 3D 오브젝트 또는 그라디언트 메시 + 발광. `next/dynamic({ssr:false})` 로드.
- [ ] 키네틱 헤드라인(GSAP SplitText, 무료) — 스크롤·호버 반응 가변 axis.
- [ ] IntersectionObserver로 뷰포트 진입 시에만 Canvas 마운트. 이탈 시 일시정지.
- [ ] 모바일/저사양·reduced-motion → 정적 포스터 이미지 + CSS 그라디언트 폴백.
- ✔ 검증: 데스크톱 60fps 근접, 모바일 폴백 동작, LCP·CLS 확인.

### Phase 4 — 상품 리스트 (벤토 + 셰이더 전환) (1.5d)
- [ ] `app/page.tsx`/리스트를 **벤토 그리드**로. 크기 변주 카드, 호버 시 셰이더 리빌/블러(Codrops 기법).
- [ ] Prisma에서 상품 로드(서버 컴포넌트) — **데이터 로직 유지**, 프레젠테이션만 교체.
- [ ] 카드 → 상세 **공유 요소 전환**(썸네일이 히어로로 확장). Motion layout 또는 GSAP Flip.
- [ ] 스크롤 진입 스태거 애니메이션, 이미지 `next/image`(AVIF/WebP, sizes).
- ✔ 검증: 필터/정렬 동작 유지, 이미지 지연로드, 전환 자연스러움.

### Phase 5 — 상품 상세 (3D 뷰어 + 스토리) (2d)
- [ ] 결정적 3D 순간: 회전 가능한 상품 3D(있으면 GLB, 없으면 360° 이미지 시퀀스 폴백) — meshopt 압축, `useGLTF.preload` on intent.
- [ ] 스크롤 스토리텔링 섹션(소재·디테일·컨텍스트) — ScrollTrigger 스크럽.
- [ ] **사이즈 선택 → 장바구니**: 기존 `add-to-cart.tsx` 서버액션·`lib/cart.ts` **유지**, UI만 새로.
- [ ] reduced-motion·저사양 폴백(정적 갤러리).
- ✔ 검증: 장바구니 담기 정상, 재고/사이즈 로직 유지, 3D 폴백 동작.

### Phase 6 — 장바구니·체크아웃·주문완료 (1.5d)
- [ ] `cart`/`checkout`/`order/[id]` UI 재디자인. **금액 계산·서버액션·주문 확정 로직 유지.**
- [ ] **KSPAY 결제창 흐름 절대 유지**: `createAuthOrder` → 결제창(jQuery `_pay()`) → `/api/pg/kspay/callback` → `/api/pg/kspay/result`. 마크업만 손대고 스크립트 로드 순서(jQuery 먼저) 보존.
- [ ] 체크아웃 진행 표시(스텝 인디케이터), 로딩·성공 마이크로인터랙션.
- ✔ 검증: **테스트 MID `2999199999`로 승인→자동취소까지 실제 결제 흐름 통과**(가장 중요한 회귀 테스트). 콘솔 `_pay $ is not defined` 없어야 함.

### Phase 7 — 인증·마이페이지 & 정책 페이지 (1d)
- [ ] `login`/`register`/`mypage` UI 재디자인 — 서버액션·세션 유지.
- [ ] 정책 3종(`terms`/`privacy`/`refund`) 새 타이포로 재조판, **내용·항목 유지**(심사 필수).
- ✔ 검증: 로그인/로그아웃/회원가입, 정책 링크 접근성.

### Phase 8 — 마감: 성능·접근성·QA (1–1.5d)
- [ ] 성능 예산 점검(§7): 3D lazy, DPR 스케일링, 번들 분석. Lighthouse 모바일/데스크톱.
- [ ] 접근성 패스: 키보드 내비, 포커스 순서, 색대비 AA, reduced-motion 전 구간, alt 텍스트.
- [ ] 크로스 브라우저(Safari 포함 WebGL) + 모바일 실기 확인.
- [ ] 최종 회귀: 결제 테스트 흐름 재확인 → 메인 브랜치 병합 준비.
- ✔ 검증: `design:accessibility-review` 스킬로 감사, `engineering:code-review`로 결제 근처 변경 점검.

---

## 6. 기술 스택 (검증된 최신 — 2026)

> 정확한 패치는 설치 시 `npm view <pkg> version`으로 확정. **R3F는 반드시 v9**(React 19/Next 15). v8 사용 시 깨짐.

**설치 베이스라인**
```bash
# 3D / WebGL
pnpm add three @react-three/fiber@9 @react-three/drei@10 @react-three/postprocessing
pnpm add @react-three/rapier            # 물리(옵션)
# 모션
pnpm add motion gsap @gsap/react        # motion = 구 framer-motion (import 'motion/react')
# 스무스 스크롤 (새 패키지명!)
pnpm add lenis                          # @studio-freight/lenis 는 폐기됨
# 셰이더 DOM 레이어 (옵션)
pnpm add @paper-design/shaders-react    # MeshGradient 등 무코드 셰이더 배경
```

| 목적 | 라이브러리 | 핵심 노트 |
|---|---|---|
| 3D 엔진 | `three` (~r185대) | 프레임워크 독립. WebGPU 렌더러 프로덕션 가능. |
| R3F | `@react-three/fiber@9` | **React 19 = v9 필수.** 클라이언트 전용 → `'use client'` + `next/dynamic({ssr:false})`. |
| 3D 헬퍼 | `@react-three/drei@10` | `useGLTF`, `<Environment>`, `shaderMaterial`, 컨트롤 등. |
| 포스트프로세싱 | `@react-three/postprocessing` | Bloom/글로우·DOF·노이즈. 성능 주의(버퍼 비쌈). |
| 물리(옵션) | `@react-three/rapier` | 부유·충돌 연출. React19 peer 확인 후 핀. |
| UI 모션 | `motion` (구 Framer Motion, `motion/react`) | 진입/이탈·레이아웃·공유요소·제스처. React19 지원. |
| 타임라인/스크롤 | `gsap` + `@gsap/react` | **2026년 전 플러그인 무료**(Webflow 인수). ScrollTrigger·SplitText·Flip·MorphSVG 상업 무료. `useGSAP()` 사용. |
| 스무스 스크롤 | `lenis` (+ `lenis/react`) | ScrollTrigger와 **단일 RAF 루프** 공유, `scroll`마다 `ScrollTrigger.update()`. |
| 셰이더 배경 | `@paper-design/shaders-react` | `MeshGradient` 등 무코드. GLSL 직접 작성은 drei `shaderMaterial`. |
| 이미지 | `next/image` | AVIF/WebP·반응형·지연로드. (3D 텍스처는 별도 KTX2/Basis 압축) |
| 3D 에셋 파이프 | `gltf-transform` CLI | Draco(정적) 또는 **meshopt(애니메이션 — 모프타깃 보존)** + KTX2 텍스처. |
| 폰트 | `next/font` + Fontshare/Google 가변 | 디스플레이 가변폰트 + Pretendard(한글) 유지. |

**모션 선택 가이드:** 컴포넌트 상태 UI → `motion/react`. 스크롤 내러티브·스크럽·텍스트 리빌·SVG 모프 → GSAP(+ScrollTrigger/SplitText).

**핵심 함정 요약**
1. R3F는 **v9**(v8은 Next15에서 깨짐).
2. R3F는 클라이언트 전용 — `'use client'` + `dynamic({ssr:false})`.
3. GSAP 전면 무료 — SplitText/ScrollTrigger 등 부담 없이 사용, `useGSAP()`로 클린업.
4. import는 `motion/react` (구 `framer-motion` 아님).
5. 스무스 스크롤은 `lenis` (스코프드 패키지 폐기).
6. 애니메이션 모델은 **meshopt**(모프타깃 생존), `gltf-transform`로 일괄 압축.
7. `prefers-reduced-motion`은 선택이 아니라 **필수 분기**.

---

## 7. 성능·접근성 가드레일 (반드시 지킬 것)

**성능 리얼리티 체크(2026 포스트모템 교훈):** 무거운 WebGL/3D는 성능 예산을 자주 초과한다. 많은 팀이 "프리미엄" 느낌을 **CSS 그레인 + 그라디언트**로 더 싸게 얻고, 진짜 3D는 히어로/상품의 결정적 순간에만 썼다.

- **3D는 lazy.** 뷰포트 진입 시 마운트, 이탈 시 정지. 초기 HTML은 가볍게.
- **DPR 스케일링:** drei `<PerformanceMonitor>`/`<AdaptiveDpr>`로 약한 GPU에서 해상도 자동 하향. 목표 데스크톱 60fps, 모바일은 우아하게 저하.
- **에셋 예산:** 초기 JS + 모델 페이로드 슬림. 텍스처 KTX2, 지오메트리 meshopt/Draco. 드로우콜·텍스처 해상도 상한.
- **`prefers-reduced-motion`:** 자동재생 3D/스크롤 애니메이션 정지, 정적 포스터 폴백. `gsap.matchMedia()` / Motion `useReducedMotion()` 사용.
- **접근성 AA:** 다크 배경 대비 검증, 포커스 링 항상 노출, 키보드 내비게이션, 3D/캔버스에 대체 콘텐츠·alt. `design:accessibility-review` 스킬로 감사.
- **회귀 최우선:** 어떤 리디자인도 **결제 테스트 흐름 통과**를 깨선 안 된다(Phase 6 검증).

---

## 8. 활용 가능한 스킬/도구 (Claude Code)

- **Figma MCP** — 무드보드/토큰/컴포넌트를 Figma에서 생성·동기화하고 싶으면 `use_figma`(사전 `/figma-use` 스킬), 코드→디자인/디자인→코드 브리지. (연결 인증 필요)
- **`design:design-system`** — 토큰/컴포넌트 문서화·일관성 감사.
- **`design:design-critique`** — 각 페이지 완성 후 사용성·위계 피드백.
- **`design:accessibility-review`** — WCAG 2.1 AA 감사(Phase 8 필수).
- **`design:ux-copy`** — 버튼·빈상태·에러 카피(미래지향 톤).
- **`engineering:code-review`** — 결제 인접 변경 리뷰(회귀 방지).
- **`design:design-handoff`** — 필요 시 개발 핸드오프 스펙 생성.

---

## 9. 완료 정의 (Definition of Done)

1. 홈/리스트/상세/장바구니/체크아웃/마이페이지/정책 전부 미래지향 다크 디자인 시스템으로 재구축.
2. 히어로·상품 상세에 진짜 WebGL "순간", 나머지는 저비용 깊이감. 전 구간 심리스 전환.
3. **결제 테스트 흐름(테스트 MID `2999199999`) 통과**, footer 사업자정보·정책 3종 유지.
4. Lighthouse: 성능(모바일 3D 폴백 포함)·접근성 AA 통과, reduced-motion 전 구간 동작.
5. `pnpm build` 무결, Phase별 한국어 Conventional Commits로 커밋·푸시 완료.

---

> **다음 액션(Claude Code):** Phase 0부터 시작. 브랜치 생성 → §1 유지 목록 재확인 → §4 토큰을 코드에 심는 Phase 1 착수. 애매하면 §3 레퍼런스를 열어 "더 과감하되 성능 예산은 지키는" 쪽으로.
