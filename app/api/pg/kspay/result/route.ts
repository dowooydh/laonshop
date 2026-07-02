// KSPAY 최종 결과(result) — goResult 폼 수신 → recv_post.jsp 서버승인 → 주문 확정.
import { prisma } from "@/lib/db";
import { getPgProvider } from "@/lib/kspay";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const orderId = String(form.get("a") ?? ""); // 패스스루 a = ShopOrder id
  const reCommConId = String(form.get("reCommConId") ?? "");
  const reCnclType = String(form.get("reCnclType") ?? "");

  const base = process.env.SHOP_APP_URL ?? new URL(req.url).origin;
  if (!orderId) return NextResponse.redirect(`${base}/`, 303);

  const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.redirect(`${base}/`, 303);

  // 멱등: PENDING일 때만 승인 처리
  if (order.status === "PENDING") {
    const result = await getPgProvider().approveAuthCallback({
      reCommConId,
      reCnclType,
      sndAmount: String(order.totalAmount), // DB 금액 사용 (위변조 차단)
    });
    // 조건부 update — 승인 요청 중 상태가 바뀐 경우(중복 제출 등) 덮어쓰지 않는다
    await prisma.shopOrder.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: result.success
        ? {
            status: "PAID",
            approvalNo: result.approvalNo,
            pgTrno: result.pgTrno,
            paidAt: result.paidAt ?? new Date(),
          }
        : { status: "FAILED" },
    });
  }

  // receipt=1: "방금 결제를 마친" 방문에만 장바구니 클리어 (과거 주문 재조회 시 카트 보존)
  return NextResponse.redirect(`${base}/order/${order.id}?receipt=1`, 303);
}
