import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireShopUser } from "@/lib/auth";
import { BillingCards } from "./billing-cards";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata = { title: "설정" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireShopUser();
  const billingCards = await prisma.shopBillingCard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, maskedCardNumb: true, createdAt: true },
  });

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

      <section className="space-y-5 border-t border-line pt-8">
        <div className="space-y-1">
          <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">간편결제 카드 관리</h2>
          <p className="text-step--1 text-fg-subtle">기존 카드 정보를 확인하거나 삭제할 수 있습니다.</p>
        </div>
        <BillingCards
          cards={billingCards.map((c) => ({
            id: c.id,
            maskedCardNumb: c.maskedCardNumb,
            dateLabel: c.createdAt.toLocaleDateString("ko-KR"),
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
