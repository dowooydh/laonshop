# 55465ce 통신판매업신고번호 회귀 검증

작성일: 2026-07-22

검증 제품 SHA: `55465ce5cf268a6f897536f6136b9668b6ab6bcc`

비교 범위: `3068c64df156320973f0b28d52888ba03304b6ce..55465ce5cf268a6f897536f6136b9668b6ab6bcc`

운영 배포: `dpl_HEvkp7tL2fWt511YcztVS8MLCErG` / `https://laonshop.com`

결과: **PASS**

## 판정

- 발급된 통신판매업신고번호 `2025-성남분당A-0152`가 공통 footer에 정확히 표시됩니다.
- 공개 화면에 기존 `신고 예정` 문구가 남지 않았습니다.
- 최소 지원 폭과 루트 글자 200%에서 사업자정보, 정책 링크, 전화, 이메일이 잘리거나 가로로 넘치지 않습니다.
- 신고증 원본 PDF와 `reference/legal` 경로는 Git, 공개 자산, production build, 실제 운영 네트워크에 노출되지 않습니다.
- 신규 P0/P1/P2 결함은 발견하지 않았으며 이 변경은 출시 가능합니다.

## 변경 독립 검토

- 제품 변경은 `app/layout.tsx`의 공통 footer 문구 1건입니다.
- API, DB schema, 인증, 세션, 주문, 결제, 관리자 동작 변경은 없습니다.
- `tests/api/business-info.test.ts`는 정확한 신고번호와 `신고 예정` 부재를 자동 회귀로 고정합니다.
- `AGENTS.md`와 `CLAUDE.md`는 바이트 단위로 동일합니다.
- `git diff --check 3068c64..55465ce`를 통과했습니다.

## 정적 검증

환경: Node `22.23.1`, pnpm `11.5.3`

| 검증 | 결과 |
| --- | --- |
| `pnpm exec tsx --test tests/api/business-info.test.ts` | PASS 1/1, skip 0 |
| `pnpm test` | PASS 126/126, fail 0, skip 0 |
| 이미지 무결성 gate | PASS: 상품 329개/1,316장, 큐레이션 20상품/100장 |
| `pnpm lint` | PASS, warning 0 |
| `pnpm typecheck` | PASS |
| `pnpm prisma validate` | PASS, 기존 Prisma 7 설정 deprecation warning만 존재 |
| `pnpm audit --prod` | PASS, 알려진 취약점 0 |
| `pnpm build` | PASS, Next 15.5.19, static generation 20/20 |

## 운영 배포

- Vercel deployment `dpl_HEvkp7tL2fWt511YcztVS8MLCErG`은 `READY`, `production`, `sin1`입니다.
- 배포 Git SHA, local HEAD, `origin/main`이 모두 `55465ce5cf268a6f897536f6136b9668b6ab6bcc`로 일치했습니다.
- `laonshop.com`, `www.laonshop.com` alias가 연결됐고 alias error가 없습니다.
- `www.laonshop.com`은 `https://laonshop.com/`으로 308 정규화됩니다.
- 최근 1시간 runtime error cluster 0, 해당 배포 error/fatal log 0입니다.
- 고정 배포 URL은 Vercel 인증으로 302되므로 실제 공개 브라우저 회귀는 production apex에서 수행했습니다.

## 브라우저 회귀

운영 `https://laonshop.com`을 Google Chrome/Playwright로 실제 렌더링했습니다.

- 경로: 홈, 개인정보처리방침, 로그인, 상품 상세 1개
- 화면 폭: 320, 360, 390, 412, 1280px
- 글자 크기: 루트 100%, 200%
- 총 조합: 4경로 x 5폭 x 2배율 = 40

모든 조합에서 다음을 단정했습니다.

- footer의 정확한 신고번호 노출 1회
- `신고 예정` 노출 0회
- `document.scrollWidth <= clientWidth`
- footer visible descendant의 viewport 이탈 0
- `overflow-x: hidden|clip` 조상에 의한 clipping 0
- 정책 링크 6개의 href 유지 및 44px 이상 높이
- 전화 `tel:070-4044-7008`, 이메일 `mailto:custom_sales@customorder.co.kr` 유지
- 콘솔 오류 0, 실제 실패 요청 0, HTTP 4xx/5xx 0

이용약관, 개인정보처리방침, 청약철회·교환·환불, 배송, FAQ 5개 footer 목적지도 각각 운영 GET 200과 동일 footer 문구를 확인했습니다. 페이지 전환 중 Next prefetch/lazy image의 `net::ERR_ABORTED`는 브라우저의 정상 탐색 취소로 분리했으며, 이를 제외한 실패 요청은 0건입니다.

320px·200% full-page 증거를 사람이 추가 확인해 신고번호, 주소, 전화, 이메일이 여러 줄로 자연스럽게 재배치되고 글자가 잘리지 않는 것을 확인했습니다. 증거 이미지는 개인정보를 포함하지 않았으며 QA 완료 후 임시 러너와 함께 삭제했습니다.

## 공개 비노출

- `git ls-files` 기준 `reference/legal/**` 및 PDF 추적 파일 0개
- `.gitignore:36`의 `/reference/` 규칙으로 `reference/legal` 제외 확인
- `public`, `.next/server`, `.next/static`에서 `.pdf` 또는 `reference/legal` 참조 0개
- 40개 운영 렌더와 정책 목적지 탐색의 resource URL에서 PDF, `reference/legal`, birth/resident 단서 0개
- 운영 `/reference/legal`은 trailing slash 정규화 후 404

제품에는 결제 입력 안내로 일반적인 생년월일 필드가 존재하므로, 개인정보 비노출 판정은 해당 기능 문구가 아니라 신고증 파일·경로·실제 대표자 개인정보 값의 공개 여부를 기준으로 했습니다. 개인정보 보호를 위해 로컬 신고증 원본은 열거나 OCR하지 않았습니다.

## 발견 결함

없습니다.

## 미실행 범위

- 신고증 원본 PDF 내용의 OCR/문자 대조는 개인정보 노출 방지를 위해 수행하지 않았습니다. 표시 번호는 인계된 발급 번호와 저장소 기준 문서에 대조했습니다.
- API/DB/인증/결제 기능 변경이 없어 DB write, 로그인 사용자 흐름, PG 호출은 수행하지 않았습니다.

## Cleanup

- 일회성 Playwright runner와 320px·200% screenshot을 삭제했습니다.
- 브라우저 context와 process를 종료했습니다.
- 테스트 데이터, DB, 운영 env, Vercel 설정, PG 상태를 변경하지 않았습니다.
- 제품 코드는 수정하지 않았습니다.

## 출시 판단

통신판매업신고번호 footer 반영 범위는 **PASS / GO**입니다. 발급 번호가 공통 layout에 일관되게 표시되고 최소 폭·큰 글자에서도 완전히 읽히며, 원본 신고증과 개인정보는 공개 산출물에 포함되지 않습니다.
