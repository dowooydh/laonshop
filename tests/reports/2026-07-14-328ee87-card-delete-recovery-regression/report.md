# 328ee87 카드 삭제 실패 복구 회귀 QA 보고서

작성일: 2026-07-14

담당: Codex QA/테스트 세션

대상 제품 커밋: `328ee874f8c6b681ad386b561888ed6d6c69486d`

비교 범위: `8a51fc42fad6652b37140e03c5256117764cbc85..328ee874f8c6b681ad386b561888ed6d6c69486d`

결과: **PASS**

출시 판정: **GO - 카드 삭제 통신 실패·500 복구와 소유권 회귀 통과**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 테스트 전용 Neon 데이터에 일회용 고객 2명과 과거 mock 카드 4개만 생성했습니다.
- offline/abort와 HTTP 500은 로컬 production 브라우저에서 Server Action POST에 안전하게 주입했습니다.
- 운영 DB 쓰기, 실제 카드정보, KSPAY 승인·취소·영수증, Vercel 설정 변경은 실행하지 않았습니다.
- credential, DB URL, 세션 쿠키, 환경변수 실제 값은 출력하거나 문서화하지 않았습니다.

## 저장소·배포 기준

- 검증 시작 시 브랜치는 `main`, `HEAD=origin/main=328ee874f8c6b681ad386b561888ed6d6c69486d`, 작업 트리는 clean이었습니다.
- `AGENTS.md`와 `CLAUDE.md`는 바이트 단위로 동일했습니다.
- Vercel deployment `dpl_HyGAiDcfxdY7CibgD1SbKdPaVwNw`는 `READY`, target `production`, Git SHA `328ee87`이었습니다.
- `laonshop.com`, `www.laonshop.com` 별칭이 위 배포에 연결돼 있습니다.
- 최근 1시간 Vercel runtime error cluster는 0건이고 해당 배포의 error/fatal 로그도 0건입니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3에서 독립 실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 34/34, fail 0, skip 0 |
| 카드 비활성 focused test | PASS | 4/4 포함 |
| 이미지 파이프라인 단위 테스트 | PASS | 1/1 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 안내만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 독립 코드 검토

| 검토 항목 | 결과 | 근거 |
| --- | --- | --- |
| 실패 예외 처리 | PASS | `deleteBillingCardAction` 호출을 `try/catch/finally`로 감싸 네트워크·500 예외를 사용자 상태로 전환합니다. |
| 낙관적 제거 금지 | PASS | 로컬 cards state나 `cards.filter`가 없고 성공 후에만 `router.refresh()`를 호출합니다. |
| 실패 안내 | PASS | 고정 `role=alert`에 삭제 상태를 확인하지 못했다는 보수적 문구를 표시합니다. |
| 처리 상태 해제 | PASS | `finally`에서 `deletingId`를 해제하고 transition 종료 후 삭제 버튼이 다시 활성화됩니다. |
| 접근성 상태 | PASS | 처리 카드에만 `aria-busy=true`, 오류 후 버튼에 alert 설명 연결을 제공합니다. |
| 소유권 경계 | PASS | Server Action의 `deleteMany({ id: cardId, userId: user.id })`는 변경되지 않았습니다. |
| 결제 경계 | PASS | 원클릭 조기 차단, 일반 KSPAY, 주문·재고·관리자 코드는 변경되지 않았습니다. |

## 로컬 브라우저·DB 검증

### offline/abort

1. 일회용 고객으로 `/mypage/settings`에 로그인하고 기존 mock 카드 행을 확인했습니다.
2. 해당 카드의 Server Action POST를 네트워크 abort로 종료했습니다.
3. 마스킹 카드 행과 DB owner card count가 모두 유지됐습니다.
4. `#billing-card-delete-error[role=alert]`에 “카드 삭제 상태를 확인하지 못했습니다” 안내가 표시됐습니다.
5. `aria-busy=false`, 버튼 enabled로 복귀했습니다.
6. 네트워크 복구 후 같은 버튼을 재시도하자 alert가 제거되고 행과 DB 카드가 정확히 1건 삭제됐습니다.

결과: **PASS**

### HTTP 500

1. 다음 카드의 동일 POST를 HTTP 500으로 응답했습니다.
2. 카드 행과 DB count가 유지되고 동일한 보수적 alert가 표시됐습니다.
3. transition 종료 후 버튼이 재활성화됐습니다.
4. 정상 응답으로 재시도하자 alert가 사라지고 DB 카드가 정확히 1건 감소했습니다.

결과: **PASS**

### 빠른 이중 클릭

- 동일 DOM 버튼에 동기식 `click()`을 두 번 전달해 가장 빠른 사용자 입력 경계를 만들었습니다.
- Server Action POST는 2회 발생했지만 조건부 `deleteMany(id,userId)`가 멱등하게 동작해 DB 카드 삭제 부작용은 정확히 1건이었습니다.
- 최종 owner card count는 0, 오류 overlay와 비정상 상태는 없었습니다.

