# 2026-11-06 보안 보완 및 운영 배포

작성일: 2026-11-06. 기준선 `de41c604602b3ffd75e1e1cddd42845ca93c42ef`. 이 문서는 11월 4일 화면·카탈로그 배포 기록을 대체하지 않는다.

## 변경 범위·수용 조건

| 확인한 문제 | 수정·수용 조건 |
|---|---|
| 비밀번호 변경 후 이전 세션도 계속 유효 | 세션에 현재 비밀번호 해시로 결박한 HMAC credentialTag를 넣고 모든 실제 사용자 소비 경로에서 검증. 기존 쿠키는 재로그인, 현재 변경 세션만 갱신. 동시 변경은 CAS 하나만 성공 |
| 새 비밀번호의 bcrypt UTF-8 72바이트 경계 누락 | 새 비밀번호는 UTF-8 72바이트 이하, 기존 로그인 호환은 별도의 1024바이트 상한으로 유지 |
| PG 폼·응답의 무제한 파싱 | 실제 stream32KiB 상한, 부정 content-length·중복 중요 필드·File·잘못된 content-type 거절. 정상 브릿지·취소·HMAC 계약 유지 |
| 공급사 누락 금액을 요청 금액으로 대체 | 성공 응답에 양의 안전 정수 금액을 요구하고 요청 주문과 일치 검증. 미정 authyn은 O/X 규격 오류로 처리하여 결과미상 주문을 실패로 확정하지 않음 |
| lock 의존성 취약점 | Next15.5.29·Zod4.6.7·sharp0.35.5 및 관련 하위 의존성 패치. Zod4 오류 API 호환 수정. 실제 악용 확인과 SCA 취약 버전 탐지를 구분 |
| 반복 가능한 기본 보안 QA 부재 | SHA·부정 시험·의존성/비밀값·격리 test/lint/typecheck/build/browser·정리 증거를 기본 게이트로 추가. 선택 추가 감사와 명시적으로 분리 |

기본 응답 헤더에 nosniff·strict-origin-when-cross-origin을 추가한다. 카드 원문/provider token·서명 canonical·기존 파트너 API·DB schema·운영 환경·키·기능 gate는 변경하지 않는다. 정상 KSPAY O/X의 근거는 보관된 KSNET 통합모듈V1.4 JSP 결과 샘플의 공식 성공 여부 규칙이다.

## 검증 구분

실행 완료 수치와 최종 SHA는 검증 후 인계 문서에 고정한다. 이 초기 문서 자체는 검증 PASS 증거가 아니다. 수용 조건은 기존 회귀·이미지 게이트·Zod4·새 세션·PG 부정 입력·금액·소유권·중복 승인 차단, 격리 서비스/HTTP/브라우저, production build, 외부 호출 차단, 소스 SHA 동일, 정리 확인이다.

독립 읽기 전용 소스 검토는 [별도 기록](2026-11-06-security-independent-review.md)으로 구분한다. 최종 격리 실행 결과는 `tests/.generated/`의 컨트롤러 summary와 핸드오프에 기록한다. 기본 실행에 PentAGI·Cloudflare는 포함하지 않으며 `not-run/false`로 남긴다.

초기 의존성 준비 중 pnpm11의 자동 설치가 호스트 postinstall Prisma generate를 실행했다. 운영 DB/PG 호출은 없었고 원시 환경값은 출력하지 않았다. 이를 격리 보안 검증 성공으로 간주하지 않는다. 이후 부모 실행은 직접 Node, workspace는 `verifyDepsBeforeRun: error`로 보완했다. 전용 이미지 최초 준비 실패(Prisma engines 경로)는 수정 후 재준비하며 최초 실패를 보존한다.

실행기 자체 시험 최초 55개 중 middleware 민감 연산 목록 누락으로 1개가 실패했다. 목록 범위를 실제 middleware/Next 설정까지 넓힌 뒤 55/55(skip0)로 재검증했다. 독립 검토에서 발견한 실행기 증거 누락·출력 원문·전체 signal 수명과 이전 쿠키 시험의 선행 쿠키 삭제 문제는 검증 전에 수정하고 부정 시험으로 확인한다. 이 준비 기록은 제품 통합 QA 통과와 구분한다.

추가 실행기 하니스는 58/58(skip0) 통과했다. 격리 도구 사전검사에서는 pnpm11 SQLite store가 readonly 경로에 쓰기를 요구해 `ERR_SQLITE_ERROR`로 실패했고 후속 dependency 검증도 차단됐다. 읽기 전용 root를 완화하지 않고 전용 scratch에 캐시를 복사해 명시적 offline 설치로 준비 경로를 수정한다. 이 실패는 앱/fixture 실행 전 발생한 준비 실패로 보존한다.

