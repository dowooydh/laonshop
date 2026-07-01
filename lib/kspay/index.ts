import { KspayProvider } from "./kspay-provider";
import type { PgMode, PgProvider } from "./types";

export * from "./types";
export { KspayProvider } from "./kspay-provider";

let cached: PgProvider | null = null;

/**
 * PG 프로바이더 — laonshop은 KSNET KSPAY 결제창만 사용.
 * PG_MODE=kspay 이고 KSPAY_STORE_ID(테스트 MID 2999199999)가 있어야 한다.
 * 미확보 스펙(구인증/취소/정기결제 등)은 KspayProvider 내부에서 NEEDS_PG_SPEC throw.
 */
export function getPgProvider(): PgProvider {
  if (cached) return cached;
  const mode = (process.env.PG_MODE ?? "kspay") as PgMode;
  if (mode !== "kspay") {
    throw new Error(`laonshop은 PG_MODE=kspay만 지원합니다 (현재: ${mode})`);
  }
  const storeId = process.env.KSPAY_STORE_ID;
  if (!storeId) throw new Error("PG_MODE=kspay 인데 KSPAY_STORE_ID가 없습니다 (.env 확인)");
  cached = new KspayProvider({ storeId, storeKey: process.env.KSPAY_STORE_KEY });
  return cached;
}
