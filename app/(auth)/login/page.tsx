import Link from "next/link";
import { safeLoginReturnTarget } from "@/lib/auth-redirect";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell eyebrow="Login" title="로그인">
      <LoginForm next={safeLoginReturnTarget(next) ?? undefined} />
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-fg-muted">
        아직 회원이 아니신가요?{" "}
        <Link href="/register" className="inline-flex min-h-11 items-center font-medium text-accent-cyan hover:underline">
          회원가입
        </Link>
      </p>
    </AuthShell>
  );
}
