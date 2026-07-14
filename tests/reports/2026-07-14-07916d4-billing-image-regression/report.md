# 07916d4 원클릭 차단·상품 이미지 회귀 QA 보고서

작성일: 2026-07-14

담당: Codex QA/테스트 세션

대상 제품 커밋: `07916d402c8bea72668ae8ddbeac682a7b963fc2`

제품 변경 커밋:

- `877992787071fc197540701122311dd6f0b36c5e` - 미연동 원클릭 결제 경로 차단
- `07916d402c8bea72668ae8ddbeac682a7b963fc2` - 상품 이미지 원본 비율 복원

비교 범위: `30321c1b2450524fda2a79e8b493ce4dbe931673..07916d402c8bea72668ae8ddbeac682a7b963fc2`

결과: **PASS**

출시 판정: **GO - 미연동 원클릭 차단과 원본 상품 이미지 전환 회귀 통과**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 테스트 전용 Neon 데이터에만 일회용 사용자·카드·주문 fixture를 생성했고 종료 시 기준선으로 복구했습니다.
- KSPAY 인증결제는 로컬 폼 생성까지만 확인했습니다. 결제창 외부 승인, 실카드, 운영 DB 쓰기는 실행하지 않았습니다.
- 운영에서는 공개 상품 목록·상세와 Vercel 배포·오류 상태만 읽기 검증했습니다.
- secret, 카드 원문, 세션 쿠키, 환경변수 실제 값은 출력하거나 문서화하지 않았습니다.

## 저장소·배포 기준

- 검증 시작 시 `HEAD=origin/main=07916d402c8bea72668ae8ddbeac682a7b963fc2`, 브랜치는 `main`, 작업 트리는 clean이었습니다.
- Vercel deployment `dpl_EEQtYQTYaam8XjS17wDMfYPrnGrr`는 `READY`, target `production`, Git SHA `07916d4`였습니다.
- `laonshop.com`, `www.laonshop.com` 별칭이 위 배포에 연결돼 있습니다.
- 최근 1시간 Vercel runtime error cluster는 0건이고 해당 배포의 error/fatal 로그도 0건입니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3에서 실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 33/33, fail 0, skip 0 |
| 이미지 파이프라인 단위 테스트 | PASS | `python3 -m unittest tests/scripts/test_image_pipeline.py`, 1/1 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 구조 변경 없음 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |
| `git diff --check` | PASS | whitespace 오류 0 |
| 지침 동기화 | PASS | `AGENTS.md`와 `CLAUDE.md` 바이트 동일 |

## 독립 코드 검토

| 검토 항목 | 결과 | 근거 |
| --- | --- | --- |
| stale oneclick 조기 차단 | PASS | checkout/retry action 모두 `getDisabledBillingResult`를 Prisma transaction과 주문 상태 변경 전에 호출합니다. |
| 원클릭 합성 승인 제거 | PASS | raw 카드 등록 action, mock billing token 생성, PG 호출 없는 PAID 전환이 제품 코드에서 제거됐습니다. |
| 결제수단 UI | PASS | checkout/retry에서 oneclick 선택지는 제거되고 카드·카카오·네이버·계좌이체 KSPAY 경로만 유지됩니다. |
| 과거 카드 IDOR 경계 | PASS | 삭제는 `deleteMany({ id, userId })`로 현재 사용자 소유권을 제한합니다. |
| legacy 이미지 차단 | PASS | `safeProductImageUrl`이 상대·절대 `/products/detail/` URL을 `null`로 정규화합니다. |
| 장바구니 의미 보존 | PASS | legacy image URL만 제거하고 상품 ID·이름·가격·수량·사이즈·checkout nonce는 보존합니다. |
| 최근 상품 의미 보존 | PASS | legacy image URL만 제거하고 기존 상품 메타데이터를 유지합니다. |
| 원본 이미지 렌더링 | PASS | 상품 상세는 `product.imageUrl`의 안전한 원본 대표 이미지를 4:5 프레임과 `object-fit: cover`로 표시합니다. |
| 이미지 생성 비율 | PASS | splitter/audit sheet는 `ImageOps.pad`와 단일 배율로 1200x1500 출력을 만듭니다. |

