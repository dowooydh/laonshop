# 보안 보완 독립 전체 QA 실행과 후속 검토

최신 실행은 P2 SHA `831ae7055f6c005a5a42db923eb95a4c3dcda879`의 **FAIL**입니다. SCA·DB/PG·정리는 통과했고, 제품 unit 1건·lint·브라우저 제한시간은 실패했습니다. 아래 첫 실행 기록을 보존하고 P2 결과와 원인·수정 소스 검토를 마지막 절에 구분합니다. 후속 후보의 전체 재검증은 아직 필요합니다.

## 첫 실행 판정

**전체 PASS가 아닙니다.** 후보 SHA `871ffefa0da6a6a86e064b2e942c40b84f61e6bf`의 첫 `qa:full`은 local-security 실패 후 격리 브라우저 단계가 장시간 반환하지 않아 **개발 담당의 판단으로 SIGINT 중단**했습니다. 사용자 중단 요청으로 보고하지 않습니다. 제어기의 기계적 결과는 `INTERRUPTED`, exit 130입니다.

서비스 DB 37개와 PG route 5개는 중단 전에 안전한 결과 메타데이터로 부분 통과를 확인했습니다. unit·lint·typecheck·production build 및 브라우저 전체의 최종 runtime receipt는 회수하지 못했으므로 PASS로 처리하지 않습니다. 전용 컨테이너와 이 실행의 VM 임시 입력은 제거됐음을 독립 재확인했습니다.

이후 SCA 설정·환경 예시와 준비·폰트·시간 제한·프로세스 회수 보완의 **소스 검토**를 이 문서의 후속 절에 기록합니다. 수정 후 전체 실행 결과는 아니며 새 clean SHA의 독립 재검증은 아직 필요합니다.

## 실행 식별과 범위

| 항목 | 확인 결과 |
|---|---|
| 작성일 | 2026-11-06 (KST) |
| 저장소 / 브랜치 | `/Users/donghyuk/Projects/laonshop` / `codex/security-baseline-20261106` |
| 시작·종료 SHA | 둘 다 `871ffefa0da6a6a86e064b2e942c40b84f61e6bf` |
| 소스 식별 | `sourceVerified:true`, `sourceChanged:false`; 실행 전·종료 후 사용자 첨부 제외 dirty 0 |
| Node | v22.23.1 |
| 명령 | Node 22 경로와 `/opt/homebrew/bin`을 PATH에 지정한 뒤 `node scripts/qa/full.mjs` 직접 실행. pnpm wrapper 사용 없음 |
| 기간 | 2026-11-06 02:33:25.877–02:48:48.737 UTC, 약 15분 23초; KST 11:33–11:48 |
| 기본 단계 | local-security → qa-harness → isolated |
| 선택 외부 감사 | `optionalEvidenceRequested:false`, `securityAuditStatus:not-run`, `securityAuditComplete:false` |
| target | 전용 Docker context `colima-laonshop-security-20261106`, Colima profile `laonshop-security-20261106`의 network-none 컨테이너 |
| 준비 이미지 | 전달받은 준비 tag `laonshop-qa-sandbox:41fd71ed6251720e56c6`; 최종 runtime receipt의 실제 image ID는 회수하지 못함 |

실행 중 제품 코드·문서·Git을 수정하지 않았습니다. 제품 실행은 격리 제어기 안에서만 수행했습니다. 운영 환경파일·키 원문을 읽거나 전달하지 않았고, 운영 DB·실 PG·권한·기능 gate·배포를 변경하지 않았습니다. 기본 SCA의 registry 조회와 전용 VM의 합성 DB·공급사 stub은 실제 운영 연동 검증과 구분합니다.

## 실제 회수 결과

