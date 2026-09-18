# 같은 계정의 카드 등록 재개

## 범위와 원인

사용자가 LAONPAY 15자리 카드 등록 시험을 승인하고 LAONSHOP에 로그인했다. 해당 계정에는 7월의 UNKNOWN 등록이 남아 있어 기존 시작 버튼이 그 요청만 조회했다. 운영 등록 기능은 해당 시험 계정만 허용되어 있으므로 다른 계정 안내가 해결책이 아니었다.

LAONPAY의 현재 서버 계약은 미확정 Baum REGISTER 작업을 차단하지만 provider가 지정되지 않은 과거 등록을 같은 방식으로 차단하지 않는다. 이 정책을 LAONSHOP에서 추정하거나 우회하지 않고 정상 서명 API가 신규 요청 가능 여부를 판단하도록 연결한다.

## 변경

- 기존 `등록 절차 이어서 확인`은 같은 요청 조회를 유지한다. 본인 UNKNOWN 원격 요청이 있고 카드가 없을 때만 `새 카드 등록 요청`을 표시한다.
- 명시적 새 요청은 feature/소유권/요청 fingerprint/원격 ID·UNKNOWN/카드 미존재를 확인한다. 사용자별 트랜잭션 잠금 안에서 상태를 다시 확인하고 진행 중 요청·동시 제출을 차단한다.
- 기존 원장은 그대로 두고 신규 멱등키로 LAONPAY registration-intents API를 호출한다. PAN·provider token·PG 자격정보를 LAONSHOP에 전달하지 않는다.
- LAONPAY가 새 intent 생성 자체를 `409 REGISTRATION_UNRESOLVED`로 거절하면 외부 ID 없는 신규 시작 행만 DECLINED로 종료한다. 과거 UNKNOWN이나 이미 발급을 시도한 원장은 변경하지 않는다.
- 응답 유실 시 기존 동일 키 대사 1회 정책, 청구·해지·취소 차단, 운영 allowlist·키·schema는 보존한다.

## 검증

- Node 22.23.1 / pnpm 11.5.3. 운영 `.env`를 복사하지 않은 별도 소스 snapshot에서 실행했다.
- API 및 파트너 HTTP lifecycle 검사 **157/157 PASS**. 신규 Server Action 검사 17개는 실제 action을 실행하고 DB/HTTP 경계만 대체한다. 소유권·상태 변화·동시 제출·명시적 거절·응답 유실·과거 원장 불변을 포함한다.
- 변경 TS/TSX 및 신규 테스트 ESLint PASS, diff 공백 검사 PASS.
- 이미지 무결성, Next.js production build의 타입·lint·페이지 생성 PASS. 첫 빌드는 비연결 테스트 DB 주소 때문에 sitemap 생성에서 중단됐고, 자체 임시 PostgreSQL과 빈 schema를 준비한 재검증에서 완료했다. 운영 DB에는 접속하지 않았다. 임시 DB는 종료·삭제했다.
- 기존 Prisma package.json 설정 deprecation 안내는 기존 구성에서 발생하며 이번 기능 오류가 아니다. 메이저 업그레이드는 수행하지 않았다.

## 배포와 실제 시험

이 보고서 작성 시점에는 코드 검증을 완료했다. main 자동 배포 후 동일 로그인 세션에서 새 카드 입력 화면 진입을 확인한다. 화면 진입은 실제 15자리 카드의 빌링키 발급 성공을 뜻하지 않으며 사용자가 카드 정보를 직접 입력한 뒤 LAONPAY 등록 결과를 확인해야 한다. 실제 청구·송금은 이번 시험 범위가 아니다.
