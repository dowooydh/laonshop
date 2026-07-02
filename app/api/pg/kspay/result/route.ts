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
    // 인증키 없는 쓰레기 POST는 확정하지 않고 PENDING 유지 — 주문 ID(a 패스스루)가 브라우저에
    // 노출되므로, 빈 POST로 임의 FAILED 확정시키는 그리핑 차단. 사용자 취소(reCnclType=1)와
    // 진짜 KSNET 거절만 FAILED 확정. (laonpay 29b1aef 동기화)
    if (!reCommConId && reCnclType !== "1") {
      return NextResponse.redirect(`${base}/order/${order.id}`, 303);
    }

    let result = await getPgProvider().approveAuthCallback({
      reCommConId,
      reCnclType,
      sndAmount: String(order.totalAmount), // DB 금액 사용 (위변조 차단)
    });

    // PG 승인금액 ↔ DB 스냅샷 대조 — 불일치면 PAID 금지 (절대 규칙 1: 모든 돈 계산은 서버).
    // 실카드는 승인됐을 수 있으므로 운영자가 확인 후 KSTA에서 취소해야 한다. (laonpay c2f1d75 동기화)
    if (result.success && result.amount > 0 && result.amount !== order.totalAmount) {
      const failReason = `승인금액 불일치 PG=${result.amount}, DB=${order.totalAmount}`;
      console.error(
        `[pg:security] ${failReason} (orderId=${order.id}, moid=${order.moid}) — 운영자 확인·KSTA 취소 필요`,
      );
      result = { ...result, success: false, failReason };
    }

    // 조건부 update — 승인 요청 중 상태가 바뀐 경우(중복 제출 등) 덮어쓰지 않는다
    await prisma.shopOrder.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: result.success
        ? {
            status: "PAID",
            approvalNo: result.approvalNo,
            pgTrno: result.pgTrno,
            cardName: result.cardName ?? null,
            paidAt: result.paidAt ?? new Date(),
          }
        : { status: "FAILED" },
    });
  }

  // receipt=1: "방금 결제를 마친" 방문에만 장바구니 클리어 (과거 주문 재조회 시 카트 보존)
  return NextResponse.redirect(`${base}/order/${order.id}?receipt=1`, 303);
}