| 검증 | 결과 | 근거와 한계 |
|---|---|---|
| local-security | **FAIL, exit 1** | 아래 두 실패 축을 그대로 보존했습니다. |
| tracked-text secret pattern | **FAIL** | 추적된 `.env.example` 7·8행의 credential-url 후보 2건. 원문·값은 출력하지 않았습니다. 구현 담당은 USER/PASSWORD 형식의 placeholder라고 안전 메타데이터로 확인했습니다. 실제 운영 secret 유출 발견으로 단정하지 않습니다. |
| pnpm audit | **PASS** | runtime 70, development 382, optional 89, total 487. 도구의 분류 수치는 중복될 수 있어 각 분류를 단순 합산하지 않습니다. info/low/moderate/high/critical 모두 0, advisory 0, exit 0. 실제 조회 시각 02:33:26 UTC. registry API는 DB 갱신시각을 제공하지 않습니다. |
| Trivy | **BLOCKED** | v0.74.0, DB 갱신시각 2026-11-06 01:07:43 UTC. exit 1, `TRIVY_EXECUTION_OR_SCHEMA_ERROR`. 취약점·secret 0 또는 PASS로 처리하지 않습니다. 구현 담당의 별도 합성 재현에서 빈 `--secret-config` YAML의 EOF decode 오류가 원인으로 확인됐습니다. |
| qa-harness | **exit 0** | 부모 제어기 시험 프로세스 완료. 원시 TAP 출력을 승격하지 않아 이 실행의 정확 시험 수는 이 문서에서 주장하지 않습니다. |
| isolated | **INTERRUPTED, exit 130** | 최종 runtime receipt 없음. 부모 소스 SHA는 유지됐지만 `isolatedSourceVerified:false`입니다. |
| unit regression | **미확인** | 202개 전후라는 사전 기대치나 다른 담당의 수치를 이번 실행의 실제 결과로 사용하지 않습니다. 정확 tests/pass/fail/skip를 회수하지 못했습니다. |
| lint / typecheck / production build | **미확인** | runtime 최종 receipt가 없으므로 실행 순서나 이후 단계 일부 완료만으로 PASS를 추론하지 않습니다. |
| 서비스 DB | **부분 37/37 PASS 관찰** | 중단 전 `database-results.json`의 status PASS·count 37만 안전 메타데이터로 직접 읽었습니다. 전체 receipt 승격 전의 부분 증거입니다. |
| PG route + DB | **부분 5/5 PASS 관찰** | 중단 전 `security-pg-route-results.json`의 status PASS·count 5를 직접 읽었습니다. 실제 POST 함수+격리 PostgreSQL+in-process 공급사 stub이며 HTTP adapter·실 PG 시험이 아닙니다. |
| commerce browser | **미완료·결과 미확인** | 기대 46개. 관찰 시 PASS/partial 결과 파일이 없었으며 최종 개수·성공 여부를 회수하지 못했습니다. |
| security browser | **미완료·결과 미확인** | 기대 16개. 최종 결과 파일·receipt가 없어 시작/완료 여부나 결과를 PASS로 처리하지 않습니다. |
| 선택 PentAGI·Cloudflare | **not-run / complete false** | 기본 QA 실행입니다. 해당 감사 완료나 promotion 증거로 해석하면 안 됩니다. |

부분 DB/PG 결과 파일은 disposable scratch 안에 있었으며 컨테이너 제거와 함께 삭제됐습니다. 이 문서의 37/5는 실행 담당이 중단 전에 직접 관찰한 안전 메타데이터 기록이며, 이후 최종 receipt를 재구성한 결과가 아닙니다.

## 대기·중단과 원인 구분

격리 컨테이너는 장시간 running 상태였고 보조 inspect의 `OOMKilled`는 false였습니다. 원시 브라우저 콘솔·에러·자격정보는 읽지 않았습니다. 브라우저 결과/partial 파일이 생성되지 않았고, 제어기가 단계별 제한 이후에도 반환하지 않는 현상을 관찰했습니다. 정확한 active check·완료된 브라우저 수는 알 수 없습니다.

구현 담당은 이후 소스·도구 확인으로 폰트 CSS 추출 문제, 무상한 await, 프로세스/PID 회수 공백을 보완 대상으로 확인했습니다. 이들을 첫 실행의 특정 브라우저 대기 원인으로 각각 확정하는 실행 증거는 아직 없습니다. 재실행 전 안전한 단계 번호·시간 progress, HTTP/font 대기 상한, 종료 후 자식 프로세스 회수 등을 검토해야 합니다.

local-security 실패와 실행기 보완 필요가 확인돼 전체 PASS가 불가능하다는 개발 판단에 따라, 부모 전체 20분 backstop까지 대기하지 않고 정확한 `node scripts/qa/full.mjs` 프로세스에 SIGINT를 전달했습니다. 제품 실행·운영 장애·사용자 취소와 구분합니다. 첫 실행 출력과 summary는 수정하지 않았습니다.

## 정리의 독립 재확인

- isolated summary는 cleanup PASS, ownedContainerRemoved true, ownedVmInputRemoved true, listenerNamespaceDestroyed true를 기록합니다.
- 이 담당자가 별도로 exact name `laonshop-qa-dca2206b842ad226`을 Docker의 전체 컨테이너 목록에서 조회했고 빈 결과·exit 0을 확인했습니다.
- 전용 Colima profile에서 `/var/tmp/laonshop-qa-dca2206b842ad226` 부재를 `test ! -e`로 재확인해 exit 0을 받았습니다.
- 무관한 profile·리소스·파일을 삭제하지 않았습니다. 호스트의 생성된 QA summary는 증거로 보존했습니다.

