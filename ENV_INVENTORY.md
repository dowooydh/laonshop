# ENV_INVENTORY — 환경변수·외부 서비스 인벤토리 (이관용)

> 목적: Claude 없이 다른 코딩 에이전트(Codex 등)가 이 저장소를 안전하게 이어가기 위한 **환경설정·외부 서비스** 참조.
> 작성: 2026-07-10 · 범위: **laonshop 저장소 1개(Next.js 15 웹앱)**. 모바일/EC2/CI는 이 저장소에 없음(아래 "해당 없음" 참조).
>
> 🔒 **이 문서에는 실제 비밀값이 없다.** 변수명·용도·존재 여부·보관 위치만 기록한다. 실제 값은 각 "원본 보관 위치"에서만 확인한다.

## 1. 환경변수 표

| 변수명 | 용도 | 필수/선택 | 적용 환경 | 원본 보관 위치 | 상태(로컬 / Vercel) | 값 변경 후 |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | Neon Postgres **pooled** 런타임 연결(Prisma). `schema.prisma`의 `env()`로 읽음 | **필수** | 로컬·Vercel Prod·Preview | 로컬 `.env`(gitignore) · Vercel env · **원본: Neon 콘솔** | 존재 / Prod+Preview 존재 | Vercel 값 변경 시 **재배포** |
| `DIRECT_URL` | Neon **direct** 연결(`prisma db push`/migrate 전용, 런타임 미사용) | **필수** | 로컬·Vercel | 로컬 `.env` · Vercel env · 원본: Neon 콘솔 | 존재 / Prod+Preview 존재 | 마이그레이션 시 사용(재배포 무관) |
| `SESSION_SECRET` | iron-session 쿠키 암호화 키(≥32자). 빌드/런타임에 필요 | **필수** | 로컬·Vercel | 로컬 `.env` · Vercel env · 원본: 최초 `openssl rand -base64 32` 생성값(별도 원본 없음) | 존재 / Prod+Preview 존재 | 변경 시 **전 세션 무효 + 재배포** |
| `PG_MODE` | PG 프로바이더 선택. 값 `kspay`(기본값 `kspay`) | 필수(기본값 있음) | 로컬·Vercel | 로컬 `.env` · Vercel env | 존재 / Prod+Preview 존재 | 재배포 |
| `KSPAY_STORE_ID` | KSNET 상점 MID. **현재 테스트 MID `2999199999`**. `reHash` 주문 결박 규격 구현 전에는 코드가 실 MID 서버승인을 차단 | **필수** | 로컬·Vercel | 로컬 `.env` · Vercel env · **원본: KSNET 계약** | 존재(테스트값) / Prod+Preview 존재 | 스펙 구현·회귀 후 실 MID 교체 및 **재배포** |
| `SHOP_APP_URL` | 결제 콜백(rcv)/복귀 절대 URL = 배포 도메인. 미설정 시 코드가 `http://localhost:3003` 폴백 | **필수** | 로컬·Vercel | 로컬 `.env` · Vercel env | 존재 / Prod+Preview 존재(`https://laonshop.com`) | 재배포 |
| `KSPAY_STORE_KEY` | KSPAY 상점키. 결제창 V1.4엔 미사용, `KspayProvider`/WEBFEP 계열에서 참조 | 선택(계약 후) | (미설정) | 로컬 `.env` **주석 처리**, Vercel 없음 · 원본: KSNET 계약 | **누락(의도 — 계약 전)** / 없음 | 설정 시 재배포 |
| `KSPAY_API_KEY` | KSNET **WEBFEP REST** 인증키(수기/구인증 실연동). `lib/kspay/webfep.ts` | 선택(계약 후) | (미설정) | 로컬·Vercel 없음 · **원본: KSNET 사업부 별도 계약** | **누락(의도 — 미설정 시 UI·서버 비활성)** / 없음 | 설정 시 재배포 |
| `KSPAY_REST_LIVE` | WEBFEP 실제 승인 명시적 차단 스위치. 값 `1`일 때만 `KSPAY_API_KEY`와 함께 실호출 | 선택(계약 후) | (미설정) | 로컬·Vercel 없음 · 운영 설정값(비밀 아님) | **누락(의도 — 기본 비활성)** / 없음 | `1` 설정 시 재배포 |
| `KSPAY_WEBFEP_BASE` | WEBFEP API base URL. **기본값 `https://pay.ksnet.co.kr`** | 선택(기본값 있음) | (미설정) | 로컬·Vercel 없음(기본값 동작) · 원본: KSNET 문서 | **누락(기본값 사용)** / 없음 | 설정 시 재배포 |
| `NODE_ENV` | 런타임 모드(development/production) | 자동 | Next.js/Vercel 자동 주입 | (설정 불필요) | 자동 | — |

