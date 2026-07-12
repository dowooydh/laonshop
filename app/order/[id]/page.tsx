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
import { PAYMENT_PROCESSING_MARKER } from "@/lib/order-guard";

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
  searchParams: Promise<{ receipt?: string }>;
}) {
  const user = await requireShopUser();
  const { id } = await params;
  const { receipt } = await searchParams;
  const order = await prisma.shopOrder.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();

  const paid = order.status === "PAID";
  const processing = order.status === "PENDING" && order.approvalNo === PAYMENT_PROCESSING_MARKER;
  const retryable = !processing && (order.status === "PENDING" || order.status === "FAILED");
  const s = processing
    ? { eyebrow: "Payment Processing", heading: "결제 결과를 확인하고 있습니다", tone: "warning" as const }
    : STATUS[order.status] ?? STATUS.PENDING;

  // 결제 재개 섹션 — 원클릭(등록 카드) 노출·선택용
  const billingCards = retryable
    ? await prisma.shopBillingCard.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, maskedCardNumb: true },
      })
    : [];

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
        <h1 className="mt-2 text-balance break-keep font-display text-step-1 font-bold tracking-tight text-fg min-[360px]:text-step-2">
          {s.heading}
        </h1>
        <div className="mt-4">
          <Amount value={order.totalAmount} className="inline-block max-w-full text-step-2 text-fg [overflow-wrap:anywhere]" />
        </div>
      </div>

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
                  {order.cardName ? `${order.cardName} (KSPAY)` : "신용카드·간편결제 (KSPAY)"}
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

      {retryable && <RetryPayment orderId={order.id} amount={order.totalAmount} billingCards={billingCards} />}

      {order.status === "CANCEL_REQUESTED" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-raised px-4 py-3 text-step--1 text-fg-muted">
          <span className="min-w-[min(100%,15rem)] flex-1 break-keep">
            {order.cancelRequestedAt?.toLocaleDateString("ko-KR")} 접수 — 확인 후 고객센터에서 연락드립니다.
          </span>
          <Badge variant="orange">취소 접수</Badge>
        </div>
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

      {paid && (
        <div className="mt-8 border-t border-line pt-6">
          <CancelRequest orderId={order.id} />
        </div>
      )}
    </div>
  );
}