## 첫 실행 이후 SCA 보완의 독립 소스 검토

최종 재실행 전 dirty 작업 트리에서 `scripts/qa/local-security.mjs`, `tests/qa/local-security.test.mjs`의 diff를 읽고, `.env.example`의 두 연결 assignment가 inline 안내 주석을 제외하면 빈 값임을 값 출력 없이 확인했습니다. 실제 `.env`는 읽거나 변경하지 않았습니다.

1. Trivy 전용 일반 config와 secret config를 각각 `{}` YAML 파일로 생성합니다. npm user/global config와 ignorefile은 별도 빈 파일로 유지합니다. EOF를 피하려고 source finding을 무시하거나 secret rule 예외를 추가하지 않았습니다.
2. 주 스캔 snapshot과 별도인 임시 디렉터리에 무작위·비기능 합성 canary를 생성하고 같은 설정의 secret scanner로 검사합니다. 원래 source의 발견 수에 canary를 섞지 않습니다.
3. `summarizeSecretProbe`는 exit 1과 github-pat 정확 1건 탐지를 요구합니다. 무탐지·정상 종료 0·다른 규칙·잘못된 결과는 BLOCKED이며 전체 aggregate 필수 요소입니다. matched token·원문·주변 텍스트를 결과에 보존하지 않고 전체 임시 snapshot은 finally에서 제거합니다.
4. 양성·음성·원문 미보존 부정 시험을 확인했습니다. 구현 담당이 보고한 집중 시험 21/21 및 실제 별도 합성 canary CRITICAL 1건 탐지는 **DEV 검증**이며 이 담당자가 실행한 시험 결과로 합산하지 않습니다.
5. `.env.example` 두 연결값을 빈 설정과 pooled/direct 안내로 바꿉니다. placeholder 오탐에 넓은 무시 규칙을 만들지 않는 변경입니다. 운영 DB 연결 정보나 실제 운영 설정을 변경한 근거는 없습니다.

이 소스 보완에서 추가 차단 결함은 발견하지 못했습니다. canary는 **github-pat 기본 규칙의 양성 대조**이며, 모든 secret 규칙·바이너리·전체 비밀값의 탐지율 또는 완전한 소스 감사 완료를 증명하지 않습니다. 수정 후 동일한 최종 clean SHA를 묶은 독립 전체 QA는 아직 필요합니다.

## 보존한 안전 산출물

모두 ignored 생성 디렉터리의 metadata-only summary입니다. 원문 target 로그를 별도 파일로 승격하지 않았습니다.

| 산출물 | SHA-256 |
|---|---|
| `tests/.generated/2026-11-06T02-33-25.840Z-full-pevcWG/summary.json` | `3e5ea19d9795d565507f6ac2fa52b1d635c35ca1ad8e4c33f6f09f2c2fab42e3` |
| `tests/.generated/2026-11-06T02-33-36.743Z-isolated-urfjaZ/summary.json` | `e1259f32d07c53a739f8bce5b09b7fd7264b1394e2624662a135080d02c59cac` |
| `tests/.generated/2026-11-06T02-33-25-906Z-local-security-JFuRqe/summary.json` | `fa7357945ef980b44d365823ce9f280c13a09f83287ccf50875952050c011e7c` |

## 첫 실행 직후 남은 작업과 운영 상태

격리 실행기·폰트·시간 제한·프로세스 회수·init 보완은 첫 실행 직후 진행 중이었습니다. 그 후 소스 검토는 다음 절로 갱신합니다. 보완 후 새 clean SHA에서 전체 필수 QA를 독립 실행해 정확 unit 수, 최신 exact 증거, lint·typecheck·build, SCA·secret 양성 대조, 격리·정리 결과를 회수해야 합니다.

이 첫 실행으로 제품·QA 최종 커밋의 통과, push, 운영 배포 또는 배포 후 공개 확인을 증명하지 않습니다. 실제 PG·LAONPAY 연동 활성화도 검증하지 않았습니다. 기존 [독립 소스 검토](2026-11-06-security-independent-review.md), 이 실패·중단 실행, DEV 자체 보완 검증, 후속 최종 독립 QA와 운영 배포 결과를 각각 구분해야 합니다.

## 후속 소스 검토: 폰트·브라우저 상한·프로세스 회수

