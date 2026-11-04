# LAONSHOP 운영 출시 기록

기준일: 2026-11-04. 사용자 요청: `남은 작업끝내고 운영배포까지해`.

## 운영 반영

- 검증 제품 SHA: `d62fc447d762cce04132288e83a5a8d4dde3c7e3`
- 이전 운영 SHA: `b8ccd8fb83f091f12747e33506933b75ddb22c44`
- `main` 정상 fast-forward push로 배포했습니다. 강제 push·운영 환경변수·키·결제 게이트 변경은 없습니다.
- Vercel 프로젝트 `customorder/laonshop`, production 배포 `dpl_LpY3iVUugoqSY3XNAaPjuVvdiqJL`은 READY입니다. `laonshop.com` 조회도 이 배포·제품 SHA로 확인했고 apex·www alias가 연결됐습니다.
- 운영 주소: https://laonshop.com . `www`의 정상 apex 이동은 HTTP308입니다.
- 빌드 로그의 완료 시간은 약2분, 빌드 시작부터 READY까지 약148초입니다. 저장소 engines의 Node22가 프로젝트 설정24를 덮어쓴다는 안내와 기존 Prisma7 설정 deprecation을 보존합니다.
- 이 보고서를 포함하는 후속 QA·증적 커밋은 제품 런타임·이미지 변경을 포함하지 않습니다. [배포 메타데이터](deployment-evidence.json).

## 달라진 동작

교환·반품을 포함한 구매 안내 행과 공통 글자색/크기 병합을 정리하고 공개 참고 사이즈표·측정 그림을 추가했습니다. 기존329개 SKU·가격·사진·주문을 보존하면서14개 쇼핑 분류와 세부 분류로 재구성했습니다.

신규32개 스타일의 독립 AI 대표사진을 모두 완성했습니다. 남녀각16개로 상의10·하의9 중심이며, 홈·분류·검색·준비상품 목록과 상세에서 소개합니다. 기존 판매329개와 출시 준비32개를 구분해 전체361개(남성171/여성190)로 안내합니다. 공급·실측·가격·재고 미확정 준비상품에는 AI 이미지·예상 가격·판매 준비 중을 표시하고 재고0·구매/장바구니 없음·조작 ID 주문 거절을 유지합니다. 실제 판매 상품을32개 늘렸다는 의미는 아닙니다. [생성 프롬프트·원본/최종 해시](../../../data/new-product-images.json).

운영 후기·배송 테이블을 추가해 본인의 결제완료·배송완료 상품 후기, 관리자 송장·배송완료·불변 이력, 본인/관리자 주문·배송 내역 기능의 readiness를 열었습니다. 합성 예시 평가는 미리보기 전용이며 실제 고객 후기·별점 집계·운영 DB에 넣지 않았습니다.

## 검증의 구분

| 실행 주체·범위 | 결과 |
|---|---|
| DEV 자체 | 전체186/186 skip0, 이미지 무결성, lint warning0, typecheck, production build19/19 PASS. [기록](dev-validation.json) |
| 독립 격리 QA | 서비스37, 실제HTTP46범위, Chromium288조합, 새WebKit8조합 PASS. 준비상품32종 양모드 상세64회·원본사진32·조작주문2건 거절 확인. [독립 보고서](independent-report.md) |
| 별도 소스 리뷰 | 주문·결제 경계, 준비상품·예시 분리, 이미지와 운영 스키마 증적 검토에서 차단결함 없음. 실제 운영 DB 재검증을 수행한 리뷰는 아닙니다. [기록](source-review.json) |
| 운영 담당 DB 작업 | 보호된 로컬 전체/스키마 백업 후 additive3테이블 적용·post-verify. 기존11테이블 count/digest 불변, validated CHECK4·활성 불변trigger·앱 readiness=true, 새원장0행. 배포 후 읽기 전용 대조도 별도 기록. [운영 결과](operational-schema-results.json) |
| 운영 공개 DEV 확인 | 실제apex의43검사 PASS. 분류 수·구매가능필터·신규32상세·원본사진32의HTTP/실제SHA·기존상품 사이즈/후기 readiness·320/390/1280×100/200% 대표상세 확인. 최종pageerror0/차단POST시도0. [결과](production-public-smoke-results.json) |
| 독립 운영 추가 조사 | 매번 새 컨텍스트의6페이지 HTTP200·pageerror/console error0. prefetch fetch취소11건은 별도 보존. [결과](production-hydration-probe-independent.json) |
| 관찰 | 해당 production 배포의 최근10분 error/fatal level 집계에서 일치 그룹이 반환되지 않았습니다. 전체기간 무오류 보장이 아닙니다. log-drain API는404여서 구성 여부 미확인입니다. |

## 실패·경고를 보존한 범위

최초 운영 브라우저 검사는 스트리밍 본문보다 먼저 온 main wrapper를 준비 완료로 판단해 링크를 놓쳤습니다. 같은 배포의 전체 HTML과 apex SHA를 대조하고 route h1을 기다리도록 검사 준비 조건을 보완했습니다. [초기 기록](production-public-smoke-initial.json).

다음 실행에서는43개 기능 검사가 모두 통과했지만 React#418 hydration 오류1건이 관찰돼 전체결과를 FAIL로 보존했습니다. [React 공식 설명](https://react.dev/errors/418)은 서버·클라이언트 HTML 불일치입니다. 해당 최초 오류에는 URL/stack 계측이 없어 원인은 확정하지 못했습니다. URL·검사명 계측을 추가한 동일43개 재검사와 독립 fresh6개에서는 재현되지 않았으며, 소스 검토도 확인 가능한 원인을 찾지 못했습니다. 오류를 지우거나 해결 완료로 단정하지 않고 **WARN/원인 미확정**으로 남깁니다. [관찰 원본](production-public-smoke-hydration-initial.json).

독립 격리 QA의 WebKit broader probe RSC20→6 경고, 이전 단계 RSC5 경고, QA 대기 조건 보완·중간 실패도 각 원문과 보고서에 보존했습니다. 안정된 신규8개 결과와 섞어 모든 네트워크/엔진 오류0으로 보고하지 않습니다. 현재 배포는 위 제한을 포함한 GO입니다.

## 남은 외부 업무와 보존

실제 신규 상품 공급·실측·제조정보·판매가·재고 확정과 판매 전환, 실제 고객 후기 확보, 실제 물품 발송·수령·카드 승인/취소 및 실기기 검증은 수행하지 않았습니다. 이는 이번 코드/운영 배포 완료와 별개입니다. 기존 KSPAY·LAONPAY 계약·실운영 결제 활성화 상태를 이번 UI/배송 변경으로 새로 판정하지 않습니다.

사용자 첨부·공유 브라우저·다른 저장소·운영 자격정보를 보존했습니다. 독립 QA의 임시 서버/DB/세션은 정리했고 운영 백업은 보호된 비공개 로컬 경로에 유지합니다. 공개 운영 검사는 로그인·업무 POST 없이 별도 브라우저에서 GET만 수행했습니다.
