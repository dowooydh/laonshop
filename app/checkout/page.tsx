import { prisma } from "@/lib/db";
import { requireShopUser } from "@/lib/auth";
import { isKspayRestLiveEnabled } from "@/lib/kspay/webfep";
import { CheckoutForm } from "./checkout-form";

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

  return (
    <CheckoutForm
      manualPaymentEnabled={isKspayRestLiveEnabled()}
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