첫 실행 이후 고정 통지된 parent/runtime, `isolated-process.mjs`, `isolated-fonts.mjs`, `browser-qa-support.mjs`, 두 브라우저 suite와 관련 순수 하니스의 변경을 독립적으로 읽었습니다. 이 절은 앞 절의 진행 중 상태를 갱신하는 **소스 검토**입니다. 아직 새 clean SHA의 독립 전체 실행 결과가 아닙니다.

| 보완 | 독립 소스 확인 |
|---|---|
| 폰트 추출 | 기존 minified CSS의 `src:url`을 실제 Next 추출기가 요구하는 `src: url`로 정규화합니다. 호스트·Linux 이미지 모두 실제 Next extractor를 사용해 Space Grotesk 3개·JetBrains Mono 6개, 총 9개와 Latin preload 2개를 확인합니다. extractor hash·실제 WOFF2 magic/hash·response/assets는 이미지 식별에 결박합니다. 캐시의 최초 취득 provenance 한계는 유지합니다. |
| 실제 브라우저 폰트 | 두 CSS 변수의 서로 다른 실제 family에 대해 FontFaceSet load 수>0·상태 loaded·해당 CSS font-face와 같은 origin의 `/_next/static/media/*.woff2` HTTP 200을 요구합니다. 빈 집합·fallback·외부 src·준비 경로 `/opt/qa` 잔존·응답 누락은 실패합니다. commerce 증거는 이 검사 1개가 추가돼 **47개**입니다. |
| 개별 브라우저 상한 | navigation 20초, action/API/response/evaluate/fonts/native fetch 15초, close 10초의 Promise 상한과 Playwright 기본 timeout을 적용합니다. native fetch도 AbortSignal을 사용합니다. reject를 삼켜 성공으로 바꾸지 않고 정리까지 진행한 뒤 실패를 보존합니다. |
| Playwright wrapper | 고정된 Playwright constructor만 감싸며 원 method는 `member.apply(target, args)`로 호출합니다. route/event/wait predicate의 객체 인자는 필요한 항목만 wrapping하고 Buffer·일반 객체·DOM evaluate 함수는 보존합니다. 현재 suite의 호출 패턴에서 receiver/콜백 타입 파괴를 발견하지 못했습니다. |
| 요청과 progress | 모든 non-loopback 브라우저 요청을 abort하고 APIRequestContext/native fetch는 dispatch 전에 loopback을 검사합니다. browser progress는 suite·정수 check index·허용 enum만 atomic rename으로 기록합니다. 런타임의 단계 번호·시각·완료 단계 요약도 raw 값 없이 보존합니다. |
| 비동기 단계 | 모든 `run`·`attempt` 호출을 await하며 buildReady도 Promise 자체가 아닌 실제 결과입니다. 일반 유한 작업은 각각 소유 POSIX process group으로 실행해 deadline/abort/출력 상한 뒤 TERM→KILL하고 group 부재를 확인합니다. timeout·abort·cleanup 실패를 코드 0으로 승격하지 않습니다. browser suite 전체 상한은 각각 240초입니다. |
| 의도된 서비스 | pg_ctl start만 service children 보존을 명시하고 PostgreSQL을 유한 작업의 종료 cleanup으로 죽이지 않습니다. Next 앱은 별도 소유 group이며 finally에서 회수합니다. 최종 PostgreSQL stop과 서비스 정리 결과도 전체 판정에 묶습니다. |
| init과 최종 판정 | `--init`·HostConfig.Init·실제 PID1 reaper를 확인합니다. 모든 필수 단계의 group cleanup, 서비스 cleanup, 기존 격리 조건 및 parent의 실제 container/input 정리를 요구합니다. 현재 exact 증거는 **DB 37 / commerce browser 47 / security browser 16 / PG route 5**입니다. 일반 격리 QA를 PentAGI·Cloudflare 완료로 승격하지 않습니다. |

최종 확인 과정에서 hard-deadline timer를 exit 후 짧은 timer가 덮어쓸 수 있는 경합, parent timeout flag의 성공 판정 반영, PostgreSQL stop의 semantic 결과·실제 pid 부재 확인을 구현 담당에게 전달했습니다. 이후 timer handle 분리·양쪽 clear 및 회귀 시험, 원 `commandExitCode`와 semantic `code` 분리, parent/prepare의 timeout·hard deadline·중단 배제, PostgreSQL stop의 실패 flag·group cleanup·실제 pid 파일 부재 조건을 소스에서 재확인했습니다.

