# LAONSHOP `8dc613b` 관리자 결제 확인 센터 QA 보고서

실행일: 2026-07-11

담당: Codex QA/테스트 세션

대상 저장소: `/Users/donghyuk/Projects/laonshop`

대상 브랜치/커밋: `main` / `8dc613b1df8607fe27a891e48426726654074439`

비교 범위: `d70ccf1a14b734c5d4681682926b7fbec5bc7588..8dc613b1df8607fe27a891e48426726654074439`

최종 결과: **FAIL**

출시 판정: **NO-GO - 관리자 확정 성공 후 UI가 완료되지 않는 P1 수정 필요**

## 1. 결론

- DB 역할 기반 RBAC, 5분 보호 구간, PAID/FAILED 검증, advisory lock 직렬화, 주문-감사로그 원자성은 실제 브라우저와 테스터 DB에서 통과했습니다.
- 신규 핵심 흐름에서 결제 확정은 DB에 정상 커밋되지만 관리자 화면이 무한 pending 상태로 남는 P1을 발견했습니다.
- Android 16/Chrome 133에서 로컬 HTTP 호스트 `10.0.2.2` 접속 시 `crypto.randomUUID` secure-context 의존으로 오류 화면이 발생하는 P2를 발견했습니다. 운영 HTTPS에서는 재현되지 않았습니다.
- 관리자 주요 확정 버튼과 상단 명령 링크가 모바일에서 높이 40px로 측정되어 44px 터치 타깃 기준에 못 미치는 P2를 발견했습니다.
- 제품 코드는 수정하지 않았습니다. QA 보고서와 스크린샷만 추가했습니다.

## 2. 환경과 배포

| 항목 | 검증값 |
| --- | --- |
| Git | `main`, HEAD/origin 모두 `8dc613b`, 시작 시 clean |
| Node / pnpm | Node `22.23.1`, pnpm `11.5.3` |
| Next / Prisma | Next `15.5.19`, Prisma `6.19.3` |
| 로컬 서버 | production build 후 `next start -p 3003` |
| DB | 제공된 Neon 테스터 브랜치, 실제 URL 미기록 |
| 데스크톱 브라우저 | Chromium, 320x568 / 390x844 / 412x915, 200% 글자 확대 |
| 실제 모바일 | Android 16 emulator, Chrome `133.0.6943.137`, CSS viewport 412px |
| 운영 | `https://laonshop.com`, deployment `dpl_AN7VFmpY9JgmJkvXc4HPMwhukgdr` |

Vercel API에서 배포 상태 `READY`, production target, Git SHA `8dc613b1df8607fe27a891e48426726654074439`, `laonshop.com` alias를 확인했습니다. 운영 `/admin` 게스트는 `/login`으로 이동했고 콘솔 오류·가로 overflow가 없었습니다. 고정 deployment URL은 Vercel SSO 보호 상태라 메타데이터로만 커밋 일치를 확인했습니다.

## 3. 정적·빌드 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test` | PASS | 21/21, fail 0, skip 0 |
| `pnpm lint` | PASS | 오류 없음 |
| `pnpm typecheck` | PASS | TypeScript 오류 없음 |
| `pnpm prisma validate` | PASS | 스키마 유효 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | static generation 19/19 |

DB에는 `ShopUser.role`, `ShopOrderAuditLog`, `ShopOrder.pgTrno` unique index, `(status, approvalNo, updatedAt)` index가 실제 적용돼 있었습니다.

## 4. 발견 결함

### QA-8DC-01 P1 - 결제 확정은 커밋되지만 관리자 UI가 무한 pending으로 남음

재현 경로:

1. 로컬 production `/admin`에 QA ADMIN으로 로그인합니다.
2. 처리 마커가 5분 이상 지난 주문에서 PAID 또는 FAILED 정상값을 입력합니다.
3. 확정 버튼을 한 번 누르고 응답과 DB를 확인합니다.

기대 결과:

- 성공 메시지가 표시되고 버튼 pending이 끝납니다.
- 확정된 주문이 대기 목록에서 사라지고 감사 이력에 나타납니다.

실제 결과:

