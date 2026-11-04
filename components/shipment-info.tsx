import { getOrderShipment } from "@/lib/commerce/queries";
import Link from "next/link";
const dt = (date: Date) =>
  date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export async function ShipmentInfo({
  orderId,
  paid,
}: {
  orderId: string;
  paid: boolean;
}) {
  const { available, shipment } = await getOrderShipment(orderId);
  return (
    <section
      className="mt-6 space-y-4 rounded-md border border-line p-5"
      aria-labelledby="shipment-title"
    >
      <h2 id="shipment-title" className="text-lg font-bold">
        배송 정보
      </h2>
      {!available ? (
        <p className="text-sm text-fg-muted">
          배송 정보는 고객센터로 문의해주세요.
        </p>
      ) : !shipment ? (
        <p className="text-sm text-fg-muted">
          {paid
            ? "상품을 준비하고 있습니다. 발송 후 택배사와 송장번호가 표시됩니다."
            : "발송된 상품이 없습니다."}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-fg-subtle">배송 상태</dt>
            <dd className="font-semibold">
              {shipment.status === "DELIVERED" ? "배송완료" : "배송중"}
            </dd>
            <dt className="text-fg-subtle">택배사</dt>
            <dd>{shipment.carrierLabel}</dd>
            <dt className="text-fg-subtle">송장번호</dt>
            <dd className="break-all font-semibold">
              {shipment.trackingNumber}
            </dd>
            <dt className="text-fg-subtle">발송일시</dt>
            <dd>{dt(shipment.shippedAt)}</dd>
            {shipment.deliveredAt && (
              <>
                <dt className="text-fg-subtle">배송완료</dt>
                <dd>{dt(shipment.deliveredAt)}</dd>
              </>
            )}
          </dl>
          <ol className="space-y-2 border-t border-line pt-4 text-sm">
            {shipment.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>
                  {event.action === "DELIVERED"
                    ? "배송완료 확인"
                    : event.action === "TRACKING_CORRECTED"
                      ? "송장정보 변경"
                      : "발송 등록"}
                </span>
                <time
                  className="text-fg-subtle"
                  dateTime={event.createdAt.toISOString()}
                >
                  {dt(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        </>
      )}
      <Link
        href={`/order/${orderId}/statement`}
        className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
      >
        주문·배송 내역 보기
      </Link>
    </section>
  );
}
