import Link from "next/link";
import { requireShopAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { getCommerceReadiness, getOrderShipment } from "@/lib/commerce/queries";
import { canFulfilOrder } from "@/lib/commerce/policy";
import { ShippingForm } from "./shipping-form";
export const dynamic = "force-dynamic";
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireShopAdmin();
  const params = await searchParams;
  const requested = Number(params.page ?? 1);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 10000)
      : 1;
  const [orders, total, readiness] = await Promise.all([
    prisma.shopOrder.findMany({
      include: { items: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20,
      take: 20,
    }),
    prisma.shopOrder.count(),
    getCommerceReadiness(),
  ]);
  const rows = await Promise.all(
    orders.map(async (order) => ({
      order,
      shipping: await getOrderShipment(order.id),
    })),
  );
  const labels: Record<string, string> = {
    PAID: "결제완료",
    PENDING: "결제대기",
    FAILED: "결제실패",
    CANCEL_REQUESTED: "취소·반품 접수",
    CANCELED: "취소완료",
  };
  return (
    <div className="min-w-0 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">주문·배송 관리</h1>
          <p className="mt-3 text-sm text-fg-muted">
            실제 발송한 주문의 택배사와 송장번호를 등록하세요. 결제 상태와 배송
            이력은 따로 보관됩니다.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm font-semibold underline"
        >
          결제 확인 센터
        </Link>
      </header>
      {!readiness.ready && (
        <p
          role="status"
          className="rounded border border-line bg-raised p-4 text-sm"
        >
          배송관리 준비가 필요합니다. 운영 담당자가 추가 테이블 반영과 검증을
          완료하면 발송을 등록할 수 있습니다.
        </p>
      )}
      <p className="text-sm text-fg-subtle">
        전체 {total}건 · {page}페이지 (페이지당 20건)
      </p>
      {rows.length === 0 && (
        <p className="bg-raised p-8 text-center">표시할 주문이 없습니다.</p>
      )}
      {rows.map(({ order, shipping }) => (
        <article
          key={order.id}
          className="min-w-0 space-y-5 rounded-md border border-line p-4 sm:p-6"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="break-all text-sm font-semibold">{order.moid}</p>
              <p className="mt-2 text-sm text-fg-subtle">
                {order.createdAt.toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </p>
            </div>
            <div className="text-sm">
              <span className="font-semibold">{labels[order.status]}</span>
              <p className="mt-1">{formatKrw(order.totalAmount)}</p>
            </div>
          </div>
          <ul className="space-y-1 text-sm">
            {order.items.map((item) => (
              <li key={item.id}>
                {item.name} {item.size ? `(${item.size})` : ""} × {item.qty}
              </li>
            ))}
          </ul>
          <p className="break-words text-sm text-fg-muted">
            받는 분: {order.receiverName ?? "미입력"}
            <br />
            배송지: {order.address ?? "미입력"}
          </p>
          {shipping.shipment && (
            <p className="break-all text-sm font-semibold">
              {shipping.shipment.status === "DELIVERED" ? "배송완료" : "배송중"}{" "}
              · {shipping.shipment.carrierLabel}{" "}
              {shipping.shipment.trackingNumber}
            </p>
          )}
          {readiness.ready && canFulfilOrder(order) && (
            <ShippingForm orderId={order.id} shipment={shipping.shipment} />
          )}
          {!canFulfilOrder(order) && (
            <p className="text-sm text-fg-subtle">
              이 주문은 발송 등록 대상이 아닙니다. 결제대기·취소·시연 주문은
              발송할 수 없습니다.
            </p>
          )}
          <Link
            href={`/admin/orders/${order.id}/statement`}
            className="inline-flex min-h-11 items-center text-sm font-semibold underline"
          >
            주문·배송 내역 보기
          </Link>
        </article>
      ))}
      <nav
        aria-label="주문 목록 페이지"
        className="flex flex-wrap justify-center gap-4"
      >
        {page > 1 && (
          <Link
            href={`/admin/orders?page=${page - 1}`}
            className="inline-flex min-h-11 items-center px-4"
          >
            이전 페이지
          </Link>
        )}
        {page * 20 < total && (
          <Link
            href={`/admin/orders?page=${page + 1}`}
            className="inline-flex min-h-11 items-center px-4"
          >
            다음 페이지
          </Link>
        )}
      </nav>
    </div>
  );
}
