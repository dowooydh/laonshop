# QA 핸드오프 최신본

작성일: 2026-07-14

담당: Codex QA/테스트 세션

대상: `main` / `46f40f6c5000fec55ef050c42fd9073da65559cb`

비교 범위: `22c229bb7c7ae59620dbc1e53223adc8800d602c..46f40f6c5000fec55ef050c42fd9073da65559cb`

결과: **PASS**

출시 판정: **GO - 로그인 공백 안내·입력 보존·모바일 보기 토글 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 25/25, skip 0, lint, typecheck, Prisma validate, production audit, build와 diff check가 모두 통과했습니다.
- raw password를 먼저 비교하고, 실패 시 trim 후보가 실제 hash와 일치할 때만 공백 안내를 반환하는 것을 독립 코드 검토했습니다. 자동 trim 로그인은 없습니다.
- 운영 공개 `/login`을 320/390/412px에서 직접 검증해 문서 오버플로 0, 폼 컨트롤 이탈 0, 44px 보기 토글과 56px 로그인 버튼을 확인했습니다.
- 보기/숨김 type·aria-label·aria-pressed 전환과 합성 generic 오류 후 이메일·비밀번호 보존, 버튼 재활성을 확인했습니다.
- 사용자 지시에 따라 동일 SHA에서 DEV가 확보한 Samsung Internet UA exact 로그인·Secure/HttpOnly 세션·`/mypage`·공백 전용 안내 증거를 교차 근거로 사용했습니다. QA는 credential/hash/cookie 값을 읽거나 출력하지 않았습니다.
- 상세 보고서: [2026-07-14 `46f40f6` 모바일 로그인 입력 회귀 QA 보고서](../reports/2026-07-14-46f40f6-login-input-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 25/25, lint/typecheck/prisma/audit/build/diff check PASS |
| 인증 코드 경계 | PASS | raw bcrypt 우선, 진단 후보만 trim, generic 오류·5회 잠금 유지 |
| 320px | PASS | `sw=cw=320`, input 246×44, toggle 44×44, submit 246×56 |
| 390px | PASS | `sw=cw=390`, input 316×44, toggle 44×44, submit 316×56 |
| 412px | PASS | `sw=cw=412`, input 338×44, toggle 44×44, submit 338×56 |
| 오류 복구 | PASS | generic 오류, 이메일·비밀번호 보존, 토글 초기화, submit enabled |
| `www` host | PASS | 공개 로그인 폼, 320px 가로 overflow 0, 44px 토글 |
| 운영 exact 인증 | PASS | DEV Samsung Internet UA 증거: 인증 헤더, Secure/HttpOnly 세션, `/mypage` |

## 결함과 위험

- 신규 제품 결함은 발견하지 못했습니다.
- 로그인 실패 잠금은 기존 Vercel 인스턴스 메모리 기반이라 다중 인스턴스 일관성 위험이 남습니다.
- 실제 Samsung Internet 앱, Safari/WebKit, iOS 실제 기기는 QA가 직접 실행하지 않았습니다.
- QA는 승인 범위에 따라 실제 credential 재제출, DB fixture, 5회 잠금 반복을 생략했습니다.

## cleanup

- DB fixture와 DB 쓰기는 없으며 삭제할 데이터가 없습니다.
- 존재하지 않는 합성 계정의 generic 오류 요청 1회만 실행했고 세션·사용자 데이터는 생성되지 않았습니다.
- 브라우저 viewport override와 QA 탭을 정리했습니다.
- OCR, 추가 설치, secret 추출, 임시 credential 파일, 제품 코드 변경은 없습니다.
- 실결제, 운영·마스터 데이터, PG/Vercel 설정 변경은 없습니다.

## 개발 회귀 요청

추가 제품 수정 없이 현재 제품 커밋을 출시 후보로 유지합니다. 인스턴스 간 로그인 잠금 일관성과 Safari/iOS 실제 기기는 별도 위험으로 관리합니다.
