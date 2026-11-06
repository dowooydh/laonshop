# 보안 보완 독립 소스 검토

최신 판정: 제품 P4 `fa2d1aa0b70d07bc2a7522ab9fd8e1fb2a08e060`의 독립 필수 전체 QA는 **PASS/exit0**입니다. source/final/isolated SHA 일치, 제품 unit202/202·skip0, 이미지 gate·lint·타입·build, DB37/상품47/보안16/PG5, SCA487·secret/양성 대조, 실제 wrapper·폰트·정리를 확인했습니다. 같은 SHA의 제어기 별도 독립 측정은 **93/93·skip0**입니다.

**WARN:** 상품 브라우저 consoleErrorCount616은 원문 미분류이며 콘솔 무오류로 보고하지 않습니다. Prisma deprecation·일반 WARNING_PRESENT도 보존합니다. 선택 감사는 not-run/complete false이고 배포·실 PG 활성화는 별도입니다. 최종 QA 문서 커밋 Q의 강화 시험·재검증은 root의 후속 증거이며 P4 독립 실행에 소급 포함하지 않습니다.

최초 후보·P2·P3의 실패와 DEV 인과 실험을 [독립 실행 보고서](2026-11-06-security-independent-execution.md)에 보존했습니다. 아래는 최초 실행 전 소스 검토 범위이며 최신 실행 상태는 위 P4 판정과 실행 보고서를 따릅니다.

## 초기 소스 검토 대상과 판정 범위

- 작성일: 2026-11-06 (KST)
- 저장소: `/Users/donghyuk/Projects/laonshop`
- 브랜치: `codex/security-baseline-20261106`
- 검토 시 기준 HEAD: `de41c604602b3ffd75e1e1cddd42845ca93c42ef`
- 대상: 위 HEAD 이후 작업 트리의 보안 보완 코드와 QA 제어기·시험 코드입니다. **변경이 진행 중이며 최종 제품 SHA는 미정입니다.** 기준 HEAD 자체에 이번 보완이 들어 있다고 해석하면 안 됩니다.
- 담당: 구현 담당과 분리된 독립 소스 검토 담당입니다. 이 문서는 독립 실행 QA 보고서가 아닙니다.

현재 읽은 변경 범위에서 추가 차단 결함은 발견하지 못했습니다. 아래 제품·제어기 검토 의견의 소스 수정도 재확인했습니다. 격리 실행기·추가 PG 시험·최종 의존성 준비 경로의 소스 검토를 완료했습니다. **소스 검토 완료를 실행 PASS·배포 GO·운영 연동 활성화로 판정하지 않습니다.** 최종 커밋에 묶인 격리 실행 증거가 필요합니다.

초기 소스 검토 단계에서는 제품 코드, 환경, DB, Git을 변경하거나 애플리케이션·빌드·시험·브라우저·PG를 실행하지 않았습니다. 이후 승인된 독립 격리 실행과 두 보고서 갱신은 실행 보고서에 별도 기록합니다. 운영·실 PG 실행은 없으며 비밀값, 환경파일 원문, 카드 원문, provider token 및 첨부 이미지는 읽거나 기록하지 않았습니다.

## 적용 지침과 과거 증거

루트 `AGENTS.md`, `AGENT_CONTEXT.md`, `tests/README.md`, `tests/handoff/latest.md`, `.claude/rules/commit.md`를 기준으로 검토했습니다. 적용되는 하위 `AGENTS.md`는 발견하지 못했습니다.

`tests/handoff/latest.md`는 2026-11-04 작성이며 제품 SHA `d62fc447d762cce04132288e83a5a8d4dde3c7e3`에 대한 결과입니다. 그 문서의 카탈로그·배송·후기 QA 수치와 운영 상태를 이번 보안 변경의 현재 증거나 PASS 수치로 재사용하지 않았습니다. 구현 판단은 현재 소스와 diff를 기준으로 했고, 이번 독립 검토에서 운영 상태를 조회하지 않았습니다.