- POST는 HTTP 200이고 DB는 PAID/FAILED, 감사로그 1건으로 정확히 커밋됩니다.
- 새 브라우저 컨텍스트의 단일 정상 제출에서도 5초 이상 `aria-busy=true`, 비활성 버튼과 spinner, 기존 주문이 그대로 남았습니다.
- 새로고침하면 주문은 목록에서 사라지고 감사 이력은 정상 표시됩니다.
- PAID와 FAILED 양쪽에서 재현됐고 콘솔 오류는 없었습니다.

영향:

- 운영자는 확정 실패로 오인하거나 화면을 계속 기다리게 됩니다. 서버 멱등성은 중복 상태 변경을 막지만 신규 관리자 핵심 흐름은 정상 완료 피드백을 제공하지 못합니다.

관련 위치와 원인 후보:

- `app/admin/payment-paid-form.tsx:10`, `app/admin/payment-failed-form.tsx:16`의 `useActionState`
- `app/admin/actions.ts:108`의 성공 후 `revalidatePath("/admin")`
- DB 커밋과 action 응답은 정상이라, 성공 action의 RSC 재검증 결과가 클라이언트 transition을 완료하지 못하는 경계를 우선 확인해야 합니다.

증거: [admin-success-stuck-390.png](./admin-success-stuck-390.png)

필요 회귀:

- PAID/FAILED 단일 제출 후 3초 이내 pending 종료, 성공 메시지, 목록 제거, 감사 이력 노출을 한 테스트에서 단정합니다.
- 빠른 더블클릭과 성공 응답 재수신에서도 버튼이 영구 비활성화되지 않는지 확인합니다.

### QA-8DC-02 P2 - Android 로컬 HTTP에서 `crypto.randomUUID` 부재로 오류 화면

재현 경로:

1. Android emulator Chrome에서 `http://10.0.2.2:3003`에 접속합니다.
2. 로그인 또는 계정 전환으로 카트 소유권이 바뀌게 합니다.
3. 클라이언트 화면과 CDP console을 확인합니다.

실제 결과:

```text
TypeError: globalThis.crypto.randomUUID is not a function
```

`10.0.2.2` HTTP는 secure context가 아니어서 `crypto.randomUUID`가 제공되지 않습니다. `CartAuthSync`가 `clearCart()`를 호출하면 nonce 회전에서 예외가 발생하고 전역 ERROR 화면으로 전환됩니다.

관련 위치:

- `lib/checkout-idempotency.ts:48`
- `lib/cart.ts:51`
- `components/cart-auth-sync.tsx:21`

운영 `https://laonshop.com`은 `isSecureContext=true`, `typeof crypto.randomUUID === "function"`으로 이 결함이 재현되지 않았습니다. 영향은 Android emulator·LAN IP 등 로컬 HTTP 모바일 검증과 비보안 개발 호스트입니다.

증거: [android-http-randomuuid-error.png](./android-http-randomuuid-error.png), [android-chrome-admin-guest-412.png](./android-chrome-admin-guest-412.png)

필요 회귀:

- `crypto.randomUUID`가 없는 브라우저에서 nonce fallback이 동작하는 단위 테스트
- Android `10.0.2.2` HTTP에서 로그인·로그아웃·계정 전환 후 오류 화면이 없는 E2E

### QA-8DC-03 P2 - 관리자 주요 명령의 모바일 터치 타깃 높이 40px

320/390/412px에서 결제완료·결제실패 확정 버튼과 `계정 설정`·`쇼핑몰 보기` 링크 높이가 40px로 측정됐습니다. 가로 overflow나 텍스트 겹침은 없었지만 운영자 주요 명령의 44px 터치 기준을 충족하지 못합니다.

관련 위치:

- `lib/ui/button.tsx:22`의 기본 `md: h-10`
- `app/admin/payment-paid-form.tsx:74`
- `app/admin/payment-failed-form.tsx:63`

필요 회귀: 320/390/412px에서 관리자 주요 명령의 실제 bounding box 높이 44px 이상을 단정합니다.

## 5. 통과한 실제 검증

### RBAC와 세션

