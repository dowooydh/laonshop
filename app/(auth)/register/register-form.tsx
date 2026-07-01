"use client";
import { Button, FieldError, FieldHint, Input, Label } from "@/lib/ui";
import { useActionState } from "react";
import { registerAction, type AuthState } from "../actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">이름</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        <FieldHint>6자 이상 입력해 주세요.</FieldHint>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">휴대폰 (선택)</Label>
        <Input id="phone" name="phone" inputMode="numeric" placeholder="010-0000-0000" />
      </div>
      <FieldError>{state.error}</FieldError>
      <Button type="submit" variant="primary" size="xl" loading={pending}>
        가입하기
      </Button>
    </form>
  );
}
