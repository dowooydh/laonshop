# fbc2312 에디토리얼 상품 갤러리 회귀 QA 보고서

작성일: 2026-07-15

담당: Codex QA/테스트 세션

대상 제품 커밋: `fbc2312d0ded7a66ebab4a929a15a08fdf16e63f`

비교 범위: `1308b919478dc2f930ad6d369c1046864c310bda..fbc2312d0ded7a66ebab4a929a15a08fdf16e63f`

결과: **PASS**

출시 판정: **GO - 329개 상품의 대표 1장 + 에디토리얼 상세 4장 갤러리 회귀 통과**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 로컬 테스트 DB에서는 활성 상품 ID와 표시 정보만 읽었고 생성·수정·삭제 쿼리는 실행하지 않았습니다.
- 운영에서는 공개 상품·이미지와 Vercel 배포·로그만 읽기 검증했습니다.
- 실 결제, 운영 DB 쓰기, Vercel 환경변수·도메인 변경은 실행하지 않았습니다.
- secret, credential, 세션 쿠키, 환경변수 실제 값은 출력하거나 문서화하지 않았습니다.

## 저장소·배포 기준

- 검증 기준은 `main=origin/main=fbc2312d0ded7a66ebab4a929a15a08fdf16e63f`입니다.
- Vercel deployment `dpl_5CMGXFRSMUG9LDSeFe71mhrgmKRX`는 `READY`, target `production`, Git SHA `fbc2312`입니다.
- 배포 URL은 `laonshop-6gqh0rd6r-customorder.vercel.app`이며 `laonshop.com`, `www.laonshop.com` 별칭이 같은 배포를 가리킵니다.
- 해당 배포의 최근 1시간 error/fatal runtime 로그는 0건입니다.
- `AGENTS.md`와 `CLAUDE.md`는 바이트 단위로 동일합니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3에서 실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 50/50, fail 0, skip 0 |
| 이미지 파이프라인 | PASS | `python3 -m unittest tests/scripts/test_image_pipeline.py`, 2/2 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid, 기존 Prisma 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 독립 코드 검토

| 검토 항목 | 결과 | 근거 |
| --- | --- | --- |
| 갤러리 구성 | PASS | 안전한 Unsplash 대표 이미지와 로컬 `01.webp`~`04.webp`가 모두 있을 때 총 5장을 반환하고, 로컬 세트가 불완전하면 대표 이미지로 축소합니다. |
| 안정 slug | PASS | 카탈로그 Unsplash photo ID를 안정 키로 사용하고 매칭 실패 시 기존 해시 slug로 대체합니다. |
| URL 안전 경계 | PASS | 로컬 상세 경로는 `01`~`04`만 허용하고 버전을 `20260715-editorial`로 고정합니다. 비허용 protocol·host·credential·port·hash는 거부합니다. |
| 대표 이미지 정규화 | PASS | Unsplash URL을 `1200x1500`, `fit=crop`, `crop=faces,entropy`로 정규화해 목록·검색·위시리스트·최근상품과 상세 대표컷이 같은 기준을 사용합니다. |
| 반응형 상세컷 | PASS | 모바일 1열, 640px 이상 2열이며 `sizes`는 640~767px와 768px 이상 실제 컬럼 폭을 구분합니다. |
| 저장 URL 마이그레이션 | PASS | 구버전 상세 URL만 새 버전으로 올리고 상품 ID·수량·사이즈·checkout nonce를 보존합니다. null 이미지는 읽기 전용 API 결과로 복구합니다. |
| 품질 gate | PASS | prebuild에서 329개 slug, 1,316장, 1200x1500, 정확 중복 0, 인공 레터박스 기준을 강제합니다. |

## 전수 자산 무결성

상품 manifest와 `public/products/detail`을 전수 비교하고 모든 WebP를 실제 디코딩했습니다.