## 소스에서 확인한 보완과 보존 경계

| 영역 | 소스에서 확인한 내용 | 남은 실행 확인 |
|---|---|---|
| 세션과 권한 | `lib/session-security.ts`는 사용자 ID와 현재 비밀번호 hash를 SESSION_SECRET 기반 HMAC으로 결박하고, 쿠키에는 hash 원문 대신 tag를 저장합니다. `lib/auth.ts`의 필수·선택 사용자 조회가 현재 DB 사용자·탈퇴 상태·tag를 검증하며 관리자 역할도 현재 DB 값으로 판단합니다. | 이전 tag·tag 없는 legacy 쿠키·변조 쿠키의 실제 보호 경로 접근 차단 |
| 직접 세션 소비 경로 | `app/mypage/settings/billing/return/route.ts`는 등록카드 기능 준비 상태 및 LAONPAY 조회 전에 현재 사용자와 tag를 확인합니다. 기존 등록 요청·사용자 소유권 검증을 유지합니다. | 오래된 쿠키로 직접 복귀 URL에 접근할 때 provider 호출 및 원장 변경 0 |
| 비밀번호 변경 | `app/mypage/actions.ts`는 이전 hash·역할·미탈퇴 조건을 묶은 `updateMany` CAS로 변경하고, 성공한 현재 요청의 tag를 새 hash에 맞춰 갱신합니다. 새 비밀번호는 bcrypt의 UTF-8 72바이트 경계를 제한하며, 기존 로그인은 별도 1024바이트 상한으로 과거 입력 호환을 유지합니다. | 같은 이전 비밀번호를 이용한 동시 변경, 한글·emoji 경계 및 legacy 로그인 |
| PG 공개 입력 | `lib/security/bounded-form.ts`는 파싱 전 실제 스트림을 32KiB로 제한합니다. Content-Length가 없거나 작아도 실제 수신량을 검사합니다. 지원하지 않는 형식, File, 중요 필드 중복·제어 문자·길이 초과를 거절합니다. callback/result가 DB·승인 처리 전에 이 검증을 적용합니다. | 실제 HTTP 400/413/415, 취소·정상 브릿지 및 초과 스트림 종료 |
| PG 결과미상 | `lib/kspay/kspay-provider.ts`는 공급사 응답 스트림에도 상한을 적용합니다. 성공 금액 누락·비정수·0·범위 초과를 요청 금액으로 채우지 않고 예외로 처리합니다. 정의되지 않은 승인 상태도 예외로 처리합니다. | 해당 예외에서 PENDING·처리 마커가 유지되고 다음 요청으로 재승인되지 않는지 |
| 결제 신뢰 경계 | 기존 결과 HMAC·주문번호/금액 결박·advisory lock·처리 마커·서버 금액 계산을 바꾸지 않았습니다. callback의 부모창 호출과 JavaScript escaping, 정상 X 거절 경로를 보존했습니다. 일반 KSPAY와 LAONPAY 등록카드 경로의 역할을 합치지 않았습니다. | 정상 성공·명시 거절·취소·중복·다른 주문·과거 주문 회귀 |
| 의존성과 프레임워크 | Next·sharp·Zod 및 전이 의존성 보완과 Zod 4의 `issues`·literal 오류 설정 변경을 확인했습니다. 소스 검토만으로 Linux native 모듈·실제 lockfile 취약점 0을 증명하지 않습니다. | 최종 lockfile 대상 개발 의존성 포함 SCA, Zod 오류·정상 흐름, lint·타입·production build |
| 응답 헤더 | `next.config.ts`의 nosniff와 strict-origin-when-cross-origin을 확인했습니다. 기존 PG iframe 경로에 영향을 줄 수 있는 새 blanket frame 제한은 추가하지 않았습니다. | 실제 배포 응답 및 결제창 경로 호환 |

