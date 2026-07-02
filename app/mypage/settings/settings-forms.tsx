"use client";
// 설정 폼 3종 — 내 정보 / 비밀번호 변경 / 회원 탈퇴 (마이페이지 톤: 모노 아이브로 + 섹션 분리)
import { Button, FieldError, FieldHint, Input, Label } from "@/lib/ui";
import { useActionState, useState } from "react";
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
  type SettingsState,
} from "../actions";

function SavedMark({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="font-mono text-step--1 text-success">저장되었습니다 ✓</span>;
}

export function ProfileForm({ initial }: { initial: { name: string; phone: string; address: string } }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="s-name">이름</Label>
        <Input id="s-name" name="name" defaultValue={initial.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-phone">휴대폰</Label>
        <Input id="s-phone" name="phone" inputMode="numeric" placeholder="010-0000-0000" defaultValue={initial.phone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-addr">기본 배송지</Label>
        <Input id="s-addr" name="address" placeholder="주소를 입력해 주세요" defaultValue={initial.address} />
        <FieldHint>주문서 배송지에 자동으로 채워집니다.</FieldHint>
      </div>
      <FieldError>{state.error}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="md" loading={pending}>
          저장
        </Button>
        <SavedMark show={!!state.ok && !pending} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="s-cur">현재 비밀번호</Label>
        <Input id="s-cur" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-next">새 비밀번호</Label>
        <Input id="s-next" name="next" type="password" autoComplete="new-password" required />
        <FieldHint>8자 이상 입력해 주세요.</FieldHint>
      </div>
      <FieldError>{state.error}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="md" loading={pending}>
          비밀번호 변경
        </Button>
        <SavedMark show={!!state.ok && !pending} />
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(deleteAccountAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-step--1 text-fg-subtle">
          탈퇴 시 개인정보는 파기되며, 주문·결제 기록은 법정 보존기간 동안만 보관됩니다.
        </p>
        <Button type="button" variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setOpen(true)}>
          회원 탈퇴
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-step--1 leading-relaxed text-fg-muted">
        탈퇴하면 되돌릴 수 없습니다. 계속하려면 비밀번호를 입력해 주세요.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="s-del">비밀번호 확인</Label>
        <Input id="s-del" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FieldError>{state.error}</FieldError>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>
          취소
        </Button>
        <Button type="submit" variant="danger" size="md" loading={pending}>
          탈퇴하기
        </Button>
      </div>
    </form>
  );
}
