# 보안·통합 QA 실행 계약

기준일: 2026-11-06. LAONPAY 참고 구현의 최신 `70ef85e` 결정에 맞춰 **필수 기본 QA**와 **선택 추가 보안 감사**를 구분한다. 다른 저장소의 코드·운영 설정은 수정하지 않는다.

## 필수 기본 QA

Node 22.x / pnpm 11.5.3을 사용한다. 운영 환경파일을 읽거나 애플리케이션을 호스트에서 실행하지 않고 다음 컨트롤러를 직접 실행한다.

```bash
node scripts/qa/full.mjs
```

1. `local-security`: Git 추적 소스의 비밀값 검사·진입점/민감 연산 목록, 개발·선택 의존성을 포함한 pnpm audit 및 Trivy 취약점/비밀값 검사. pnpm audit에는 최소 manifest·lock·workspace만 전달하며 프로젝트 hooks·lifecycle·개인 npm 설정을 전달하지 않는다. 정규식 목록은 수동 소스 전수 감사 완료 증거가 아니다.
2. `qa-harness`: 판정기·증거·중단·누락·SHA·격리 조건의 부정 시험.
3. `isolated`: 깨끗한 HEAD의 Git archive만 네트워크 없는 전용 컨테이너로 전달한다. 제품 test(이미지 게이트 포함), lint, typecheck, production build, 로컬 합성 PostgreSQL의 서비스/HTTP/브라우저 검사를 모두 수행한다. KSPAY·LAONPAY·Neon에 연결하지 않는다.

시작·종료·격리 실행 SHA가 모두 같아야 한다. 사용자 `.codex-attachments/`와 ignored `tests/.generated/`를 제외한 미커밋 소스는 차단한다. 검증 기준 로컬 커밋은 만들 수 있으나 통과 전 푸시하지 않는다. 누락·중단·시간 초과·격리 준비 실패·정리 실패를 PASS로 바꾸지 않는다. 실패 후 가능한 독립 단계는 계속 실행한다. 종료 코드는 PASS `0`, FAIL `1`, BLOCKED `2`, 중단 `130`이다.

`scope=required-qa`, `securityAuditRequested=false`, `securityAuditStatus=not-run`, `securityAuditComplete=false`는 기본 실행의 정상 표기다. 기본 성공을 침투 감사나 모든 소스의 안전성 보증으로 해석하지 않는다.

## 전용 실행 환경 준비

Docker context `colima-laonshop-security-20261106` / profile `laonshop-security-20261106`만 사용한다. 공유 프로필·Docker 기본 context·브라우저를 변경하지 않는다. 이 프로필은 host mount·SSH agent 없는 전용 VM이며, 실행 전 명시적으로 준비해야 한다. 실행기는 VM을 임의로 시작하거나 네트워크 격리를 완화하지 않는다.

```bash
colima start --profile laonshop-security-20261106 --activate=false --mount none --ssh-agent=false --ssh-config=false --template=false --cpu 2 --memory 4 --disk 12 --root-disk 8 --vm-type vz
node scripts/qa/isolated.mjs --prepare
node scripts/qa/full.mjs
```

`--prepare`만 공식 도구·고정 lock 의존성 다운로드를 허용한다. 앱 코드·운영 자격정보는 빌드 컨텍스트에 넣지 않는다. 이미지 fingerprint는 의존성·schema·폰트 명세·실행기를 결박한다. Next Google 폰트는 같은 명세의 기존 실제 WOFF2 자산을 오프라인 캐시로 사용하고 해시를 기록한다. 빈 폰트로 대체하거나 production 제품 설정을 바꾸지 않는다. `verifyDepsBeforeRun: error`로 pnpm run/exec의 묵시적 설치를 차단하며, 명시적 캐시 설치만 격리 준비 단계에 허용한다.

제품 실행은 uid1000, readonly root/input, 쓰기 가능 `/scratch` 2GiB, network none, CPU2·메모리3584MiB·PID256·20분 wall timeout을 적용한다. scratch는 CLI·Prisma native 실행을 위해 exec이며 nosuid/nodev를 유지한다. 관리 소켓·홈·운영 env 부재와 실제 격리를 검사한다. 실행 후 자기 컨테이너·VM 임시 입력 삭제를 확인한 뒤에만 정리 PASS를 기록한다. 프로필·다른 컨테이너·운영 데이터는 삭제하지 않는다. 원시 테스트 출력·합성 비밀번호·쿠키·DB URL을 증거로 승격하지 않고 검사 이름·건수·해시·상태만 보관한다.

## 선택 추가 감사

PentAGI와 Cloudflare는 사용자가 요청한 경우에만 다음 엄격한 추가 게이트로 검증한다.

```bash
node scripts/qa/full.mjs --security-evidence /absolute/path/outside-repository
```

이 경우 `scope=required-qa-and-security-audit`이며 동일 SHA의 PentAGI 3역할 흐름, Cloudflare 공식 완료/보고 검증기, 독립 검토, 증거 파일 해시가 모두 필요하다. 상세 schema는 `scripts/qa/security.mjs`와 부정 시험을 따른다. 파일 존재·이전 SHA·부분 실행·도구 설치·스킬 문서 열람은 감사 완료 증거가 아니다. 누락/차단 시 기본 단계가 성공해도 전체 성공이 아니다. 안전 거절·네트워크/디스크/시간 실패는 N/A로 바꾸거나 다른 경로로 우회하지 않는다.

## 결과 인계

DEV 수정·자체 검증, 독립 소스 검토, 최종 SHA의 독립 실행, 운영 배포/공개 GET 확인, 실제 외부 결제 연동은 따로 기록한다. 운영 로그인·결제·카드 등록·DB/스키마·환경·키·기능 게이트 변경은 기본 QA나 코드 배포 승인에 포함되지 않는다. 기존 미정 결제 재승인 차단·소유권·서버 금액·과거 주문 호환은 회귀 대상이다.
