# LAONSHOP `970b098` 관리자 200% reflow 최종 QA 보고서

실행일: 2026-07-12

담당: Codex QA/테스트 세션

대상 저장소: `/Users/donghyuk/Projects/laonshop`

대상 브랜치/커밋: `main` / `970b098c5d8f2b88247474119b85962459c2876f`

비교 범위: `15db7fb21e1e38cf0bc4d4daf1109bc21e000468..970b098c5d8f2b88247474119b85962459c2876f`

최종 결과: **PASS**

출시 판정: **GO - 검증 범위에서 QA-AC95-01 수정 및 핵심 회귀 통과**

## 1. 결론

- QA-AC95-01 원 재현인 320px·루트 글자 200%에서 PAID/FAILED 폼의 article, details, form, input, textarea, checkbox label, submit 경계를 실제 좌표로 다시 측정했습니다.
- 이전 `details right=394`, `form right=354`가 각각 `272`, `232`로 줄었고 article right `273` 안에 완전히 들어왔습니다.
- 320/390/412px·200%와 일반 글자 세 폭, 1280px 2열에서 가로 잘림·문서 overflow·버튼 내부 텍스트 잘림이 없었습니다.
- Enter/Space로 summary를 열고 닫았으며 PAID/FAILED 정방향·역방향 Tab 순서와 focus-visible ring의 카드 내 여백을 확인했습니다.
- PAID/FAILED 성공 이동, 오류 후 재제출, 실제 더블클릭, 두 탭 동시 제출은 UI·네트워크·DB 결과를 함께 확인했습니다.
- 제품 코드는 수정하지 않았습니다. QA 보고서와 스크린샷만 추가했습니다.

## 2. 환경과 배포

| 항목 | 검증값 |
| --- | --- |
| Git | `main`, 시작 시 HEAD/origin `970b098`, 제품 트리 clean |
| Node / pnpm | Node `22.23.1`, pnpm `11.5.3` |
| Next / Prisma | Next `15.5.19`, Prisma `6.19.3` |
| 로컬 서버 | production build 후 `next start -p 3003` |
| DB | 제공된 Neon 테스터 브랜치, 실제 URL 미기록 |
| 브라우저 | Chrome `149.0.7827.201`, 320x568 / 390x844 / 412x915 / 1280x900 |
| 운영 | `https://laonshop.com`, deployment `dpl_EnYVJjajT4iTgMsbhYKivp7hKgZM` |

Vercel API에서 deployment `READY`, target `production`, Git SHA `970b098c5d8f2b88247474119b85962459c2876f`, `laonshop.com`과 `www.laonshop.com` alias를 확인했습니다. 운영 390px Chromium의 guest `/admin`은 `/login`으로 이동했고 관리자 콘텐츠·콘솔 오류·가로 overflow가 없었습니다. 최근 1시간 Vercel runtime error cluster는 0건입니다.

## 3. 정적·빌드 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm test` | PASS | 24/24, fail 0, skip 0 |
| `pnpm lint` | PASS | 오류 없음 |
| `pnpm typecheck` | PASS | TypeScript 오류 없음 |
| `pnpm prisma validate` | PASS | 스키마 유효, Prisma 설정 deprecation 안내만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |

## 4. QA-AC95-01 원 재현

### 320px·200% 실제 경계

| 요소 | 이전 실패 | 현재 PAID | 현재 FAILED | 판정 |
| --- | --- | --- | --- | --- |
| article | right 273 | left 32 / right 273 / width 241 | 동일 | 기준 |
| details | right 394 | left 33 / right 272 / width 239 | 동일 | PASS |
| form | right 354 | left 73 / right 232 / width 159 | 동일 | PASS |
| inputs/textarea/submit | 우측 잘림 | left 73 / right 232 | left 73 / right 232 | PASS |
| document | 단순 scrollWidth 검사만 통과 | scrollWidth 305 = clientWidth 305 | 동일 | PASS |

- details와 form의 `scrollWidth <= clientWidth`, 모든 컨트롤의 `right <= article right`, `right <= viewport`를 각각 단정했습니다.
- submit은 200%에서 폭 159px, 높이 136px이며 `scrollWidth=clientWidth`, `scrollHeight=clientHeight`로 줄바꿈된 문구가 잘리지 않았습니다.
- checkbox label과 summary는 44px 이상이었고, focus-visible ring이 표시될 때 submit 좌우에 article 기준 41px 여백이 남았습니다.
- 긴 MOID, 2,147,483,000원 금액, 긴 상품명과 안내 문구도 카드 안에서 줄바꿈됐습니다.

증거:

- [admin-320-font200-paid-fixed.png](./admin-320-font200-paid-fixed.png)
- [admin-320-font200-failed-fixed.png](./admin-320-font200-failed-fixed.png)

### 다른 폭과 데스크톱