비밀번호 tag 도입에 따른 legacy 쿠키의 재로그인은 의도된 동작입니다. 이미 열린 일반 인증결제의 결과 승인은 로그인 쿠키 대신 기존 결과 서명을 사용하며, 이 경계는 소스상 유지됩니다. 실제 과거 주문·열린 결제창 호환을 실행 검증했다는 뜻은 아닙니다.

## 검토 의견과 재확인

| 의견 | 최초 분류 | 재확인한 조치 | 판정 |
|---|---|---|---|
| 뜻이 불명확한 `authyn`을 단순 false로 해석하면 실패 확정 뒤 재시도가 허용될 수 있음 | 공급사 정상 거절 계약 확인이 필요한 정확성 후보였습니다. 확인 전 심각도를 부여하지 않았습니다. | `lib/kspay/kspay-provider.ts:174`에서 대문자 O/X만 허용하고 나머지는 throw합니다. 정상 X는 false를 유지합니다. `tests/api/kspay-transport.test.ts`에 미정 상태 및 정상 X 시험이 있습니다. 구현 담당이 확인한 공식 O/X 계약은 이 검토 담당이 실 PG 호출로 검증한 것은 아닙니다. | 소스 조치 확인, 실행 미검증 |
| 선택 전체 감사의 소스 범위에서 install/build에 영향을 주는 `pnpm-workspace.yaml` 누락 | 선택 감사가 전체 범위를 확인했다고 주장할 때의 증거 결함 | `scripts/qa/security.mjs:97`의 범위에 workspace, npm/env 예시, 배포·도구 설정을 포함합니다. `tests/qa/security.test.mjs`에는 설정 하나씩을 누락시킨 BLOCKED 시험이 있습니다. | 소스 조치 확인, 실행 미검증 |
| `pnpm audit`가 전체 텍스트 snapshot에서 프로젝트 설정·hook을 읽을 가능성 | 현재 저장소에는 해당 `.npmrc`·`.pnpmfile.cjs`가 없어 확인된 제품 취약점이 아닌 방어 보완 의견 | `scripts/qa/local-security.mjs:107`의 `createAuditSnapshot`이 dependency 필드만 가진 manifest와 lock/workspace를 별도 디렉터리에 복사합니다. 프로젝트 npmrc·pnpmfile·scripts·package 내 감사 제외 설정을 반입하지 않는 시험이 추가됐습니다. Trivy의 전체 tracked 텍스트 snapshot은 유지됩니다. workspace의 allowBuilds·overrides와 추가된 verifyDepsBeforeRun 설정을 구분하며, 감사 제외 설정은 발견하지 못했습니다. | 현재 소스의 의견 해소, 실행 미검증 |

세 번째 보완과 함께 `scripts/qa/full.mjs:19`는 local-security를 `pnpm run/exec` 대신 Node로 직접 호출하며, `tests/qa/full.test.mjs`에도 이 계획의 시험이 있습니다. 이는 부모 제어 단계의 불필요한 package script·자동 설치 경계를 줄인 소스 변경입니다. 격리 실행기 내부의 설치·실행·네트워크 경계는 아래 별도 후속 검토 범위입니다.

## 기본 QA와 선택 추가 감사

현재 `fullPlan()`은 기본 필수 단계로 local-security → QA 제어기 시험 → isolated를 계획합니다. 기본 명령에서 PentAGI·Cloudflare 감사가 실행되지 않은 것은 `not-run`, 완료 여부 false로 남겨야 하며, 기본 보안 회귀를 생략할 근거가 되지 않습니다.

`--security-evidence`를 명시하면 추가 감사 증거 단계가 포함됩니다. 명시된 증거가 없거나 현재 SHA·전체 범위·완료 조건을 충족하지 못할 때 기본 모드로 강등해서 PASS시키지 않는 검증 흐름과 시험 코드를 확인했습니다. 시작·종료 소스 식별, 필수 격리 단계 receipt, cleanup, 중단·실패 전파도 소스에서 검토했습니다. 이 담당자는 PentAGI·Cloudflare를 실행하거나 외부 감사 결과를 회수하지 않았습니다.

