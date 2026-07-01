import { Card, CardContent } from "@/lib/ui";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인 · LAON SHOP" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-6 text-center text-2xl font-bold text-fg">로그인</h1>
      <Card>
        <CardContent className="pt-5">
          <LoginForm />
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-fg-muted">
        아직 회원이 아니신가요?{" "}
        <Link href="/register" className="font-medium text-accent-cyan hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
