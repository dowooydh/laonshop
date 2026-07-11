import Link from "next/link";
import { requireShopAdmin } from "@/lib/auth";
import { ADMIN_PAYMENT_REVIEW_DELAY_MS, paymentReviewAvailableAt } from "@/lib/admin-order";
import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import { PAYMENT_PROCESSING_MARKER } from "@/lib/order-guard";
import { Amount, Badge, EmptyState, StatCard, buttonVariants } from "@/lib/ui";
import { PaymentFailedForm } from "./payment-failed-form";
import { PaymentPaidForm } from "./payment-paid-form";

export const dynamic = "force-dynamic";

const ACTION_LABEL = {
  PAYMENT_CONFIRMED_PAID: "결제완료 확정",
  PAYMENT_CONFIRMED_FAILED: "결제실패 확정",
} as const;

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

type AdminPageProps = {
  searchParams: Promise<{ paymentResolved?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await requireShopAdmin();
  const { paymentResolved } = await searchParams;
  const resolutionMessage = paymentResolved === "paid"
    ? "결제완료 확정과 감사 이력을 저장했습니다."
    : paymentResolved === "failed"
      ? "결제실패 확정과 감사 이력을 저장했습니다."
      : null;
  const now = new Date();
  const reviewCutoff = new Date(now.getTime() - ADMIN_PAYMENT_REVIEW_DELAY_MS);
  const markerWhere = { status: "PENDING" as const, approvalNo: PAYMENT_PROCESSING_MARKER };
  const [reviewOrders, processingOrders, reviewCount, processingCount, recentAudits] = await Promise.all([
    prisma.shopOrder.findMany({
      where: { ...markerWhere, updatedAt: { lte: reviewCutoff } },
      include: {
        user: { select: { name: true, email: true } },
        items: true,
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    prisma.shopOrder.findMany({
      where: { ...markerWhere, updatedAt: { gt: reviewCutoff } },
      select: { id: true, moid: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    prisma.shopOrder.count({ where: { ...markerWhere, updatedAt: { lte: reviewCutoff } } }),
    prisma.shopOrder.count({ where: { ...markerWhere, updatedAt: { gt: reviewCutoff } } }),
    prisma.shopOrderAuditLog.findMany({
      include: { order: { select: { moid: true, totalAmount: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-step--1 uppercase tracking-[0.24em] text-accent-cyan">Payment Review</p>
          <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">결제 확인 센터</h1>
          <p className="max-w-2xl text-step-0 text-fg-muted">
            자동 확정되지 않은 결제만 표시합니다. KSTA에서 주문번호·금액·승인 상태를 대조한 뒤 처리하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/mypage/settings" className={buttonVariants({ variant: "outline", size: "lg" })}>
            계정 설정
          </Link>
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "lg" })}>
            쇼핑몰 보기
          </Link>
        </div>
      </header>

      {resolutionMessage && (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--success)_38%,transparent)] bg-[color-mix(in_oklab,var(--success)_8%,transparent)] px-4 py-3 text-step--1 text-success"
        >
          {resolutionMessage}
        </p>
      )}

      <section aria-labelledby="review-summary" className="space-y-4">
        <h2 id="review-summary" className="sr-only">결제 확인 요약</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="확인 대기" value={reviewCount} sub="처리 마커가 남은 주문" tone={reviewCount ? "orange" : "green"} />
          <StatCard label="자동 처리 중" value={processingCount} sub="5분 보호 구간" tone={processingCount ? "blue" : "default"} />
          <StatCard label="최근 처리 이력" value={recentAudits.length} sub="최대 20건 표시" tone="blue" />
          <StatCard
            label="현재 관리자"
            value={<span className="break-all text-step-0">{admin.name}</span>}
            sub={<span className="break-all">{admin.email}</span>}
          />
        </div>
      </section>

      {processingCount > 0 && (
        <section aria-labelledby="automatic-processing" className="rounded-[var(--radius-lg)] border border-line bg-raised p-5 shadow-elev1 sm:p-6">
          <h2 id="automatic-processing" className="font-display text-step-1 font-semibold text-fg">자동 처리 중</h2>
          <p className="mt-1 text-step--1 text-fg-muted">
            PG 응답과 내부 확정이 끝날 때까지 관리자 처리를 잠시 잠급니다. 아래 시각 이후에도 남아 있을 때만 KSTA에서 확인하세요.
          </p>
          <ul className="mt-4 space-y-2 text-step--1 text-fg-muted">
            {processingOrders.map((order) => (
              <li key={order.id} className="flex flex-col justify-between gap-1 rounded-[var(--radius-md)] border border-line px-4 py-3 sm:flex-row sm:items-center">
                <span className="break-all font-mono text-fg">{order.moid}</span>
                <span>확인 가능 {DATE_TIME_FORMAT.format(paymentReviewAvailableAt(order.updatedAt))}</span>
              </li>
            ))}
          </ul>
          {processingCount > processingOrders.length && (
            <p className="mt-3 text-step--1 text-fg-subtle">외 {processingCount - processingOrders.length}건이 자동 처리 중입니다.</p>
          )}
        </section>
      )}

      <section aria-labelledby="review-queue" className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="review-queue" className="font-display text-step-1 font-semibold text-fg">확인 대기 주문</h2>
            <p className="mt-1 text-step--1 text-fg-subtle">오래된 요청부터 표시됩니다.</p>
          </div>
          <Badge variant={reviewCount ? "orange" : "green"}>{reviewCount}건</Badge>
        </div>

        {reviewCount === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-line bg-raised">
            <EmptyState title="지금 확인할 결제가 없습니다." description="불명확한 결제가 생기면 이 화면에 자동으로 표시됩니다." />
          </div>
        ) : (
          <div className="space-y-6">
            {reviewOrders.map((order) => (
              <article key={order.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised shadow-elev1">
                <div className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="orange">확인 필요</Badge>
                        <span className="break-all font-mono text-step--1 text-fg-subtle">{order.moid}</span>
                      </div>
                      <h3 className="mt-3 font-display text-step-1 font-semibold text-fg">{order.user.name}님의 주문</h3>
                      <p className="mt-1 break-all text-step--1 text-fg-muted">{order.user.email}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <Amount value={order.totalAmount} className="text-step-1 text-fg" />
                      <p className="mt-1 text-step--1 text-fg-subtle">PG 요청 {DATE_TIME_FORMAT.format(order.updatedAt)}</p>
                    </div>
                  </div>

                  <ul className="space-y-2 border-y border-line py-4 text-step--1 text-fg-muted">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex min-w-0 justify-between gap-4">
                        <span className="min-w-0 [overflow-wrap:anywhere]">{item.name}{item.size ? ` (${item.size})` : ""} × {item.qty}</span>
                        <Amount value={item.price * item.qty} className="shrink-0" />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid border-t border-line lg:grid-cols-2 lg:divide-x lg:divide-line">
                  <details className="group border-b border-line p-5 open:bg-[color-mix(in_oklab,var(--success)_5%,transparent)] lg:border-b-0 sm:p-6">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-medium text-success marker:hidden">
                      승인 내역 있음 — 결제완료
                      <span aria-hidden className="transition-transform group-open:rotate-45">＋</span>
                    </summary>
                    <div className="mt-5 border-t border-line pt-5"><PaymentPaidForm orderId={order.id} /></div>
                  </details>
                  <details className="group p-5 open:bg-[color-mix(in_oklab,var(--danger)_5%,transparent)] sm:p-6">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-medium text-danger marker:hidden">
                      승인 내역 없음 — 결제실패
                      <span aria-hidden className="transition-transform group-open:rotate-45">＋</span>
                    </summary>
                    <div className="mt-5 border-t border-line pt-5">
                      <PaymentFailedForm orderId={order.id} orderMoid={order.moid} totalLabel={formatKrw(order.totalAmount)} />
                    </div>
                  </details>
                </div>
              </article>
            ))}
            {reviewCount > reviewOrders.length && (
              <p className="text-center text-step--1 text-fg-subtle">
                오래된 100건을 표시 중입니다. 이 화면의 주문을 처리하면 다음 대기 주문이 나타납니다.
              </p>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="audit-log" className="space-y-5">
        <div>
          <h2 id="audit-log" className="font-display text-step-1 font-semibold text-fg">최근 처리 이력</h2>
          <p className="mt-1 text-step--1 text-fg-subtle">주문 상태와 함께 저장되는 변경 불가 감사 기록입니다.</p>
        </div>
        {recentAudits.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-line bg-raised">
            <EmptyState title="아직 관리자 처리 이력이 없습니다." />
          </div>
        ) : (
          <div className="space-y-3">
            {recentAudits.map((audit) => (
              <article key={audit.id} className="rounded-[var(--radius-lg)] border border-line bg-raised p-5 shadow-elev1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={audit.toStatus === "PAID" ? "green" : "red"}>{ACTION_LABEL[audit.action]}</Badge>
                      <span className="break-all font-mono text-step--1 text-fg-subtle">{audit.order.moid}</span>
                    </div>
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-step--1 text-fg-muted sm:grid-cols-[auto_1fr]">
                      <dt>주문금액</dt>
                      <dd><Amount value={audit.order.totalAmount} /></dd>
                      {audit.confirmedAmount !== null && (
                        <><dt>확인금액</dt><dd><Amount value={audit.confirmedAmount} /></dd></>
                      )}
                      {audit.approvalNo && <><dt>승인번호</dt><dd className="break-all font-mono">{audit.approvalNo}</dd></>}
                      {audit.pgTrno && <><dt>PG 거래번호</dt><dd className="break-all font-mono">{audit.pgTrno}</dd></>}
                      {audit.cardName && <><dt>결제수단</dt><dd className="[overflow-wrap:anywhere]">{audit.cardName}</dd></>}
                    </dl>
                    <p className="mt-3 whitespace-pre-wrap text-step--1 text-fg-muted [overflow-wrap:anywhere]">{audit.reason}</p>
                  </div>
                  <div className="shrink-0 text-step--1 text-fg-subtle sm:text-right">
                    <p className="break-all">{audit.actorEmail}</p>
                    <p className="mt-1">{DATE_TIME_FORMAT.format(audit.createdAt)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
