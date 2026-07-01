import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { Badge, EmptyState } from "@/lib/ui";
import Link from "next/link";
import { requireShopUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  FAILED: "결제실패",
  CANCELED: "취소",
};

export default async function MyPage() {
  const user = await requireShopUser();
  const orders = await prisma.shopOrder.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">마이페이지</h1>
        <p className="mt-0.5 text-sm text-gray-500">{user.name}님 · {user.email}</p>
      </div>

      <h2 className="text-sm font-semibold text-gray-900">주문 내역</h2>
      {orders.length === 0 ? (
        <EmptyState title="주문 내역이 없습니다" description="첫 주문을 해보세요" />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/order/${o.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{o.createdAt.toLocaleString("ko-KR")}</span>
                  <Badge variant={o.status === "PAID" ? "green" : o.status === "FAILED" ? "red" : "gray"}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                </div>
                <div className="mt-1.5 text-sm text-gray-700">
                  {o.items[0]?.name}
                  {o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}
                </div>
                <div className="mt-0.5 text-sm font-bold text-gray-900">{formatKrw(o.totalAmount)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
