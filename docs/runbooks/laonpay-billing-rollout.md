# LAONPAY 등록카드·원클릭 운영 전환 런북

이 문서는 LAONSHOP의 LAONPAY 호스팅 카드등록·원클릭 결제를 **forward-only**로 준비하고, 문제가 생기면 외부 재승인 없이 안전하게 닫는 절차입니다. 실제 환경변수 값, 카드 원문, KSNET `billingToken`, PG 인증정보는 이 문서·명령 출력·로그·DB 일반 필드에 남기지 않습니다.

## 현재 기본 상태: HOLD

- 운영 additive SQL, LAONPAY keyring·파트너 공개키·활성화, KSNET 빌링 권한·개발 `pgapi`, 실제 hosted 상호운용 검증이 모두 완료되기 전까지 기능을 열지 않습니다.
- LAONSHOP에는 KSNET MID·`pgapi`를 추가하지 않습니다. 카드 원문은 LAONPAY hosted origin에서만 입력하고 LAONSHOP 브라우저·서버·DB를 통과하지 않습니다.
- 공용 개발 MID `2999199999`는 개발계 응답 시연용이며 실제 카드 청구 가능 상태를 뜻하지 않습니다.
- `prisma db push`, seed, 실카드·실 PG 호출, 운영 주문 생성으로 이 전환을 대신하지 않습니다.

## 게이트 의미

| 게이트 | 값 | 의미 |
| --- | --- | --- |
| `LAONPAY_BILLING_SCHEMA_READY` | `1` | additive schema와 post-verify가 완료되어 기존 원장 조회·상태 대사가 가능합니다. |
| `LAONPAY_BILLING_FEATURE_ENABLED` | `1` | 신규 등록·신규 원클릭 청구를 사용자에게 엽니다. schema gate보다 먼저 열면 안 됩니다. |

feature gate를 내려도 이미 생성된 `PENDING`·`PROCESSING`·`UNKNOWN` 원장의 signed GET 대사는 유지해야 합니다. 이를 위해 미결 원장이 있는 동안 schema gate, 파트너 키 3종, API base를 제거하지 않습니다.

## 0. 사전 승인과 기준선

1. 변경창·담당자·백업·복구 책임자를 확정합니다.
2. LAONPAY 제품/계약 SHA, LAONSHOP 제품 SHA, Vercel Production 배포 SHA를 기록합니다.
3. `DIRECT_URL` 대상이 운영 direct endpoint인지 로컬에서만 확인합니다. URL 값 자체를 채팅·문서·로그에 출력하지 않습니다.
4. 운영 DB의 스키마 전용 백업과 복원 가능 시점을 확보합니다.
5. 아래 사전검사는 닫힌 상태에서도 성공할 수 있게 실행합니다. 이 명령은 현재 셸에 주입된 값만 검사하며 Vercel 값을 자동으로 내려받지 않습니다.

```bash
pnpm billing:preflight --allow-closed
```

`INVALID`가 하나라도 있으면 중단합니다. `CLOSED`는 아직 활성화하지 않았다는 정상 상태입니다.

## 1. 기존 `db push` DB와 baseline resolve 정책

이 저장소의 기존 운영 DB는 migration history 없이 만들어졌고 현재 승인된 `prisma/migrations` baseline artifact가 없습니다. 따라서 **이번 전환에서는 `prisma migrate deploy/resolve`를 실행하지 않고**, 독립 검토된 forward-only `001_additive.sql`만 변경창에서 직접 적용합니다.

향후 Prisma migrate를 도입할 때만 별도 변경으로 전체 baseline artifact를 생성·독립 검토하고, 당시 운영 스키마와 일치함을 확인한 후 다음과 같이 resolve합니다. 이름을 추측하거나 현재 rollout에 끼워 넣지 않습니다.

```bash
pnpm exec prisma migrate resolve --applied "$LAONSHOP_BASELINE_MIGRATION"
pnpm exec prisma migrate status
```

baseline resolve는 향후 migration history 도입 절차이며 이번 additive SQL 적용의 선행 조건이 아닙니다. `db push`나 seed로 대체하지 않습니다.

## 2. additive schema 적용

기능·schema 게이트를 닫은 채 승인된 direct connection에서 실행합니다. SQL은 신규 enum·원장 테이블·인덱스·소유권 FK만 추가하며 기존 테이블·데이터를 삭제하지 않습니다.

```bash
psql "$DIRECT_URL" --set=ON_ERROR_STOP=1 \
  --file ops/laonpay-billing/sql/001_additive.sql
```

- 실패하면 같은 파일을 무작정 반복하지 말고 오류 원인과 transaction rollback 여부를 확인합니다.
- 운영 seed는 실행하지 않습니다.
- 과거 `ShopBillingCard.billingToken` 물리 컬럼 삭제는 이 SQL의 범위가 아닙니다.

## 3. read-only post-verify

```bash
pnpm billing:schema:verify
```

enum, 필수 컬럼·기본값, 금지된 민감 컬럼 부재, unique/index, FK와 복합 소유권 결박 중 하나라도 다르면 예외로 종료합니다. 이 검사는 실제 행이나 비밀값을 출력하지 않습니다. 실패 시 두 게이트를 계속 닫고 원인을 수정합니다.

## 4. schema gate만 열어 배포

