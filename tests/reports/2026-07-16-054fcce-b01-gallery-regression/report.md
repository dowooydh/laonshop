# 054fcce 남성 상의 1차 큐레이션 갤러리 회귀 QA 보고서

작성일: 2026-07-16

담당: Codex QA/테스트 세션

대상 제품 커밋: `054fccee03f491af430cdd8a9aea45ba4dc753cb`

비교 범위: `6a0127358c00f92b7b43081c9c73249e886dee4b..054fccee03f491af430cdd8a9aea45ba4dc753cb`

결과: **PARTIAL**

출시 판정: **조건부 GO - 갤러리 제품 기준은 통과했으나 iOS MobileSafari 전체 조작을 재실행해야 함**

## 범위와 안전 경계

- 제품 코드는 수정하지 않았습니다.
- 로컬 DB에서는 대상 상품 ID를 읽기만 했고 fixture나 데이터 쓰기를 만들지 않았습니다.
- 운영에서는 공개 상품·이미지와 Vercel 배포 정보만 읽기 검증했습니다.
- 결제, 운영 DB 쓰기, Vercel 환경변수·도메인 변경은 실행하지 않았습니다.
- secret, credential, 세션 쿠키, 환경변수 실제 값은 출력하거나 문서화하지 않았습니다.

## 저장소·배포 기준

- 검증 시작 시 `main=origin/main=054fccee03f491af430cdd8a9aea45ba4dc753cb`이고 작업 트리는 clean이었습니다.
- Vercel deployment `dpl_HoRpAUkqfuwaDMi1kYuwxADwGbTa`는 `READY`, target `production`, Git SHA `054fccee`입니다.
- `laonshop.com`, `www.laonshop.com` 별칭이 같은 운영 배포를 가리킵니다.
- 고정 deployment URL은 Vercel SSO로 302 보호되어 공개 자산 검증에는 apex를 사용했습니다. 이는 운영 apex의 제품 결함이 아닙니다.
- `AGENTS.md`와 `CLAUDE.md`는 바이트 단위로 동일합니다.

## 정적 검증