## 최종 격리 실행에서 필요한 확인

1. 실제 HTTP에서 로그인, legacy 재로그인, 비밀번호 변경 후 현재 쿠키 갱신, 복사한 이전 쿠키 차단을 확인해야 합니다. 보호 페이지뿐 아니라 직접 등록카드 복귀 URL도 포함하고, 거절 시 provider 호출·원장 변경이 없어야 합니다.
2. 같은 이전 hash로 시작한 비밀번호 변경 두 건에서 하나만 성공하고 패배한 요청이 hash/tag를 덮어쓰지 않아야 합니다. UTF-8 72바이트의 한글·emoji 경계와 기존 72바이트 초과 로그인도 확인해야 합니다.
3. 실제 PG callback/result HTTP에서 정상 브릿지, 취소, 중복 필드, File, 잘못된 형식, 필드 초과, Content-Length 없는 초과 스트림을 확인해야 합니다. 부정 입력은 PG 호출·주문/재고 변경 없이 종료해야 합니다.
4. 모의 공급사 응답으로 정상 O/X, 주문·금액 불일치, 금액 누락·비정수·범위 초과, 미정 상태 및 응답 초과를 확인해야 합니다. 결과미상 상태는 PENDING·처리 마커를 유지하며 두 번째 요청도 재승인하지 않아야 합니다.
5. Zod 4에 영향을 받는 동의·주소·주문·관리자 확인의 정상·오류 흐름과 기존 소유권·중복 결제 회귀를 실행해야 합니다. Linux에서 sharp 포함 설치·테스트·lint·타입·production build·브라우저를 확인해야 합니다.
6. 최종 제품 SHA와 일치하는 SCA·secrets 결과, 격리 실행 receipt, 시작·종료 소스 식별 및 cleanup 결과가 필요합니다. 시험 코드가 있다는 사실이나 자식 프로세스 exit 0만으로 PASS시키면 안 됩니다.

격리 실행기의 후속 소스 검토는 다음 절에 기록합니다. 최종 SHA의 실제 실행 결과에 대한 독립 검증은 아직 미완료입니다.

## 후속 소스 검토: 격리 실행기와 PG route 시험

2026-11-06에 구현 담당자가 검토 가능 통지한 `scripts/qa/isolated.mjs`, `isolated-runtime.mjs`, `isolated-evidence.mjs`, `Dockerfile.isolated`, `tests/qa/isolated.test.mjs`, `tests/integration/security-browser-qa.mjs`, `security-pg-route-qa.mjs`를 추가로 읽었습니다. 이 절은 실행기 소스 검토의 후속 결과입니다. 초기 의존성 준비 오류에 대한 최종 경로와 실제 로그인 시험 추가까지 재확인했습니다. 최종 SHA·이미지 준비 실행·실제 전체 QA 결과의 독립 검증은 여전히 미완료입니다.

