import type { Prisma } from "@prisma/client";
import { acquireTransactionLock } from "@/lib/order-guard";
import type { BillingPaymentMethod } from "./billing-contract";
import { paymentMethodData, paymentMethodSyncData } from "./billing-policy";

const OWNED_METHOD_SELECT = {
  id: true,
  userId: true,
  status: true,
  deregisterIdempotencyKey: true,
} as const;

/**
 * LAONPAY opaque 결제수단 ID는 전 파트너 응답에서 유일해야 한다. 아직 로컬 행이
 * 없는 두 사용자가 같은 provider ID를 동시에 받더라도 전역 advisory lock 뒤
 * 소유자를 다시 확인해 한 사용자에게만 결박한다.
 */
export async function upsertOwnedBillingPaymentMethod(
  tx: Prisma.TransactionClient,
  userId: string,
  method: BillingPaymentMethod,
) {
  await acquireTransactionLock(
    tx,
    `billing-provider-method:${method.id}`,
  );
  const existing = await tx.shopBillingPaymentMethod.findUnique({
    where: { laonpayPaymentMethodId: method.id },
    select: OWNED_METHOD_SELECT,
  });
  if (existing && existing.userId !== userId) {
    throw new Error("결제수단 소유권 불일치");
  }
  if (existing) {
    await acquireTransactionLock(tx, `billing-method:${existing.id}`);
  }
  const lockedExisting = existing
    ? await tx.shopBillingPaymentMethod.findUnique({
        where: { id: existing.id },
        select: OWNED_METHOD_SELECT,
      })
    : null;
  if (
    (existing && !lockedExisting) ||
    (lockedExisting && lockedExisting.userId !== userId)
  ) {
    throw new Error("결제수단 소유권 불일치");
  }

  const synchronized = await tx.shopBillingPaymentMethod.upsert({
    where: { laonpayPaymentMethodId: method.id },
    create: { userId, ...paymentMethodData(method) },
    update: paymentMethodSyncData(method, lockedExisting),
    select: { id: true, userId: true, status: true },
  });
  if (synchronized.userId !== userId) {
    throw new Error("결제수단 소유권 불일치");
  }
  return synchronized;
}
