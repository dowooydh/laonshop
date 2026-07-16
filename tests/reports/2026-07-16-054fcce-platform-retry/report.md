# 054fcce iOS·Android 확대·저장 데이터 재검증 보고서

작성일: 2026-07-16

담당: Codex QA/테스트 세션

대상 제품 커밋: `054fccee03f491af430cdd8a9aea45ba4dc753cb`

대상 배포: `https://laonshop.com` / `dpl_HoRpAUkqfuwaDMi1kYuwxADwGbTa`

결과: **PASS**

출시 판정: **GO - 1차 10개 큐레이션 갤러리의 미완료 플랫폼 회귀 통과**

## 범위와 기준 고정

- 제품 코드는 수정하지 않았습니다.
- 검증 시작 시 로컬 `HEAD=a52edd2b2a02a6088b03e8c351fb7fa5b50205b8`, `origin/main=054fccee03f491af430cdd8a9aea45ba4dc753cb`이었습니다.
- 로컬에는 미푸시 QA 문서 `d266019`과 2차 갤러리 제품 `a52edd2`가 있어 로컬 서버를 사용하지 않았습니다.
- 모든 브라우저 요청은 운영 apex의 1차 제품 배포만 대상으로 했습니다.
- Vercel 고정 배포는 `READY`, target `production`, runtime `nodejs22.x`이고 apex/www 별칭이 연결돼 있습니다.
- DB·인증·결제·관리자 쓰기, 실 PG, 운영 설정 변경은 실행하지 않았습니다.

## iOS 26.5 MobileSafari

실제 `LAON QA iPhone 17 Pro` Simulator와 SafariDriver의 MobileSafari 세션을 사용했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| 남성 목록 | PASS | CSS viewport 402x714, document 402/402, 1차 대상 slug 10개 노출 |
| 타탄 체크 오버셔츠 | PASS | 대상 `01`~`05` 5장 complete, 각 natural 251x314, ratio 약 0.799 |
| 오버핏 검정 반팔 티 | PASS | 대상 `01`~`05` 5장 complete, 각 natural 251x314, ratio 약 0.799 |
| 스트라이프 옥스포드 | PASS | 대상 `01`~`05` 5장 complete, 각 natural 251x314, ratio 약 0.799 |
| overflow·clipping | PASS | 세 상세 모두 document 402/402, 의미 있는 viewport 이탈 0 |
| 뒤로가기 | PASS | 상세에서 `/shop/men?qa=054fcce-ios-history`로 복귀 |
| 새로고침 | PASS | 목록 title·URL 유지, 대상 대표 이미지 10개 재확인 |

- 대표 이미지는 344px, 상세 이미지는 368px 실제 폭으로 viewport 안에 렌더됐습니다.
- 스트라이프 상품의 실제 MobileSafari 화면에서 청백 세로 스트라이프, 포인트 칼라, 전신 대표컷과 비클리핑 레이아웃을 시각 확인했습니다.
- Safari 세션 생성·navigation·스크롤·뒤로가기·refresh가 모두 정상 종료됐습니다.

## Android Chrome 200% 글자 배율

Android 16/API 36 에뮬레이터, Chrome 133, `font_scale=2.0`에서 실제 전경 탭과 ADB 물리 스와이프를 사용했습니다.

| 상품 | 결과 | 이미지·레이아웃 증거 |
| --- | --- | --- |
| 타탄 체크 오버셔츠 | PASS | 5/5 complete, 412x515, `01` auto + `02`~`05` lazy, document 412/412 |
| 오버핏 검정 반팔 티 | PASS | 5/5 complete, 412x515, `01` auto + `02`~`05` lazy, document 412/412 |
| 스트라이프 옥스포드 | PASS | 5/5 complete, 412x515, `01` auto + `02`~`05` lazy, document 412/412 |

- CSS viewport는 412x786~842, DPR 2.625, visual viewport scale 1이었습니다.
- 모든 이미지의 자연 비율은 약 0.8이고 broken 0, 의미 있는 viewport 이탈·clipping 0, console error/warning 0입니다.
- 각 상품을 전경으로 올린 뒤 8회의 실제 물리 스와이프로 lazy image를 순차 로드했습니다.
- 화면 확대 상태에서도 헤더·관련 상품·footer가 가로 스크롤 없이 줄바꿈됐습니다.