추가로 별도 세션/PGID를 만든 도구 자식은 원 group 부재 확인만으로 회수가 증명되지 않는 경계를 전달했습니다. 실행기 담당이 실제 준비 이미지의 Playwright `coreBundle.js`를 읽어 Chromium launcher의 detached 설정을 확인했습니다. 따라서 기존 원 PGID 종료만으로 실제 browser deadline 뒤 Chrome 자식 회수가 보장되지 않는 **QA 실행기 신뢰성 결함**으로 구분합니다. 제품 auth/PG의 취약점을 발견했다는 의미는 아닙니다. 기존 pipe-holding 회귀 fixture의 detached 자식은 짧은 자연 종료를 사용하므로 이 경계를 검증한 것으로 합산하지 않습니다.

이후 `isolated-descendants.mjs`와 순수 fixture 11종 및 process/parent 통합을 소스로 재확인했습니다. 유한 작업만 100ms 간격으로 PID/PPID/pgrp/starttime/state를 읽고, stat의 프로세스명·명령줄·환경은 보존하지 않습니다. 관측한 자손은 reparent·별도 PGID가 되어도 시작시각 일치를 신호 직전에 재확인해 정확 PID에만 TERM→KILL합니다. root PID·다른 identity는 제외하며, 관측·권한 실패는 sticky FAIL입니다. 의도된 PostgreSQL daemon 모드는 tracker를 제외합니다.

원 group과 관측 자손 정리를 함께 확인하고, 부모도 필수 8단계의 Linux descendant-supported/PASS/remainingCount0을 요구합니다. 새 helper는 이미지 fingerprint/COPY에 포함됩니다. 이 최종 소스 경로에서 추가 차단 결함은 발견하지 못했습니다. 실제 detached Chrome 도구 probe는 다음 절의 DEV 증거로 회수했으며, 새 clean SHA의 독립 전체 QA는 여전히 필요합니다. 첫 관측 전에 이미 사라진 부모·관측 밖 임의 setsid 회피를 전부 포착하는 보장이나 formal audit 완료와는 구분합니다.

구현 담당이 보고한 이미지 준비, 실제 network-none 환경의 TERM 무시 자식/손자 회수·의도된 daemon 보존·zombie0 도구 probe 3/3 및 순수 하니스 수치는 DEV 증거입니다. 이 담당자의 새 전체 QA 실행으로 합산하지 않습니다. 첫 실행의 46개 commerce 기대치·미완료 기록은 당시 사실로 보존하며, 이후 47개 기대치로 소급 교체하지 않습니다.

## P2 실행 전 DEV 도구 증거 회수

소스 고정 뒤 구현 담당에게서 다음 DEV 결과를 회수했습니다. 이 담당자가 실제 Chrome을 실행한 결과나 새 제품 SHA 전체 QA 결과로 합산하지 않습니다.

| 항목 | 회수 결과와 구분 |
|---|---|
| 최종 이미지 준비 | `laonshop-qa-sandbox:7eb870a2ce4db588742c`, fingerprint `7eb870a2ce4db588742cacae4402c69168167c10b23967437f4f6614f6f1e361`, prepare PASS·exit 0. 이 담당자도 metadata-only summary의 해당 값과 폰트 9개·Latin preload 2개를 직접 대조했습니다. |
| 실제 Playwright 자식 회수 | about:blank 도구 probe에서 실제 PW 직접 자식의 별도 PGID를 확인한 뒤 **200ms 제어 deadline의 AbortSignal 경로**로 중단했습니다. 원 Node SIGKILL, 관측 자손 9개·별도 group 9개 회수 PASS, remaining0이라는 DEV 결과입니다. |
| 독립 PID 비교 | 같은 DEV probe의 별도 PID:starttime 집합이 시작 2개→종료 2개, SHA 동일이며 미관측 잔여0·zombie0이라는 결과입니다. 이 비교는 tracker 자체의 remaining0만 다시 인용한 것과 구분합니다. |
| 내부 wall timer | 위 200ms actual Chrome probe가 내부 wall timer의 만료 경로까지 실행한 것으로 주장하지 않습니다. 내부 timer→KILL은 앞선 별도 자식/손자 실제 probe와 timer·semantic 부정 시험의 다른 증거입니다. |
| 제어기 하니스 | root가 전체 하니스 **88/88, skip0**을 실측했다고 회수했습니다. 제품 unit regression 수나 독립 실행 결과가 아닙니다. |

준비 산출물은 `tests/.generated/2026-11-06T03-27-34.195Z-isolated-0DoHxq/summary.json`이며 rawOutputRetained false입니다. 이 최종 회수 과정에서 제품 애플리케이션·브라우저·DB·PG를 이 담당자가 실행하지 않았고 문서만 갱신했습니다.