- 활성 상품 329개, 실제 slug 329개, 상품별 정확히 `01.webp`~`04.webp` 4장입니다.
- 로컬 WebP는 총 1,316장이고 `05.webp` 잔존·참조는 0건입니다.
- 1,316장 모두 1200x1500, decode 실패 0, SHA-256 exact duplicate 0입니다.
- 전체 크기는 149.38MiB이며 개별 파일은 31.29~403.93KiB입니다.
- 인공 좌우 패딩은 평균 0.019%, 최대 1.667%, 12% 초과 0건입니다.
- 최저 시각 표준편차는 10.598로 빈 이미지·단색 실패 기준을 통과했습니다.

## 시각 감사

남녀 17개 카테고리 그룹에서 처음·중간·마지막 상품과 지정 핵심 SKU를 포함한 52개 상품의 4컷을 감사 시트로 직접 확인했습니다.

- 남성 8개 그룹: 상의, 아우터, 하의, 신발, 가방, 액세서리, 홈웨어, 스포츠.
- 여성 9개 그룹: 상의, 아우터, 하의, 원피스/스커트, 신발, 가방, 액세서리, 홈웨어, 스포츠.
- `p-1dtc2le` 타탄 상의, `p-who192` 러닝 스니커즈, `p-10xekba` 실버 네크리스는 색상·상품 형태·실루엣이 네 컷에서 일치했습니다.
- 다른 SKU 혼입, 가로 늘어짐, 빈 프레임, 시트 경계, 과도한 좌우 레터박스는 발견하지 못했습니다.
- 네 상세 이미지는 두 패널을 조합한 서로 다른 에디토리얼 페어이며, 의도한 패널 재사용 외 exact duplicate는 없습니다.

## 로컬 전수 HTML·이미지 응답

- 로컬 production 서버에서 활성 상품 상세 HTML 329개를 전수 요청해 329/329 HTTP 200을 확인했습니다.
- 329개 페이지는 각각 고유 slug 1개와 버전된 `01.webp`~`04.webp` 4개를 포함했고 `05.webp` 참조는 0건입니다.
- 로컬 정적 이미지 1,316개를 모두 요청해 1,316/1,316 HTTP 200, `image/webp`, 20KiB 초과 payload를 확인했습니다.
- 각 HTML은 대표 Unsplash URL의 `w=1200`, `h=1500`, `crop=faces,entropy`를 포함했습니다.

## 로컬 실제 브라우저

Google Chrome production 모드에서 지정 SKU 3개를 다음 9개 프로필로 검증해 총 27조합이 통과했습니다.

- 320x568 100%·200%, 360x740 100%, 390x844 200%, 412x915 100%.
- 640x900 DPR2 100%, 767x1000 DPR2 200%, 768x900 100%, 1280x900 100%.
- 모든 조합에서 대표 1장 + 상세 4장 = 5장, broken 0, 자연 비율 0.8을 확인했습니다.
- 320~412px는 상세컷 1열, 640~1280px는 2열이며 `sizes` 속성과 실제 x 좌표가 일치했습니다.
- 문서 `scrollWidth=clientWidth`, 의미 있는 descendant의 viewport 이탈 0, 콘솔 error/warning 0입니다.
- 구버전 카트·최근상품 URL은 `v=20260715-editorial`로 전환됐고 상품 ID·수량 3·사이즈 XL·nonce가 보존됐습니다.
- null 카트 이미지는 공개 API의 스마트 대표컷으로 복구됐고 수량·사이즈·nonce가 유지됐습니다.

## 운영 공개 회귀

- apex, www, 고정 deployment 루트 3개가 HTTP 200을 반환했습니다.
- 핵심 상품 3개 HTML, 정적 WebP 12개, 버전 URL을 확인했고 세 상품의 `05.webp`는 404였습니다.
- Next Image optimizer의 버전된 로컬 이미지 요청은 HTTP 200과 정상 이미지 payload를 반환했습니다.
- 운영 Chrome에서 핵심 상품 3개를 320px·1280px로 검증한 6조합 모두 5장·자연 비율 0.8·overflow 0·콘솔 오류 0이었습니다.

