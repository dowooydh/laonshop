import { prisma } from "@/lib/db";
import { requireShopUser } from "@/lib/auth";
import { isKspayRestLiveEnabled } from "@/lib/kspay/webfep";
import { isLaonpayBillingReady } from "@/lib/laonpay/billing-client";
import { isBillingIntegrationAccount } from "@/lib/laonpay/billing-policy";
import { resolveManualPaymentMode } from "@/lib/manual-payment-demo";
import { CheckoutForm, type CheckoutBillingPaymentMethod } from "./checkout-form";

export const metadata = { title: "주문/결제" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // 체크아웃 진입 시점에 로그인 요구 — 폼을 다 채운 뒤 결제 단계에서 튕기는 것 방지
  const user = await requireShopUser();

  // 네이버식 프리필: 설정의 기본 배송지 → 최근 주문 배송지 → 회원 프로필(이름·휴대폰) 순
  const lastOrder = await prisma.shopOrder.findFirst({
    where: { userId: user.id, address: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { receiverName: true, receiverPhone: true, address: true },
  });
  let billingPaymentMethods: CheckoutBillingPaymentMethod[] = [];
  if (isBillingIntegrationAccount(user.email) && isLaonpayBillingReady()) {
    try {
      billingPaymentMethods = await prisma.shopBillingPaymentMethod.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true, cardName: true, cardLast4: true, cardType: true },
      });
    } catch {
      // 스키마·외부 연동 준비가 완전히 끝나기 전에는 일반 결제수단만 제공한다.
      billingPaymentMethods = [];
    }
  }

  return (
    <CheckoutForm
      manualPaymentMode={resolveManualPaymentMode(
        user.email,
        isKspayRestLiveEnabled(),
      )}
      billingPaymentMethods={billingPaymentMethods}
      initial={{
        receiverName: lastOrder?.receiverName ?? user.name ?? "",
        receiverPhone: lastOrder?.receiverPhone ?? user.phone ?? "",
        zipcode: user.zipcode ?? "",
        address: user.address ?? lastOrder?.address ?? "",
        addressDetail: user.addressDetail ?? "",
      }}
    />
  );
}
