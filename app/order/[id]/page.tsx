import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireShopUser } from "@/lib/auth";
import { ClearCartOnPaid } from "./clear-cart";

export const dynamic = "force-dynamic";

export default async function OrderResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireShopUser();
  const { id } = await params;
  const order = await prisma.shopOrder.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();

  const paid = order.status === "PAID";
  const failed = order.status === "FAILED";

  return (
    <div className="mx-auto max-w-lg py-6 text-center">
      {paid && <ClearCartOnPaid />}

      <div className="text-5xl">{paid ? "✅" : failed ? "⚠️" : "⏳"}</div>
      <h1 className="mt-3 text-xl font-bold text-gray-900">
        {paid ? "결제가 완료되었습니다" : failed ? "결제에 실패했습니다" : "결제가 완료되지 않았습니다"}
      </h1>
      <div className="mt-2 text-2xl font-extrabold text-gray-900">{formatKrw(order.totalAmount)}</div>

      <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 text-left text-sm">
        <dl className="space-y-1.5 text-gray-600">
          <div className="flex justify-between">
            <dt>주문번호</dt>
            <dd className="font-medium text-gray-900">{order.moid}</dd>
          </div>
          {order.approvalNo && (
            <div className="flex justify-between">
              <dt>승인번호</dt>
              <dd className="font-medium text-gray-900">{order.approvalNo}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>받는 분</dt>
            <dd className="font-medium text-gray-900">{order.receiverName}</dd>
          </div>
          <div className="flex justify-between">
            <dt>배송지</dt>
            <dd className="max-w-60 text-right font-medium text-gray-900">{order.address}</dd>
          </div>
        </dl>
        <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>
                {it.name}
                {it.size ? ` (${it.size})` : ""} × {it.qty}
              </span>
              <span>{formatKrw(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex justify-center gap-2">
        <Link href="/mypage" className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          주문내역
        </Link>
        <Link href="/" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          계속 쇼핑하기
        </Link>
      </div>
    </div>
  );
}
