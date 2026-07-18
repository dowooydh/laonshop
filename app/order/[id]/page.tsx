import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { getPgProvider } from "@/lib/kspay";
import { Amount, Badge, buttonVariants } from "@/lib/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireShopUser } from "@/lib/auth";
import { ClearCartOnPaid } from "./clear-cart";
import { CancelRequest } from "./cancel-request";
import { RetryPayment } from "./retry-payment";
import {
  isPaymentProcessingMarker,
  LAONPAY_BILLING_PROCESSING_MARKER,
} from "@/lib/order-guard";
import {
  refreshBillingCancelStatusFormAction,
  refreshBillingChargeStatusFormAction,
} from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<
  string,
  { eyebrow: string; heading: string; tone: "success" | "danger" | "warning" | "muted" }
> = {
  PAID: { eyebrow: "Order Complete", heading: "결제가 완료되었습니다", tone: "success" },
  FAILED: { eyebrow: "Payment Failed", heading: "결제에 실패했습니다", tone: "danger" },
  PENDING: { eyebrow: "Payment Pending", heading: "결제가 완료되지 않았습니다", tone: "warning" },
  CANCEL_REQUESTED: { eyebrow: "Cancel Requested", heading: "취소·반품 신청이 접수되었습니다", tone: "warning" },
  CANCELED: { eyebrow: "Order Canceled", heading: "주문이 취소되었습니다", tone: "muted" },
};

const TONE_CLASS: Record<string, string> = {
  success: "text-success ring-[color-mix(in_oklab,var(--success)_45%,transparent)]",
  danger: "text-danger ring-[color-mix(in_oklab,var(--danger)_45%,transparent)]",
  warning: "text-warning ring-[color-mix(in_oklab,var(--warning)_45%,transparent)]",
  muted: "text-fg-subtle ring-line",
};

