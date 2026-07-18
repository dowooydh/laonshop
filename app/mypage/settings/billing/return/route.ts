import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { acquireTransactionLock } from "@/lib/order-guard";
import { createLaonpayBillingClient, isLaonpayBillingReady } from "@/lib/laonpay/billing-client";
import {
  BILLING_REGISTRATION_COOKIE,
  isBillingIntegrationAccount,
  mergeRegistrationStatus,
  paymentMethodData,
  paymentMethodSyncData,
} from "@/lib/laonpay/billing-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsRedirect(request: NextRequest, state: string): NextResponse {
  const target = new URL("/mypage/settings", request.url);
  target.searchParams.set("billingRegistration", state);
  target.hash = "billing-card-management";
  const response = NextResponse.redirect(target, 303);
  response.cookies.set(BILLING_REGISTRATION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/mypage/settings/billing/return",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function parseRegistrationCookie(value: string | undefined): { localId: string; providerId: string } | null {
  if (!value) return null;
  const [localId, providerId, extra] = value.split(".");
  if (
    extra !== undefined ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(localId ?? "") ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(providerId ?? "")
  ) {
    return null;
  }
  return { localId, providerId };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.redirect(new URL("/login", request.url), 303);
  const user = await prisma.shopUser.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt || !isBillingIntegrationAccount(user.email) || !isLaonpayBillingReady()) {
    return settingsRedirect(request, "unavailable");
  }

  const cookieRegistration = parseRegistrationCookie(
    request.cookies.get(BILLING_REGISTRATION_COOKIE)?.value,
  );
  const queryRegistrationId = request.nextUrl.searchParams.get("billingRegistrationId");
  if (!cookieRegistration || queryRegistrationId !== cookieRegistration.providerId) {
    return settingsRedirect(request, "invalid");
  }

  const localRegistration = await prisma.shopBillingRegistration
    .findFirst({
      where: {
        id: cookieRegistration.localId,
        userId: user.id,
        laonpayRegistrationId: cookieRegistration.providerId,
      },
    })
    .catch(() => null);
  if (!localRegistration) return settingsRedirect(request, "invalid");

  const result = await createLaonpayBillingClient().getRegistrationIntent(
    cookieRegistration.providerId,
  );
  if (!result.ok || result.data.registrationId !== cookieRegistration.providerId) {
    await prisma
      .$transaction(async (tx) => {
        await acquireTransactionLock(tx, `billing-user-lifecycle:${user.id}`);
        await acquireTransactionLock(tx, `billing-registration:${localRegistration.id}`);
        const activeUser = await tx.shopUser.findFirst({
          where: { id: user.id, email: user.email, deletedAt: null },
          select: { id: true },
        });
        if (!activeUser) return;
        await tx.shopBillingRegistration.updateMany({
          where: {
            id: localRegistration.id,
            userId: user.id,
            status: { in: ["REQUESTING", "PENDING", "PROCESSING", "UNKNOWN"] },
          },
          data: { status: "UNKNOWN" },
        });
      })
      .catch(() => undefined);
    return settingsRedirect(request, "unknown");
  }

  const remote = result.data;
  const finalState = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-user-lifecycle:${user.id}`);
      await acquireTransactionLock(tx, `billing-registration:${localRegistration.id}`);
      const [activeUser, local] = await Promise.all([
        tx.shopUser.findFirst({
          where: { id: user.id, email: user.email, deletedAt: null },
          select: { id: true },
        }),
        tx.shopBillingRegistration.findFirst({
          where: {
            id: localRegistration.id,
            userId: user.id,
            laonpayRegistrationId: cookieRegistration.providerId,
          },
        }),
      ]);
      if (!activeUser || !local) return "unavailable";
      if (local.status === "SUCCEEDED" && local.paymentMethodId) return "succeeded";
      if (local.status === "DECLINED" || local.status === "EXPIRED") {
        return local.status.toLowerCase();
      }
      if (remote.status !== "SUCCEEDED" || !remote.paymentMethod) {
        const status = mergeRegistrationStatus(local.status, remote.status);
        await tx.shopBillingRegistration.update({
          where: { id: local.id },
          data: { status, expiresAt: new Date(remote.expiresAt) },
        });
        return status.toLowerCase();
      }

      const existing = await tx.shopBillingPaymentMethod.findUnique({
        where: { laonpayPaymentMethodId: remote.paymentMethod.id },
        select: { id: true, userId: true, status: true, deregisterIdempotencyKey: true },
      });
      if (existing && existing.userId !== user.id) {
        await tx.shopBillingRegistration.update({
          where: { id: local.id },
          data: { status: "UNKNOWN" },
        });
        return "unknown";
      }
      if (existing) {
        await acquireTransactionLock(tx, `billing-method:${existing.id}`);
      }
      const lockedExisting = existing
        ? await tx.shopBillingPaymentMethod.findUnique({
            where: { id: existing.id },
            select: {
              id: true,
              userId: true,
              status: true,
              deregisterIdempotencyKey: true,
            },
          })
        : null;
      if (existing && !lockedExisting) return "unknown";
      const method = await tx.shopBillingPaymentMethod.upsert({
        where: { laonpayPaymentMethodId: remote.paymentMethod.id },
        create: { userId: user.id, ...paymentMethodData(remote.paymentMethod) },
        update: paymentMethodSyncData(remote.paymentMethod, lockedExisting),
      });
      await tx.shopBillingRegistration.update({
        where: { id: local.id },
        data: {
          status: "SUCCEEDED",
          expiresAt: new Date(remote.expiresAt),
          paymentMethodId: method.id,
        },
      });
      return "succeeded";
    })
    .catch(() => "unknown");
  return settingsRedirect(request, finalState);
}