결과: **PASS - 요청 병합이 아니라 DB 부작용 멱등성으로 보장**

### 타인 카드 IDOR

- 로그인한 owner의 실제 Server Action 요청 형식을 보존하고 인자만 foreign card ID로 교체해 직접 제출했습니다.
- 응답은 200이었지만 foreign card는 DB에 그대로 남았습니다.
- owner의 잔여 카드는 0, foreign card는 1로 사용자 경계가 유지됐습니다.

결과: **PASS**

### 결제 경계 회귀

- 설정 화면의 카드 원문 입력 필드와 신규 등록 버튼은 0개였습니다.
- `getDisabledBillingResult("oneclick")`과 checkout/retry의 transaction 이전 차단 단위 테스트가 통과했습니다.
- 일반 카드·카카오페이·네이버페이·계좌이체와 KSPAY 코드에는 diff가 없습니다.
- 실 KSPAY 호출은 안전 범위에 따라 실행하지 않았습니다.

결과: **PASS**

## 모바일·접근성

각 폭에서 루트 글자 크기 200%로 만들고, 요청을 450ms 지연한 뒤 abort해 “삭제 중”과 alert를 실제 측정했습니다.

| 화면 | 문서 폭 | 삭제 중 버튼 | alert 폭·오른쪽 | 가시 요소 이탈 | 결과 |
| --- | --- | --- | --- | --- | --- |
| 320x568, 200% | `320=320` | 91.53x44px | 256px / 288px | 0 | PASS |
| 390x844, 200% | `390=390` | 91.53x44px | 326px / 358px | 0 | PASS |
| 412x915, 200% | `412=412` | 91.53x44px | 348px / 380px | 0 | PASS |

- 세 폭 모두 `scrollWidth=clientWidth`, alert·카드 행·버튼 viewport 이탈 0, 버튼 내부 clipping 0이었습니다.
- 처리 중 `aria-busy=true`, 실패 후 `aria-busy=false`와 enabled 상태를 확인했습니다.
- 삭제 중·삭제 버튼은 모두 높이 44px 이상입니다.
- 기능 검증의 재시도·이중 클릭·IDOR는 412x915 정상 글자 크기에서도 통과했습니다.
- 브라우저의 예상된 abort/500 네트워크 오류 이벤트 5건은 fault injection 증거로 분리했고, 예상 밖 console error/pageerror는 0건입니다.

## QA 도구 이슈 구분

- 첫 시도는 설정 페이지 reload 직후 카드 행 준비 전에 QA locator가 count를 단정해 중단됐습니다. DB 카드 4개가 모두 존재함을 직접 확인하고 카드 텍스트 wait를 추가했습니다.
- 두 번째 시도는 Next route announcer의 빈 `role=alert`를 제품 alert로 잘못 선택했습니다. 고정 ID `billing-card-delete-error`로 범위를 좁혀 재실행했습니다.
- 두 중단 모두 제품 상태·DB 변경 없이 종료됐으며, 최종 동일 시나리오는 전체 PASS했습니다.

## 결함과 잔여 위험

- 이번 범위에서 신규 제품 결함은 발견하지 못했습니다.
- 아주 빠른 이중 클릭에서 HTTP 요청 자체는 2회 발생합니다. 현재 삭제 쿼리가 조건부·멱등이어서 부작용은 한 번이지만, 향후 비멱등 action으로 변경할 경우 요청 단위 dedupe 검토가 필요합니다.
- 응답 유실 시 클라이언트는 성공·실패를 단정하지 않고 보수적 안내를 표시합니다. 사용자는 재시도 또는 새로고침으로 서버 상태를 확인해야 합니다.
- Safari/WebKit/iOS 실제 기기와 실 KSNET 승인·취소·영수증은 실행하지 않았습니다.

## cleanup

- 삭제: 일회용 QA 사용자 2명과 cascade된 QA 카드 잔여 1건. 성공·재시도로 삭제된 owner 카드 3건도 최종 부재를 확인했습니다.
- 최종 DB: users 10, cards 4, orders 9, items 9, audits 0, wishlists 0.
- 시작 기준선과 최종 수치가 정확히 일치했습니다.
- 로컬 production 서버 3003을 종료하고 임시 fixture·브라우저 스크립트와 credential 파일을 삭제했습니다.
- 운영·마스터 데이터, Vercel 설정, PG 상태는 변경하지 않았습니다.

## 최종 판정

offline/abort와 HTTP 500에서 카드 행·DB가 보존되고 명시적 alert와 즉시 재시도가 제공됩니다. 복구 후 성공은 정확히 한 건만 삭제하며, 빠른 이중 클릭과 타인 ID 직접 제출에서도 DB 부작용·소유권 경계가 안전했습니다. 320/390/412px 200% 확대에서도 alert와 처리 버튼은 잘리지 않았습니다.

정적 검증, 실제 UI/API/DB fault injection, 모바일 접근성, 배포 상태, cleanup이 모두 일치하므로 제품 커밋 `328ee87`을 **PASS / GO**로 판정합니다.
