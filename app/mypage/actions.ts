"use server";
// 마이페이지 설정 — 내 정보 수정 / 비밀번호 변경 / 회원 탈퇴
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireShopUser } from "@/lib/auth";
import { getSession } from "@/lib/session";

export type SettingsState = { error?: string; ok?: boolean };

const profileSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30),
  phone: z.union([z.string().trim().max(20), z.literal("")]).optional(),
  zipcode: z.union([z.string().trim().regex(/^\d{5}$/, "우편번호는 주소 검색으로 입력해 주세요."), z.literal("")]).optional(),
  address: z.union([z.string().trim().max(200), z.literal("")]).optional(),
  addressDetail: z.union([z.string().trim().max(100), z.literal("")]).optional(),
});

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireShopUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    zipcode: formData.get("zipcode"),
    address: formData.get("address"),
    addressDetail: formData.get("addressDetail"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };

  await prisma.shopUser.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      zipcode: parsed.data.zipcode || null,
      address: parsed.data.address || null,
      addressDetail: parsed.data.addressDetail || null,
    },
  });
  revalidatePath("/mypage");
  return { ok: true };
}

const passwordSchema = z.object({
  current: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
  next: z.string().min(8, "새 비밀번호는 8자 이상 입력해 주세요."),
});

export async function changePasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireShopUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };

  if (user.role === "ADMIN" && parsed.data.next.length < 12) {
    return { error: "관리자 계정의 새 비밀번호는 12자 이상 입력해 주세요." };
  }

  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }
  await prisma.shopUser.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, user.role === "ADMIN" ? 12 : 10) },
  });
  return { ok: true };
}

// ── 원클릭 결제 카드 관리 ──────────────────────────────────────────────
// NEEDS_PG_SPEC: KSNET 빌링키 등록·승인·해지 계약과 안전한 PG 호스팅 등록 경로가 확인될 때까지
// 신규 등록은 제공하지 않는다. 아래 삭제 액션은 과거 mock 등록 레코드 정리 용도로만 유지한다.
export async function deleteBillingCardAction(cardId: string): Promise<SettingsState> {
  const user = await requireShopUser();
  // 본인 카드만 — 조건부 삭제로 IDOR 차단
  await prisma.shopBillingCard.deleteMany({ where: { id: cardId, userId: user.id } });
  revalidatePath("/mypage/settings");
  return { ok: true };
}

export async function deleteAccountAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireShopUser();
  if (user.role === "ADMIN") {
    return { error: "관리자 계정은 회원 탈퇴할 수 없습니다. 먼저 다른 관리자에게 권한을 이관해 주세요." };
  }
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "비밀번호를 입력해 주세요." };
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  // 소프트 삭제 + 개인정보 익명화 — 주문·결제 기록은 전자상거래법 보존기간(5년) 동안 유지,
  // 식별 정보만 파기 (개인정보처리방침 6조와 정합)
  await prisma.$transaction([
    prisma.wishlist.deleteMany({ where: { userId: user.id } }),
    prisma.shopBillingCard.deleteMany({ where: { userId: user.id } }),
    prisma.shopUser.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        email: `deleted-${user.id}@removed.laonshop`,
        name: "탈퇴회원",
        phone: null,
        zipcode: null,
        address: null,
        addressDetail: null,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10), // 재로그인 원천 차단
      },
    }),
  ]);

  const session = await getSession();
  session.destroy();
  redirect("/");
}
