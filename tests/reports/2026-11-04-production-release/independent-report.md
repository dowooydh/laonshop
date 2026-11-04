# 운영 공개 후속 독립 QA

검증일: 2026-11-04

- 제품 SHA: `d62fc447d762cce04132288e83a5a8d4dde3c7e3`
- 비교: `83ac36c9cd56e716a95b262a57b9dd58163a68f5..d62fc447d762cce04132288e83a5a8d4dde3c7e3`
- 브랜치: `codex/shop-upgrade-20261104`
- 판정: **독립 코드·격리 실행 검증 GO**. WebKit RSC 자동화 경고는 아래 WARN으로 보존합니다.
- 독립 QA는 제품 파일·운영 DB·운영 환경·PG를 변경하지 않았습니다. 운영 스키마 적용과 실제 배포는 root 담당의 별도 실행 범위입니다.

## 사용자 동작과 수용 조건

신규 준비상품32종을 production에서도 사진·상세와 함께 소개합니다. AI 이미지·예상 가격·판매 준비 중을 표시하고 실판매329종의 후기·재고·주문과 분리합니다. 전체361종 중 남성은 전체171/판매155/준비16, 여성은 전체190/판매174/준비16입니다. 구매 가능 상품만 필터는 준비상품을 제외합니다. 준비상품 상세에는 장바구니·바로 구매·결제 CTA가 없으며, ID를 직접 조작해도 주문을 만들 수 없어야 합니다.

실판매 상품의 구매 안내 정렬·참고 사이즈표를 유지합니다. 상품별30개 이상·글10% 이상의 예시 평가는 preview 전용이고 실제 구매후기 집계와 분리합니다. production에서는 실제 구매후기만 표시합니다. 합성 후기를 실제 고객 원장에 추가하거나 준비상품 판매를 활성화하는 작업은 아닙니다.

## 검증 결과

아래는 서비스 검사·HTTP 시나리오·화면 조합·사진 표본으로 단위가 다르며 하나의 PASS 수로 더하지 않습니다.

| 검증 축 | 결과와 증거 |
|---|---|
| DEV | 보고받은186/186 skip0, 이미지 게이트 PASS, lint warning0·typecheck PASS, 최종 production build static19/19 PASS. 기존 Prisma 설정 deprecation 유지. [DEV 기록](dev-validation.json) |
| 독립 DB·서비스 | 37/37 PASS. 본인 배송완료 후기, 동시중복, 관리자 권한/강등, 취소/시연 주문 차단, 송장 정정·완료 멱등성, CHECK·불변 trigger, readiness 부재 차단, 결제 상태·금액 불변. [결과](database-results.json) |
| 실제 HTTP | 공개36조합 + 인증/권한/후기·배송 액션10 = 46범위 PASS. 동일 제품 SHA에서 slice를 나누어 실행. [공개36](browser-public-results.json), [인증10](browser-auth-results.json) |
| Chromium | production228 + preview60 = 288조합 PASS. 넘침·필드 잘림·페이지 오류·이미지 HTTP 실패·운영 예시 노출0. [화면 결과](independent-chromium-display-results.json) |
| 준비상품 상세 | 32종 ×production/preview = 64개 상세에서 이미지 실제 로드, AI·준비중 안내, 참고 사이즈, 구매 CTA 부재. [같은 화면 결과](independent-chromium-display-results.json) |
| 원본 이미지 | 32개 로컬 HTTP200, WebP1200×1500, manifest SHA 일치, 고유 SHA32개. [화면 결과의 원본 검사](independent-chromium-display-results.json) |
| 위조 주문 | prepared ID·catalog-draft ID2건을 합성 구매자 localStorage에 삽입 후 실제 주문 Server Action POST. 각각 HTTP200 오류 결과·판매 종료 안내·주문 증분0. [음성 경로](independent-chromium-negative-results.json) |
| WebKit 신규 페이지 | 목록/대표상세 ×390/1280px ×100/200% = 8조합 PASS. 별도 남녀 대표 상세 이미지2개 로드. 최종 targeted 오류·넘침·이미지 실패0. [결과](independent-webkit-results.json) |
| 독립 QA 정적 검사 | 변경 QA runner3개의 ESLint warning0, git diff --check PASS |

Chromium은320/390/1280px ×100/200%를 검사했습니다. production은 준비상품32종 전체 상세와 홈·남성·여성·검색·준비목록·실판매 상세의38개 route/state, preview는 대표 준비상품4종을 포함한10개 route/state입니다. 200%는 root font-size32px로 재현했습니다. 상세64회와 원본 사진32회는 서로 다른 증거이며 사진96종이 있다는 뜻이 아닙니다.

HTTP 액션은 POST 응답 완료·주문별 고유 본문 표시·DB단일 행·작성 완료 옵션 제거를 함께 대조했습니다. 다른 구매자/비로그인 재전송 거절, HTML 문자열 실행 차단, 송장 정정·완료 이력, 주문 내역 소유권/인쇄, 보호 trigger 부재 시 쓰기 차단도 포함합니다.

## 격리와 원장 경계

일회용 `127.0.0.1:52968/laonshop_qa`에 현재 schema와 additive SQL·post-verify, 상품329종 시드와 합성 사용자·주문·배송을 준비했습니다. 독립 QA는 운영 연결 문자열·비밀·환경파일 원문을 읽거나 저장하지 않았습니다.

액션 재검증과 QA 대기 보완 반복 후 격리 원장은 상품329/합성주문15/합성후기6/합성배송14/합성이력18입니다. 운영 행 수가 아니며 cleanup에서 cluster 전체를 제거했습니다. 예시 평가는 원장에 삽입되지 않습니다. 위조 주문2건과 최종 WebKit 검증 전후 이 수와 상품 hash가 동일했습니다. 서비스37개 검증은 원래 합성 주문의 결제 상태·금액·승인 식별값 불변도 별도로 확인했습니다.