이 시점의 독립 소스 검토를 고정했고 다음 clean SHA의 `qa:full`을 대기했습니다. 그 후 실제 실행 결과는 다음 P2 절로 갱신합니다. 이 DEV 증거를 운영 배포·실제 PG 활성화 또는 최종 전체 QA PASS로 보고하면 안 됩니다.

## P2 독립 전체 실행 결과

P2는 Node v22.23.1로 `node scripts/qa/full.mjs`를 직접 실행했습니다. 2026-11-06 03:31:37.045–03:40:37.207 UTC에 실행했으며 **FAIL·exit 1, interrupted false**로 종료됐습니다. 첫 실행처럼 개발 판단으로 중단한 것이 아니라 실패 receipt까지 정상 회수한 실행입니다.

시작·종료 `sourceRef`는 모두 `831ae7055f6c005a5a42db923eb95a4c3dcda879`, `sourceVerified:true`, `sourceChanged:false`입니다. 실행 전·후 사용자 첨부 제외 dirty 0을 확인했고 실행 중 소스·Git·문서를 변경하지 않았습니다. 실제 사용 image ID는 `sha256:8681514fd83768b081f13ddc2165d5fb3a234bf9784053c40ff79b8717644bc8`, tag/fingerprint는 위 `7eb870a2ce4db588742c` 준비 증거와 일치합니다.

| 검사 | P2 실제 결과 |
|---|---|
| pnpm / Trivy | **각 487개·취약점 0 PASS**, development/optional 포함. Trivy v0.74.0·DB 01:07:43 UTC, Trivy secret0. |
| tracked text / 양성 대조 | secret pattern0 PASS. 별도 github-pat canary 양성 PASS(의도한 탐지 exit1). 운영 키나 실제 token을 사용한 시험이 아닙니다. |
| full 안의 qa-harness | exit0. full metadata는 정확 TAP 수를 보존하지 않아 별도 독립 측정으로 보완했습니다. |
| 제품 unit | **202개 중 pass201 / fail1 / skipped0**, TAP 실패 index90, 실제 command exit1. 이미지 검증은 이 test 명령의 `&&` 뒤에 있어 이 경로에서는 미수행이며 별도 PASS로 처리하지 않습니다. |
| lint | **exit1**, WARNING_PRESENT. 실제 원인은 아래 JSON 부분 진단에서 확인했습니다. |
| 타입 / production build | **각 exit0**. build 및 schema 단계의 PRISMA_DEPRECATION·WARNING_PRESENT enum을 보존합니다. warning0이라고 보고하지 않습니다. |
| 서비스 DB / PG route | **37/37, 5/5 PASS**, exact checks·불변조건이 최종 runtime receipt에서 일치합니다. PG는 실제 함수+합성 DB+stub이며 실 PG가 아닙니다. |
| commerce browser | **STAGE_DEADLINE·exit1·timedOut true**. partial 파일은 FAIL·완료41개였습니다. 최종 progress는 index42 / close입니다. 성공 파일이 없어 receipt의 성공 증거 상태는 NOT_RUN·0이며, 실제 suite 미실행을 뜻하는 것으로 해석하지 않습니다. |
| security browser | **STAGE_DEADLINE·exit1·timedOut true**. 성공2개/기대16개, 최종 progress index3 / close, 실패 check index3·Error. 마지막 원장 불변 검사가 미완료라 불변 증명도 없습니다. 원장이 변경됐다는 결론으로 대체하지 않습니다. |
| 폰트·console | 실제 폰트 성공을 포함한 commerce 전체 성공 증거가 없어 수용 완료로 처리하지 않습니다. 두 browser의 consoleErrorCount는 최종 성공 증거에서 회수하지 못한 null이며 오류0이라고 보고하지 않습니다. |
| 프로세스·서비스 | 모든 단계 group cleanup PASS. commerce/security 관측 자손13/15·별도group13/15·remaining0, PostgreSQL stop exit0·pid 파일 부재 및 앱 group 정리 PASS. |
| 격리 | init reaper, lo-only/network none·외부/관리 loopback 차단, UID1000, read-only root/input, socket·운영 자격정보 부재, scratch exec/nosuid/nodev/rw, 메모리·PID·CPU cgroup preflight PASS. |
| 최종 정리 | container/input cleanup PASS. exact container `laonshop-qa-a77ffb95e5332cb8` 전체 목록의 빈 결과·exit0 및 전용 VM `/var/tmp/laonshop-qa-a77ffb95e5332cb8` 부재 test exit0을 별도로 재확인했습니다. |
| 선택 감사 | optionalEvidenceRequested false, securityAuditStatus not-run, securityAuditComplete false. |

