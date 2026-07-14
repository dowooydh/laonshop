# QA 핸드오프 최신본

작성일: 2026-07-14

담당: Codex QA/테스트 세션

대상: `main` / `328ee874f8c6b681ad386b561888ed6d6c69486d`

비교 범위: `8a51fc42fad6652b37140e03c5256117764cbc85..328ee874f8c6b681ad386b561888ed6d6c69486d`

결과: **PASS**

출시 판정: **GO - 카드 삭제 통신 실패·500 복구와 소유권 회귀 통과**

## 요약

- 제품 코드는 수정하지 않았습니다.
- Node 22.23.1 + pnpm 11.5.3에서 test 34/34, skip 0, 이미지 파이프라인 1/1, lint, typecheck, Prisma validate, production audit, build, diff check를 통과했습니다.
- 실제 Server Action POST를 abort와 HTTP 500으로 주입해 카드 행·DB count 유지, `role=alert`, `aria-busy` 종료, 삭제 버튼 재활성을 확인했습니다.
- 네트워크 복구 후 같은 버튼 재시도는 alert를 제거하고 DB 카드를 정확히 1건만 삭제했습니다.
- 빠른 이중 클릭은 POST 2회가 발생했지만 조건부 `deleteMany(id,userId)`로 DB 부작용은 한 번뿐이었습니다.
- 타인 `cardId` 직접 Server Action 호출은 응답 200 뒤에도 foreign card를 DB에 보존해 IDOR를 차단했습니다.
- 320/390/412px·200%에서 문서 overflow와 가시 요소 이탈 0, alert·삭제 중 버튼 clipping 0, 44px 타깃을 확인했습니다.
- 상세 보고서: [2026-07-14 `328ee87` 카드 삭제 실패 복구 회귀 QA 보고서](../reports/2026-07-14-328ee87-card-delete-recovery-regression/report.md)

## 핵심 결과

| 영역 | 결과 | 실제 증거 |
| --- | --- | --- |
| 정적 검증 | PASS | test 34/34, pipeline 1/1, lint/typecheck/prisma/audit/build/diff check PASS |
| offline/abort | PASS | 행·DB 보존, alert 표시, busy 종료, 버튼 재활성 |
| HTTP 500 | PASS | 행·DB 보존, alert 표시, busy 종료, 버튼 재활성 |
| 복구 재시도 | PASS | alert 제거, 카드 정확히 1건 삭제 |
| 빠른 이중 클릭 | PASS | POST 2회, 조건부 삭제 부작용 1회, owner cards 0 |
| IDOR | PASS | 타인 cardId 직접 호출 후 foreign card DB 보존 |
| 모바일·200% | PASS | 320/390/412px overflow·clipping 0, 버튼 높이 44px |
| 결제 경계 | PASS | 신규 카드 입력 0, oneclick 차단·KSPAY 경계 변경 없음 |
| 운영 배포 | PASS | Vercel READY, production SHA `328ee87`, 최근 1시간 runtime 오류 0 |

## 결함과 위험

- 신규 제품 결함은 발견하지 못했습니다.
- 빠른 이중 클릭은 HTTP 요청 자체를 2회 보냅니다. 현재 조건부 삭제가 멱등이라 부작용은 한 번이며 출시 차단은 아닙니다.
- 응답 유실 시 보수적 문구 뒤 재시도·새로고침으로 최종 서버 상태를 확인하는 정책입니다.
- 실 PG 승인·취소·영수증과 Safari/WebKit/iOS 실제 기기는 실행하지 않았습니다.

## cleanup

- 일회용 QA 사용자 2명과 mock 카드 4개를 모두 정리했습니다.
- 최종 DB `users 10 / cards 4 / orders 9 / items 9 / audits 0 / wishlists 0`으로 시작 기준선과 일치합니다.
- 로컬 3003 서버와 임시 fixture·브라우저 스크립트·credential 파일을 삭제했습니다.
- 운영·마스터 데이터, Vercel 설정, 실 PG 상태 변경은 없습니다.

## 개발 회귀 요청

제품 커밋 `328ee87`을 출시 후보로 유지합니다. 향후 카드 삭제가 비멱등 외부 해지 호출을 포함하면 클릭 잠금 외에 요청 단위 멱등키·dedupe를 추가 검토합니다.
