import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./register-form";

export const metadata = { title: "회원가입 · LAON SHOP" };

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="Join" title="회원가입">
      <RegisterForm />
      <div className="mt-6 space-y-3 border-t border-line pt-5 text-center">
        <p className="text-sm text-fg-muted">
          이미 회원이신가요?{" "}
          <Link href="/login" className="font-medium text-accent-cyan hover:underline">
            로그인
          </Link>
        </p>
        <p className="text-[11px] text-fg-subtle">
          가입 시 이용약관 및 개인정보처리방침에 동의하는 것으로 간주합니다.
        </p>
      </div>
    </AuthShell>
  );
}