| 확인 축 | 최종 소스에서 확인한 경계 |
|---|---|
| 자격정보와 데이터 | 부모는 선택한 Docker context와 Colima profile만 사용하고 운영 환경변수 원문을 자식에 넘기지 않습니다. 소스는 clean SHA의 `git archive`이며 추적된 symlink·submodule을 거절합니다. 컨테이너 entrypoint는 `env -i`로 시작하고 런타임은 합성 비밀값·loopback DB·테스트 MID·비활성 등록카드 설정만 구성합니다. 호스트 홈·Docker socket을 target에 mount하지 않습니다. |
| 준비와 target 실행 | 이미지 준비 단계에는 manifest·lock·workspace·검사된 Prisma schema·제어기·폰트만 복사합니다. 연결 가능한 준비 단계에서 설치할 수 있는 대상과, 네트워크 없는 target 실행을 구분합니다. 최종 Docker 경로는 `/scratch/source`·`/scratch/pnpm-store`에서 설치·Prisma 준비를 한 RUN 안에 수행해 /opt로 보존합니다. target은 store와 node_modules를 한 `cp -a` 호출로 복원해 디렉터리 사이 hardlink를 유지하고 registry metadata cache도 scratch로 복원한 뒤 `--offline --frozen-lockfile --ignore-scripts`로 명시 설치합니다. 구현 담당자의 offline exit0·registry 시도0 사전 probe 보고와 이 담당자의 독립 실행 검증은 구분하며, 후자는 아직 하지 않았습니다. |
| 네트워크와 권한 | target은 network none, 포트 공개 없음, non-root 1000:1000, read-only root/input, cap-drop ALL, no-new-privileges를 사용합니다. 외부 연결·관리 loopback 차단, lo만 존재, socket·호스트 홈 부재를 preflight에서 확인합니다. 브라우저 provider 차단 카운터는 브라우저 요청 계측이며 서버 내부 호출 계측으로 해석하지 않습니다. |
| 자원과 시간 | CPU 2개, 메모리/스왑 3584MiB, pids 256, scratch tmpfs 2GiB, 파일·프로세스·CPU ulimit을 설정합니다. 런타임은 실제 cgroup과 scratch 용량을 검사하며 부모도 inspect를 대조합니다. 단계별 10분·부모 target 20분 제한과 owned container 중단 경로가 있습니다. scratch는 CLI·Prisma native 실행을 위해 exec를 명시하며 nosuid·nodev를 유지합니다. 런타임이 `/proc/mounts`에서 exec/nosuid/nodev/rw를 확인하고 부모도 네 필드가 모두 true인 receipt를 요구하며 각 필드를 누락시키는 부정 시험이 있습니다. 읽기 전용 root/input, network none, non-root·cap 제한은 그대로입니다. 이 경계를 scratch noexec 또는 임의 target의 완전한 악성코드 격리로 표현하면 안 됩니다. |
| 출력 | target stdout/stderr는 byte 수·SHA로만 남기며 warning enum·실패 TAP 번호·구조화된 타입 오류 위치/코드를 요약합니다. 원문 진단은 disposable scratch에 남겨 컨테이너와 함께 제거합니다. evidence는 체크명·오류 문자열을 그대로 승격하지 않고 고정 기대값과의 일치 수·enum·불변조건으로 요약합니다. 준비 단계의 도구 실패 진단은 별도로 취급합니다. |
| 판정 | 필수 실제 단계 8종과 성공 코드를 확인합니다. unit TAP tests>0, pass=tests, fail0, skip0가 필요하고 lint는 max-warnings0입니다. 서비스·브라우저·보안 브라우저·PG route 증거 4종은 현재 기대 체크 37/46/16/5개와 정확히 일치해야 합니다. 파일 누락·FAIL·잘못된 개수·불변조건 누락은 exit 0만으로 PASS할 수 없습니다. 런타임과 부모 양쪽에서 검사합니다. |
| 정리와 중단 | 정상 결과는 owned container 부재·owned VM input 부재를 실제 확인한 뒤에만 PASS합니다. main 전체 SIGINT/SIGTERM handler와 단계 사이 중단 점검이 추가돼 중간 전송·검증 단계도 cleanup 경로로 수렴합니다. 이름이 제한된 이 실행의 리소스만 삭제합니다. SIGKILL·호스트/VM 강제 종료 같은 복구 불가능한 중단의 자동 정리를 증명하는 것은 아닙니다. |
| 소스·이미지 식별 | 시작·종료 clean SHA가 같아야 합니다. dependency/config/schema/controller/helper와 실제 폰트 response·WOFF2 digest가 이미지 fingerprint에 포함됩니다. 실행 전 이미지 label을 확인하고 결과에 실제 image ID를 기록합니다. 폰트는 기존 로컬 build cache의 실제 자산이며 원래 취득 시점 provenance의 한계도 명시합니다. |
| 감사 구분 | 결과는 ordinary isolated QA이며 PentAGI·Cloudflare 감사 완료 또는 promotion receipt가 아니라고 명시합니다. 선택 외부 감사를 완료한 것으로 승격하지 않습니다. |