**요약:** 코드가 쓰는 변수 총 10종(+NODE_ENV 자동). 운영에 반드시 있어야 할 6종은 로컬·Vercel(Prod+Preview) 모두 존재. `KSPAY_STORE_KEY`/`KSPAY_API_KEY`/`KSPAY_REST_LIVE`/`KSPAY_WEBFEP_BASE`는 **KSNET 실연동 계약 전이라 의도적으로 미설정**이다. 수기결제는 API 키와 운영 스위치가 모두 없으면 UI·서버에서 차단하며 mock 승인 경로가 없다. 원클릭 빌링도 mock 발급·승인 경로를 제거하고 모든 계정에서 비활성화했다.

## 2. 원본(마스터) 보관 위치 — 시스템별

| 시스템 | 보관 대상 | 접근 경로 |
|---|---|---|
| **Neon 콘솔** | `DATABASE_URL`·`DIRECT_URL` 마스터 | console.neon.tech → 프로젝트(DB `neondb`, region `ap-southeast-1`) → Connection string |
| **KSNET / KSPAY** | 실 MID·`KSPAY_STORE_KEY`·`KSPAY_API_KEY` | KSNET 가맹점 관리자 / 사업부 계약 담당(㈜커스텀오더) |
| **Vercel 대시보드** | 배포용 env 6종(암호화 저장) | vercel.com → `customorder/laonshop` → Settings → Environment Variables |
| **로컬 `.env`** | 로컬 개발용 실값(gitignore) | `~/Projects/laonshop/.env` (이 맥에만 존재, 커밋 금지) |
| **`SESSION_SECRET`** | 별도 마스터 없음 | 최초 생성값이 로컬 `.env`+Vercel에 저장. 분실 시 재생성(전 세션 로그아웃) |
| **가비아(Gabia)** | `laonshop.com` 도메인·DNS(env 아님) | dns.gabia.com — A `@`→76.76.21.21, CNAME `www`→cname.vercel-dns.com |
| **GitHub `dowooydh/laonshop`** | 코드 원본 + Vercel 자동배포 연결 | github.com/dowooydh/laonshop (main push = 자동 배포) |

## 3. 외부 서비스 사용 현황

**사용 중:** Neon(PostgreSQL) · KSNET KSPAY(PG 결제) · Vercel(호스팅·배포) · GitHub(코드·CI 대체 자동배포) · 가비아(도메인).
`package.json` 외부 SaaS SDK 의존성 없음(결제는 KSPAY 결제창 스크립트 + WEBFEP REST fetch, DB는 Prisma).

**해당 없음(이 저장소 범위에서 미사용):**
- **EC2 / 운영 서버 .env** — 없음. Vercel 서버리스만 사용.
- **GitHub Actions Secrets** — 없음(`.github/` 워크플로 파일 자체가 없음). 배포는 Vercel Git 연동으로 대체.
- **Firebase** — 없음(`firebase.json`·`google-services.json`·SDK 의존성 없음).
- **App Store Connect / Google Play** — 없음(웹앱, 모바일 앱 아님).
- **AWS(SDK)·Sentry·메일/SMS(nodemailer/twilio/solapi 등)** — 코드·의존성 참조 없음.
> ※ 위 항목이 라온페이(`Projects/laon`, 별도 저장소)에는 있을 수 있으나 **laonshop 범위가 아니다.**

