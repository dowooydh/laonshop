import { Card, CardContent } from "@/lib/ui";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata = { title: "회원가입 · LAON SHOP" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-6 text-center text-2xl font-bold text-fg">회원가입</h1>
      <Card>
        <CardContent className="pt-5">
          <RegisterForm />
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-fg-muted">
        이미 회원이신가요?{" "}
        <Link href="/login" className="font-medium text-accent-cyan hover:underline">
          로그인
        </Link>
      </p>
      <p className="mt-3 text-center text-[11px] text-fg-subtle">
        가입 시 이용약관 및 개인정보처리방침에 동의하는 것으로 간주합니다.
      </p>
    </div>
  );
}