## 실제 브라우저 cart/recent 마이그레이션

운영 apex의 격리된 Chrome context 390x844에 구형 Unsplash 대표 URL을 직접 저장하고 제품 UI를 열었습니다. context는 테스트 종료 시 삭제했습니다.

### 장바구니

- 구형 타탄 대표 URL이 `/products/gallery/b01/p-1dtc2le/01.webp`로 마이그레이션됐습니다.
- `productId`, 상품명, 가격 39,000원, 수량 2, 사이즈 M이 모두 유지됐습니다.
- `laonshop-checkout-nonce`는 테스트 전후 동일했습니다.
- 장바구니 UI의 실제 Next Image 요청도 같은 로컬 대표컷을 사용했습니다.

### 최근 본 상품

- 구형 검정 티 대표 URL이 `/products/gallery/b01/p-1acjf79/01.webp`로 마이그레이션됐습니다.
- 상품 ID, 이름, 가격 29,000원이 유지됐습니다.
- 현재 방문한 스트라이프 상품이 최근 목록 앞에 추가되는 정상 동작과 기존 검정 티 보존을 함께 확인했습니다.
- 최근상품 UI의 실제 Next Image 요청이 마이그레이션된 대표컷을 사용했습니다.
- checkout nonce는 최근상품 마이그레이션 뒤에도 동일했습니다.

두 화면 모두 document `scrollWidth=clientWidth=390`, console error/warning 0이었습니다.

## QA 도구 이슈 구분

- Android에서 프로그램 방식으로 문서 끝으로 즉시 이동한 첫 시도는 일부 lazy image 요청을 깨우지 못했습니다.
- 같은 상품을 실제 전경으로 올리고 물리 스와이프한 재실행에서는 세 상품 모두 5/5가 412x515로 디코딩됐습니다.
- 따라서 첫 결과는 background/programmatic scrolling 자동화 제약이며 제품 실패로 보지 않습니다.
- Android Chrome의 번역 제안 popup은 외부 영역 탭으로 닫고 제품 화면과 분리했습니다.

## 결함과 잔여 위험

- 이번 표적 재검증에서 신규 P0/P1/P2/P3 제품 결함은 발견하지 못했습니다.
- 1차 10개는 운영 브라우저 기준 PASS지만 실제 재고 촬영물이 아닌 생성형 더미 이미지입니다.
- 비대상 상품과 2차 로컬 제품 커밋 `a52edd2`는 이번 운영 재검증 판정에 포함하지 않았습니다.
- 실 iOS 기기와 실 Android 기기는 미실행이며 Simulator/Emulator 결과입니다.

## cleanup

- iOS SafariDriver 세션과 4444 서버를 정상 종료했습니다.
- Android에서 QA가 생성한 운영 탭을 닫고 CDP 포워딩을 제거했습니다.
- Android `font_scale`을 1.0으로 복원하고 Chrome을 다시 실행했습니다.
- 격리 Chrome context를 닫아 cart/recent fixture와 nonce를 삭제했습니다.
- 임시 runner·스크린샷은 QA 문서 커밋 전에 삭제했습니다.
- DB fixture·운영 데이터·Vercel env·도메인·결제 상태 변경은 0입니다.

## 최종 판정

이전 PARTIAL의 세 항목인 iOS MobileSafari 전체 조작, Android 200% 전경 상세 5컷, 실제 브라우저 cart/recent 마이그레이션이 모두 통과했습니다. iOS와 Android에서 대상 세 상품은 같은 5컷을 4:5로 완전히 로드했고 overflow·clipping이 없었습니다. 구형 저장 URL은 정확한 큐레이션 대표컷으로 바뀌면서 상품 의미와 checkout nonce를 보존했습니다.

제품 커밋 `054fccee`의 1차 10개 큐레이션 갤러리를 **PASS / GO**로 승격합니다.