초기 실행기에서 발견한 다음 의견은 소스상 수정됐습니다. 실행 PASS로 처리하지 않습니다.

- 증거 파일이 없거나 FAIL이어도 단계 exit 0만으로 PASS할 수 있었던 경로에 4종 exact evidence·불변조건 gate와 부정 시험이 추가됐습니다.
- warning·실패 테스트명·오류 message의 target 원문 전달을 enum·번호·제한된 구조화 정보로 바꿨습니다.
- capture 외부 단계의 신호 처리 공백에 main 수명의 handler와 중단 점검을 추가했습니다.
- `/mypage` 거절로 쿠키가 지워진 뒤 hosted return을 검사하던 시험을 별도 oldCookie context로 분리하고 쿠키 값을 확인합니다.
- unit TAP count/skip 및 lint warning 판정을 명시했으며, 새 evidence helper·실제 폰트 자산까지 이미지 식별 입력에 결박했습니다.

최종 보안 브라우저 시험에는 실제 로그인 액션으로 이전 비밀번호를 거절하고 새 비밀번호를 수락한 뒤 현재 hash에 결박된 쿠키를 발급하는 검사가 추가됐습니다. 합성 사용자만 사용하며, 이로 인해 보안 브라우저의 고정 기대 체크는 15개에서 16개로 늘었습니다.

추가 PG 시험은 실제 `result.POST`와 disposable PostgreSQL을 사용합니다. `globalThis.fetch`는 정확한 recv_post.jsp 주소의 in-process stub에만 응답하고, 예상 외 URL·동작은 원래 fetch로 전달하지 않고 거절합니다. Linux/non-root/loopback·격리 DB·합성 secret·테스트 MID·비활성 운영 gate를 먼저 확인합니다.

금액 누락, 금액 불일치, 미정 authyn, 정상 X 거절 각각에 대해 병렬 두 요청과 재전송 한 요청을 실행하도록 구성했습니다. 각 case의 stub 호출은 한 번이어야 하며, 결과미상 3종은 PENDING·처리 마커 유지, X는 FAILED·마커 제거, 금액·소유권·결제 필드·재고 불변을 확인합니다. 정확히 이 실행이 만든 fixture만 정리하고 기존 결제 원장·개수의 동일성을 확인합니다. 이로써 기존 단위 시험과 소스 결합만 있던 경로의 통합 실행 공백을 보완했습니다. **HTTP 어댑터·실 PG 승인·취소·실제 공급사 호환을 검증하는 시험은 아닙니다.** 실행 결과는 최종 SHA QA에서 회수해야 합니다.

## 유지되는 한계와 운영 상태

- 로그아웃은 현재 브라우저 쿠키를 제거하지만 이미 복사된 유효 쿠키를 서버에서 폐기하는 별도 세션 저장소는 없습니다. 비밀번호 변경에 따른 tag 폐기와 구분해야 합니다.
- 로그인 횟수 제한은 인스턴스별 메모리에 있으며 분산·전역 제한을 증명하지 않습니다. 이번 보완으로 해소됐다고 보고하면 안 됩니다.
- 이 독립 검토에는 최종 제품·QA 커밋, 실행 PASS 수치, 실제 PG 승인·취소, 운영 DB/스키마/환경 변경, 배포 또는 배포 후 확인 결과가 없습니다. 운영 활성화 여부도 미확인입니다.

최종 보고에서는 이 문서의 독립 소스 검토, DEV 자체 검증, 독립 격리 실행 QA, 선택 외부 감사, 운영 배포·공개 확인을 각각 구분해야 합니다.
