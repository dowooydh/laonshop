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
      <h1 className={`mt-3 text-xl font-bold ${paid ? "text-success" : failed ? "text-danger" : "text-warning"}`}>
        {paid ? "결제가 완료되었습니다" : failed ? "결제에 실패했습니다" : "결제가 완료되지 않았습니다"}
      </h1>
      <div className="mt-2 font-mono text-2xl font-extrabold text-fg">{formatKrw(order.totalAmount)}</div>

      <div className="mt-5 rounded-xl border border-line bg-raised p-4 text-left text-sm shadow-elev1">
        <dl className="space-y-1.5 text-fg-muted">
          <div className="flex justify-between">
            <dt>주문번호</dt>
            <dd className="font-mono font-medium text-fg">{order.moid}</dd>
          </div>
          {order.approvalNo && (
            <div className="flex justify-between">
              <dt>승인번호</dt>
              <dd className="font-medium text-fg">{order.approvalNo}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>받는 분</dt>
            <dd className="font-medium text-fg">{order.receiverName}</dd>
          </div>
          <div className="flex justify-between">
            <dt>배송지</dt>
            <dd className="max-w-60 text-right font-medium text-fg">{order.address}</dd>
          </div>
        </dl>
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-fg-muted">
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
        <Link href="/mypage" className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-fg hover:bg-raised">
          주문내역
        </Link>
        <Link href="/" className="rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-void hover:opacity-90">
          계속 쇼핑하기
        </Link>
      </div>
    </div>
  );
}