실패 때문에 full의 isolated 성공 증명은 성립하지 않습니다. runtime 내부의 source/final SHA는 같았지만 `isolatedSourceVerified:false`를 성공으로 바꾸지 않습니다. raw target 로그·expected/actual·secret은 승격하지 않았습니다.

### 별도 독립 제어기 수치 측정

full 종료 후 같은 `831ae705…`·Node22·정제 환경으로 신뢰된 `node --test tests/qa/*.test.mjs`를 한 번 별도 실행하고 최종 TAP count만 파싱했습니다. 03:42:23.030–03:42:24.525 UTC, exit0, **tests88 / pass88 / fail0 / skipped0 / cancelled0 / todo0**입니다. 이 담당자의 독립 측정이며 이전 root의 DEV88을 합산한 수치가 아닙니다. 제품 애플리케이션의 호스트 실행은 하지 않았습니다.

stdout는 20,566바이트·SHA-256 `a5cfaeffa3cfc4508dfe6541a9d486ece87e3a1e6def226c2636916f47baa52b`, stderr0이며 원문은 저장하지 않았습니다. 이 통과가 제품 unit·lint·브라우저 실패를 상쇄하지 않습니다.

## P2 실패 원인과 수정 소스 검토

P2 정리 이후 root/실행기 담당이 동일 clean SHA에서 수행한 unit·ESLint JSON 전용 진단을 metadata-only summary로 읽었습니다. `PARTIAL_DIAGNOSTIC`, `overallQaPassed:false`, unit202/201/1/skip0, 서비스·컨테이너·입력 정리 PASS입니다. 이것은 DEV 부분 진단이며 독립 전체 QA가 아닙니다.

- unit index90은 `tests/api/kspay-result-security.test.ts:57`의 ERR_ASSERTION입니다. 기본 인자가 `process.env.KSPAY_STORE_ID`인 함수를 undefined로 호출하면서 환경을 제거하지 않고 false를 기대한 기존 시험의 격리 누락이었습니다. 수정은 해당 test에서 환경 없음·심사 MID·실 MID를 분리하고 finally에서 원래 값을 복원합니다. 변경 diff와 `lib/kspay/approval-gate.ts`를 읽어 운영 guard의 변경·허용 범위 확대가 없음을 확인했습니다.
- lint는 `scripts/qa/isolated-process.mjs:68:44`의 `@typescript-eslint/no-unused-expressions`, severity1입니다. max-warnings0 정책에서 실패한 것이며 무시 규칙을 추가하지 않고 같은 신호 전달을 하는 if/else로 바꿨습니다. 소스상 동등 동작을 확인했습니다.
- 두 browser의 공통 원인 후보였던 실제 Playwright 별칭을 이 담당자도 실행 중인 이미지의 공개 `playwright-core/lib/coreBundle.js`에서 읽었습니다. named class `_Browser`, `_BrowserContext2`, `_Page2`, `_Locator`, `_APIRequestContext`, `_Request2`, `_Response` 등은 기존 exact whitelist와 맞지 않습니다. 실제 객체가 wrap 없이 반환돼 일부 response/close 상한이 적용되지 않는 QA helper 결함입니다. mock class 시험 통과만으로 실제 pinned PW 객체의 wrapping을 증명할 수 없었으며, 앞선 소스 검토의 의도된 상한 확인을 실제 동작 보장으로 사용하면 안 됩니다.

unit·lint 수정에서 추가 차단 의견은 발견하지 못했습니다. Playwright alias와 실제 API 보완의 최종 소스·도구 증거는 다음 절에서 회수했습니다. 제품 호스트 실행이나 KSPAY 실 MID guard·계약·서명 변경은 이 검토에서 하지 않았습니다. 이후 새 clean SHA에서 전체 QA를 다시 회수해야 합니다.

| P2 및 부분 진단 산출물 | SHA-256 |
|---|---|
| `tests/.generated/2026-11-06T03-31-37.001Z-full-UR8OKf/summary.json` | `db3141c5d1bcc17a785b6a03c375a45cd25b21fe95de3920424620cf2e6eb82f` |
| `tests/.generated/2026-11-06T03-31-40.093Z-isolated-OIoNB3/summary.json` | `a250162fde168d3c6af681dd4cded28ed9e714facecf4a5a22815a5385e81ad1` |
| `tests/.generated/2026-11-06T03-31-37-074Z-local-security-a18BIn/summary.json` | `8113034813579495d2949ffda44d0876c8f5687fc1a3efb5f7477c74dcf27563` |
| `tests/.generated/2026-11-06-partial-diagnostic/summary.json` | `9fa7e85cf176f6cdc535480b6bdf759d23885b6257a852d4cd73ba1e49770508` |