function StatusMark({ tone }: { tone: string }) {
  return (
    <div
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-2 ${TONE_CLASS[tone] ?? TONE_CLASS.muted}`}
    >
      {tone === "success" ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12.5 9.5 18 20 6.5" />
        </svg>
      ) : tone === "danger" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      ) : (
        <span className="h-2.5 w-2.5 animate-glow-pulse rounded-full bg-current" aria-hidden />
      )}
    </div>
  );
}

export default async function OrderResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    receipt?: string;
    billingRefresh?: string;
    billingCancelRefresh?: string;
  }>;
}) {
  const user = await requireShopUser();
  const { id } = await params;
  const { receipt, billingRefresh, billingCancelRefresh } = await searchParams;
  const order = await prisma.shopOrder.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();
  const isBillingPaidOrder = order.cardName?.includes("(LAONPAY 원클릭)") === true;
  const billingCancelLedger = isBillingPaidOrder
    ? await prisma.shopBillingCharge
        .findFirst({
          where: { orderId: order.id, userId: user.id },
          select: {
            status: true,
            cancelRequest: {
              select: {
                status: true,
                requestSentAt: true,
                rejectReason: true,
                laonpayCancelRequestId: true,
              },
            },
          },
        })
        .catch(() => null)
    : null;
  const billingCancelRequestStatus = billingCancelLedger?.cancelRequest?.status ?? null;
  const billingCancelRejectReason =
    billingCancelLedger?.cancelRequest?.rejectReason ?? null;
  const billingCancelRequestSent =
    billingCancelLedger?.cancelRequest?.requestSentAt !== null &&
    billingCancelLedger?.cancelRequest?.requestSentAt !== undefined;
  const billingCancelHasProviderRequest =
    billingCancelLedger?.cancelRequest?.laonpayCancelRequestId !== null &&
    billingCancelLedger?.cancelRequest?.laonpayCancelRequestId !== undefined;

  const paid = order.status === "PAID";
  const processing = order.status === "PENDING" && isPaymentProcessingMarker(order.approvalNo);
  const billingProcessing =
    order.status === "PENDING" &&
    order.approvalNo === LAONPAY_BILLING_PROCESSING_MARKER;
  const retryable = !processing && (order.status === "PENDING" || order.status === "FAILED");
  const billingCancelRequestInProgress =
    billingCancelRequestStatus === "REQUESTING" ||
    billingCancelRequestStatus === "REQUESTED" ||
    billingCancelRequestStatus === "PROCESSING" ||
    billingCancelRequestStatus === "UNKNOWN";
  const billingCancelRequestBlocked =
    billingCancelRequestInProgress || billingCancelRequestStatus === "REJECTED";
  const billingCancelCanRefresh =
    (order.status === "CANCEL_REQUESTED" &&
      billingCancelLedger?.status === "CANCEL_REQUESTED" &&
      (billingCancelRequestStatus === "REQUESTED" ||
        billingCancelRequestStatus === "PROCESSING")) ||
    (paid &&
      billingCancelLedger?.status === "PAID" &&
      billingCancelRequestSent &&
      (billingCancelRequestStatus === "REQUESTING" ||
        billingCancelRequestStatus === "UNKNOWN")) ||
    (paid &&
      billingCancelLedger?.status === "PAID" &&
      billingCancelRequestStatus === "REJECTED" &&
      billingCancelHasProviderRequest);
  const billingCancelNotice =
    paid && billingCancelRequestStatus === "UNKNOWN"
      ? {
          role: "alert" as const,
          tone: "border-warning/40 bg-warning/5 text-warning",
          message:
            "등록카드 취소 신청 결과를 확인 중입니다. 중복 신청하거나 카드를 해지하지 말고 고객센터(070-4044-7008)에 문의해 주세요.",
        }
      : paid && billingCancelRequestStatus === "REJECTED"
        ? {
            role: "alert" as const,
            tone: "border-danger/40 bg-danger/5 text-danger",
            message:
              `등록카드 취소 신청이 반려되었습니다.${
                billingCancelRejectReason
                  ? ` 사유: ${billingCancelRejectReason}`
                  : ""
              } 다시 신청하지 말고 고객센터(070-4044-7008)에 문의해 주세요.`,
          }
        : paid && billingCancelRequestInProgress
          ? {
              role: "status" as const,
              tone: "border-warning/40 bg-warning/5 text-fg-muted",
              message:
                billingCancelRequestStatus === "REQUESTING"
                  ? "등록카드 취소 신청을 전송하고 있습니다. 중복 신청하지 말고 잠시 후 주문 상태를 다시 확인해 주세요."
                  : "등록카드 취소 신청을 처리하고 있습니다. 완료 전까지 다시 신청하거나 카드를 해지하지 말아 주세요.",
            }
          : null;
  const billingRefreshMessage =
    billingRefresh === "paid" && order.status === "PAID"
      ? "등록카드 결제가 완료되었습니다."
      : billingRefresh === "declined" && order.status === "FAILED"
        ? "등록카드 결제가 거절되었습니다. 다른 결제수단을 이용해 주세요."
        : (billingRefresh === "pending" || billingRefresh === "unknown") &&
            billingProcessing
          ? "결제 결과를 아직 확인 중입니다. 새로 결제하지 말고 잠시 후 다시 조회해 주세요."
          : billingRefresh === "error" && billingProcessing
            ? "결제 상태를 확인하지 못했습니다. 새로 결제하지 말고 고객센터에 문의해 주세요."
            : null;
  const billingCancelRefreshMessage =
    billingCancelRefresh === "canceled" && order.status === "CANCELED"
      ? {
          role: "status" as const,
          message: "등록카드 결제 취소가 완료된 것을 확인했습니다.",
        }
      : billingCancelRefresh === "pending" && order.status === "CANCEL_REQUESTED"
        ? {
            role: "status" as const,
            message: "취소 요청을 처리 중입니다. 완료될 때까지 다시 취소하지 말아 주세요.",
          }
        : billingCancelRefresh === "unknown" && billingCancelRequestBlocked
          ? {
              role: "alert" as const,
              message:
                "취소 완료 여부를 아직 확인하지 못했습니다. 다시 취소하지 말고 고객센터에 문의해 주세요.",
            }
          : billingCancelRefresh === "error" && billingCancelRequestBlocked
            ? {
                role: "alert" as const,
                message:
                  "취소 상태를 조회하지 못했습니다. 다시 취소하지 말고 고객센터에 문의해 주세요.",
              }
            : null;
  const s = processing
    ? { eyebrow: "Payment Processing", heading: "결제 결과를 확인하고 있습니다", tone: "warning" as const }
    : STATUS[order.status] ?? STATUS.PENDING;

  // KSNET 매출전표(영수증) — 심사 캡처·소비자 증빙. env 미설정 시 링크만 생략.
  let receiptUrl: string | null = null;
  if ((paid || order.status === "CANCEL_REQUESTED") && order.pgTrno) {
    try {
      receiptUrl = getPgProvider().receiptUrl(order.pgTrno);
    } catch {
      receiptUrl = null;
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg py-8">
      {/* 결제 직후(receipt=1)에만 카트 클리어 — 과거 주문 재조회로 현재 카트가 지워지는 것 방지 */}
      {paid && receipt === "1" && <ClearCartOnPaid />}

      <div className="text-center">
        <StatusMark tone={s.tone} />
        <p className="mt-5 font-mono text-step--1 uppercase tracking-[0.3em] text-fg-subtle">{s.eyebrow}</p>
        <h1 className="mt-2 min-w-0 max-w-full text-balance break-keep font-display text-step-1 font-bold tracking-tight text-fg [overflow-wrap:anywhere] min-[360px]:text-step-2">
          {s.heading}
        </h1>
        <div className="mt-4">
          <Amount value={order.totalAmount} className="inline-block max-w-full text-step-2 text-fg [overflow-wrap:anywhere]" />
        </div>
      </div>

      {billingRefreshMessage && (
        <p
          className="mt-5 rounded-[var(--radius-md)] border border-line bg-raised px-4 py-3 text-center text-step--1 text-fg-muted"
          role="status"
        >
          {billingRefreshMessage}
        </p>
      )}

      {billingCancelNotice && (
        <p
          role={billingCancelNotice.role}
          aria-live={billingCancelNotice.role === "alert" ? "assertive" : "polite"}
          className={`mt-5 rounded-[var(--radius-md)] border px-4 py-3 text-center text-step--1 leading-relaxed ${billingCancelNotice.tone}`}
        >
          {billingCancelNotice.message}
        </p>
      )}

      {billingCancelRefreshMessage && (
        <p
          role={billingCancelRefreshMessage.role}
          aria-live={billingCancelRefreshMessage.role === "alert" ? "assertive" : "polite"}
          className="mt-5 rounded-[var(--radius-md)] border border-line bg-raised px-4 py-3 text-center text-step--1 leading-relaxed text-fg-muted"
        >
          {billingCancelRefreshMessage.message}
        </p>
      )}

      {/* 심사 캡처 요소 — 주문번호·승인번호·결제수단·결제일시가 한 화면에 (카드사 결제경로 캡처 기준) */}
      <div className="mt-8 rounded-[var(--radius-lg)] border border-line bg-raised p-[20px] text-left shadow-elev1">
        <dl className="space-y-2 text-step--1 text-fg-muted">
          <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
            <dt className="shrink-0">주문번호</dt>
            <dd className="min-w-[min(100%,7rem)] flex-1 text-right font-mono font-medium text-fg [overflow-wrap:anywhere]">
              {order.moid}
            </dd>
          </div>
          {order.approvalNo && !processing && (
            <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
              <dt className="shrink-0">승인번호</dt>
              <dd className="min-w-[min(100%,7rem)] flex-1 text-right font-mono font-medium text-fg [overflow-wrap:anywhere]">
                {order.approvalNo}
              </dd>
            </div>
          )}
          {(paid || order.status === "CANCEL_REQUESTED") && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
                <dt className="shrink-0">결제수단</dt>
                <dd className="min-w-[min(100%,7rem)] flex-1 text-right font-medium text-fg [overflow-wrap:anywhere]">
                  {order.cardName?.includes("(LAONPAY 원클릭)")
                    ? order.cardName
                    : order.cardName
                      ? `${order.cardName} (KSPAY)`
                      : "신용카드·간편결제 (KSPAY)"}
                </dd>
              </div>
              {order.paidAt && (
                <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
                  <dt className="shrink-0">결제일시</dt>
                  <dd className="min-w-[min(100%,7rem)] flex-1 text-right font-medium text-fg [overflow-wrap:anywhere]">
                    {order.paidAt.toLocaleString("ko-KR")}
                  </dd>
                </div>
              )}
              {receiptUrl && (
                <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
                  <dt className="shrink-0">매출전표</dt>
                  <dd className="min-w-[min(100%,7rem)] flex-1 text-right">
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent-cyan hover:underline"
                    >
                      영수증 보기 →
                    </a>
                  </dd>
                </div>
              )}
            </>
          )}
          <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
            <dt className="shrink-0">받는 분</dt>
            <dd className="min-w-[min(100%,7rem)] flex-1 text-right font-medium text-fg [overflow-wrap:anywhere]">
              {order.receiverName}
            </dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
            <dt className="shrink-0">배송지</dt>
            <dd className="min-w-[min(100%,7rem)] max-w-60 flex-1 text-right font-medium text-fg [overflow-wrap:anywhere]">
              {order.address}
            </dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[8px]">
            <dt className="shrink-0">배송비</dt>
            <dd className="shrink-0 font-medium text-success">무료</dd>
          </div>
        </dl>

        <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-step--1 text-fg-muted">
          {order.items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[4px]">
              <span className="min-w-[min(100%,8rem)] flex-1 [overflow-wrap:anywhere]">
                {it.name}
                {it.size ? ` (${it.size})` : ""} × {it.qty}
              </span>
              <span className="min-w-0 max-w-full text-right font-mono [overflow-wrap:anywhere]">{formatKrw(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
      </div>

      {retryable && <RetryPayment orderId={order.id} amount={order.totalAmount} />}

      {billingProcessing && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-warning/40 bg-raised p-4">
          <p className="break-keep text-step--1 text-fg-muted">
            등록카드 결제 승인 여부를 확인 중입니다. 중복 결제를 막기 위해 다른 결제를
            시도하지 말고 아래 상태 조회를 이용해 주세요.
          </p>
          <form
            action={refreshBillingChargeStatusFormAction.bind(null, order.id)}
            className="mt-3"
          >
            <button
              type="submit"
              className={`${buttonVariants({ variant: "outline", size: "lg" })} min-h-12 w-full !h-auto py-3 !whitespace-normal`}
            >
              결제 상태 조회
            </button>
          </form>
        </div>
      )}

      {order.status === "CANCEL_REQUESTED" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-raised px-4 py-3 text-step--1 text-fg-muted">
          <span className="min-w-[min(100%,15rem)] flex-1 break-keep">
            {order.cancelRequestedAt?.toLocaleDateString("ko-KR")} 접수 — 확인 후 고객센터에서 연락드립니다.
          </span>
          <Badge variant="orange">취소 접수</Badge>
        </div>
      )}

      {billingCancelCanRefresh && (
        <form
          action={refreshBillingCancelStatusFormAction.bind(null, order.id)}
          className="mt-4"
        >
          <button
            type="submit"
            className={`${buttonVariants({ variant: "outline", size: "lg" })} min-h-12 w-full !h-auto py-3 !whitespace-normal`}
          >
            취소 상태 조회
          </button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/mypage"
          className={`${buttonVariants({ variant: "outline", size: "lg" })} min-w-[min(100%,8rem)] max-w-full flex-1 !h-auto min-h-12 py-3 text-center !whitespace-normal`}
        >
          주문내역
        </Link>
        <Link
          href="/"
          className={`${buttonVariants({ variant: "primary", size: "lg" })} min-w-[min(100%,8rem)] max-w-full flex-1 !h-auto min-h-12 py-3 text-center !whitespace-normal`}
        >
          계속 쇼핑하기
        </Link>
      </div>

      {paid && !billingCancelRequestBlocked && (
        <div className="mt-8 border-t border-line pt-6">
          <CancelRequest orderId={order.id} />
        </div>
      )}
    </div>
  );
}
