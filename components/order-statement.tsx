import type { ShopOrder, ShopOrderItem } from "@/lib/db";
import { getOrderShipment } from "@/lib/commerce/queries";
import { formatKrw } from "@/lib/format";
import { normalizeLaonpayBillingOrderCardName } from "@/lib/billing";
import { PrintButton } from "./print-button";
const dt = (date: Date | null) =>
  date ? date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "기록 없음";
export async function OrderStatement({
  order,
}: {
  order: ShopOrder & { items: ShopOrderItem[] };
}) {
  const { available, shipment } = await getOrderShipment(order.id);
  const labels: Record<string, string> = {
    PAID: "결제완료",
    PENDING: "결제대기",
    FAILED: "결제실패",
    CANCEL_REQUESTED: "취소·반품 접수",
    CANCELED: "취소완료",
  };
  const demo =
    order.approvalNo?.startsWith("DEMO-") ||
    order.cardName?.includes("수기결제 시연");
  return (
    <article className="mx-auto min-w-0 max-w-3xl space-y-8 [overflow-wrap:anywhere]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">LAON SHOP</p>
          <h1 className="mt-2 text-2xl font-bold">주문·배송 내역</h1>
        </div>
        <PrintButton />
      </header>
      <p className="rounded border border-line p-4 text-sm leading-relaxed">
        라온샵에 저장된 주문·결제 상태와 배송 기록입니다. 택배사 실시간 조회
        결과 또는 카드 매출전표를 대신하지 않습니다.
        {demo && " 이 주문은 실제 청구가 없는 시연 주문입니다."}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt>주문번호</dt>
        <dd className="font-semibold">{order.moid}</dd>
        <dt>주문일시</dt>
        <dd>{dt(order.createdAt)}</dd>
        <dt>현재 상태</dt>
        <dd>{labels[order.status]}</dd>
        <dt>주문금액</dt>
        <dd>{formatKrw(order.totalAmount)}</dd>
        <dt>결제일시</dt>
        <dd>{dt(order.paidAt)}</dd>
        <dt>결제수단</dt>
        <dd>{order.cardName ? normalizeLaonpayBillingOrderCardName(order.cardName) : "기록 없음"}</dd>
        <dt>취소·반품 접수</dt>
        <dd>{dt(order.cancelRequestedAt)}</dd>
      </dl>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">주문 상품</h2>
        <ul className="divide-y divide-line border-y border-line">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap justify-between gap-3 py-4 text-sm"
            >
              <span>
                {item.name}
                {item.size ? ` (${item.size})` : ""} × {item.qty}
              </span>
              <span>{formatKrw(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">배송 기록</h2>
        <p className="text-sm">
          받는 분: {order.receiverName ?? "기록 없음"}
          <br />
          배송지: {order.address ?? "기록 없음"}
        </p>
        {!available ? (
          <p className="text-sm">배송 기록을 이용할 수 없습니다.</p>
        ) : !shipment ? (
          <p className="text-sm">등록된 발송 기록이 없습니다.</p>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt>택배사</dt>
              <dd>{shipment.carrierLabel}</dd>
              <dt>송장번호</dt>
              <dd>{shipment.trackingNumber}</dd>
              <dt>발송일시</dt>
              <dd>{dt(shipment.shippedAt)}</dd>
              <dt>배송완료 확인</dt>
              <dd>{dt(shipment.deliveredAt)}</dd>
            </dl>
            <ol className="space-y-2 border-t border-line pt-4 text-sm">
              {shipment.events.map((event) => (
                <li key={event.id}>
                  {dt(event.createdAt)} —{" "}
                  {event.action === "DELIVERED"
                    ? "배송완료 확인"
                    : event.action === "TRACKING_CORRECTED"
                      ? "송장정보 변경"
                      : "발송 등록"}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      <div className="border-t border-line pt-5 text-xs leading-relaxed text-fg-subtle">
        발급 기준: 라온샵에 현재 저장된 기록 · 모든 시각은 한국 시간입니다.
        <br />
        (주)커스텀오더 · 대표 유준혁 · 사업자등록번호 864-88-03054 ·
        통신판매업신고번호 2025-성남분당A-0152
        <br />
        문의 070-4044-7008 / custom_sales@customorder.co.kr
      </div>
    </article>
  );
}
