import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

export type RequestedOrderItem = {
  productId: string;
  qty: number;
  size?: string | null;
};

type InventoryProduct = {
  id: string;
  name: string;
  price: number;
  sizes: string | null;
  stock: number;
  active: boolean;
};

export type PreparedOrderItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  size: string | null;
};

export type InventoryCheck =
  | { ok: true; items: PreparedOrderItem[]; total: number }
  | { ok: false; error: string };

type ReservedQuantity = { productId: string; qty: number };

export const PENDING_RESERVATION_MINUTES = 30;
export const PAYMENT_PROCESSING_MARKER = "__KSPAY_PROCESSING__";

export function shouldStartKspayApproval(
  status: string,
  approvalNo: string | null,
  hasCommConId: boolean,
  isCanceled: boolean,
): boolean {
  return (
    status === "PENDING" &&
    approvalNo !== PAYMENT_PROCESSING_MARKER &&
    (hasCommConId || isCanceled)
  );
}

export function mergeRequestedItems(items: RequestedOrderItem[]): RequestedOrderItem[] {
  const merged = new Map<string, RequestedOrderItem>();

  for (const item of items) {
    const size = item.size?.trim() || null;
    const key = `${item.productId}\u0000${size ?? ""}`;
    const previous = merged.get(key);
    merged.set(key, {
      productId: item.productId,
      size,
      qty: (previous?.qty ?? 0) + item.qty,
    });
  }

  return [...merged.values()];
}

export function validateInventorySnapshot(
  products: InventoryProduct[],
  reservedQuantities: ReservedQuantity[],
  requestedItems: RequestedOrderItem[],
): InventoryCheck {
  const items = mergeRequestedItems(requestedItems);
  if (items.length === 0) return { ok: false, error: "장바구니가 비어 있습니다." };

  const productMap = new Map(products.map((product) => [product.id, product]));
  const requestedByProduct = new Map<string, number>();
  const reservedByProduct = new Map(reservedQuantities.map((row) => [row.productId, Number(row.qty)]));
  const prepared: PreparedOrderItem[] = [];
  let total = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product?.active) {
      return {
        ok: false,
        error: "판매가 종료된 상품이 장바구니에 있습니다. 장바구니를 정리한 뒤 다시 시도해 주세요.",
      };
    }
    if (!Number.isInteger(item.qty) || item.qty <= 0 || item.qty > 99) {
      return { ok: false, error: "상품별 수량은 1개 이상 99개 이하로 주문해 주세요." };
    }

    const allowedSizes = (product.sizes ?? "")
      .split(",")
      .map((size) => size.trim())
      .filter(Boolean);
    if (allowedSizes.length > 0 && (!item.size || !allowedSizes.includes(item.size))) {
      return { ok: false, error: `${product.name}의 사이즈를 다시 선택해 주세요.` };
    }
    if (allowedSizes.length === 0 && item.size) {
      return { ok: false, error: `${product.name}에는 선택할 수 없는 사이즈가 포함되어 있습니다.` };
    }

    requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.qty);
    const lineAmount = product.price * item.qty;
    if (!Number.isSafeInteger(lineAmount) || lineAmount < 0) {
      return { ok: false, error: "주문 금액을 계산할 수 없습니다." };
    }
    total += lineAmount;
    prepared.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: item.qty,
      size: item.size ?? null,
    });
  }

  for (const [productId, requested] of requestedByProduct) {
    const product = productMap.get(productId)!;
    const reserved = reservedByProduct.get(productId) ?? 0;
    if (reserved + requested > product.stock) {
      return { ok: false, error: `재고가 부족한 상품이 있습니다: ${product.name}` };
    }
  }

  if (!Number.isSafeInteger(total) || total <= 0) {
    return { ok: false, error: "주문 금액을 계산할 수 없습니다." };
  }
  return { ok: true, items: prepared, total };
}

export function createIdempotentMoid(userId: string, idempotencyKey: string): string {
  const digest = createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex").slice(0, 30);
  return `LP${digest.toUpperCase()}`;
}

export async function acquireTransactionLock(tx: Prisma.TransactionClient, scope: string): Promise<void> {
  // PostgreSQL 함수 반환형은 void라 Prisma가 직접 역직렬화할 수 없다. text로 캐스팅하되
  // SELECT가 완료될 때까지 기다리는 함수의 잠금 동작은 그대로 유지한다.
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text AS "lock"
  `);
}

export async function lockAndValidateInventory(
  tx: Prisma.TransactionClient,
  requestedItems: RequestedOrderItem[],
  excludeOrderId?: string,
): Promise<InventoryCheck> {
  const merged = mergeRequestedItems(requestedItems);
  const productIds = [...new Set(merged.map((item) => item.productId))].sort();
  if (productIds.length === 0) return { ok: false, error: "장바구니가 비어 있습니다." };

  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(productIds)}) ORDER BY "id" FOR UPDATE`,
  );

  const products = await tx.product.findMany({ where: { id: { in: productIds } } });
  const exclude = excludeOrderId ? Prisma.sql`AND o."id" <> ${excludeOrderId}` : Prisma.empty;
  const reserved = await tx.$queryRaw<ReservedQuantity[]>(Prisma.sql`
    SELECT oi."productId", COALESCE(SUM(oi."qty"), 0)::int AS "qty"
    FROM "ShopOrderItem" oi
    JOIN "ShopOrder" o ON o."id" = oi."orderId"
    WHERE oi."productId" IN (${Prisma.join(productIds)})
      ${exclude}
      AND (
        o."status" IN ('PAID', 'CANCEL_REQUESTED')
        OR (
          o."status" = 'PENDING'
          AND (
            o."approvalNo" = ${PAYMENT_PROCESSING_MARKER}
            OR o."updatedAt" >= NOW() - INTERVAL '30 minutes'
          )
        )
      )
    GROUP BY oi."productId"
  `);

  return validateInventorySnapshot(products, reserved, merged);
}
