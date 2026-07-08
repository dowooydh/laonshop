// 원클릭(빌링) 결제 — NEEDS_PG_SPEC: KSNET 빌링 승인 API(사업부 계약 + KSPAY_API_KEY) 미확보.
// 실연동 시 라온페이 pg-adapter 빌링 이식 후 allowlist·mock 승인을 제거한다.
import { prisma } from "@/lib/db";

// 실고객이 mock 승인으로 무결제 주문을 만드는 것을 차단하는 가드
export const BILLING_TEST_EMAILS = ["test@laonshop.com", "laontest@laontest.com"];

// mock 승인 — 결제 대기(PENDING/FAILED) 주문만 조건부 확정 (경합·중복 승인 차단).
// 금액은 주문 생성 시 서버 재조회로 확정된 totalAmount를 그대로 사용한다.
export async function approveBillingMock(orderId: string, maskedCardNumb: string): Promise<boolean> {
  const r = await prisma.shopOrder.updateMany({
    where: { id: orderId, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      approvalNo: `MB${Date.now().toString().slice(-8)}`,
      cardName: `등록카드 ${maskedCardNumb}`,
    },
  });
  return r.count === 1;
}
