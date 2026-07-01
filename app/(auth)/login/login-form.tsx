"use client";
import { Button, FieldError, Input, Label } from "@/lib/ui";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FieldError>{state.error}</FieldError>
      <Button type="submit" size="xl" loading={pending}>
        로그인
      </Button>
    </form>
  );
}
