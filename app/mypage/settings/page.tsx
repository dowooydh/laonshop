import Link from "next/link";
import { requireShopUser } from "@/lib/auth";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata = { title: "설정" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireShopUser();

  return (
    <div className="mx-auto max-w-lg space-y-10">
      <header className="space-y-2 border-b border-line pb-8">
        <Link
          href="/mypage"
          className="group inline-flex items-center gap-2 font-mono text-step--1 uppercase tracking-widest text-fg-subtle transition-colors hover:text-fg-muted"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">←</span>
          마이페이지
        </Link>
        <h1 className="font-display text-step-3 font-bold tracking-tight text-fg">설정</h1>
        <p className="font-mono text-step--1 text-fg-muted">{user.email}</p>
      </header>

      <section className="space-y-5">
        <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">내 정보</h2>
        <ProfileForm initial={{ name: user.name, phone: user.phone ?? "", address: user.address ?? "" }} />
      </section>

      <section className="space-y-5 border-t border-line pt-8">
        <h2 className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">비밀번호 변경</h2>
        <PasswordForm />
      </section>

      <section className="space-y-5 border-t border-line pt-8">
        <h2 className="font-mono text-step--1 uppercase tracking-widest text-fg-subtle">회원 탈퇴</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
