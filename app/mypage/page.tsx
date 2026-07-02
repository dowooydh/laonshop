import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { EmptyState } from "@/lib/ui";
import { requireShopUser } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { OrderHistory, type OrderRow } from "./order-history";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  FAILED: "결제실패",
  CANCEL_REQUESTED: "취소 접수",
  CANCELED: "취소",
};

export default async function MyPage() {
  const user = await requireShopUser();
  const [orders, wishlist] = await Promise.all([
    prisma.shopOrder.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.wishlist.findMany({
      where: { userId: user.id, product: { active: true } },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    href: `/order/${o.id}`,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    badgeVariant:
      o.status === "PAID"
        ? "green"
        : o.status === "FAILED"
          ? "red"
          : o.status === "CANCEL_REQUESTED"
            ? "orange"
            : "gray",
    dateLabel: o.createdAt.toLocaleString("ko-KR"),
    itemSummary: `${o.items[0]?.name ?? ""}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}`,
    totalLabel: formatKrw(o.totalAmount),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header className="border-b border-line pb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="font-mono text-step--1 uppercase tracking-widest text-fg-muted">{user.email}</p>
            <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">{user.name}</h1>
          </div>
          <Link
            href="/mypage/settings"
            className="rounded-[var(--radius-sm)] px-3 py-2 text-step--1 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
          >
            설정
          </Link>
        </div>
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

      <section className="space-y-5 border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">위시리스트</h2>
          {wishlist.length > 0 ? (
            <span className="font-mono text-step--1 text-fg-subtle">{wishlist.length}개</span>
          ) : null}
        </div>
        {wishlist.length === 0 ? (
          <EmptyState title="찜한 상품이 없습니다" description="상품 상세의 하트를 눌러 담아보세요" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {wishlist.map(({ product: p }) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised transition-[border-color,box-shadow] duration-base hover:border-accent-cyan hover:shadow-glow-cyan"
              >
                {p.imageUrl && (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    sizes="(min-width: 640px) 25vw, 50vw"
                    className="object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.06]"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void via-void/60 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="truncate text-step--1 font-semibold text-fg">{p.name}</div>
                  <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(p.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
