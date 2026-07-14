import type { PgApprovalResult } from "./types";

export type ApprovalOrder = { moid: string; totalAmount: number };

export function validateKspayApprovalBinding(
  order: ApprovalOrder,
  result: PgApprovalResult,
): { ok: true } | { ok: false; reason: string } {
  if (!result.moid || result.moid !== order.moid) {
    return { ok: false, reason: "PG 주문번호 불일치" };
  }
  if (result.amount > 0 && result.amount !== order.totalAmount) {
    return { ok: false, reason: "PG 승인금액 불일치" };
  }
  if (result.success) {
    if (result.amount !== order.totalAmount) return { ok: false, reason: "PG 승인금액 누락" };
    if (!result.approvalNo?.trim()) return { ok: false, reason: "PG 승인번호 누락" };
    if (!result.pgTrno?.trim()) return { ok: false, reason: "PG 거래번호 누락" };
  }
  return { ok: true };
}