## Android 회귀

- Android 15 arm64 에뮬레이터의 Chrome 133 엔진에서 CSS viewport 412px로 공개 운영 상품을 검증했습니다.
- `p-1dtc2le`은 100%·200%, `p-who192`와 `p-10xekba`는 100%로 총 4조합을 실행했습니다.
- 모든 조합에서 갤러리 5장, 상세컷 1열, 자연 비율 0.8, 새 버전 URL, 가로 overflow 0, 콘솔 오류 0이었습니다.
- 테스트 뒤 localStorage, CDP 포워딩, 임시 UA override를 정리하고 기존 탭 URL과 UA를 복원했습니다.

## QA 도구 이슈 구분

- SSR HTML의 React 식별자까지 버전 접미사로 읽은 초기 정규식 false fail은 파일 경로와 정확 버전 검사를 분리해 해결했습니다.
- 네 번째 상세컷은 lazy image라 화면 밖에서 요청되지 않았고 실제 스크롤 후 정상 디코딩됐습니다.
- 게스트 카트 fixture에서 소유자 키를 생략한 첫 시도는 기존 보안 로직이 카트를 의도대로 초기화한 결과였습니다. 게스트 소유자 상태를 명시한 재실행에서 마이그레이션 PASS를 확인했습니다.
- Android Playwright 연결은 기존 다른 탭과 context 관리 제약으로 중단됐습니다. 별도 page-target CDP 검증으로 대체해 같은 제품 단정을 회수했습니다.
- 위 항목은 QA 러너·fixture 문제이며 제품 결함으로 판정하지 않았습니다.

## 결함과 잔여 위험

- 이번 변경의 신규 P0/P1/P2 제품 결함은 발견하지 못했습니다.
- 상세 자산은 약 84.0MiB에서 149.38MiB로 증가했습니다. Vercel 배포 크기와 최초 optimizer 비용·응답 지연을 운영 관찰해야 합니다.
- 원본 AI 시트와 상품 매핑은 저장소 밖에 있어 현재 저장소만으로 1,316장을 동일하게 일괄 재생성할 수 없습니다.
- 대표컷은 외부 Unsplash 가용성과 응답 품질에 의존합니다. 로컬 상세 4장은 대표컷 장애와 무관하게 정적 배포됩니다.
- 전수 기계 검사는 329개 상품 모두 수행했지만 사람이 직접 본 범위는 카테고리 균형 표본 52개 상품입니다.
- Safari/WebKit/iOS 실제 기기와 실 KSNET 승인·취소·영수증은 이번 변경 범위에서 실행하지 않았습니다.

## cleanup

- DB fixture를 생성하지 않아 삭제 대상이 없습니다. 로컬·운영 DB 데이터는 변경하지 않았습니다.
- 로컬 3013 production 서버와 Android CDP 포워딩을 종료했습니다.
- 임시 브라우저·Android·자산 감사 스크립트와 `/private/tmp` 감사 시트를 삭제했습니다.
- 운영·마스터 데이터, Vercel env·도메인 설정, 실 PG 상태 변경은 없습니다.

## 최종 판정

329개 상품의 대표 1장 + 로컬 상세 4장 구성이 코드·자산·HTML·정적 응답·브라우저에서 일치합니다. 1,316개 로컬 WebP는 모두 1200x1500이고 누락·정확 중복·인공 레터박스 기준을 통과했으며, 핵심 상품과 카테고리 균형 표본에서 왜곡·잘림·SKU 혼입을 발견하지 못했습니다.

정적 검증, 전수 자산·HTML·HTTP 검사, 로컬 27개 반응형 조합, 운영 6개 조합, Android 4개 조합과 Vercel 상태가 같은 결과를 가리키므로 제품 커밋 `fbc2312`를 **PASS / GO**로 판정합니다.
