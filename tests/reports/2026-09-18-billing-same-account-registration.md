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

`357f85a4e1b069a0dec7294a6aa4f070132ff78c`의 main 자동 배포 `dpl_Hu7UdhtenBvPSCBD8nCP8eARxVNK`가 READY이고 운영 두 도메인 alias에 적용됨을 확인했다. 동일 Chrome 로그인 세션에서 새 카드 입력 화면 진입을 검증했다. AWS LAONPAY는 기존 `0e250e3`를 유지했다.

## 등록 링크 만료 확인과 실제 등록 완료

- 첫 요청은 21:21:43 KST 생성·21:31:43 만료였다. 22시 사용자 문의 후 LAONPAY read-only 조회에서 EXPIRED/INTENT_EXPIRED·REGISTER operation 0·카드 0·청구 0을 확인했다. 15자리 지원 거절이 아니라 발급 요청 전 링크 만료였다.
- 라온샵의 등록 복귀 쿠키도 등록 링크 유효시간과 함께 만료되므로 늦게 돌아오면 `invalid` 안내가 표시되는 코드 경로와 일치한다. 인증·쿠키 대조를 완화하지 않고 안내에 만료 가능성과 기존 요청 상태 확인 버튼을 명시했다. API로 확정된 EXPIRED에는 만료 종료 및 새 등록 방법을 표시한다.
- `등록 절차 이어서 확인`으로 정상 서명 GET을 수행해 기존 요청의 만료 상태를 반영한 뒤 명시적 새 등록 1회를 실행했다. 과거 7월 UNKNOWN은 보존했다.
- 22:01 KST 생성된 새 링크에서 사용자가 15자리 카드 등록 완료를 알렸다. LAONPAY는 registration SUCCEEDED, BAUM REGISTER SUCCEEDED 1건, ACTIVE method 1개, 암호화 token 존재, BillingCharge 0을 반환했다. 과거 UNKNOWN과 operation의 전체 내용 digest는 변경되지 않았다.
- 라온샵 복귀 화면에도 `카드 등록이 완료되었습니다` 및 마스킹 카드 1개의 `사용 가능`을 확인했다. 실제 카드정보·token은 출력하거나 저장하지 않았다.
- 성공 후 남아 있는 과거 요청 안내를 현재 사용 가능한 카드와 구분하도록 문구를 보완했다. 이번 실제 등록 성공은 등록카드 청구·전체취소·해지·실통보 검증을 포함하지 않는다.

만료/성공 안내 문구 후속 변경도 관련 검사 157/157·변경 3개 파일 lint·운영 설정 없는 자체 DB production build를 통과했다. 인증·소유권·복귀 쿠키 검증이나 PG 호출 조건은 변경하지 않았다. 자체 QA DB는 종료·삭제했다.