저장소에는 기존 왜곡 파일 1,645개가 남아 있으나, 검색 결과 제품 렌더링 참조는 안전 함수와 회귀 테스트 외에 발견되지 않았습니다. 직접 URL 접근 가능성은 잔여 위험으로 관리합니다.

## 로컬 브라우저·DB 회귀

로컬 production 서버와 테스트 전용 DB fixture로 사용자 동작, 반환 UI, DB 결과를 함께 확인했습니다.

### 카드 관리

- 설정 화면에서 카드번호·유효기간·비밀번호·생년월일 입력과 신규 카드 등록 버튼이 0개임을 확인했습니다.
- 미연동 안내와 과거 mock 카드의 마스킹 정보·삭제 명령만 노출됐습니다.
- 본인 카드 삭제는 화면에서 사라지고 DB에서도 삭제됐습니다.
- 타인 `cardId`를 직접 제출한 요청은 action 응답 후에도 타인 카드가 DB에 남아 IDOR가 차단됐습니다.
- 네트워크를 끊은 삭제 시 DB 카드는 보존됐고 재연결·새로고침 후 다시 보였습니다. 다만 실패 중 화면에 명시적 오류 안내가 없는 기존 UX 공백을 관찰했습니다.

### stale oneclick·일반 KSPAY

- checkout stale `method=oneclick` 직접 제출: 공통 비활성 안내, 주문·항목·재고 예약·감사로그 변경 0.
- retry stale `method=oneclick` 직접 제출: 동일 안내, 기존 FAILED 주문 상태·승인 필드 변경 0.
- checkout의 카드·카카오페이·네이버페이·실시간계좌이체 선택지는 각각 1개, oneclick은 0개였습니다.
- 정상 카드 checkout은 KSPAY 인증 폼 생성과 PENDING 주문 생성까지만 확인했습니다. 외부 결제창 승인 호출은 실행하지 않았습니다.
- retry 화면에서도 oneclick은 0개이고 기존 KSPAY 수단만 유지됨을 확인했습니다.
- DB 최종 확인에서 일반 카드 주문만 `PENDING`, retry 대상은 `FAILED`, 감사로그 0이었습니다. oneclick 제출로 생성·승인된 주문은 없었습니다.

### storage 마이그레이션

- legacy cart fixture는 상품·가격·수량·사이즈를 유지하고 `/products/detail/` 이미지 URL만 제거했습니다.
- checkout nonce는 마이그레이션 전후 동일했습니다.
- legacy recent fixture도 상품 메타데이터를 유지하고 이미지 URL만 제거했습니다.
- storage write 실패를 주입해도 현재 메모리 장바구니와 화면 상품은 유지됐습니다.

### 이미지·반응형

- 홈, 남성/여성 목록, 검색, 상품 상세, 장바구니, 최근 상품 경로에서 legacy 상세 이미지 URL이 렌더되지 않음을 확인했습니다.
- 로컬 상품 상세 원본 이미지는 실제 로드되고 4:5 frame ratio `0.8`, `object-fit: cover`였습니다.
- 320/390/412px와 100%/200% 글자 확대에서 상품 상세·설정·checkout의 `scrollWidth=clientWidth`, 주요 컨트롤 viewport 이탈 0, clipping 0이었습니다.
- 200% 확대 320px 수량 버튼은 계산된 line box의 `scrollHeight`가 50px, 버튼 높이가 44px로 generic 검사에 걸렸지만 캡처에서 기호와 focus 영역이 완전히 보였습니다. 제품 잘림이 아닌 측정 false positive로 판정했습니다.
- 주요 결제·삭제·수량 컨트롤은 44px 이상이었습니다. 상품 본문의 일부 보조 텍스트 링크는 44px 미만인 기존 상태로 이번 변경 범위 밖입니다.
- 브라우저 console error/warning은 0이었습니다.

## 운영 공개 스모크