| 시나리오 | 결과 | 실제 단정 |
| --- | --- | --- |
| guest `/admin` | PASS | `/login` 이동 |
| CUSTOMER `/admin` | PASS | 404 화면, 관리자 내용 없음 |
| CUSTOMER의 Server Action 직접 POST | PASS | HTTP 404, 주문/감사로그 변화 없음 |
| ADMIN DB role 강등 | PASS | 기존 세션에서 즉시 404 |
| ADMIN `deletedAt` 변경 | PASS | 기존 세션에서 즉시 `/login` |
| 액션 도중 role 강등 | PASS | order lock 7.4초 경합 뒤 권한 오류, PENDING+marker/audit 0 |
| 관리자 탈퇴 직접 Action | PASS | 서버에서 관리자 탈퇴 차단 |

### 결제 정책·원자성·동시성

| 시나리오 | 결과 | 실제 단정 |
| --- | --- | --- |
| 5분 보호 UI/서버 | PASS | fresh는 자동 처리 중, 5분 초과는 대기; stale form도 서버 거부 |
| PAID 입력 검증 | PASS | 금액 불일치, marker 승인번호, 빈 pgTrno, 미체크 거부 |
| 중복 pgTrno | PASS | 친화 오류, 주문 PENDING+marker, audit 0 |
| FAILED 입력 검증 | PASS | MOID 오입력, 짧은 메모, 미체크 거부 |
| 정상 FAILED | PASS | FAILED, 결제필드 null, audit 1, 예약량 정확히 1 감소 |
| 정상 PAID | PASS | PAID, 승인번호/pgTrno/카드사, audit 1 |
| PAID/FAILED 동시 제출 | PASS | 성공 1, 오류 1, 최종 audit 1 |
| PG callback 경합 모사 | PASS | 같은 advisory lock을 5.9초 대기, PG PAID 유지, 관리자 audit 0 |
| 감사로그 insert 실패 | PASS | actor FK 실패 주입 후 주문 전체 롤백, PENDING+marker/audit 0 |
| XSS·긴 무공백 메모 | PASS | 텍스트로 표시, script/img 실행 0, overflow 0 |

정상 FAILED 주문의 구매자 화면에는 재결제 UI가 나타났고, processing marker 주문에는 `결제 결과를 확인하고 있습니다`만 표시되어 재승인이 차단됐습니다.

### 계정·반응형

- 대소문자·공백 변형 이메일 회원가입은 소문자로 저장되고 `CUSTOMER` 역할이 부여됐습니다.
- 관리자 새 비밀번호 11자는 거부, 12자는 성공했고 bcrypt cost 12를 확인했습니다.
- 320/390/412px 및 200% 글자 확대에서 관리자 긴 이메일·상품명·500자 메모의 가로 overflow와 error overlay는 없었습니다.
- `<details>`는 Enter와 Space로 열기/닫기가 가능했습니다.
- Android guest `/admin`은 로그인 화면으로 이동했고 CSS viewport 412, `scrollWidth=innerWidth=412`였습니다. 로그인 이후는 QA-8DC-02로 중단했습니다.

## 6. 미실행·잔여 위험

- 실 KSNET/KSTA 조회, 실승인, 실취소, 실영수증은 실행하지 않았습니다.
- 운영 관리자 계정이 제공되지 않아 운영 `/admin`의 로그인 이후 쓰기 흐름은 실행하지 않았습니다.
- Safari/WebKit 및 iOS 실제 기기는 미검증입니다.
- 실제 PG HTTP callback과 관리자 action의 경합은 외부 승인 없이 동일 advisory lock과 DB 상태 전환으로 안전하게 모사했습니다.
- Android 관리자 화면의 실제 입력·확정은 QA-8DC-02 오류 때문에 미실행했습니다.

## 7. cleanup

QA fixture 삭제 결과:

```text
users=4, orders=9, items=9, audits=4, products=1 삭제
qaRemaining: users=0, orders=0, products=0
```

최종 DB 기준선:

```text
users=9, activeUsers=8, orders=4, items=4,
products=329, audits=0, cards=4, wishlists=0
```

3003 서버와 Android CDP forward를 종료했습니다. 운영·마스터 데이터, PG/Vercel 설정, 제품 코드는 변경하지 않았습니다.

## 8. 출시 권고

QA-8DC-01을 수정하고 PAID/FAILED 양쪽의 UI 완료 상태를 재검증하기 전에는 관리자 결제 확인 센터를 출시 승인하지 않습니다. QA-8DC-02와 QA-8DC-03도 모바일 회귀에 포함해야 합니다.
