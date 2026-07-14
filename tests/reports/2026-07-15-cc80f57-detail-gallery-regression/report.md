# cc80f57 상품 상세 5장 갤러리 회귀 QA 보고서

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상 제품 커밋: `cc80f578da0a626c9407c64d9b92567bd2739909`

비교 범위: `d4653f6ced7ee30d55939669b025db95ad95895c..cc80f578da0a626c9407c64d9b92567bd2739909`

결과: **PASS**

출시 판정: **GO - 전 상품 5장 갤러리·4:5 비율·캐시 버전 회귀 통과**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 로컬 테스트 DB는 상품 ID를 읽는 용도로만 사용했으며 생성·수정·삭제 쿼리는 실행하지 않았습니다.
- 운영에서는 공개 상품 이미지와 Vercel 배포·오류 상태만 읽기 검증했습니다.
- 결제, 운영 DB 쓰기, Vercel 환경변수·도메인 변경은 실행하지 않았습니다.
- secret, 세션, credential, 환경변수 실제 값은 출력하거나 문서화하지 않았습니다.

## 저장소·배포 기준

- 검증 대상은 `main=origin/main=cc80f578da0a626c9407c64d9b92567bd2739909`입니다.
- Vercel deployment `dpl_HZNqtYpKcgPCid4Vf6iyBRgFSvXt`는 `READY`, target `production`, Git SHA `cc80f57`입니다.
- `laonshop.com`, `www.laonshop.com` 별칭이 같은 배포에 연결돼 있습니다.
- 최근 1시간 Vercel runtime error cluster는 0건이고 해당 배포의 error/fatal 로그도 0건입니다.
- `AGENTS.md`와 `CLAUDE.md`는 바이트 단위로 동일합니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3에서 실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 35/35, fail 0, skip 0 |
| 이미지 파이프라인 | PASS | `python3 -m unittest tests/scripts/test_image_pipeline.py`, 2/2 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 19/19 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 독립 코드 검토

| 검토 항목 | 결과 | 근거 |
| --- | --- | --- |
| 상세컷 선택 | PASS | 상품 slug 디렉터리에서 01~05를 조회하고 최소 4장 미만이면 안전한 대표 이미지로 대체합니다. 현재 배포 자산은 전 상품 5장입니다. |
| 캐시 버전 | PASS | 상세 이미지 URL에 `v=20260714-4x5`를 부여해 이전 왜곡 optimizer 캐시를 우회합니다. |
| 저장 URL 마이그레이션 | PASS | 장바구니·최근 상품의 무버전 로컬 상세 URL만 새 버전으로 바꾸고 상품 ID·수량·사이즈·checkout nonce를 보존합니다. |
| 비정상 URL 차단 | PASS | `safeProductImageUrl`은 HTTP(S)만 허용하고 `javascript:` 등 비허용 scheme을 제거합니다. |
| 이미지 생성 비율 | PASS | splitter는 단일 배율 `ImageOps.pad`로 1200x1500을 만들며 기준 도형 비율 회귀 테스트가 통과합니다. |
| 지연 로딩 | PASS | 대표 이미지만 `priority`, 추가 4장은 `loading=lazy`로 렌더됩니다. |

## 전수 자산 무결성

상품 manifest와 `public/products/detail`을 전수 비교하고 모든 WebP를 실제 디코딩했습니다.

- 상품·기대 slug 329개, 실제 slug 329개.
- 누락 slug 0개, 추가 slug 0개.
- 이미지 1,645개, 상품별 정확히 `01.webp`~`05.webp` 5장.
- 1,645개 모두 1200x1500, 파일 decode 실패 0.
- exact binary duplicate group 0.
- 저정보 이미지 실패 0, 최소 entropy 2.67.
- 패딩 경계 최대 색 거리 1.73으로 중립 배경 연결이 안정적이었습니다.
- perceptual hash 근접 후보는 흰 배경과 유사 구도에 따른 후보였습니다. 거리 0 후보인 니트 장갑·체인 팔찌·니트 레그워머·러닝 캡도 시각 확인 결과 서로 다른 정상 컷이었습니다.

## 전 상품 시각 감사

329개 상품을 남녀 17개 카테고리 감사 시트로 구성해 5컷 전체를 확인했습니다.

- 남성: 상의, 아우터, 하의, 신발, 가방, 액세서리, 홈웨어, 스포츠.
- 여성: 상의, 아우터, 하의, 원피스, 신발, 가방, 액세서리, 홈웨어, 스포츠.
- 각 상품의 색상·소재·상품 종류·실루엣은 5컷 안에서 일치했습니다.
- 다른 slug 상품 혼입, 빈 패널, 깨진 이미지, 가로 늘어짐은 발견되지 않았습니다.
- 일부 신발·스포츠 컷은 스튜디오와 착용·야외 배경이 섞였지만 같은 상품의 정상 라이프스타일 컷으로 확인했습니다.
- 원본 패널이 세로로 긴 AI 생성 시트라 좌우 여백은 남지만, 중립 배경 패딩이 일관되고 상품을 왜곡하거나 잘라내는 출시 차단 사례는 없었습니다.

