import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface ShopSessionData {
  userId?: string;
  email?: string;
  name?: string;
}

export async function getSession(): Promise<IronSession<ShopSessionData>> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET이 없거나 32자 미만입니다 (.env 확인)");
  }
  return getIronSession<ShopSessionData>(await cookies(), {
    cookieName: "laonshop_session", // laonshop 독립 쿠키
    password: secret,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });
}
