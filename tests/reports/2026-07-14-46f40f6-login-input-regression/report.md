# 46f40f6 모바일 로그인 입력 회귀 QA 보고서

작성일: 2026-07-14

담당: Codex QA/테스트 세션

대상 제품 커밋: `46f40f6c5000fec55ef050c42fd9073da65559cb`

비교 범위: `22c229bb7c7ae59620dbc1e53223adc8800d602c..46f40f6c5000fec55ef050c42fd9073da65559cb`

결과: **PASS**

출시 판정: **GO - 로그인 공백 안내·입력 보존·모바일 보기 토글 회귀 통과**

## 범위와 증거 구분

- 제품 코드는 수정하지 않았습니다.
- QA는 변경 diff와 현재 코드를 독립 검토하고, Node 22 정적 검증 및 운영 공개 `/login`의 secret 없는 모바일 회귀를 직접 실행했습니다.
- 실제 심사용 계정의 credential, hash, cookie 값은 읽거나 출력하지 않았습니다.
- exact 로그인·세션·`/mypage`와 실제 비밀번호 기반 공백 안내는 사용자 지시에 따라 DEV가 같은 제품 SHA에서 확보한 운영 Samsung Internet UA 412px 증거를 교차 근거로 사용했습니다. 이 항목은 QA가 credential을 다시 제출한 결과로 표기하지 않습니다.
- OCR, 추가 설치, DB fixture, 운영·테스트 DB 쓰기, 실결제는 실행하지 않았습니다.

## 저장소·배포 기준

- 검증 시작 시 `HEAD=origin/main=46f40f6c5000fec55ef050c42fd9073da65559cb`이고 작업 트리는 clean이었습니다.
- DEV 인계 배포는 `dpl_8zYRVeMDCrkajg71pdukWokhwdni`, `READY`, production Git SHA `46f40f6`입니다.
- 운영 대상은 `https://laonshop.com`과 `https://www.laonshop.com`입니다.

## 정적 검증

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 25/25, fail 0, skip 0 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 7 설정 이전 안내만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 독립 코드 검토

| 검토 항목 | 결과 | 코드 근거 |
| --- | --- | --- |
| raw password 우선 | PASS | `actions.ts:85-94`에서 원문 bcrypt 비교 후에만 진단 후보를 검사합니다. 자동 trim 인증이 없습니다. |
| 정확한 공백 안내 | PASS | trim 후보가 같은 사용자의 실제 hash와 일치할 때만 전용 문구를 반환합니다. 일반 오입력은 기존 generic 문구를 유지합니다. |
| 경계 문자 | PASS | `auth-input.ts:9-11`에서 양끝 `\s`와 zero-width space만 제거하며 내부 공백은 유지합니다. |
| 기존 잠금 | PASS | 5회·10분 정책과 성공 시 실패 카운터 삭제 로직은 유지됐습니다. 전용 공백 진단은 올바른 trim 후보일 때만 실패 카운터 증가 전에 반환됩니다. |
| 입력 보존 | PASS | `login-form.tsx:7-43`의 controlled email/password state가 Server Action 오류 후 값을 유지합니다. |
| 모바일 입력 힌트 | PASS | email/password 모두 `autoCapitalize=none`, `autoCorrect=off`, `spellCheck=false`, 기존 autocomplete 목적을 유지합니다. |
| 보기 토글 접근성 | PASS | 토글은 `type=button`, 상태별 aria-label, `aria-pressed`, 44px 최소 타깃을 사용합니다. |

## 운영 공개 로그인 UI

Chromium 기반 인앱 브라우저에서 production `/login`을 직접 검증했습니다.

| 폭 | 문서 폭 | 이메일/비밀번호 | 보기 토글 | 로그인 버튼 | 결과 |
| --- | --- | --- | --- | --- | --- |
| 320×568 | `scrollWidth=clientWidth=320` | 246×44px | 44×44px | 246×56px | PASS |
| 390×844 | `scrollWidth=clientWidth=390` | 316×44px | 44×44px | 316×56px | PASS |
| 412×915 | `scrollWidth=clientWidth=412` | 338×44px | 44×44px | 338×56px | PASS |

- 세 폭 모두 form input/button의 viewport 이탈은 0이고 버튼 내부 `scrollWidth/clientWidth`, `scrollHeight/clientHeight`가 일치했습니다.
- 초기 password type은 `password`, 토글 `aria-pressed=false`, aria-label은 `비밀번호 보기`입니다.
- 토글 후 type `text`, `aria-pressed=true`, aria-label `비밀번호 숨기기`로 바뀌고 재토글 시 원상복구됐습니다.
- 존재하지 않는 합성 이메일과 비밀이 아닌 합성 문자열을 1회 제출했습니다. 로그인되지 않고 generic 오류가 표시됐으며 이메일·비밀번호 값이 모두 유지됐습니다.
- 오류 후 password type `password`, 토글 `aria-pressed=false`, 로그인 버튼 enabled 상태를 확인했습니다.
- `www.laonshop.com/login`도 320px에서 입력 두 개, 44×44px 토글, 문서 가로 오버플로 0을 확인했습니다.
- 브라우저 console error/warning은 0입니다.

## DEV 운영 증거 교차 검토

동일 SHA의 DEV 실행 증거는 다음 코드 경계와 모순이 없습니다.

- 운영 Samsung Internet UA 412px에서 exact credential 로그인, authenticated header, Secure/HttpOnly 세션, `/mypage` 접근 성공
- leading/trailing 복사 공백에서 자동 로그인되지 않고 전용 안내, 입력값 유지, 보기 토글 정상
- 일반 오입력은 generic 오류, 44px 타깃, 가로 오버플로와 console error 0

QA는 이 증거의 credential·hash·cookie 실제 값을 수신하거나 기록하지 않았습니다.

## 결함과 잔여 위험

- 이번 범위에서 신규 제품 결함은 발견하지 못했습니다.
- 로그인 실패 잠금은 기존과 같이 Vercel 인스턴스별 메모리 `Map`이므로 다중 인스턴스 일관성 위험이 남습니다.
- QA는 지시에 따라 실제 심사용 credential 제출, 5회 잠금 실제 반복, DB 경계 비밀번호 fixture를 재실행하지 않았습니다. 해당 동작은 코드 검토·기존 정책·DEV 운영 증거로 판정했습니다.
- 실제 Samsung Internet 앱, Safari/WebKit, iOS 실제 기기는 QA 직접 실행 범위가 아닙니다.

## cleanup

- QA DB 쓰기와 fixture 생성이 없으므로 삭제할 테스트 데이터가 없습니다.
- 운영에는 존재하지 않는 합성 계정 로그인 요청 1회만 발생했으며 세션·사용자 데이터가 생성되지 않았습니다.
- 브라우저 viewport override를 reset하고 QA 탭을 finalize했습니다.
- OCR·secret 추출·임시 credential 파일은 생성되지 않았습니다.
- 실결제, 운영·마스터 데이터, Vercel env·도메인 설정 변경은 없습니다.

## 최종 판정

변경 분기는 raw password 우선·진단 전용 후보 비교·generic 오류 유지라는 요구사항과 일치합니다. 정적 검증, 독립 코드 검토, 운영 공개 모바일 UI 및 사용자 지시에 따라 재사용한 동일 SHA의 DEV 운영 인증 증거가 모두 일치하므로 제품 커밋 `46f40f6`은 **PASS / GO**입니다.
