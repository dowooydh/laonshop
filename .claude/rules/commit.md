# 커밋 메시지 규칙

형식: `<타입>(<범위>): <설명>` — 설명은 한국어, 명령형/요약형.

## 타입
| 타입 | 의미 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 동작 변화 없는 구조 개선 |
| `style` | 포맷팅(로직 변화 없음) |
| `docs` | 문서 |
| `chore` | 빌드/설정/잡무 |
| `test` | 테스트 |

## 범위 (생략 가능)
`shop`, `db`, `pg`, `auth`, `ui`, `product`, `order`, `payment`, `seed`, `ci`

## 예시
```
feat(shop): 상품 상세 — 사이즈 선택 후 장바구니 담기
fix(pg): KSPAY 결제창 jQuery 의존성 로드 (_pay $ is not defined 수정)
chore(ci): Vercel 배포 설정
```

## 본문 (권장)
- 비개발자(운영/기획)가 이해할 한국어 요약 1~3줄을 본문에 포함한다.
- **PG 스펙·카드사 심사 관련** 변경은 *왜* 그렇게 했는지(어떤 규칙 근거인지)를 한 줄 남긴다.

## AI 보조 커밋
AI가 작성/보조한 커밋은 트레일러를 마지막에 둔다:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## 금지
secrets(`.env`·PG 상점키·세션 시크릿)·카드정보·대용량 원본(`*.zip` 등)을 커밋에 포함하지 않는다. (`.gitignore` 확인)
