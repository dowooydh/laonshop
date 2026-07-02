import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./register-form";

export const metadata = { title: "회원가입" };

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="Join" title="회원가입">
      <RegisterForm />
      <div className="mt-6 border-t border-line pt-5 text-center">
        <p className="text-sm text-fg-muted">
          이미 회원이신가요?{" "}
          <Link href="/login" className="font-medium text-accent-cyan hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
