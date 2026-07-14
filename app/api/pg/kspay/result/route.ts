// KSPAY 최종 결과(result) — goResult 폼 수신 → recv_post.jsp 서버승인 → 주문 확정.
import { prisma } from "@/lib/db";
import { getPgProvider } from "@/lib/kspay";
import { isKspayResultApprovalEnabled } from "@/lib/kspay/approval-gate";
import { validateKspayApprovalBinding } from "@/lib/kspay/approval-validation";
import { verifyKspayResultToken } from "@/lib/kspay/result-token";
import {
  acquireTransactionLock,
  lockAndValidateInventory,
  PAYMENT_PROCESSING_MARKER,
  shouldStartKspayApproval,
} from "@/lib/order-guard";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 30;

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const orderId = String(form.get("a") ?? ""); // 패스스루 a = ShopOrder id
  const reCommConId = String(form.get("reCommConId") ?? "");
  const reCnclType = String(form.get("reCnclType") ?? "");
  const resultToken = String(form.get("c") ?? "");

  const base = process.env.SHOP_APP_URL ?? new URL(req.url).origin;
  if (!orderId) return NextResponse.redirect(`${base}/`, 303);

  const prepared = await prisma.$transaction(async (tx) => {
    // 외부 승인 전에 처리 마커를 먼저 커밋한다. 병렬 callback과 timeout 뒤 재전송은 마커를
    // 확인하고 외부 승인을 다시 호출하지 않으므로 승인 요청은 정확히 한 번만 전송된다.
    await acquireTransactionLock(tx, `order:${orderId}`);
    const order = await tx.shopOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return null;
    if (!verifyKspayResultToken(order, resultToken)) return null;
    if (!isKspayResultApprovalEnabled()) {
      console.error("[pg:security] reHash 결박 규격 확인 전 실 MID 서버승인을 차단했습니다.");
      return { shouldApprove: false as const, order };
    }
    const hasValidCommConId = reCommConId.length > 0 && reCommConId.length <= 1024;
    if (!shouldStartKspayApproval(order.status, order.approvalNo, hasValidCommConId, reCnclType === "1")) {
      return { shouldApprove: false as const, order };
    }

    const inventory = await lockAndValidateInventory(tx, order.items, order.id);
    if (!inventory.ok) {
      const failed = await tx.shopOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return { shouldApprove: false as const, order: failed };
    }

    const marked = await tx.shopOrder.update({
      where: { id: order.id },
      data: { approvalNo: PAYMENT_PROCESSING_MARKER },
    });
    return { shouldApprove: true as const, order: marked };
  }, TX_OPTIONS).catch(() => undefined);

  if (prepared === undefined) return NextResponse.redirect(`${base}/order/${orderId}`, 303);
  if (prepared === null) return NextResponse.redirect(`${base}/`, 303);
  if (!prepared.shouldApprove) {
    const receipt = prepared.order.status === "PAID" ? "?receipt=1" : "";
    return NextResponse.redirect(`${base}/order/${prepared.order.id}${receipt}`, 303);
  }

  let result;
  try {
    result = await getPgProvider().approveAuthCallback({
      reCommConId,
      reCnclType,
      sndAmount: String(prepared.order.totalAmount),
    });
  } catch {
    // timeout/5xx/파싱 오류는 승인 성립 여부가 불명확하다. 처리 마커와 PENDING을 유지해
    // 재승인을 막고 주문내역에서 운영 확인을 기다린다.
    return NextResponse.redirect(`${base}/order/${prepared.order.id}`, 303);
  }

  const binding = validateKspayApprovalBinding(prepared.order, result);
  if (!binding.ok) {
    console.error(
      `[pg:security] ${binding.reason} (orderId=${prepared.order.id}, moid=${prepared.order.moid}) — 운영자 확인·KSTA 대조 필요`,
    );
    return NextResponse.redirect(`${base}/order/${prepared.order.id}`, 303);
  }

  const processed = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `order:${prepared.order.id}`);
    const current = await tx.shopOrder.findUnique({ where: { id: prepared.order.id } });
    if (!current || current.status !== "PENDING" || current.approvalNo !== PAYMENT_PROCESSING_MARKER) {
      return current;
    }
    return tx.shopOrder.update({
      where: { id: current.id },
      data: result.success
        ? {
            status: "PAID",
            approvalNo: result.approvalNo,
            pgTrno: result.pgTrno,
            cardName: result.cardName ?? null,
            paidAt: result.paidAt ?? new Date(),
          }
        : { status: "FAILED", approvalNo: null },
    });
  }, TX_OPTIONS).catch(() => undefined);

  if (processed === undefined) return NextResponse.redirect(`${base}/order/${orderId}`, 303);
  if (processed === null) return NextResponse.redirect(`${base}/`, 303);

  // receipt=1: "방금 결제를 마친" 방문에만 장바구니 클리어 (과거 주문 재조회 시 카트 보존)
  const receipt = processed.status === "PAID" ? "?receipt=1" : "";
  return NextResponse.redirect(`${base}/order/${processed.id}${receipt}`, 303);
}
