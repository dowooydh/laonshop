import { cache } from "react";
import { prisma, Prisma } from "@/lib/db";
import { MANUAL_PAYMENT_DEMO_APPROVAL_PREFIX } from "@/lib/manual-payment-demo";
import { carrierLabel, isMissingCommerceTable, maskReviewAuthor } from "./policy";

const paidOrderWhere: Prisma.ShopOrderWhereInput = {
  status: "PAID",
  paidAt: { not: null },
  OR: [{ approvalNo: null }, { approvalNo: { not: { startsWith: MANUAL_PAYMENT_DEMO_APPROVAL_PREFIX } } }],
};

export const getCommerceReadiness = cache(async (): Promise<{ ready: boolean }> => {
  const rows = await prisma.$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`
    SELECT to_regclass('"ShopProductReview"') IS NOT NULL
      AND to_regclass('"ShopShipment"') IS NOT NULL
      AND to_regclass('"ShopShipmentEvent"') IS NOT NULL
      AND (SELECT COUNT(*) FROM pg_constraint WHERE convalidated AND (
        (conrelid = to_regclass('"ShopProductReview"') AND conname IN ('ShopProductReview_rating_check', 'ShopProductReview_content_check')) OR
        (conrelid = to_regclass('"ShopShipment"') AND conname = 'ShopShipment_valid_check') OR
        (conrelid = to_regclass('"ShopShipmentEvent"') AND conname = 'ShopShipmentEvent_valid_check')
      )) = 4
      AND EXISTS (SELECT FROM pg_trigger WHERE tgrelid = to_regclass('"ShopShipmentEvent"')
        AND tgname = 'laonshop_shipment_event_immutable' AND tgenabled IN ('O', 'A')) AS ready
  `);
  return { ready: rows[0]?.ready === true };
});

export async function getProductReviews(productId: string) {
  const empty = { available: false, total: 0, averageRating: null as number | null, reviews: [] as Array<{
    id: string; rating: number; content: string; authorLabel: string; purchasedSize: string | null; createdAt: Date;
  }> };
  if (!(await getCommerceReadiness()).ready) return empty;
  try {
    const where: Prisma.ShopProductReviewWhereInput = {
      productId,
      order: { ...paidOrderWhere, shipment: { status: "DELIVERED" } },
    };
    const [summary, reviews] = await Promise.all([
      prisma.shopProductReview.aggregate({ where, _count: true, _avg: { rating: true } }),
      prisma.shopProductReview.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20,
        select: { id: true, rating: true, content: true, createdAt: true,
          user: { select: { name: true } }, orderItem: { select: { size: true } } },
      }),
    ]);
    return { available: true, total: summary._count, averageRating: summary._avg.rating,
      reviews: reviews.map((review) => ({ id: review.id, rating: review.rating, content: review.content,
        createdAt: review.createdAt, authorLabel: maskReviewAuthor(review.user.name), purchasedSize: review.orderItem.size })) };
  } catch (error) {
    if (isMissingCommerceTable(error)) return empty;
    throw error;
  }
}

export async function getReviewableItems(userId: string, productId: string) {
  const empty = { available: false, items: [] as Array<{ id: string; orderId: string; orderNumber: string; name: string; size: string | null }> };
  if (!(await getCommerceReadiness()).ready) return empty;
  try {
    const items = await prisma.shopOrderItem.findMany({
      where: { productId, review: null, order: { ...paidOrderWhere, userId, shipment: { status: "DELIVERED" } } },
      select: { id: true, orderId: true, name: true, size: true, order: { select: { moid: true } } },
      orderBy: { id: "desc" }, take: 50,
    });
    return { available: true, items: items.map((item) => ({ id: item.id, orderId: item.orderId,
      name: item.name, size: item.size, orderNumber: item.order.moid })) };
  } catch (error) {
    if (isMissingCommerceTable(error)) return empty;
    throw error;
  }
}

export async function getOrderShipment(orderId: string) {
  const empty = { available: false, shipment: null as null | {
    carrier: string; carrierLabel: string; trackingNumber: string; status: "SHIPPED" | "DELIVERED";
    shippedAt: Date; deliveredAt: Date | null; events: Array<{ id: string; action: string; createdAt: Date }>;
  } };
  if (!(await getCommerceReadiness()).ready) return empty;
  try {
    const shipment = await prisma.shopShipment.findUnique({ where: { orderId }, select: {
      carrier: true, trackingNumber: true, status: true, shippedAt: true, deliveredAt: true,
      events: { select: { id: true, action: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    } });
    if (!shipment) return { available: true, shipment: null };
    if (shipment.status !== "SHIPPED" && shipment.status !== "DELIVERED") throw new Error("배송 상태를 확인할 수 없습니다.");
    return { available: true, shipment: { ...shipment, status: shipment.status as "SHIPPED" | "DELIVERED", carrierLabel: carrierLabel(shipment.carrier) } };
  } catch (error) {
    if (isMissingCommerceTable(error)) return empty;
    throw error;
  }
}