pnpm의 registry 메타데이터 캐시 부재에 따른 조회 시도도 network none에서 차단됐다. 준비 단계에서 해당 캐시까지 보존하며 신뢰 검증 정책을 끄지 않는다. 이미지 export의 ENOSPC는 layer 간 dependency/store copy-up 중복을 없애고 이번 전용 VM의 이전 자체 image/build cache만 식별 정리해 보완한다. 공유 프로필·기존 사용자 자료·운영 데이터는 정리 대상이 아니다.

경로·registry 캐시 복원 후 offline install은 exit0·registry 조회 시도0을 사전 확인했다. 기본 tmpfs noexec로 CLI가 EACCES를 낸 문제는 CLI·Prisma native 실행 대상인 전용 scratch만 exec로 명시해 수정한다. root/input readonly, non-root·nosuid/nodev·권한 제거·네트워크 차단·자원 상한은 유지한다. 이는 제품 전체 검증에 앞선 도구 사전검사다.

최종 도구 사전검사는 offline install0·tsx 실행0·registry 조회 시도0, 준비 scratch 1,209,487,360바이트로 확인됐다. 실제 scratch mount option을 child/parent 양쪽에서 검사하도록 보강했고 최종 하니스는 59/59(skip0) 통과했다. 최종 이미지 export에서도 이전 image layer의 중복으로 ENOSPC가 다시 발생해 이번 전용 image/cache만 정리했으며, 이 준비 실패 역시 제품 테스트와 구분한다.

### 첫 독립 전체 실행: `871ffef`

2026-11-06 02:33:25~02:48:48 UTC, `qa:full`은 **INTERRUPTED/exit130**이며 전체 PASS가 아니다. 소스 SHA 전후 동일·dirty0, pnpm audit는 개발/선택 포함487개 취약점0, 하니스 exit0였다. 서비스37·실제 result route/DB stub5는 별도 결과 파일로 부분 PASS를 확인했다. 최종 runtime receipt가 없어 unit 정확수치·lint·typecheck·build는 미확인, 브라우저46·보안16은 미완료로 보존한다. 컨테이너와 VM 임시 입력 부재·cleanup PASS를 독립 담당자가 재확인했다. 상세 summary는 `tests/.generated/2026-11-06T02-33-25.840Z-full-pevcWG/summary.json`이다.

확인한 검사 설정 FAIL과 실행기 대기 공백 때문에 DEV 판단으로 중단했다. 사용자가 작업을 중단한 것으로 표시하지 않는다. `.env.example`의 두 연결 문자열은 USER/PASSWORD 예시였으며 실제 credential 유출로 판정하지 않는다. 예외/ignore를 추가하는 대신 빈 연결값과 입력 안내로 바꿨다. 실제 `.env`·운영 환경은 수정하지 않았다.

Trivy는 빈 secret YAML의 EOF 오류를 합성 디렉터리로 재현했다. 명시적인 `{}` YAML로 수정하고, 별도 임시 디렉터리의 비기능 랜덤 canary를 실제 기본 `github-pat` 규칙이 탐지하는지도 필수 검사로 추가했다. 토큰·매치 원문은 저장하지 않으며 미탐지는 BLOCKED다. 양성 실측1건·판정 부정 시험을 통과했다. 기본 규칙이나 심각도 검사를 끄지 않았다.

추가로 Next 내부 추출기의 `src: url(...)` 형식과 오프라인 minified CSS의 불일치, 상한 없는 폰트/응답 대기, PID1의 자식 회수 공백을 발견했다. 폰트 실추출·로딩 확인, 고정 index 진행 메타데이터·명시적 대기 상한, init/process group 정리를 보완한 새 SHA에서 전체 재실행한다. 현재 제품의 실제 운영 오류로 단정하지 않고 QA 실행기 문제와 구분한다.

검사기 수정 후 02:58 UTC 부분 진단에서 pnpm/Trivy 각각487개·취약점0, tracked secret0, 기본 github-pat 양성 대조 PASS를 확인했다. 그러나 수정 중 dirty source이므로 전체는 BLOCKED/exit2다. 최종 clean SHA의 QA 성공으로 인용하지 않는다. 증거: `tests/.generated/2026-11-06T02-58-14-183Z-local-security-geCJn0/summary.json`.

실행기 보완 후 실제 Next 추출기에서 수정 전0→9개·Latin preload2개, WOFF2 magic/hash를 확인했다. Linux에서 init·기존 격리/자원 조건 그대로 TERM을 무시하는 자식/손자 종료·의도된 daemon 보존 후 정리·zombie0의 도구 probe3개를 통과했다. DEV 부모 하니스는 이 시점73/73(skip0)이다. commerce 기존46개를 보존하고 실제 self-host 폰트1개를 추가해47개, 보안 HTTP16개·서비스37개·PG route5개를 필수로 유지한다. 실제 제품 build·브라우저의 재실행 결과로 해석하지 않는다.

