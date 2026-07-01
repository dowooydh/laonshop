"use server";
// 쇼핑몰 회원 인증 — 회원가입/로그인/로그아웃 (ShopUser, iron-session)
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";

export type AuthState = { error?: string };

const registerSchema = z.object({
  email: z.string().email("이메일 형식을 확인해 주세요."),
  password: z.string().min(6, "비밀번호는 6자 이상 입력해 주세요."),
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30),
  phone: z.union([z.string().trim().max(20), z.literal("")]).optional(),
});

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };
  const d = parsed.data;

  const exists = await prisma.shopUser.findUnique({ where: { email: d.email } });
  if (exists) return { error: "이미 가입된 이메일입니다." };

  const passwordHash = await bcrypt.hash(d.password, 10);
  const user = await prisma.shopUser.create({
    data: { email: d.email, passwordHash, name: d.name, phone: d.phone || null },
  });

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  await session.save();
  redirect("/");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };

  const user = await prisma.shopUser.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  await session.save();
  redirect("/");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