## P2 이후 alias 보완의 최종 독립 소스 검토

고정된 `browser-qa-support.mjs`·순수 시험, `isolated-evidence.mjs`·runtime·parent wrapper gate를 읽었습니다. 다음 내용을 소스로 확인했으며 추가 차단 의견은 없습니다. **후속 후보의 독립 전체 QA PASS는 아직 아닙니다.**

- 표준 PW kind의 이름만 optional leading underscore 1개·숫자 suffix로 정규화합니다. 임의 접두·다른 이름은 허용하지 않습니다. `prototype.constructor`를 기준으로 판별하고 proxy의 원 constructor·private `_` 필드·symbol은 유지하며 공개 method는 원 receiver로 호출합니다.
- 알 수 없는 API object는 counter를 올리고 즉시 `QA_UNSUPPORTED_PLAYWRIGHT_OBJECT`로 실패합니다. 일반 직렬화 객체·명시된 native data 외의 unknown을 조용히 통과시키지 않으며 원 constructor 이름은 증거에 넣지 않습니다.
- pinned 버전의 route 등록 반환값인 `DisposableStub`은 실제 vendor source와 도구 객체 확인 후 정확 set에 추가했습니다. unknown 전체를 통과시키는 예외가 아니며 dispose는 close 상한으로 처리합니다.
- 양 suite는 원문 대신 kind·alias·operation 수를 별도 atomic wrapper metadata로 기록합니다. runtime은 정규 파일·nlink1·상한·O_NOFOLLOW를 확인해 고정 kind/operation 숫자만 요약합니다. runtime과 parent 양쪽 모두 commerce/security 증거가 PASS, unknown0, Browser/BrowserContext/Page/Locator 각>0, response/close/navigate 각>0이어야 통과합니다. 누락·unknown·미적용 counter를 거절하는 부정 시험을 확인했습니다.
- 초기 이름 그대로인 정상 클래스는 alias 수0이어도 허용하지만 실제 wrapper 종류·operation은 생략할 수 없습니다. 새 alias 수와 시험 수를 P2의 독립88에 소급 합산하지 않습니다.

`tests/.generated/2026-11-06T03-55-39-playwright-wrapper-probe/summary.json`을 metadata-only로 읽고 현재 helper의 SHA-256 `a06167aa9db9b9188cd982c4898ef5bd0a3e5aa33cf4c7f418de2b1af2ba4f16`과 일치를 확인했습니다. summary 자체의 SHA-256은 `295e51e8a88e60480a3fb878eb564464af60238f1f11063e030e0c084e88a300`입니다.

이 산출물은 기존 `7eb870…` 격리 이미지에 새 helper를 복사해 수행한 **DEV의 실제 PW 도구 probe**이며, 제품 앱·DB·운영 자격정보를 사용하지 않습니다. 고정 `1.65.0-alpha-2026-10-30`의 실제 API 10종을 확인했고, alias10·unknown0·외부 요청0, response body를 보류한 실제 `Response.finished` 50ms 상한, `Browser.close` Promise를 의도적으로 정지시킨 50ms 상한을 확인했습니다. 원 close를 복구한 뒤 실제 browser/server 종료 및 container/input cleanup PASS가 기록돼 있습니다. 이 담당자는 probe를 직접 실행한 것이 아니라 준비 코드 hash와 결과 메타데이터를 대조했습니다.

앞선 `tests/.generated/2026-11-06T03-52-43-playwright-wrapper-probe/summary.json`의 DisposableStub 미등록 FAIL은 보존하며 후속 PASS로 덮어쓰지 않습니다. 순수 시험 8개 통과는 구현 담당의 별도 DEV 결과입니다. 실제 PW 객체와 mock class 검증을 구분합니다.

이 단계에서 두 독립 보고서를 고정합니다. 남은 수용 조건은 새 clean SHA의 전체 독립 실행에서 정확한 제어기·제품 unit/skip 수, 이미지 gate, SCA·secret 양성 대조, lint warning0·타입·빌드, DB37/commerce47/security16/PG5, 실제 wrapper·폰트·프로세스·서비스·컨테이너/입력 정리를 함께 회수하는 것입니다. P2 FAIL과 warning·console 결과 미회수는 그대로 유지하며, 배포·실 PG 활성화로 보고하지 않습니다.