실제 Playwright가 Chromium을 detached 새 PGID로 실행하는 경계를 추가 확인해 관측 자손 identity 추적·회수를 보완했다. 03:27 UTC 최종 준비 image `7eb870a2ce4db588742c`에서 about:blank Chromium의 별도 PGID를 먼저 확인한 뒤 200ms 제어 deadline(AbortSignal 경로)을 걸었다. 원 Node SIGKILL·자손9개 회수·remaining0, 독립 PID/starttime 집합 시작2→종료2·SHA256동일·미관측 잔여0·zombie0를 확인했다. 내부 wall timer 경로는 별도 자식/손자 probe·회귀 시험으로 구분한다. 부모 전체 하니스88/88(skip0)·구문·diff 검증도 통과했다. 이는 DEV 도구 준비 증거이며 실제 제품 build·브라우저47/16 전체 성공 증거는 아니다. 증거: `tests/.generated/2026-11-06T03-27-34.195Z-isolated-0DoHxq/summary.json`.

### 두 번째 독립 전체 실행: `831ae70`

전체는 **FAIL/exit1**이며 중단되지 않았다. source/finalRef 동일·dirty0, SCA는 pnpm/Trivy 각각487개·취약점0·source secret0·별도 양성대조 PASS, production build와 typecheck는0, DB37·PG5 exact/invariant PASS였다. 제품 unit은202개 중201 PASS·1 FAIL·skip0, lint는1이었다. commerce47 중41개 완료 후240초 제한, security16 중2개 완료 후 제한에 걸렸다. 결과 파일 미완료를 전체 통과로 처리하지 않았다. 자손13/15의 remaining0, group/descendant·서비스/PG·컨테이너/VM 입력 정리 PASS는 최종 receipt와 독립 조회로 확인했다. 독립 제어기 별도 측정88/88 skip0은 제품202개와 구분한다. 증거: `tests/.generated/2026-11-06T03-31-37.001Z-full-UR8OKf/summary.json`.

동일 SHA 부분 진단에서 unit90의 위치는 `tests/api/kspay-result-security.test.ts:57`이었다. JS 기본 인자가 env를 사용하는데 `undefined`를 전달하며 env 없음으로 가정한 시험의 격리 누락이다. env 없음/심사 MID/실 MID를 분리하고 finally 복원하도록 고쳤으며 운영 승인 가드는 변경하지 않았다. lint는 `isolated-process.mjs`의 삼항식 문장 경고1개여서 동등한 if/else로 바꿨고 무시 규칙은 추가하지 않았다. 진단은 `tests/.generated/2026-11-06-partial-diagnostic/summary.json`에 있으며 full PASS가 아니다.

브라우저는 고정된 실제 Playwright bundle이 `_Browser`, `_BrowserContext2`, `_Page2` 같은 이름을 사용해 기존 public-name exact whitelist가 적용되지 않은 실행기 결함이었다. 엄격한 별칭 정규화·원 constructor/private receiver 보존·불명 API 즉시 FAIL과 실제 종류/operation 양수 증거를 추가한다. 실제 API 객체 도구 probe에서 새 `DisposableStub` 반환형도 차단돼 실패를 보존하고, pinned primary source의 dispose 구현을 확인한 정확한 타입만 추가했다. mock 객체 하니스 통과를 실제 Playwright 수명 검증으로 대신하지 않는다.

실제 고정 SDK의10종 API 객체에서 wrap/raw·constructor/private identity, body가 끝나지 않는 Response.finished50ms·정지시킨 Browser.close50ms 경계와 복구 후 자원 정리를 확인했다. unknown0·외부0·alias10, 컨테이너/임시 입력 정리 PASS이며 이는 DEV 도구 probe다. 두 suite의 wrapper 파일·핵심 종류·응답/종료/탐색 operation 양수까지 필수 gate로 추가해 래퍼 미적용이 성공으로 표시되지 않게 했다. DEV 제어기93/93 skip0·diff 검증 PASS. 새 clean SHA의 제품 전체 결과는 별도로 회수한다. 도구 증거: `tests/.generated/2026-11-06T03-55-39-playwright-wrapper-probe/summary.json`.

## 배포 시 영향·남는 범위

- 기존 로그인 쿠키는 새 credentialTag가 없어 배포 후 한 번 다시 로그인해야 한다. 비밀번호 변경 후 복사한 이전 쿠키는 거절된다.
- 로그아웃은 현재 브라우저 쿠키 폐기다. 복사된 쿠키의 전역 서버 폐기와 인스턴스 간 로그인 속도 제한은 이번 DB/인프라 변경 없이 해결했다고 표시하지 않는다.
- 실제 PG 승인·취소·카드 등록·운영 DB/환경/키 변경은 수행하지 않는다. 격리 QA와 공개 GET 확인만으로 실 PG 상호운용 완료를 주장하지 않는다.
- 기존 11월4일 React#418 미재현 WARN, WebKit RSC 경고·실기기 미실행은 과거 기록으로 보존한다. 이번 수정의 해결 대상으로 소급 표시하지 않는다.
- 전체 소스 침투 감사·운영 컨테이너 이미지/모든 외부 도구 공급망 감사·분산 인프라 보장은 이번 기본 QA 범위가 아니다.
