# QA 핸드오프 최신본

작성일: 2026-07-18

담당: Codex QA/테스트 세션

제품 SHA: `91094a76ac97e3c98d73d071515918b58864daf4`

비교 범위: `78bb51b8f2e779e4bc62fd69a3f9a0c0b956e6d0..91094a76ac97e3c98d73d071515918b58864daf4`

대상 배포: `dpl_FkbAehHUJJytLRHRcp9LfZqzQcLN` / `https://laonshop.com`

결과: **PARTIAL**

출시 판정:

- 현재 fail-closed 운영 배포 유지: **GO**
- LAONPAY 계약 코드: **조건부 GO**
- 실제 hosted 등록·원클릭·취소 활성화: **NO-GO**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Ed25519 7줄 canonical, POST 소문자 UUID 멱등키 결박, GET 빈 canonical line·멱등 header 부재를 독립 검토하고 HTTP stub으로 검증했습니다.
- same-key/same-body reconciliation은 fresh timestamp·nonce·서명을 사용하며 UNKNOWN에서 외부 결제를 자동 재호출하지 않습니다.
- hosted 등록 URL은 exact HTTPS origin/path/signature/intent로 제한되고 등록 복귀 query는 source of truth로 사용하지 않습니다.
- cancel-request signed GET, strict 상태쌍, DONE/REJECTED 원자 대사와 charge fallback 경계를 검토했습니다.
- focused 46/46, 전체 test 97/97, lint, typecheck, Prisma validate, audit와 production build가 통과했습니다.
- 운영 Chrome 인증 세션에서 설정은 카드 등록·원문 입력 없이 명확히 fail-closed였고 checkout은 일반 KSPAY 4수단만 유지했습니다.
- 320/360/390/412px에서 설정·checkout overflow와 viewport 이탈 0, console warning/error와 LAONPAY API resource 0입니다.
- Android font scale 2.0과 iOS MobileSafari 접근성 최대 글자에서 guest 설정→로그인과 화면 폭을 확인했습니다.
- 인증 모바일 상태 화면과 schema/env 적용 후 실제 LAONPAY 상호운용은 미실행이므로 전체 결과는 PARTIAL입니다.
- 상세 보고서: [91094a7 LAONPAY 빌링 계약 보강 회귀](../reports/2026-07-18-91094a7-laonpay-billing-contract-regression.md)

## 핵심 결과

| 영역 | 결과 | 증거 |
| --- | --- | --- |
| 요청 서명·멱등 계약 | PASS | focused 46/46, exact canonical/header/stub |
| 전체 정적 회귀 | PASS | test 97/97, skip 0, lint/typecheck/prisma/audit/build |
| hosted URL·등록 복귀 | PASS | exact origin/path/intent, query/hash/credential 거부 |
| cancel-request 계약 | PASS | signed GET strict parser, 상태쌍·source-of-truth 검증 |
| 금액·소유권·UNKNOWN | PASS | 서버 재계산, 소유권 재검증, 자동 재결제 차단 코드·테스트 |
| 운영 설정 fail-closed | PASS | 등록 버튼 0, 카드 원문 input 0, 외부 API resource 0 |
| 일반 KSPAY checkout | PASS | 카드·카카오·네이버·계좌이체 유지, oneclick/manual 0 |
| Chrome 320~412px | PASS | document overflow·visible descendant 이탈 0 |
| Android guest/font 2.0 | PASS | 설정→로그인, 주요 UI 가로 잘림 없음 |
| iOS MobileSafari guest/AX XXXL | PASS | 설정→로그인, 주요 UI 가로 잘림 없음 |
| 인증 모바일 빌링 상태 UI | NOT EXECUTED | 모바일 인증 세션 부재 |
| schema/env 적용 통합 E2E | NOT EXECUTED | 의도적 미적용·LAONPAY readiness 대기 |
| cleanup | PASS | 브라우저 세션·임시 파일·기기 글자 설정 복구 |

## 결함

신규 확정 제품 결함은 없습니다.

운영의 hosted 등록·oneclick 미노출은 env와 schema가 미적용된 현재의 정상 fail-closed 상태입니다.

## 안전·운영 증거

- 실제 카드, PG, 주문·결제 submit, 운영 DB write, schema push와 Vercel env 변경을 실행하지 않았습니다.
- 카드 원문, provider token, MID, Authorization, 세션 쿠키와 비밀키를 출력하거나 문서화하지 않았습니다.
- Vercel 배포는 READY, production, Git SHA `91094a7`이며 local/origin HEAD와 apex/www alias가 일치합니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal log 0입니다.
- `www.laonshop.com`은 apex로 308 전환됩니다. 고정 배포 URL의 Vercel SSO 302는 배포 보호 설정이며 제품 결함이 아닙니다.

## 미실행·외부 blocker

- LAONPAY 최종 제품 SHA/readiness 기반 hosted/API 실제 상호운용
- 신규 Prisma schema 적용 후 주문+marker+charge 및 취소 대사 transaction E2E
- Vercel LAONPAY env 3종 적용 후 registration return·signed API 왕복
- 인증된 Android/iOS 등록 복귀·UNKNOWN·취소 상태 화면
- Chrome/iOS exact 200% browser zoom
- 실카드, 실 PG 승인·취소·해지

미실행 항목은 제품 결함이 아니라 인증 세션, 미적용 schema/env와 외부 readiness 제약입니다.

## Cleanup

- Chrome viewport와 Chrome/in-app Browser 제어 세션을 정리했습니다.
- Android font scale을 `1.0`, iOS content size를 `large`로 복구했습니다.
- Android/iOS·로컬 임시 캡처를 삭제했습니다.
- QA fixture와 DB write를 생성하지 않았고 운영 데이터·Vercel env·PG 상태를 변경하지 않았습니다.

## 개발 회신

`91094a7`은 서명·멱등·hosted URL·취소 조회 계약과 운영 fail-closed 회귀를 통과했습니다. 현재 비활성 운영 배포 유지와 다음 격리 통합 단계 진입은 가능합니다. 실제 hosted 등록·원클릭·취소 활성화는 LAONPAY readiness, schema/env 적용과 양측 E2E 전까지 NO-GO이며, 인증 모바일 상태 화면 미실행 때문에 전체 결과는 PARTIAL입니다.
