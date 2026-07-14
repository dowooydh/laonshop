"use server";
// 쇼핑몰 회원 인증 — 회원가입/로그인/로그아웃 (ShopUser, iron-session)
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getBoundaryWhitespaceTrimCandidate, normalizeEmail } from "@/lib/auth-input";
import { acquireTransactionLock } from "@/lib/order-guard";
import { Prisma } from "@prisma/client";

export type AuthState = { error?: string };

const registerSchema = z.object({
  email: z.string().trim().transform(normalizeEmail).pipe(z.string().email("이메일 형식을 확인해 주세요.")),
  password: z.string().min(8, "비밀번호는 8자 이상 입력해 주세요."),
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(30),
  phone: z.union([z.string().trim().max(20), z.literal("")]).optional(),
  // 개인정보보호법 제15조 — 명시적 동의 (체크박스 미체크 시 서버에서도 거부)
  agreeTerms: z.literal("on", { errorMap: () => ({ message: "이용약관에 동의해 주세요." }) }),
  agreePrivacy: z.literal("on", { errorMap: () => ({ message: "개인정보 수집·이용에 동의해 주세요." }) }),
});

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    agreeTerms: formData.get("agreeTerms"),
    agreePrivacy: formData.get("agreePrivacy"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };
  const d = parsed.data;

  const passwordHash = await bcrypt.hash(d.password, 10);
  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      // DB의 일반 text unique는 대소문자를 구분한다. 정규화 이메일 advisory lock으로
      // 동시 가입과 대소문자 변형 가입을 직렬화해 애플리케이션 경계에서 단일성을 보장한다.
      await acquireTransactionLock(tx, `register:${d.email}`);
      const exists = await tx.shopUser.findFirst({
        where: { email: { equals: d.email, mode: "insensitive" } },
        select: { id: true },
      });
      if (exists) return null;
      return tx.shopUser.create({
        data: { email: d.email, passwordHash, name: d.name, phone: d.phone || null },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "이미 가입된 이메일입니다." };
    }
    return { error: "회원가입을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (!user) return { error: "이미 가입된 이메일입니다." };

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  await session.save();
  redirect("/");
}

// 로그인 무차별 대입 지연 — 서버리스 인스턴스 메모리 기반(인스턴스별 독립이라 완전하진 않음).
// 운영 규모가 커지면 외부 저장소(Upstash 등) 기반 rate limit으로 전환.
const LOGIN_LOCK_AFTER = 5;
const LOGIN_LOCK_MS = 10 * 60 * 1000;
const loginFails = new Map<string, { count: number; lockedUntil: number }>();

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };

  const key = email;
  const fail = loginFails.get(key);
  if (fail && fail.lockedUntil > Date.now()) {
    return { error: "로그인 시도가 너무 많습니다. 10분 후 다시 시도해 주세요." };
  }

  const user = await prisma.shopUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!passwordMatches && user) {
    const trimCandidate = getBoundaryWhitespaceTrimCandidate(password);
    if (trimCandidate && (await bcrypt.compare(trimCandidate, user.passwordHash))) {
      return {
        error: "비밀번호 앞뒤에 공백이 포함되어 있습니다. 공백을 지우고 다시 입력해 주세요.",
      };
    }
  }

  if (!user || !passwordMatches) {
    if (loginFails.size > 1000) loginFails.clear(); // 메모리 상한
    const lockExpired = fail !== undefined && fail.lockedUntil !== 0 && fail.lockedUntil <= Date.now();
    const count = (lockExpired ? 0 : (fail?.count ?? 0)) + 1;
    const nowLocked = count >= LOGIN_LOCK_AFTER;
    loginFails.set(key, {
      count,
      lockedUntil: nowLocked ? Date.now() + LOGIN_LOCK_MS : 0,
    });
    // 잠금이 걸리는 그 시도(5번째)부터 바로 안내 — 다음 시도까지 기다리지 않도록
    return {
      error: nowLocked
        ? "비밀번호를 5회 잘못 입력했습니다. 보안을 위해 10분 후 다시 시도해 주세요."
        : "이메일 또는 비밀번호가 올바르지 않습니다.",
    };
  }
  loginFails.delete(key);

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
