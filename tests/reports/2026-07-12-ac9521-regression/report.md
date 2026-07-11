# LAONSHOP `ac9521a` 관리자 완료 전환 회귀 QA 보고서

실행일: 2026-07-12

담당: Codex QA/테스트 세션

대상 저장소: `/Users/donghyuk/Projects/laonshop`

대상 브랜치/커밋: `main` / `ac9521a84bcb6bcc5d7bff70969b92eb851814ea`

비교 범위: `d8da743a10bcc23f492089d45d4eef3fa51a2dd4..ac9521a84bcb6bcc5d7bff70969b92eb851814ea`

최종 결과: **FAIL**

출시 판정: **NO-GO - 320px·글자 200%에서 관리자 확정 폼이 잘리는 P2 수정 필요**

## 1. 결론

- 이전 QA의 P1이었던 PAID/FAILED 성공 후 무한 pending은 수정됐습니다. 새 브라우저 컨텍스트에서 단일 제출 후 3초 이내 새 `/admin?paymentResolved=...` GET으로 이동하고, 성공 안내·대기열 제거·감사로그 1건을 UI와 DB에서 함께 확인했습니다.
- `crypto.randomUUID`가 없는 Android 로컬 HTTP에서 `getRandomValues` 기반 UUID v4 nonce가 생성됐습니다. 로그인과 로그아웃·nonce 회전 후 전역 오류가 없었습니다.
- 관리자 상단 명령과 PAID/FAILED 확정 버튼은 320/390/412px에서 모두 높이 48px로 측정됐습니다.
- 다만 320px에서 루트 글자를 200%로 확대하면 `<details>`와 내부 폼이 카드보다 넓어지고, 카드의 `overflow-hidden`에 의해 오른쪽 입력 영역과 버튼이 잘립니다. 문서 `scrollWidth`는 305px로 보고돼 단순 가로 overflow 검사로는 잡히지 않지만 실제 폼 우측 경계는 354px입니다.
- 제품 코드는 수정하지 않았습니다. QA 보고서와 스크린샷만 추가했습니다.

## 2. 환경과 배포

| 항목 | 검증값 |
| --- | --- |
| Git | `main`, HEAD/origin 모두 `ac9521a`, 시작 시 제품 트리 clean |
| Node / pnpm | Node `22.23.1`, pnpm `11.5.3` |
| Next / Prisma | Next `15.5.19`, Prisma `6.19.3` |
| 로컬 서버 | production build 후 `next start -p 3003` |
| DB | 제공된 Neon 테스터 브랜치, 실제 URL 미기록 |
| 데스크톱 브라우저 | Chromium, 320x568 / 390x844 / 412x915, 루트 글자 200% |
| 실제 모바일 | Android 16 emulator, Chrome `133.0.6943.137`, CSS viewport 412px |
| 운영 | `https://laonshop.com`, deployment `dpl_7tBUNYVjVYQxLWsHcpscR5huaW1L` |

Vercel API에서 배포 상태 `READY`, target `production`, Git SHA `ac9521a84bcb6bcc5d7bff70969b92eb851814ea`, `laonshop.com` alias를 확인했습니다. 운영 `/admin` 게스트는 실제 Chromium 390x844에서 `/login`으로 이동했고, 관리자 콘텐츠 노출·콘솔 오류·가로 overflow가 없었습니다.

## 3. 정적·빌드 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test` | PASS | 24/24, fail 0, skip 0 |
| `pnpm lint` | PASS | 오류 없음 |
| `pnpm typecheck` | PASS | TypeScript 오류 없음 |
| `pnpm prisma validate` | PASS | 스키마 유효, 설정 deprecation 안내만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |

## 4. 발견 결함

### QA-AC95-01 P2 - 320px·글자 200%에서 관리자 확정 폼 우측이 잘림

재현 경로:

1. 로컬 production `/admin`에 QA ADMIN으로 로그인합니다.
2. 처리 마커가 5분 이상 지난 주문을 표시합니다.
3. viewport를 320x568로 설정하고 루트 글자 크기를 200%로 확대합니다.
4. PAID 또는 FAILED `<details>`를 엽니다.

기대 결과:

- 입력 필드와 확정 버튼이 카드 폭 안에서 줄바꿈·축소되어 모두 보이고 조작 가능해야 합니다.
- 화면 확대 상태에서도 콘텐츠가 잘리거나 접근 불가능한 영역이 없어야 합니다.

실제 결과:

```text
viewport: innerWidth=320
document: scrollWidth=305
article: x=32, width=241, right=273
details: x=33, width=361, right=394
form/input/button: x=73, width=281, right=354
article overflow: hidden
```

- 문서 자체에는 가로 스크롤이 생기지 않지만, 내부 폼이 카드보다 넓고 `overflow-hidden`으로 잘립니다.
- PAID 폼 하나만 열어도 동일하게 재현되어 두 폼 동시 열기나 자동화 상태의 영향이 아닙니다.
- 320px 일반 글자 크기와 412px 200%에서는 재현되지 않았습니다. 390px 200%에서도 일부 경계가 viewport를 넘지만 320px에서 사용자 조작 방해가 명확합니다.

영향:

- 좁은 화면에서 큰 글자를 사용하는 관리자는 결제 확정 필드와 버튼의 우측을 확인하거나 조작하기 어렵습니다.
- 목표 회귀 항목인 320/390/412px·200% 확대 호환성을 충족하지 못합니다.

관련 위치와 원인 후보:

- `app/admin/page.tsx:143`의 주문 카드 `overflow-hidden`
- `app/admin/page.tsx:170-186`의 grid, `<details>` 및 rem 기반 좌우 padding
- 확대 시 details/form의 intrinsic width를 카드 폭 이하로 제한하는 `min-w-0`·`max-w-full` 계열 제약이 부족한 것으로 추정됩니다.

증거: [admin-320-font200-clipped.png](./admin-320-font200-clipped.png)

필요 회귀:

- `document.scrollWidth`만 보지 말고 article/details/form/input/button의 실제 `getBoundingClientRect().right <= viewport`를 각각 단정합니다.
- PAID/FAILED 폼을 하나씩 열어 320/390/412px·200%에서 모든 필드와 버튼이 보이고 키보드로 접근 가능한지 확인합니다.

## 5. 수정 항목 회귀 결과

### 성공 전환과 오류 복구

| 시나리오 | 결과 | 실제 단정 |
| --- | --- | --- |
| PAID 단일 정상 제출 | PASS | URL `/admin?paymentResolved=paid`, 성공 안내, queue 0, DB PAID, audit 1 |
| FAILED 단일 정상 제출 | PASS | 2.447초 내 URL/상태 완료, queue 0, DB FAILED, audit 1 |
| PAID 오류 수정 후 정상 재제출 | PASS | 2.918초 내 성공 GET, DB PAID, audit 1 |
| 성공 뒤 reload | PASS | POST 재전송 0, queue 0, audit 1, 성공 안내 유지 |
| 성공 뒤 back | PASS | 이전 처리 폼·POST 복원 없이 쇼핑몰 화면 이동 |
| 금액 불일치 | PASS | 이동 없음, inline 오류, `aria-busy=false`, 버튼 재활성, DB/audit 변화 0 |
| MOID 오입력 | PASS | 이동 없음, PENDING+marker 유지, audit 0 |
| 중복 pgTrno | PASS | 이동 없음, PENDING+marker 유지, audit 0 |

오류 응답 뒤 React action이 비제어 입력값을 초기화해 전체 값을 다시 입력해야 하는 현상은 관찰했지만, 수정 후 정상 재제출이 가능하고 결제 상태 손상은 없어 이번 출시 차단 결함으로 분류하지 않았습니다.

### 중복·동시 요청

| 시나리오 | 결과 | 실제 단정 |
| --- | --- | --- |
| 실제 브라우저 `dblclick()` | PASS | POST 1, 성공 이동 1, DB 상태/audit 정확히 1 |
| 같은 주문 두 탭 동시 제출 | PASS | 성공 1·이미 처리 오류 1, DB PAID/audit 정확히 1 |
| 같은 JS task에서 `.click()` 2회 | 관찰 | POST 2, DB/audit는 정확히 1이나 두 번째 오류 state가 성공 이동을 덮어 페이지에 남음 |

마지막 항목은 사람이 만드는 실제 `dblclick()`에서는 재현되지 않는 합성 스트레스입니다. 서버 멱등성은 유지됐지만, 동일 task의 프로그램 방식 중복 dispatch까지 UI 성공 전환을 보장하지는 않는 잔여 위험으로 기록합니다.

