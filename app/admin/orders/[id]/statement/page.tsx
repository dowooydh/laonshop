import { requireShopAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { OrderStatement } from "@/components/order-statement";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "관리자 주문·배송 내역",
  robots: { index: false, follow: false },
};
export default async function AdminStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireShopAdmin();
  const { id } = await params;
  const order = await prisma.shopOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) notFound();
  return <OrderStatement order={order} />;
}
