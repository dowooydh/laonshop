import { MANUAL_PAYMENT_DEMO_APPROVAL_PREFIX } from "@/lib/manual-payment-demo";

export const COMMERCE_CARRIERS = [
  { code: "CJ", label: "CJ대한통운" },
  { code: "HANJIN", label: "한진택배" },
  { code: "LOTTE", label: "롯데택배" },
  { code: "POST", label: "우체국택배" },
  { code: "LOGEN", label: "로젠택배" },
  { code: "CU", label: "CU 편의점택배" },
  { code: "GS", label: "GS 편의점택배" },
] as const;

export type CommerceActionState = { status: "idle" | "success" | "error"; message?: string };
export const COMMERCE_PREPARING_MESSAGE = "후기·배송 관리 준비 중입니다. 잠시 후 다시 확인해 주세요.";

export function carrierLabel(code: string): string {
  return COMMERCE_CARRIERS.find((carrier) => carrier.code === code)?.label ?? "택배사 확인 중";
}

export function canFulfilOrder(order: {
  status: string;
  approvalNo: string | null;
  paidAt: Date | null;
}): boolean {
  return order.status === "PAID" && order.paidAt !== null &&
    !order.approvalNo?.startsWith(MANUAL_PAYMENT_DEMO_APPROVAL_PREFIX) &&
    // 이 모듈은 택배사 선택 UI에서도 사용하므로 서버 전용 order-guard를 import하지 않는다.
    order.approvalNo !== "__KSPAY_PROCESSING__" && order.approvalNo !== "__LAONPAY_BILLING_PROCESSING__";
}

export function maskReviewAuthor(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? `${first}**` : "구매자";
}

export function validShipmentInput(carrier: string, trackingNumber: string): boolean {
  return COMMERCE_CARRIERS.some((item) => item.code === carrier) &&
    trackingNumber.length >= 8 && trackingNumber.length <= 20 && !/\D/.test(trackingNumber);
}

export function isMissingCommerceTable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  // 연결·권한·데이터 오류는 준비 중으로 숨기지 않는다.
  if (error.code === "P2021" || error.code === "42P01") return true;
  return error.code === "P2010" && "meta" in error && error.meta !== null &&
    typeof error.meta === "object" && "code" in error.meta && error.meta.code === "42P01";
}