production3105와 preview3104는 같은 최종 제품 build를 격리 DB로 실행했습니다. 제품 canonical을 바꾸지 않고 QA 프로세스 DNS lookup에서만 apex를 loopback으로 연결해 hostname을 지정했습니다. 모든 기록된 최종 대상은 localhost·redirect false이며 운영 도메인·PG 요청 차단의 최종 시도 수도0입니다. OS hosts/DNS와 제품 canonical은 유지했습니다. 이전 QA의 운영 redirect를 따라간 방법 오류를 이번 릴리스에서는 반복하지 않았습니다.

## 초기 실패·경고와 검증 보완

- 후기 성공 문구만 기다린 초기 검사에서 RSC 갱신 후 timeout이 발생했습니다. POST200·저장·노출을 확인한 뒤 안정된 결과로 판정하도록 바꿨습니다. 반복 본문의 이전 행에 먼저 일치한 경쟁 조건과 여러 행 locator 문제도 주문별 고유 본문·실제 응답 완료로 보완했습니다. 제품 코드는 수정하지 않았습니다. [초기 실패 기록](http-harness-warnings.json).
- main wrapper가 streamed 본문보다 먼저 보인 시점의 즉시 읽기, 빈 checkout의 h2 상태를 h1로 기다린 QA 준비 조건으로 runner가 중단됐습니다. 콘텐츠 준비와 카트 삽입 순서를 보완했습니다. 완료된288조합은 보존하고 마지막 위조 POST2개만 재검증했습니다. [기록](release-harness-warnings.json).
- WebKit 첫 broader probe의 빠른 문서 교체에서 RSC prefetch access-control 메시지20개, 대기 보완 후 원래 성별 목록 방문에서6개가 남았습니다. 원문을 지우거나 오류0으로 바꾸지 않았습니다. 신규 목록/상세만 안정 탐색한 최종8개는 오류0입니다. [이번 WARN 원문](webkit-lifecycle-warning.json). 이전 QA의 RSC5 WARN은 [이전 보고서](../2026-11-04-layout-catalog-followup/report.md)에 보존하며 이번 수에 합치지 않습니다. 실기기 Safari 결과가 아닙니다.
- 동시중복 후기 검사 고유제약 로그는 두 번째 삽입 거절의 음성 시나리오이고 DB행1개를 확인했습니다. 기존 Prisma deprecation도 숨기지 않습니다.

## DEV/운영 증거와 남은 범위

root 운영 담당은 사용자 승인으로 백업 후3테이블을 추가하고 기존11테이블 count/digest 전후 동일·새3원장0행·validated CHECK4개·불변 trigger·앱 readiness true를 별도로 기록했습니다. [운영 스키마 결과](operational-schema-results.json)는 독립 QA 결과가 아니며 덮어쓰지 않았습니다. [별도 소스 검토](source-review.json)와 DEV 원본도 보존했습니다.

이 독립 보고서 확정 시점의 실제 production 배포 후 public GET/Chromium smoke는 root가 별도로 실행할 예정입니다. `tests/integration/production-public-smoke.mjs`도 root 소유입니다. 로컬 production PASS를 실제 사이트 배포 완료로 보고하지 않습니다.

실제 고객 후기 생성·실물 발송·공급/실측/판매가/재고 확정·신규 판매 활성화·실제 카드 승인/취소·LAONPAY 파트너 활성화·운영 인증 POST·실기기 검증은 독립 QA에서 수행하지 않았습니다.

## 화면과 cleanup

- [production 구매 안내 정렬](production-purchase-info-1280.png)
- [production 참고 사이즈표](production-size-guide-1280.png)
- [production 준비상품 목록](production-prepared-grid-1280.png)

자체 Next3104/3105·PostgreSQL52968 종료 및 listener0, 자체 cluster·합성 세션 상태·임시 DNS preload·debug script 제거를 확인했습니다. 중간 실패 JSON은 위 기록과 완료 화면 데이터로 보존한 뒤 정리했습니다. 사용자 첨부·공유 브라우저 프로필·다른 프로젝트·운영 자료·제품 build를 보존했습니다. [정리 결과](independent-cleanup-results.json).

QA 변경은 새 `production-release-qa.mjs`, 기존 runner2개의 출력 경로/후기 검증 보완, 독립 보고서 산출물과 `tests/handoff/latest.md`입니다. 독립 QA는 commit/push하지 않았고 root가 담당합니다.

## 운영 배포 후 hydration 추가 조사

root가 실제 운영 smoke에서 React#418을1회 관찰한 뒤 요청한 별도 조사입니다. 제품 코드를 바꾸지 않고 `/`, 남성/여성 목록, 준비목록, 기존 반팔 상세, `women-dress-02`를 각각 새 Chromium 컨텍스트에서 안정 로드했습니다. 여섯 페이지 모두 HTTP200, pageerror0·console error0·넘침0·후기 예시0이며 비GET/PG 요청 시도0입니다. [독립 운영 GET 결과](production-hydration-probe-independent.json).

React#418은 이 안정 탐색에서 재현되지 않았으며 원인이 해결됐다고 단정하지 않습니다. 별도로11개의 fetch `net::ERR_ABORTED` 이벤트를 URL·시각과 함께 원문 보존했습니다. 페이지/console 오류0을 네트워크 전체 오류0으로 바꾸지 않았습니다. root의 초기 React 관찰·배포 후 전체 검증 결과는 이6개 조사와 별도 범위입니다.
