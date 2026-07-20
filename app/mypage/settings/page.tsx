import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireShopUser } from "@/lib/auth";
import {
  isLaonpayBillingReady,
  isLaonpayBillingReconciliationReady,
} from "@/lib/laonpay/billing-client";
import { isBillingIntegrationAccount } from "@/lib/laonpay/billing-policy";
import { BillingCards, type BillingPaymentMethodRow } from "./billing-cards";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata = { title: "설정" };
export const dynamic = "force-dynamic";

const REGISTRATION_MESSAGES: Record<string, string> = {
  succeeded: "카드 등록 상태를 LAONPAY에서 확인했습니다. 등록된 카드로 간편결제를 이용할 수 있습니다.",
  pending: "카드 등록 처리가 아직 진행 중입니다. 새 요청을 만들지 말고 잠시 후 상태 조회를 이용해 주세요.",
  processing: "카드 등록 정보를 확인하고 있습니다. 새 요청을 만들지 말고 잠시 후 상태 조회를 이용해 주세요.",
  declined: "카드 등록이 완료되지 않았습니다. 카드정보는 라온샵에 저장되지 않았습니다.",
  expired: "카드 등록 유효시간이 만료되었습니다. 필요하면 새로 등록해 주세요.",
  unknown: "카드 등록 결과를 확인하지 못했습니다. 중복 등록을 피하려면 고객센터에 문의해 주세요.",
  invalid: "현재 계정의 카드 등록 요청을 확인할 수 없습니다.",
  unavailable: "간편결제 연동이 준비되지 않아 카드 등록 결과를 반영하지 않았습니다.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billingRegistration?: string }>;
}) {
  const user = await requireShopUser();
  const { billingRegistration } = await searchParams;
  const integrationEligible = isBillingIntegrationAccount(user.email);
  const integrationConfigured =
    integrationEligible && isLaonpayBillingReconciliationReady();
  const integrationFeatureEnabled =
    integrationEligible && isLaonpayBillingReady();
  const legacyCards = await prisma.shopBillingCard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, maskedCardNumb: true, createdAt: true },
  });
  let integrationStorageReady = false;
  let hasOpenRegistration = false;
  let paymentMethods: BillingPaymentMethodRow[] = [];
  let latestRegistration: {
    status: "REQUESTING" | "PENDING" | "PROCESSING" | "SUCCEEDED" | "DECLINED" | "UNKNOWN" | "EXPIRED";
    paymentMethodId: string | null;
  } | null = null;
  if (integrationConfigured) {
    try {
      const [methods, openRegistration, latest] = await Promise.all([
        prisma.shopBillingPaymentMethod.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            cardName: true,
            cardLast4: true,
            cardType: true,
            status: true,
            providerRegisteredAt: true,
          },
        }),
        prisma.shopBillingRegistration.findFirst({
          where: {
            userId: user.id,
            OR: [
              { status: { in: ["REQUESTING", "PENDING", "PROCESSING", "UNKNOWN"] } },
              { status: "SUCCEEDED", paymentMethodId: null },
            ],
          },
          select: { id: true },
        }),
        prisma.shopBillingRegistration.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { status: true, paymentMethodId: true },
        }),
      ]);
      paymentMethods = methods.map((method) => ({
        id: method.id,
        cardName: method.cardName,
        cardLast4: method.cardLast4,
        cardType: method.cardType,
        status: method.status,
        dateLabel: method.providerRegisteredAt.toLocaleDateString("ko-KR"),
      }));
      hasOpenRegistration = Boolean(openRegistration);
      latestRegistration = latest;
      integrationStorageReady = true;
    } catch {
      // 환경변수가 먼저 배포되거나 스키마가 아직 적용되지 않은 경우 카드 기능만 fail-closed한다.
      integrationStorageReady = false;
    }
  }

  const registrationResult = billingRegistration?.toLowerCase();
  let registrationMessage: string | null = null;
  if (registrationResult) {
    if (!integrationConfigured || !integrationStorageReady) {
      registrationMessage = REGISTRATION_MESSAGES.unavailable;
    } else if (registrationResult === "invalid") {
      registrationMessage = REGISTRATION_MESSAGES.invalid;
    } else if (
      registrationResult === "succeeded" &&
      latestRegistration?.status === "SUCCEEDED" &&
      latestRegistration.paymentMethodId !== null &&
      paymentMethods.some(
        (method) =>
          method.id === latestRegistration?.paymentMethodId && method.status === "ACTIVE",
      )
    ) {
      registrationMessage = REGISTRATION_MESSAGES.succeeded;
    } else if (
      registrationResult === "pending" &&
      latestRegistration?.status === "PENDING"
    ) {
      registrationMessage = REGISTRATION_MESSAGES.pending;
    } else if (
      registrationResult === "processing" &&
      latestRegistration?.status === "PROCESSING"
    ) {
      registrationMessage = REGISTRATION_MESSAGES.processing;
    } else if (
      registrationResult === "declined" &&
      latestRegistration?.status === "DECLINED"
    ) {
      registrationMessage = REGISTRATION_MESSAGES.declined;
    } else if (
      registrationResult === "expired" &&
      latestRegistration?.status === "EXPIRED"
    ) {
      registrationMessage = REGISTRATION_MESSAGES.expired;
    } else if (
      registrationResult === "unknown" &&
      latestRegistration?.status === "UNKNOWN"
    ) {
      registrationMessage = REGISTRATION_MESSAGES.unknown;
    } else {
      registrationMessage = REGISTRATION_MESSAGES.invalid;
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg space-y-10">
      <header className="min-w-0 space-y-2 border-b border-line pb-8">
        <Link
          href="/mypage"
          className="group inline-flex min-h-[44px] max-w-full items-center gap-2 break-keep font-mono text-step--1 uppercase tracking-widest text-fg-subtle transition-colors hover:text-fg-muted"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">←</span>
          마이페이지
        </Link>
        <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">설정</h1>
        <p className="min-w-0 font-mono text-step--1 text-fg-muted [overflow-wrap:anywhere]">{user.email}</p>
      </header>

      <section className="space-y-5">
        <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">내 정보</h2>
        <ProfileForm
          initial={{
            name: user.name,
            phone: user.phone ?? "",
            zipcode: user.zipcode ?? "",
            address: user.address ?? "",
            addressDetail: user.addressDetail ?? "",
          }}
        />
      </section>

      <section id="billing-card-management" className="scroll-mt-24 space-y-5 border-t border-line pt-8">
        <div className="space-y-1">
          <h2
            id="billing-card-management-heading"
            tabIndex={-1}
            className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
          >
            간편결제 카드 관리
          </h2>
          <p className="text-step--1 text-fg-subtle">
            등록된 결제수단의 상태를 확인하거나 안전하게 해지할 수 있습니다.
          </p>
        </div>
        <BillingCards
          integrationEligible={integrationEligible}
          integrationConfigured={integrationConfigured}
          integrationFeatureEnabled={integrationFeatureEnabled}
          integrationStorageReady={integrationStorageReady}
          hasOpenRegistration={hasOpenRegistration}
          registrationMessage={registrationMessage}
          paymentMethods={paymentMethods}
          legacyCards={legacyCards.map((card) => ({
            id: card.id,
            maskedCardNumb: card.maskedCardNumb,
            dateLabel: card.createdAt.toLocaleDateString("ko-KR"),
          }))}
        />
      </section>

      <section className="space-y-5 border-t border-line pt-8">
        <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">비밀번호 변경</h2>
        <PasswordForm minimumLength={user.role === "ADMIN" ? 12 : 8} />
      </section>

      {user.role !== "ADMIN" && (
        <section className="space-y-5 border-t border-line pt-8">
          <h2 className="font-mono text-step--1 uppercase tracking-widest text-fg-subtle">회원 탈퇴</h2>
          <DeleteAccountForm />
        </section>
      )}
    </div>
  );
}