1. LAONPAY 운영 migration·keyring·LAONSHOP 공개키·파트너 활성화·return target가 준비됐는지 LAONPAY 담당자와 교차 확인합니다.
2. Vercel Production scope에 서버 전용 파트너 환경변수 3종과 고정 앱 URL을 안전하게 설정합니다. 값을 터미널 출력이나 문서로 복사하지 않습니다.
3. `LAONPAY_BILLING_SCHEMA_READY=1`, `LAONPAY_BILLING_FEATURE_ENABLED=0`으로 배포합니다.
4. 새 등록 버튼·새 원클릭 결제가 계속 닫혀 있고, 기존 원장 조회·UNKNOWN 대사만 가능한지 확인합니다.
5. readiness는 아직 `CLOSED`가 정상입니다. Vercel Production 값은 로컬 셸에 자동으로 주입되지 않으므로 승인된 운영 담당자만 아래처럼 권한이 `0600`인 임시 파일로 내려받아 검사하고 즉시 삭제합니다. 명령 추적(`set -x`)과 파일 내용 출력은 금지합니다.

```bash
(
  set -eu
  set +x
  umask 077
  tmp_env="$(mktemp /private/tmp/laonshop-billing-production.XXXXXX)"
  trap 'rm -f "$tmp_env"' EXIT HUP INT TERM
  vercel env pull "$tmp_env" --environment=production --yes
  VERCEL_ENV=production pnpm exec tsx --env-file="$tmp_env" scripts/check-laonpay-billing-readiness.ts --allow-closed
)
```

`LAONPAY_BILLING_FEATURE_ENABLED=1`인데 다른 전제 중 하나라도 닫혀 있으면 `INVALID`입니다. `--allow-closed`로 이 모순을 통과시킬 수 없습니다.

## 5. 격리 상호운용과 feature gate

실제 기능을 열기 전에 격리 환경에서 다음을 모두 통과해야 합니다.

먼저 저장소의 loopback HTTP 계약 harness를 실행합니다. 이 테스트는 실제 LAONPAY·KSNET·DNS·운영 DB에 접속하지 않습니다.

```bash
pnpm test:billing:interop
pnpm test:billing:schema
```

`test:billing:schema`는 로컬 PostgreSQL 바이너리가 있는 환경에서 임시 클러스터를 만들고 additive SQL 2회 적용, 정상 post-verify, 잘못된 default·금지 민감 컬럼의 실패를 확인한 뒤 전체 삭제합니다.

- hosted 등록 intent → 고정 HTTPS 복귀 → signed GET 확정
- 등록카드 목록과 고객·결제수단 소유권
- 서버 재계산 금액의 청구 → 상태조회
- timeout/5xx/`UNKNOWN`에서 자동 재승인 없음
- 전체취소 요청만 생성하고 signed GET으로 `DONE`/`REJECTED` 대사
- 해지 결과 불명확 시 자동 재해지 없음
- 카드 원문·provider token·서명키가 client payload, DOM, 로그, Audit, 허용되지 않은 DB 필드에 없음

외부 readiness와 독립 QA 승인을 받은 뒤에만 `LAONPAY_BILLING_FEATURE_ENABLED=1`로 설정하고 새 Production 배포를 만듭니다.

```bash
(
  set -eu
  set +x
  umask 077
  tmp_env="$(mktemp /private/tmp/laonshop-billing-production.XXXXXX)"
  trap 'rm -f "$tmp_env"' EXIT HUP INT TERM
  vercel env pull "$tmp_env" --environment=production --yes
  VERCEL_ENV=production pnpm exec tsx --env-file="$tmp_env" scripts/check-laonpay-billing-readiness.ts
)
```

모든 항목이 `READY`가 아니면 기능을 열지 않습니다.

## 6. 활성화 직후 관찰

- 신규 intent·charge·cancel request가 사용자·주문당 한 건으로 수렴하는지 확인합니다.
- `REQUESTING`, `PENDING`, `PROCESSING`, `UNKNOWN`, `DEREGISTERING`의 체류시간과 증가율을 관찰합니다.
- timeout/5xx 뒤 POST 수가 자동 증가하지 않고 signed GET 또는 같은 멱등키 reconciliation만 수행되는지 확인합니다.
- 브라우저·서버·Vercel 로그에 카드 원문, provider token, Authorization, 서명키가 없는지 마스킹 기준으로 점검합니다.
- 운영 쓰기 시연과 실카드 테스트는 별도 승인 범위에서만 수행합니다.

## 안전한 rollback

1. **먼저** `LAONPAY_BILLING_FEATURE_ENABLED=0`으로 내리고 배포합니다. 신규 등록·신규 청구를 차단합니다.
2. 미결 원장이 있으면 `LAONPAY_BILLING_SCHEMA_READY=1`과 파트너 환경변수 3종을 유지해 signed GET 대사를 계속합니다.
3. 기존 KSPAY 인증결제만 노출되고 LAONPAY 신규 외부 POST가 0인지 확인합니다.
4. 원인이 해결되기 전 feature gate를 다시 올리지 않습니다.
5. 모든 원장이 terminal이고 감사·대사가 끝난 뒤에만 schema gate·파트너 키 제거를 별도 승인합니다.

자동 down migration은 없습니다. 새 원장 테이블·enum·기존 unique/index/FK를 `DROP`, `TRUNCATE`, `DELETE`하지 않습니다. 물리 스키마 제거가 필요하면 백업·행 수 검증·법적 보존 검토·별도 승인·별도 SQL로 수행합니다.

## legacy token 정리: 별도 HOLD

과거 mock `billingToken`은 Prisma Client에서 `@ignore`로 숨기되, 승인 전 `db push`가 운영 물리 컬럼 삭제를 제안하지 않도록 desired schema에는 보존합니다. 과거 행의 보존·폐기 정책, 참조 코드 0건, 백업, 감사 승인을 확인하기 전에는 `ShopBillingCard.billingToken` 컬럼이나 레코드를 변경하지 않습니다. 이 런북과 `001_additive.sql`은 legacy token 정리를 승인하지 않습니다.
