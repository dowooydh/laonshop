import { prisma, Prisma } from "@/lib/db";
import { acquireTransactionLock } from "@/lib/order-guard";
import { z } from "zod";
import { getCommerceReadiness } from "./queries";
import { COMMERCE_PREPARING_MESSAGE, canFulfilOrder, isMissingCommerceTable, validShipmentInput, type CommerceActionState } from "./policy";

const reviewSchema = z.object({
  orderItemId: z.string().trim().min(1).max(100), rating: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().min(10, "후기는 10자 이상 작성해 주세요.").max(2000, "후기는 2,000자 이내로 작성해 주세요."),
});
const shipmentSchema = z.object({
  orderId: z.string().trim().min(1).max(100),
  carrier: z.string().trim(), trackingNumber: z.string().trim(),
  note: z.string().trim().max(500, "메모는 500자 이내로 입력해 주세요.").default(""),
}).refine((value) => validShipmentInput(value.carrier, value.trackingNumber), "택배사와 8~20자리 숫자 송장번호를 확인해 주세요.");
const completionSchema = z.object({ orderId: z.string().trim().min(1).max(100), note: z.string().trim().min(5, "배송 완료 확인 내용을 5자 이상 입력해 주세요.").max(500) });
const options = { maxWait: 5000, timeout: 15000 } as const;
const errorState = (message: string): CommerceActionState => ({ status: "error", message });

async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await acquireTransactionLock(tx, `order:${orderId}`);
  // 일반 취소 요청의 UPDATE와도 직렬화한다. 결제/취소 상태 자체는 변경하지 않는다.
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ShopOrder" WHERE "id" = ${orderId} FOR UPDATE`);
}

export async function createVerifiedReview(userId: string, input: unknown): Promise<CommerceActionState & { productId?: string }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "후기 내용을 확인해 주세요.");
  if (!(await getCommerceReadiness()).ready) return errorState(COMMERCE_PREPARING_MESSAGE);
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.shopOrderItem.findFirst({ where: { id: parsed.data.orderItemId, order: { userId } }, select: { id: true, orderId: true, productId: true } });
      if (!item) return errorState("배송 완료된 본인 구매 상품만 후기를 작성할 수 있습니다.");
      await lockOrder(tx, item.orderId);
      const [order, activeUser] = await Promise.all([
        tx.shopOrder.findFirst({ where: { id: item.orderId, userId }, include: { shipment: true } }),
        tx.shopUser.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } }),
      ]);
      if (!activeUser || !order || !canFulfilOrder(order) || order.shipment?.status !== "DELIVERED") return errorState("배송 완료된 본인 구매 상품만 후기를 작성할 수 있습니다.");
      await tx.shopProductReview.create({ data: { orderItemId: item.id, orderId: item.orderId, userId,
        productId: item.productId, rating: parsed.data.rating, content: parsed.data.content } });
      return { status: "success", message: "구매후기를 등록했습니다.", productId: item.productId };
    }, options);
  } catch (error) {
    if (isMissingCommerceTable(error)) return errorState(COMMERCE_PREPARING_MESSAGE);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return errorState("이 구매 상품에는 이미 후기를 작성했습니다.");
    throw error;
  }
}

async function adminAndOrder(tx: Prisma.TransactionClient, actorUserId: string, orderId: string): Promise<
  { error: string } | { order: Prisma.ShopOrderGetPayload<{ include: { shipment: true } }> }
> {
  const actor = await tx.shopUser.findFirst({ where: { id: actorUserId, role: "ADMIN", deletedAt: null }, select: { id: true } });
  if (!actor) return { error: "관리자 권한을 확인해 주세요." } as const;
  await lockOrder(tx, orderId);
  const order = await tx.shopOrder.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order || !canFulfilOrder(order)) return { error: "결제 완료된 실제 주문에만 배송을 기록할 수 있습니다." } as const;
  return { order } as const;
}

export async function recordShipment(actorUserId: string, input: unknown): Promise<CommerceActionState> {
  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "배송 정보를 확인해 주세요.");
  if (!(await getCommerceReadiness()).ready) return errorState(COMMERCE_PREPARING_MESSAGE);
  const data = parsed.data;
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await adminAndOrder(tx, actorUserId, data.orderId);
      if ("error" in result) return errorState(result.error);
      const { order } = result;
      const current = order.shipment;
      if (current?.carrier === data.carrier && current.trackingNumber === data.trackingNumber) return { status: "success", message: "이미 등록된 송장입니다." };
      if (current?.status === "DELIVERED") return errorState("배송 완료된 송장은 변경할 수 없습니다.");
      if (current && data.note.length < 5) return errorState("송장 수정 사유를 5자 이상 입력해 주세요.");
      const shipment = current
        ? await tx.shopShipment.update({ where: { id: current.id }, data: { carrier: data.carrier, trackingNumber: data.trackingNumber } })
        : await tx.shopShipment.create({ data: { orderId: order.id, userId: order.userId, carrier: data.carrier, trackingNumber: data.trackingNumber } });
      await tx.shopShipmentEvent.create({ data: { shipmentId: shipment.id, actorUserId,
        action: current ? "TRACKING_CORRECTED" : "SHIPPED", carrier: data.carrier, trackingNumber: data.trackingNumber, note: data.note || null } });
      return { status: "success", message: current ? "송장 수정과 이력을 저장했습니다." : "발송 정보와 이력을 저장했습니다." };
    }, options);
  } catch (error) {
    if (isMissingCommerceTable(error)) return errorState(COMMERCE_PREPARING_MESSAGE);
    throw error;
  }
}

export async function markShipmentDelivered(actorUserId: string, input: unknown): Promise<CommerceActionState> {
  const parsed = completionSchema.safeParse(input);
  if (!parsed.success) return errorState("주문과 배송 완료 메모를 확인해 주세요.");
  if (!(await getCommerceReadiness()).ready) return errorState(COMMERCE_PREPARING_MESSAGE);
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await adminAndOrder(tx, actorUserId, parsed.data.orderId);
      if ("error" in result) return errorState(result.error);
      const shipment = result.order.shipment;
      if (!shipment) return errorState("송장을 등록한 뒤 배송 완료를 기록해 주세요.");
      if (shipment.status === "DELIVERED") return { status: "success", message: "이미 배송 완료된 주문입니다." };
      if (shipment.status !== "SHIPPED") return errorState("배송 상태를 확인해 주세요.");
      await tx.shopShipment.update({ where: { id: shipment.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
      await tx.shopShipmentEvent.create({ data: { shipmentId: shipment.id, actorUserId, action: "DELIVERED",
        carrier: shipment.carrier, trackingNumber: shipment.trackingNumber, note: parsed.data.note || null } });
      return { status: "success", message: "배송 완료와 이력을 저장했습니다." };
    }, options);
  } catch (error) {
    if (isMissingCommerceTable(error)) return errorState(COMMERCE_PREPARING_MESSAGE);
    throw error;
  }
}
