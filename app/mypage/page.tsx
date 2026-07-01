import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { EmptyState } from "@/lib/ui";
import { requireShopUser } from "@/lib/auth";
import { OrderHistory, type OrderRow } from "./order-history";

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

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    href: `/order/${o.id}`,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    badgeVariant: o.status === "PAID" ? "green" : o.status === "FAILED" ? "red" : "gray",
    dateLabel: o.createdAt.toLocaleString("ko-KR"),
    itemSummary: `${o.items[0]?.name ?? ""}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}`,
    totalLabel: formatKrw(o.totalAmount),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-2 border-b border-line pb-8">
        <p className="font-mono text-step--1 uppercase tracking-widest text-fg-muted">{user.email}</p>
        <h1 className="font-display text-hero font-bold tracking-tight text-fg">{user.name}</h1>
      </header>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">주문 내역</h2>
          {rows.length > 0 ? (
            <span className="font-mono text-step--1 text-fg-subtle">{rows.length}건</span>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <EmptyState title="주문 내역이 없습니다" description="첫 주문을 해보세요" />
        ) : (
          <OrderHistory orders={rows} />
        )}
      </section>
    </div>
  );
}