### RBAC·모바일 터치 타깃

| 시나리오 | 결과 | 실제 단정 |
| --- | --- | --- |
| guest `/admin` | PASS | `/login` 이동 |
| CUSTOMER `/admin` | PASS | semantic 404, 관리자 내용 없음 |
| 상단 관리자 명령 | PASS | 320/390/412px에서 높이 48px |
| PAID/FAILED 확정 버튼 | PASS | 320/390/412px에서 높이 48px |
| 일반 글자 크기 반응형 | PASS | 세 폭 모두 문서 overflow·overlay 0 |
| 글자 200% 반응형 | FAIL | 320px에서 QA-AC95-01 재현 |

기존 5분 자동 처리 보호, DB 역할 SSOT, advisory lock, 주문-감사로그 원자성은 변경 diff에 영향을 받지 않았고 기존 단위 테스트와 직전 회귀를 유지했습니다. 이번 타깃에서는 fresh marker의 장시간 실제 경계를 다시 기다리는 전체 테스트는 반복하지 않았습니다.

## 6. Android 로컬 HTTP

Android emulator Chrome에서 `http://10.0.2.2:3003`을 실제 검증했습니다.

```text
isSecureContext=false
typeof crypto.randomUUID=undefined
typeof crypto.getRandomValues=function
typeof crypto.subtle=undefined
nonce format=RFC4122 v4
viewport innerWidth=412, scrollWidth=412
```

- guest 진입 시 UUID v4 nonce가 생성되고 앱 오류·콘솔 오류가 없었습니다.
- ADMIN 로그인 후 카트 owner가 관리자 ID로 전환됐고 전역 오류가 없었습니다.
- 로그아웃 후 owner가 비워지고 nonce가 새 UUID v4로 회전했으며 로그인 헤더로 복귀했습니다.
- CUSTOMER 계정으로 이어지는 두 번째 전환은 Android CDP 입력 이벤트가 세션을 만들지 못해 미실행으로 남겼습니다. 동일 계정의 데스크톱 로그인과 DB 비밀번호는 정상임을 별도로 확인했습니다.
- 실제 checkout 제출은 이번 타깃에서 실행하지 않았습니다. 이 HTTP 환경에서는 `crypto.subtle`도 없으므로 `createCheckoutIdempotencyKey()` 경로는 별도 호환성 회귀가 필요합니다.

화면 증거: [android-http-nonce-fallback.png](./android-http-nonce-fallback.png)

## 7. 미실행·잔여 위험

- 실 KSNET/KSTA 조회, 실승인, 실취소, 실영수증은 실행하지 않았습니다.
- 운영 관리자 계정이 제공되지 않아 운영 `/admin` 로그인 이후 쓰기 흐름은 실행하지 않았습니다.
- Safari/WebKit 및 iOS 실제 기기는 미검증입니다.
- Android CUSTOMER 계정 전환과 로컬 HTTP checkout 제출은 미실행입니다.
- JS 차단 시 성공 action은 DB에 반영되지만 자동 `window.location.replace`가 동작하지 않아 수동 새로고침이 필요합니다.
- 동일 JS task의 프로그램 방식 2회 click은 DB 정확히 한 번을 지키지만 성공 화면 이동은 보장하지 않습니다.

## 8. cleanup

QA fixture 삭제 결과:

```text
users=3, orders=9, items=9, audits=5, products=1 삭제
qaRemaining: users=0, orders=0, products=0
```

최종 DB 기준선:

```text
users=10, activeUsers=9, orders=4, items=4,
products=329, audits=0, cards=4, wishlists=0
```

3003 서버와 Android CDP forward를 종료했고 두 포트에 listener가 없음을 확인했습니다. 운영·마스터 데이터, PG/Vercel 설정, 제품 코드는 변경하지 않았습니다.

## 9. 출시 권고

QA-8DC-01, QA-8DC-02, QA-8DC-03의 직접 수정 목표는 통과했습니다. 그러나 관리자 핵심 폼이 320px·글자 200%에서 잘려 조작성이 손상되므로 QA-AC95-01 수정과 세 폭의 실제 요소 경계 재검증 전까지 출시 승인을 보류합니다.
