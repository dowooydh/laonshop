import { PrismaClient } from "@prisma/client";

// Prisma 타입(ShopUser, Product, ShopOrder 등) 재노출 — @laonpay/db 대체
export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** 개발 중 HMR 재연결 폭증 방지용 싱글턴 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
