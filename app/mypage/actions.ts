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
  address: z.union([z.string().trim().max(200), z.literal("")]).optional(),
});

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireShopUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };

  await prisma.shopUser.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
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

  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }
  await prisma.shopUser.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  });
  return { ok: true };
}

// ── 원클릭 결제 카드 관리 ──────────────────────────────────────────────
// NEEDS_PG_SPEC: KSNET 빌링 등록(/billing/regist)은 사업부 계약 + KSPAY_API_KEY 필요.
// 계약 전에는 mock 토큰 발급 — 입력 카드정보는 검증 즉시 폐기하고 마스킹 번호만 저장한다.
// 실연동 시 라온페이 pg-adapter의 registerBillingCard(73a54ee)를 이식.

const MAX_CARDS = 3;

const cardSchema = z.object({
  cardNo: z.string().regex(/^\d{15,16}$/, "카드번호 15~16자리를 입력해 주세요."),
  expMm: z.string().regex(/^(0[1-9]|1[0-2])$/, "유효기간 월(MM)을 확인해 주세요."),
  expYy: z.string().regex(/^\d{2}$/, "유효기간 연도(YY)를 확인해 주세요."),
  pw2: z.string().regex(/^\d{2}$/, "비밀번호 앞 2자리를 입력해 주세요."),
  birth6: z.string().regex(/^\d{6}(\d{4})?$/, "생년월일 6자리(법인카드는 사업자번호 10자리)를 입력해 주세요."),
});

export async function registerBillingCardAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireShopUser();
  const parsed = cardSchema.safeParse({
    cardNo: String(formData.get("cardNo") ?? "").replace(/[\s-]/g, ""),
    expMm: formData.get("expMm"),
    expYy: formData.get("expYy"),
    pw2: formData.get("pw2"),
    birth6: formData.get("birth6"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };

  const count = await prisma.shopBillingCard.count({ where: { userId: user.id } });
  if (count >= MAX_CARDS) return { error: `카드는 최대 ${MAX_CARDS}장까지 등록할 수 있습니다.` };

  // 카드 원문은 여기서 끝 — 마스킹·토큰 외 어디에도 남기지 않는다 (로그 출력 금지)
  const cardNo = parsed.data.cardNo;
  const maskedCardNumb = `${cardNo.slice(0, 4)}-${cardNo.slice(4, 6)}**-****-${cardNo.slice(-4)}`;
  const billingToken = `MB${crypto.randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`; // mock 16자

  await prisma.shopBillingCard.create({
    data: { userId: user.id, billingToken, maskedCardNumb },
  });
  revalidatePath("/mypage/settings");
  return { ok: true };
}

export async function deleteBillingCardAction(cardId: string): Promise<SettingsState> {
  const user = await requireShopUser();
  // 본인 카드만 — 조건부 삭제로 IDOR 차단
  await prisma.shopBillingCard.deleteMany({ where: { id: cardId, userId: user.id } });
  revalidatePath("/mypage/settings");
  return { ok: true };
}

export async function deleteAccountAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireShopUser();
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
        address: null,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10), // 재로그인 원천 차단
      },
    }),
  ]);

  const session = await getSession();
  session.destroy();
  redirect("/");
}