| 폭·글자 | PAID | FAILED | 버튼 | 판정 |
| --- | --- | --- | --- | --- |
| 320px·200% | details/form/controls 카드 내부 | 카드 내부 | 136px, 내부 비클리핑 | PASS |
| 390px·200% | details right 342 / form right 302 | 동일 | 136px, 내부 비클리핑 | PASS |
| 412px·200% | details right 364 / form right 324 | 동일 | 96px, 내부 비클리핑 | PASS |
| 320/390/412px·100% | 문서·모든 컨트롤 카드 내부 | 카드 내부 | 48px | PASS |
| 1280px·100% | 551px + 551px | 같은 top의 2열 | 문서 overflow 0 | PASS |

### 키보드

```text
PAID Tab:
confirmedAmount -> approvalNo -> pgTrno -> cardName -> reason -> confirmed -> submit

PAID Shift+Tab:
submit -> confirmed -> reason -> cardName -> pgTrno -> approvalNo -> confirmedAmount

FAILED Tab:
confirmedMoid -> reason -> confirmed -> submit

FAILED Shift+Tab:
submit -> confirmed -> reason -> confirmedMoid
```

PAID summary는 Enter, FAILED summary는 Space로 각각 열고 닫았습니다. submit은 두 폼 모두 `:focus-visible=true`와 cyan 2px ring을 확인했고 카드의 `overflow-hidden` 경계에 닿지 않았습니다.

## 5. 상태 전이·멱등성 회귀

| 시나리오 | UI·네트워크 | DB | 결과 |
| --- | --- | --- | --- |
| PAID 단일 제출 | 1.806초, POST 1, `/admin?paymentResolved=paid`, queue 0, busy 0 | PAID, 승인정보, audit 1 | PASS |
| FAILED 단일 제출 | 1.188초, POST 1, `/admin?paymentResolved=failed`, queue 0, busy 0 | FAILED, 결제필드 해제, audit 1 | PASS |
| 금액 오류 | `/admin` 유지, inline 오류, busy false, 버튼 활성 | PENDING+marker, audit 0 | PASS |
| 오류 수정 후 재제출 | 1.074초, 성공 URL·banner·queue 0 | PAID, audit 1 | PASS |
| 실제 `dblclick()` | 1.195초, POST 1, 성공 URL | PAID, audit 1 | PASS |
| 같은 주문 두 탭 | POST 2, 한 탭 `/admin`, 한 탭 성공 URL | PAID 1건, audit 1건 | PASS |
| 성공 뒤 reload/back | reload POST 0, back POST 0, 처리 폼 복원 없음 | 추가 audit 0 | PASS |

PAID 최초 시도에서 Playwright MCP transport가 action 완료 뒤 종료됐지만 DB는 PAID/audit 1로 정상 커밋됐습니다. 동일 fixture를 초기화하고 독립 Playwright 프로세스로 다시 실행해 1.806초 성공 전환을 확인했습니다.

두 탭의 초기 두 시도는 DB 확정 뒤 DOM 상세 수집이 30초 도구 제한에 걸렸습니다. 제품 실패로 처리하지 않고 fixture를 초기화해 이벤트 예약 방식으로 한 번 더 실행했으며, POST 2·성공 URL 1·대기 URL 1과 DB PAID/audit 1을 확인했습니다. 추가 장시간 UI 재시도는 DEV 지침에 따라 중단했습니다.

## 6. 미실행·잔여 위험

- 실 KSNET/KSTA 조회, 실승인, 실취소, 실영수증은 실행하지 않았습니다.
- 운영 관리자 계정이 제공되지 않아 운영 `/admin` 로그인 이후 쓰기는 실행하지 않았습니다.
- Safari/WebKit 및 iOS 실제 기기는 미검증입니다.
- 이번 변경은 admin reflow 세 컴포넌트만 수정해 Android 로컬 HTTP checkout은 재실행하지 않았습니다.
- JS 차단 시 성공 후 `window.location.replace`가 동작하지 않아 수동 새로고침이 필요할 수 있는 기존 위험은 유지됩니다.

## 7. cleanup

QA fixture 삭제 결과:

```text
users=2, orders=6, items=6, audits=5, products=1 삭제
qaRemaining: users=0, orders=0, products=0
```

최종 DB 기준선:

```text
users=10, activeUsers=9, orders=4, items=4,
products=329, audits=0, cards=4, wishlists=0
```

3003 서버와 headless Chrome 프로세스를 종료했고 listener·잔여 QA 프로세스가 없음을 확인했습니다. 운영·마스터 데이터, PG/Vercel 설정, 제품 코드는 변경하지 않았습니다.

## 8. 출시 권고

QA-AC95-01은 원 재현과 관련 회귀에서 수정 확인됐습니다. 테스트한 Chromium·로컬 production·운영 guest 범위에서는 `970b098` 출시가 가능합니다. 실 PG와 Safari/iOS는 위 잔여 위험으로 별도 관리합니다.