- `https://laonshop.com/shop/men`에서 운영 상품 목록과 상세 링크를 확인했습니다.
- 320px 상품 상세: `scrollWidth=clientWidth=320`, 원본 이미지 로드, `/products/detail/` 참조 없음, 4:5 frame ratio `0.8`, `object-fit: cover`, console error/warning 0.
- 412px 상품 상세: `scrollWidth=clientWidth=412`, 원본 이미지 로드, `/products/detail/` 참조 없음, 4:5 frame ratio `0.8`, `object-fit: cover`, console error/warning 0.
- Next Image의 absolute 내부 레이어가 320px에서 frame 바깥 좌표를 갖지만 조상 4:5 frame에 의해 의도대로 crop되고 문서 폭은 증가하지 않았습니다.

## 결함과 잔여 위험

### QA-079-OBS-01 - 카드 삭제 네트워크 실패 안내 부재

- 우선순위: P3
- 귀책: 기존 동작이며 이번 제품 커밋의 신규 회귀가 아닙니다.
- 재현: 설정의 과거 카드에서 네트워크를 끈 뒤 삭제를 누릅니다.
- 실제: DB 삭제는 발생하지 않지만 처리 중 화면에 실패 안내가 없습니다. 재연결·새로고침하면 카드가 다시 보입니다.
- 기대: 카드가 화면에 유지되거나 실패 안내와 재시도 명령이 제공돼야 합니다.
- 원인 후보: `billing-cards.tsx` 삭제 핸들러가 네트워크 예외를 사용자 상태로 노출하지 않습니다.
- 회귀 요청: offline/500에서 row 유지, error alert, 버튼 재활성, reload 후 DB 일치를 자동화합니다.

### 알려진 정책 위험

- 제한 계정의 수기결제 mock PAID 경로는 기존 정책대로 남아 있습니다. 공개 심사용 계정 오용 시 주문 무결성 위험이 있으나 이번 변경에서 새로 생긴 결함은 아닙니다.
- 기존 왜곡 파일 1,645개는 직접 URL 접근이 가능하지만 제품 렌더링에서는 제외됐습니다.
- legacy cart/recent는 상품 재방문 전까지 이미지 placeholder가 보일 수 있습니다.
- 실 KSNET/KSTA 승인·취소·영수증, Safari/WebKit/iOS 실제 기기는 실행하지 않았습니다.

## QA 도구 이슈 구분

- 브라우저 자동화 초기 실행의 브라우저 설치 경로·sandbox 제약, 짧은 selector 대기, cart/recent 마이그레이션 경로 오인, 수량 버튼 line-box 검사는 QA 도구/시나리오 문제였습니다.
- fresh snapshot, 시스템 Chrome, 정확한 페이지 진입, 시각 캡처와 DB 직접 조회로 대체했습니다.
- 위 도구 이슈로 제품 FAIL을 판정한 항목은 없습니다.

## cleanup

- 삭제: QA 사용자 2명, 주문 2건과 연결 주문항목, QA 카드 3개.
- 최종 DB: users 10, orders 9, items 9, cards 4, audits 0, wishlists 0.
- 시작 기준선과 최종 수치가 정확히 일치했습니다.
- 로컬 production 서버 3003을 종료하고 임시 fixture·브라우저 스크립트·스크린샷·secret 임시 파일을 삭제했습니다.
- 브라우저 viewport override를 reset하고 QA 탭을 finalize했습니다.
- 운영·마스터 데이터, Vercel env·도메인 설정, 실 PG 상태는 변경하지 않았습니다.

## 최종 판정

미연동 oneclick은 UI와 서버 양쪽에서 차단되고, stale 요청도 주문·상태 변경 전에 종료됩니다. 과거 mock 카드는 본인 삭제만 가능하며 raw 카드 등록·mock token·합성 PAID 경로는 제거됐습니다. legacy 이미지 참조는 저장 데이터의 구매 의미와 nonce를 보존하면서 정리되고 원본 대표 이미지는 로컬·운영 모바일에서 비율 왜곡 없이 표시됐습니다.

정적 검증, 로컬 UI/API/DB, 운영 배포·공개 스모크, cleanup이 모두 일치하므로 제품 커밋 `07916d4`를 **PASS / GO**로 판정합니다. `QA-079-OBS-01`은 출시 차단이 아닌 기존 P3 UX 개선 항목입니다.