## 로컬 HTML·브라우저·optimizer

- 로컬 production 서버에서 상품 상세 329개를 12개 동시 요청으로 전수 확인했습니다.
- 329/329 HTTP 200, 각 페이지의 `/products/detail/<slug>/01.webp`~`05.webp`와 `v=20260714-4x5` 참조 누락 0.
- 대표 1장은 browser loading `auto`와 preload, 추가 4장은 `lazy`로 확인했습니다.
- headless Chrome의 첫 표본에서는 320px에서 5장 모두 디코딩되고 자연 비율 0.8, 부모·문서 경계 이탈 0이었습니다.
- 별도 optimizer 요청은 HTTP 200, 정상 이미지 payload를 반환했습니다.
- 장바구니·최근 상품 URL 버전 전환, 비 HTTP(S) 제거, 수량·사이즈·nonce 보존은 단위 테스트와 코드 경계로 확인했습니다.

DEV 인계의 실제 브라우저 증거도 독립 자산·HTML 결과와 교차 확인했습니다. 로컬 production 320/390/412/1280px에서 상세 5장, natural ratio 0.8, broken 0, versioned 5, document overflow 0, console error/warning 0이었습니다. 운영 HTML과 정적 WebP도 5장·1200x1500으로 확인된 증거를 수용했습니다.

## QA 도구 이슈 구분

- 초기 이미지 감사 스크립트는 로컬 Python의 `int.bit_count` 미지원으로 종료됐고 호환 표현으로 바꾼 뒤 전수 검사 PASS를 회수했습니다.
- HTML 라벨의 `5<!-- --> photos` React hydration 주석을 단순 문자열로 검사해 첫 실행이 false fail이었고, 주석 정규화 후 329/329 PASS를 회수했습니다.
- headless CDP의 `scrollIntoViewIfNeeded`·스크립트 스크롤은 한 표본에서 네이티브 lazy 요청을 깨우지 못했습니다. 파일 decode, HTML URL, 직접 optimizer 200, DEV 실제 브라우저 5장 로드가 모두 정상이므로 자동화 입력 제약으로 판정했습니다.
- 사용자 지시에 따라 승인 대기 중이던 in-app browser/node_repl 재시도는 실행하지 않았습니다.
- 위 도구 이슈로 제품 FAIL을 판정한 항목은 없습니다.

## 결함과 잔여 위험

- 이번 변경의 신규 제품 결함은 발견하지 못했습니다.
- 원본 330개 생성 시트와 폐기본 1개의 원시 매칭 과정은 저장소 외 원본이 없어 QA가 재현하지 못했습니다. 대신 최종 manifest 329개와 배포 자산 329개를 전수 대조했습니다.
- 이미지는 실제 촬영본이 아닌 더미 상품용 AI 생성 시트입니다. 출시 전 실제 판매 상품 이미지로 교체할 때 색상·소재·상표·인물 표현을 별도로 검수해야 합니다.
- Safari/WebKit/iOS 실제 기기는 이번 회귀에서 실행하지 않았습니다.
- 실 KSNET 승인·취소·영수증은 변경 범위 밖이며 실행하지 않았습니다.

## cleanup

- DB fixture를 생성하지 않아 삭제 대상이 없습니다. 운영·테스트 DB 데이터는 변경하지 않았습니다.
- 로컬 3003 production 서버를 종료했습니다.
- 임시 브라우저·HTML·이미지 감사 스크립트와 감사 시트는 보고서 커밋 전 삭제했습니다.
- 운영·마스터 데이터, Vercel env·도메인 설정, 실 PG 상태 변경은 없습니다.

## 최종 판정

전 상품 329개의 1,645개 상세컷이 상품별 정확히 5장, 1200x1500 4:5로 구성됐고 누락·깨짐·가로 왜곡·다른 상품 혼입을 발견하지 못했습니다. 329개 로컬 상세 HTML은 모두 5개 버전 URL을 반환했고 배포 SHA, 운영 별칭, runtime 오류 상태도 일치합니다.

정적 검증, 전수 자산 검사, 전 상품 시각 감사, 로컬 HTML·optimizer, DEV 실제 브라우저 증거가 같은 결과를 가리키므로 제품 커밋 `cc80f57`을 **PASS / GO**로 판정합니다.