## 4. `.env.example` 대비 — 누락분 placeholder 추가 완료

코드가 참조하는 계약 후 변수 4종을 **빈/주석 placeholder**로 관리함(값 없음): `KSPAY_STORE_KEY`, `KSPAY_API_KEY`, `KSPAY_REST_LIVE`, `KSPAY_WEBFEP_BASE`. `KSPAY_REST_LIVE`는 API 키가 미리 설정돼도 실제 승인이 나가지 않도록 하는 명시적 이중 가드다. 실값은 절대 커밋하지 않는다.

## 5. 미완료 — 외부 계약·사람 확인·키 발급 필요

1. **통신판매업신고번호** — 신고 완료 후 번호 확정 → footer/정책 반영(현재 "신고 예정"). 카드사 심사의 **유일한 남은 외부 리스크**. [행정/사람]
2. **KSPAY 실 MID·상점키·결과 결박 규격** — KSNET 정식 계약 후 `reCommConId`/`reHash`를 주문에 사전 결박하는 공식 규격을 구현·검증하고 `KSPAY_STORE_ID`(+`KSPAY_STORE_KEY`)를 실값으로 교체한다. 현재 코드는 테스트 MID 외 서버승인을 차단한다. [외부 계약·PG 스펙·보안 검토]
3. **`KSPAY_API_KEY` + `KSPAY_REST_LIVE=1`(WEBFEP)** — 수기/구인증 **실연동**은 KSNET 사업부 별도 계약 + API키 발급 + 실 MID + 개인정보처리 고지를 확인한 후 이중 가드를 함께 활성화해야 한다. 현재 둘 다 미설정 → UI·서버 완전 비활성, mock 승인 없음. [외부 계약·키 발급·보안 검토]
4. **원클릭 빌링 계약·스펙** — 현재 카드 등록·원클릭 승인은 안전하게 비활성화했다. KSNET의 PG 호스팅 카드 등록 또는 동등한 카드 원문 비수집 방식, 빌링키 등록·승인·해지 API, 별도 운영 가드를 모두 확정한 뒤에만 재구현한다. [외부 계약·보안 검토]
5. **현금영수증 발급** — 계좌이체/가상계좌 오픈 시 의류 소매 의무발행 대상. KSNET 발급 API 이식 필요(라온페이에 실연동 존재). [향후]
6. **Neon 콜드스타트** — 무료 티어 오토서스펜드 웨이크업(수 초)으로 첫 요청 지연·간헐 500 발생 이력. `DATABASE_URL`/`DIRECT_URL`에 `connect_timeout`/`pool_timeout` 파라미터로 완화 적용됨. 완전 제거는 **Neon 유료 전환** 필요(비용 결정). [비용]

## 6. 재배포·재시작 규칙

- **Vercel env 변경은 즉시 반영되지 않는다** — 값 추가/수정 후 **재배포**해야 런타임에 적용(`npx vercel --prod --yes` 또는 main에 커밋 push로 자동배포). CLI 버전 지정 시 `vercel@latest`가 미발행 버전으로 풀려 ETARGET 날 수 있어 특정 버전 고정 권장.
- **로컬 `.env` 변경**은 `pnpm dev` 재시작 후 반영. Prisma 스키마 변경은 `pnpm prisma generate`(+필요 시 `db push`, 운영 DB는 사전 확인).
- **DB URL/스키마 변경**은 운영 Neon에 직접 영향 → 반드시 영향 확인 후 진행.

---

> 관련 문서: [AGENT_CONTEXT.md](AGENT_CONTEXT.md)(현재 상태·가드) · [AGENTS.md](AGENTS.md)=[CLAUDE.md](CLAUDE.md)(절대 규칙) · [.env.example](.env.example)(변수 템플릿).
