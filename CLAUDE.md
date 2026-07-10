# LAON SHOP (laonshop.com)

> Codex와 Claude Code가 함께 사용하는 지침입니다. `AGENTS.md`와 `CLAUDE.md`는 항상 바이트 단위로 동일하게 유지합니다.

㈜커스텀오더 의류 쇼핑몰 — 라온페이(셀러 전용 결제 서비스)의 **KSNET 카드결제 카드사 심사용**이자 실제 판매 가능한 독립 쇼핑몰.

현재 운영 상태·카드사 심사 대기 항목·결제 테스트 정책은 **`AGENT_CONTEXT.md`**를 먼저 확인한다. 이 파일은 상태 요약이며, 현재 코드와 충돌하면 코드를 우선한다.

## 배경 / 목적 (SSOT)

- 일반 결제앱만으로는 카드사 심사가 통과되지 않는다. 그래서 **회원가입·상품·결제수단·결제창을 갖춘 실제 쇼핑몰**을 만들어, 각 결제수단의 "결제경로 캡처 + 사업자/통신판매 서류"를 카드사에 제출해 심사받는다.
- 실제 결제 로직은 라온페이 앱에서 이뤄지지만, 이 사이트는 **심사용 + 실제 의류 판매**가 가능한 독립 서비스다.
- 라온페이 모노레포 `apps/shop`의 프로토타입 **RYU SHOP**을 이관해 시작했다.
- 도메인: **laonshop.com** (구매 완료)
- 사업자: **㈜커스텀오더** (라온페이와 동일 사업자등록증 사용). 통신판매업신고번호는 신고 완료 후 footer/심사서류에 기입.

## 절대 규칙 (라온페이 계승)

1. **금액은 정수(원)**, 모든 돈 계산은 서버에서.
2. **카드정보 비저장** — KSPAY 결제창 방식(카드정보는 PG사가 직접 받음). 로그 마스킹.
3. **미확보·미계약 PG 기능은 `NEEDS_PG_SPEC` 주석 + 안전한 비활성 또는 mock** — UI가 있어도 운영 계약·키 없이 실연동으로 간주하지 않는다.
4. **결제수단**: 카드·카카오페이·네이버페이·실시간계좌이체는 KSPAY 수단별 결제창을 사용한다. 원클릭(빌링)·수기(구인증)는 구현돼 있지만 사업부 계약, `KSPAY_API_KEY`, `KSPAY_REST_LIVE=1` 전에는 운영 호출하지 않는다. 가상계좌는 KSNET 미지원 정책으로 제외한다.
5. **카드사 심사 필수 요소**: footer 사업자정보(상호·사업자등록번호·통신판매업신고번호·대표·주소·연락처) + 이용약관·개인정보처리방침·청약철회/교환/환불 정책 페이지.

## 스택 / 구조

- Next.js 15 App Router + TypeScript + Tailwind
- Prisma + PostgreSQL (Neon)
- 배포: Vercel
- 결제: KSNET KSPAY 인증결제창. 테스트 MID `2999199999` (상점키 불필요, 테스트 거래는 승인 후 몇 분 뒤 자동취소). 실 MID/키는 정식 계약 후 교체.
  - ⚠️ KSPAY 결제창(`kspay_web_ssl.js`)은 **jQuery($) 의존** → jQuery 먼저 로드한 뒤 `_pay()` 호출.
  - 흐름: 주문 생성 → `createAuthOrder`(KSPayWeb 폼) → 결제창 → `/api/pg/kspay/callback`(rcv 브릿지) → `/api/pg/kspay/result`(recv_post.jsp 서버승인 `sndActionType=1`) → 주문 확정.

## 작업 워크플로우

### 자동 커밋·푸시 (사용자 확인 없이 수행)

코드 변경이 끝나면 즉시: ① `git status`/`git diff` 분석 → ② [`.claude/rules/commit.md`](.claude/rules/commit.md) 규칙으로 한국어 Conventional Commits 메시지 작성(본문에 비개발자용 요약 권장) → ③ `git add` → `commit` → `push`.
**푸시 전 반드시 빌드 검증**: `pnpm build`(또는 `next build`)로 타입·빌드 통과 확인. 실패 시 푸시 금지.

### ⚠️ 예외 — 사용자 확인 필수

`git push --force`, `git reset --hard`, 브랜치 삭제, secrets(`.env`·PG 상점키·세션 시크릿) 포함 커밋 등 되돌리기 어려운 작업.

## 명령어

```bash
pnpm dev            # 개발 서버
pnpm build          # 빌드 (푸시 전 검증)
pnpm prisma db push # 스키마 반영
pnpm prisma generate
```

## 금지

secrets(`.env`·PG 키·세션 시크릿)·카드정보·대용량 원본을 커밋에 포함하지 않는다. (`.gitignore` 확인)

---

> 규칙을 바꾸면 `AGENTS.md`와 `CLAUDE.md`를 **같은 커밋에서 동일하게** 갱신한다.
> 폴더 구조·DB 모델·API는 **코드를 직접 읽어 확인**한다 (이 문서에 박제하면 금세 낡는다).
