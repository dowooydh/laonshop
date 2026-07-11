import { PAYMENT_PROCESSING_MARKER } from "@/lib/order-guard";

export type PaymentResolution =
  | {
      decision: "PAID";
      confirmedAmount: number;
      approvalNo: string;
      pgTrno: string;
      cardName: string | null;
      reason: string;
    }
  | {
      decision: "FAILED";
      reason: string;
    };

// KSPAY/WEBFEP 요청 timeout과 서버 후속 확정이 끝나기 전에 운영자가 상태를 덮어쓰지 않도록 한다.
export const ADMIN_PAYMENT_REVIEW_DELAY_MS = 5 * 60 * 1000;

type ReviewableOrder = {
  status: string;
  approvalNo: string | null;
  totalAmount: number;
  updatedAt: Date;
};

type PreparedResolution =
  | {
      ok: true;
      orderData: {
        status: "PAID" | "FAILED";
        approvalNo: string | null;
        pgTrno: string | null;
        cardName: string | null;
        paidAt: Date | null;
      };
      auditData: {
        action: "PAYMENT_CONFIRMED_PAID" | "PAYMENT_CONFIRMED_FAILED";
        fromStatus: "PENDING";
        toStatus: "PAID" | "FAILED";
        reason: string;
        confirmedAmount: number | null;
        approvalNo: string | null;
        pgTrno: string | null;
        cardName: string | null;
      };
    }
  | { ok: false; error: string };

export function isPaymentReviewRequired(status: string, approvalNo: string | null): boolean {
  return status === "PENDING" && approvalNo === PAYMENT_PROCESSING_MARKER;
}

export function isPaymentReviewReady(
  status: string,
  approvalNo: string | null,
  processingUpdatedAt: Date,
  now: Date = new Date(),
): boolean {
  return (
    isPaymentReviewRequired(status, approvalNo) &&
    now.getTime() - processingUpdatedAt.getTime() >= ADMIN_PAYMENT_REVIEW_DELAY_MS
  );
}

export function paymentReviewAvailableAt(processingUpdatedAt: Date): Date {
  return new Date(processingUpdatedAt.getTime() + ADMIN_PAYMENT_REVIEW_DELAY_MS);
}

/**
 * 관리자 확정 정책을 DB/Next.js와 분리한 순수 함수.
 * 실제 쓰기는 주문 advisory lock을 획득한 뒤 이 결과를 사용해야 한다.
 */
export function preparePaymentResolution(
  order: ReviewableOrder,
  resolution: PaymentResolution,
  now: Date = new Date(),
): PreparedResolution {
  if (!isPaymentReviewRequired(order.status, order.approvalNo)) {
    return { ok: false, error: "이미 처리됐거나 관리자 확인 대상이 아닌 주문입니다." };
  }
  if (!isPaymentReviewReady(order.status, order.approvalNo, order.updatedAt, now)) {
    return { ok: false, error: "PG 자동 처리가 진행 중입니다. 요청 후 5분이 지난 다음 KSTA 결과를 확인해 주세요." };
  }

  const reason = resolution.reason.trim();
  if (reason.length < 5 || reason.length > 500) {
    return { ok: false, error: "KSTA에서 확인한 내용을 5자 이상 500자 이내로 기록해 주세요." };
  }

  if (resolution.decision === "PAID") {
    const approvalNo = resolution.approvalNo.trim();
    const pgTrno = resolution.pgTrno.trim();
    const cardName = resolution.cardName?.trim() || null;
    if (!approvalNo || approvalNo === PAYMENT_PROCESSING_MARKER) {
      return { ok: false, error: "KSTA에서 확인한 실제 승인번호를 입력해 주세요." };
    }
    if (!pgTrno) {
      return { ok: false, error: "KSTA에서 확인한 PG 거래번호를 입력해 주세요." };
    }
    if (!Number.isSafeInteger(resolution.confirmedAmount) || resolution.confirmedAmount <= 0) {
      return { ok: false, error: "KSTA 승인 금액을 원 단위 정수로 입력해 주세요." };
    }
    if (resolution.confirmedAmount !== order.totalAmount) {
      return { ok: false, error: "KSTA 승인 금액과 주문 금액이 일치하지 않습니다. 승인 취소 여부를 먼저 확인해 주세요." };
    }
    return {
      ok: true,
      orderData: {
        status: "PAID",
        approvalNo,
        pgTrno,
        cardName,
        // 외부 승인 시점은 처리 마커가 기록된 시각에 가장 가깝다. 관리자 확정 시각은 감사 로그에 별도 기록된다.
        paidAt: order.updatedAt,
      },
      auditData: {
        action: "PAYMENT_CONFIRMED_PAID",
        fromStatus: "PENDING",
        toStatus: "PAID",
        reason,
        confirmedAmount: resolution.confirmedAmount,
        approvalNo,
        pgTrno,
        cardName,
      },
    };
  }

  return {
    ok: true,
    orderData: {
      status: "FAILED",
      approvalNo: null,
      pgTrno: null,
      cardName: null,
      paidAt: null,
    },
    auditData: {
      action: "PAYMENT_CONFIRMED_FAILED",
      fromStatus: "PENDING",
      toStatus: "FAILED",
      reason,
      confirmedAmount: null,
      approvalNo: null,
      pgTrno: null,
      cardName: null,
    },
  };
}