Node 22.23.1, pnpm 11.5.3에서 독립 실행했습니다.

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm test` | PASS | 51/51, fail 0, skip 0 |
| 이미지 파이프라인 | PASS | `python3 -m unittest -v tests/scripts/test_image_pipeline.py`, 3/3 |
| 이미지 gate | PASS | 레거시 329상품·1,316장 + 큐레이션 10상품·50장, 모두 1200x1500, exact duplicate 0 |
| `pnpm lint` | PASS | 오류 0 |
| `pnpm typecheck` | PASS | 오류 0 |
| `pnpm prisma validate` | PASS | schema valid |
| `pnpm audit --prod` | PASS | 알려진 취약점 0 |
| `pnpm build` | PASS | Next 15.5.19, static generation 20/20 |
| `git diff --check` | PASS | whitespace 오류 0 |

## 독립 코드 검토

| 검토 항목 | 결과 | 근거 |
| --- | --- | --- |
| manifest 경계 | PASS | 큐레이션 10개 slug와 각 5개 역할·경로를 명시하며 중복 slug·사진·경로를 로딩 시 거부합니다. |
| 정확한 whitelist | PASS | 이미지 복구 API와 저장 URL 정규화는 manifest에 등록된 정확한 경로만 허용합니다. |
| 대표컷 일치 | PASS | 큐레이션 대상은 목록·검색·상세·카트·최근상품 대표를 동일 로컬 `01.webp`로 수렴시킵니다. |
| 갤러리 구성 | PASS | 대상 상품은 로컬 `01.webp`~`05.webp`를 반환하고 비대상 상품은 기존 대표 1장 + 로컬 상세 4장을 유지합니다. |
| URL 안전 경계 | PASS | 허용 origin·path·version만 통과하며 임의 local path와 비 HTTP(S) URL은 제거합니다. |
| 품질 gate | PASS | 1200x1500, 누락, exact duplicate, 단일 프레임, 중앙 분할선, 인공 패딩을 test와 prebuild에서 검사합니다. |

## 10개 상품 50장 사람 검수

각 파일을 전체 크기로 열고 동일 상품 안의 색상·원단·칼라·단추·포켓·실루엣과 5개 촬영 역할을 교차 확인했습니다.

| 상품 | 5컷 일관성 | 독립 구도 | 집중 확인 결과 |
| --- | --- | --- | --- |
| `p-1dtc2le` 타탄 체크 오버셔츠 | PASS | PASS | 네이비·그린·머스터드·러스트 타탄, 포켓·단추 구조 일치 |
| `p-1acjf79` 오버핏 반팔 티셔츠 | PASS | PASS | 5장 모두 plain black oversized crew tee, 로고·포켓·다른 색 혼입 0 |
| `p-epq5m3` 미니멀 크루넥 니트 | PASS | PASS | 아이보리 크루넥·니트 조직·여유 실루엣 일치 |
| `p-16bll89` 링클프리 드레스 셔츠 | PASS | PASS | 5장 모두 단일 흰색 point-collar 셔츠, 다른 색·포켓 혼입 0 |
| `p-1uouwr1` 스트라이프 옥스포드 셔츠 | PASS | PASS | 청백 세로 스트라이프·가슴 포켓 일치, 칼라 끝 button-down 버튼 0 |
| `p-d3xnl2` 헤비웨이트 맨투맨 | PASS | PASS | 회색 크루넥·리브·헤비웨이트 실루엣 일치 |
| `p-1pqtxz7` 슬림핏 폴로 셔츠 | PASS | PASS | 스톤 컬러·2버튼 폴로 칼라·슬림 실루엣 일치 |
| `p-1vjw7ri` 워시드 데님 셔츠 | PASS | PASS | 워시드 블루·양쪽 플랩 포켓·스냅 구조 일치 |
| `p-1eg2rd6` 베이직 롱슬리브 티 | PASS | PASS | 5장 모두 plain black long-sleeve crew tee |
| `p-irwhuw` 릴랙스핏 카라 니트 | PASS | PASS | 네이비 리브·quarter-zip 카라·릴랙스 실루엣 일치 |

- hero / lifestyle / silhouette / product-only / detail이 서로 다른 구도와 거리로 구성됐습니다.
- 같은 원본 crop, 좌우 반쪽, diptych/contact sheet, 합성 패널, exact duplicate, 동일 자세 반복은 발견하지 못했습니다.
- 50장 모두 자연 크기 1200x1500, 4:5이며 비균일 확대나 가로 늘어짐을 발견하지 못했습니다.
- 상품명과 다른 품목·색·SKU·모델 의류 혼입을 발견하지 못했습니다.

## 전수 경로·운영 응답

- manifest의 큐레이션 상품 10개와 파일 50개를 전수 대조해 누락·추가 경로 0건을 확인했습니다.
- 운영 apex에서 50/50 파일이 HTTP 200, `image/webp`, 1200x1500으로 응답했고 로컬 SHA-256과 일치했습니다.
- 운영 상품 상세 10/10 HTML이 각 상품의 정확한 `01.webp`~`05.webp` 경로를 포함했습니다.
- 목록과 검색에서 대상 상품 대표는 manifest의 로컬 `01.webp`와 일치했습니다.

## Chromium 실제 브라우저

- 로컬 production Chrome 390px에서 10개 상품을 모두 열어 각 5장, 자연 비율 0.8, `01`~`05`, 대표 eager·나머지 lazy, broken 0을 확인했습니다.
- 320x568, 412x915, 1280x900에서 타탄·흰 셔츠·스트라이프 상품을 교차 확인했습니다. 문서 가로 overflow 0, 의미 있는 컨트롤 내부 clipping 0, console error/warning 0입니다.
- 운영 Chrome 390px에서 10개 상품 모두 5장과 동일 대표컷을 확인했습니다. cold lazy-load 표본은 재스크롤 후 5/5 디코딩됐습니다.
- 남성 목록에는 대상 10개 대표가 정확한 로컬 `01.webp`로 노출됐고 검색 `셔츠` 결과의 해당 6개도 일치했습니다.
- 상품→뒤로가기로 검색/목록 복귀, 새로고침 후 동일 경로·이미지 유지를 확인했습니다.
- 장바구니·최근상품 구형 URL의 상품·수량·사이즈·nonce 보존은 51개 자동 테스트의 집중 계약 테스트로 PASS했습니다. 브라우저 localStorage 직접 주입은 브라우저 안전 정책으로 실행하지 않았습니다.

## Safari·Android 교차 검증

| 환경 | 결과 | 실제 범위 |
| --- | --- | --- |
| macOS Safari 26.5.2 | PASS | 운영 남성 목록의 대상 10개, 스트라이프 상세 5장, desktop 레이아웃, 뒤로가기·새로고침 |
| Android 16/API 36 Chrome 133 | PASS | CSS 412x786, 대상 10개 상세 5장, 1200x1500·overflow 0, 목록·뒤로가기, 실제 화면 시각 확인 |
| Android system font scale 2.0 | PARTIAL | 목록 확대 렌더링과 overflow 0 확인. 백그라운드 CDP 상세 탭 renderer가 비어 상세 5장 자동 단정은 미실행 |
| iOS 26.5 Simulator MobileSafari | BLOCKED | 운영 상세 첫 화면은 보였으나 기존 타 앱 권한 modal과 이후 macOS host lock으로 목록·상세·뒤로가기·새로고침 전체 조작 미완료 |

- Android 정상 배율의 10개 상품은 모두 5장·412x515 표시·경로 일치·가로 overflow 0이었습니다.
- Android 200% 도구 실패 시 페이지 title과 URL은 유지됐고 console error는 없었지만 본문 renderer가 비어 제품 정상 증거로 간주하지 않았습니다.
- iOS SafariDriver는 실제 iOS 26.5 Simulator 세션 생성까지 성공했으나 host lock 뒤 navigation 결과를 회수하지 못했습니다. 제품 실패가 아닌 환경 차단으로 분류합니다.

## QA 도구 이슈 구분

- Android CDP의 뒤로가기 wait가 한 번 timeout됐지만 실제 URL은 남성 목록으로 전환돼 동작 자체는 PASS였습니다.
- Android 200% 백그라운드 탭은 title만 남고 빈 renderer로 캡처됐습니다. 정상 배율 실제 Chrome·운영 응답이 모두 정상이라 제품 결함으로 판정하지 않았습니다.
- iOS 임시 Simulator의 첫 부팅과 SafariDriver navigation은 CoreSimulator 불안정과 macOS host lock으로 중단됐습니다.
- 고정 Vercel deployment URL의 302 SSO 보호는 apex 운영 URL의 공개 제공과 분리했습니다.
- 위 도구 이슈를 catch 후 PASS로 처리하지 않았으며 필수 플랫폼 미완료 때문에 전체 결과를 PARTIAL로 판정했습니다.

## 결함과 잔여 위험

- 이번 변경의 신규 P0/P1/P2/P3 제품 결함은 발견하지 못했습니다.
- iOS MobileSafari의 목록·상세 5장·뒤로가기·새로고침을 host가 잠기지 않은 상태에서 재실행해야 전체 PASS로 올릴 수 있습니다.
- Android 200%는 목록과 폭만 확인됐으므로 상세 5컷·lazy-load의 실제 확대 상태를 재실행하는 것이 좋습니다.
- 전체 329개 중 큐레이션 교체는 1차 10개뿐이고 나머지 319개는 기존 레거시 갤러리입니다.
- 생성형 더미 이미지이므로 실제 판매 전 SKU 실사진으로 교체하고 색·봉제·상표·인물 표현을 다시 검수해야 합니다.
- 자산 증가에 따른 Vercel optimizer cold latency와 저장소 용량을 계속 관찰해야 합니다.

## cleanup

- DB fixture를 생성하지 않아 삭제 대상이 없습니다. 로컬·운영 DB 데이터는 변경하지 않았습니다.
- 로컬 3003 production 서버와 Android CDP 포워딩을 종료했습니다.
- Android `font_scale`을 1.0으로 복원하고 QA가 만든 운영 탭을 닫았습니다.
- QA용 임시 iOS Simulator를 삭제하고 기존 `LAON QA iPhone 17 Pro`를 원래처럼 booted 상태로 복원했습니다.
- 임시 브라우저 runner, 스크린샷, 감사 시트와 `/private/tmp/laonshop-054-*`를 삭제했습니다.
- 운영·마스터 데이터, Vercel env·도메인 설정, 결제 상태 변경은 없습니다.

## 최종 판정

큐레이션 대상 10개 상품의 50장은 manifest·파일·빌드 gate·운영 HTTP·브라우저와 사람의 전체 크기 시각 검수에서 동일한 결과를 보였습니다. 동일 SKU·색·구조를 유지하면서 5개 촬영 역할이 독립적이고, 목록·검색·상세 대표가 같은 로컬 세트로 수렴합니다. 신규 제품 결함은 발견하지 못했습니다.

다만 인계에서 필수로 지정한 iOS MobileSafari 전체 조작을 환경 차단으로 완료하지 못했고 Android 200% 상세도 자동 단정하지 않았으므로 전체 결과는 **PARTIAL**입니다. 제품 갤러리 자체는 **조건부 GO**이며, 두 미완료 플랫폼 회귀를 재실행해 PASS로 승격해야 합니다.
