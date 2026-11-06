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

## 배포 시 영향·남는 범위

- 기존 로그인 쿠키는 새 credentialTag가 없어 배포 후 한 번 다시 로그인해야 한다. 비밀번호 변경 후 복사한 이전 쿠키는 거절된다.
- 로그아웃은 현재 브라우저 쿠키 폐기다. 복사된 쿠키의 전역 서버 폐기와 인스턴스 간 로그인 속도 제한은 이번 DB/인프라 변경 없이 해결했다고 표시하지 않는다.
- 실제 PG 승인·취소·카드 등록·운영 DB/환경/키 변경은 수행하지 않는다. 격리 QA와 공개 GET 확인만으로 실 PG 상호운용 완료를 주장하지 않는다.
- 기존 11월4일 React#418 미재현 WARN, WebKit RSC 경고·실기기 미실행은 과거 기록으로 보존한다. 이번 수정의 해결 대상으로 소급 표시하지 않는다.
- 전체 소스 침투 감사·운영 컨테이너 이미지/모든 외부 도구 공급망 감사·분산 인프라 보장은 이번 기본 QA 범위가 아니다.
