import { requireShopUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { OrderStatement } from "@/components/order-statement";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "주문·배송 내역",
  robots: { index: false, follow: false },
};
export default async function StatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireShopUser();
  const { id } = await params;
  const order = await prisma.shopOrder.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();
  return <OrderStatement order={order} />;
}
