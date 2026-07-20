"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireShopUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { acquireTransactionLock } from "@/lib/order-guard";
import {
  BILLING_SETTINGS_RETURN_URL,
  createLaonpayBillingClient,
} from "@/lib/laonpay/billing-client";
import { upsertOwnedBillingPaymentMethod } from "@/lib/laonpay/billing-ledger";
import {
  billingRequestFingerprint,
  BILLING_REGISTRATION_COOKIE,
  isBillingIntegrationEnabled,
  isBillingReconciliationEnabled,
  mapPaymentMethodStatus,
  mergeRegistrationStatus,
} from "@/lib/laonpay/billing-policy";
import type { BillingRegistrationStatus } from "@/lib/laonpay/billing-contract";

const REGISTRATION_OPEN_STATUSES = ["REQUESTING", "PENDING", "PROCESSING", "UNKNOWN"] as const;
const BILLING_TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;
const REGISTRATION_REQUEST_STALE_MS = 5 * 60 * 1_000;

export type BillingSettingsActionState = {
  ok?: true;
  error?: string;
  message?: string;
};

function registrationCookieValue(localId: string, providerId: string): string {
  return `${localId}.${providerId}`;
}

async function setRegistrationCookie(
  localId: string,
  providerId: string,
  expiresAtValue: string,
): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = new Date(expiresAtValue).getTime();
  const maxAge = Math.max(60, Math.min(20 * 60, Math.floor((expiresAt - Date.now()) / 1_000)));
  cookieStore.set(
    BILLING_REGISTRATION_COOKIE,
    registrationCookieValue(localId, providerId),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/mypage/settings/billing/return",
    },
  );
}

async function persistCreatedRegistration(input: {
  localRegistrationId: string;
  userId: string;
  registrationId: string;
  status: BillingRegistrationStatus;
  expiresAt: string;
}): Promise<{ ok: true; status: string } | { ok: false }> {
  return prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-user-lifecycle:${input.userId}`);
      await acquireTransactionLock(tx, `billing-registration:${input.localRegistrationId}`);
      const [activeUser, local] = await Promise.all([
        tx.shopUser.findFirst({
          where: { id: input.userId, deletedAt: null },
          select: { id: true },
        }),
        tx.shopBillingRegistration.findFirst({
          where: { id: input.localRegistrationId, userId: input.userId },
        }),
      ]);
      if (
        !activeUser ||
        !local ||
        (local.laonpayRegistrationId !== null &&
          local.laonpayRegistrationId !== input.registrationId)
      ) {
        return { ok: false as const };
      }
      const status = mergeRegistrationStatus(local.status, input.status);
      if (
        local.status === "SUCCEEDED" ||
        local.status === "DECLINED" ||
        local.status === "EXPIRED"
      ) {
        return { ok: true as const, status };
      }
      await tx.shopBillingRegistration.update({
        where: { id: local.id },
        data: {
          laonpayRegistrationId: input.registrationId,
          status,
          expiresAt: new Date(input.expiresAt),
        },
      });
      return { ok: true as const, status };
    }, BILLING_TX_OPTIONS)
    .catch(() => ({ ok: false as const }));
}

async function markRegistrationUnknown(input: {
  localRegistrationId: string;
  userId: string;
  rejected?: boolean;
}): Promise<void> {
  await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-user-lifecycle:${input.userId}`);
      await acquireTransactionLock(tx, `billing-registration:${input.localRegistrationId}`);
      const local = await tx.shopBillingRegistration.findFirst({
        where: { id: input.localRegistrationId, userId: input.userId },
      });
      if (!local) return;
      const status = mergeRegistrationStatus(local.status, "UNKNOWN");
      if (status === local.status && !input.rejected) return;
      await tx.shopBillingRegistration.update({
        where: { id: local.id },
        data: {
          status,
          ...(input.rejected ? { requestAttempts: 2 } : {}),
        },
      });
    }, BILLING_TX_OPTIONS)
    .catch(() => undefined);
}

async function claimRegistrationAttempt(registrationId: string): Promise<boolean> {
  return (
    (await prisma
      .$transaction(async (tx) => {
        await acquireTransactionLock(tx, `billing-registration:${registrationId}`);
        const registration = await tx.shopBillingRegistration.findUnique({
          where: { id: registrationId },
        });
        if (!registration) {
          return false;
        }
        const staleInitialRequest =
          registration.status === "REQUESTING" &&
          registration.requestAttempts === 1 &&
          registration.laonpayRegistrationId === null &&
          registration.updatedAt.getTime() <=
            Date.now() - REGISTRATION_REQUEST_STALE_MS;
        const canClaimInitial =
          registration.status === "REQUESTING" &&
          registration.requestAttempts === 0;
        const canClaimReconciliation =
          registration.requestAttempts === 1 &&
          (registration.status === "UNKNOWN" ||
            (registration.laonpayRegistrationId !== null &&
              (registration.status === "PENDING" ||
                registration.status === "PROCESSING")));
        if (
          !canClaimInitial &&
          !canClaimReconciliation &&
          !staleInitialRequest
        ) {
          return false;
        }
        await tx.shopBillingRegistration.update({
          where: { id: registration.id },
          data: {
            requestAttempts: { increment: 1 },
            ...(staleInitialRequest ? { status: "UNKNOWN" } : {}),
          },
        });
        return true;
      }, BILLING_TX_OPTIONS)
      .catch(() => false)) === true
  );
}

async function refreshKnownRegistration(input: {
  localRegistrationId: string;
  providerRegistrationId: string;
  userId: string;
}): Promise<BillingSettingsActionState & { status?: string }> {
  const result = await createLaonpayBillingClient().getRegistrationIntent(
    input.providerRegistrationId,
  );
  if (!result.ok || result.data.registrationId !== input.providerRegistrationId) {
    await prisma
      .$transaction(async (tx) => {
        await acquireTransactionLock(tx, `billing-user-lifecycle:${input.userId}`);
        await acquireTransactionLock(tx, `billing-registration:${input.localRegistrationId}`);
        const activeUser = await tx.shopUser.findFirst({
          where: { id: input.userId, deletedAt: null },
          select: { id: true },
        });
        if (!activeUser) return;
        await tx.shopBillingRegistration.updateMany({
          where: {
            id: input.localRegistrationId,
            userId: input.userId,
            status: { in: [...REGISTRATION_OPEN_STATUSES] },
          },
          data: { status: "UNKNOWN" },
        });
      }, BILLING_TX_OPTIONS)
      .catch(() => undefined);
    return { error: "카드 등록 상태를 확인하지 못했습니다. 새 요청을 만들지 말고 잠시 후 다시 확인해 주세요." };
  }

  const remote = result.data;
  const synchronized = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-user-lifecycle:${input.userId}`);
      await acquireTransactionLock(tx, `billing-registration:${input.localRegistrationId}`);
      const activeUser = await tx.shopUser.findFirst({
        where: { id: input.userId, deletedAt: null },
        select: { id: true },
      });
      if (!activeUser) return false;
      const local = await tx.shopBillingRegistration.findFirst({
        where: {
          id: input.localRegistrationId,
          userId: input.userId,
          laonpayRegistrationId: input.providerRegistrationId,
        },
      });
      if (!local) return false;
      if (
        (local.status === "SUCCEEDED" && local.paymentMethodId) ||
        local.status === "DECLINED" ||
        local.status === "EXPIRED"
      ) {
        return local.status;
      }
      if (remote.status !== "SUCCEEDED" || !remote.paymentMethod) {
        const status = mergeRegistrationStatus(local.status, remote.status);
        await tx.shopBillingRegistration.update({
          where: { id: local.id },
          data: { status, expiresAt: new Date(remote.expiresAt) },
        });
        return status;
      }
      const method = await upsertOwnedBillingPaymentMethod(
        tx,
        input.userId,
        remote.paymentMethod,
      );
      await tx.shopBillingRegistration.update({
        where: { id: local.id },
        data: {
          status: "SUCCEEDED",
          expiresAt: new Date(remote.expiresAt),
          paymentMethodId: method.id,
        },
      });
      return "SUCCEEDED";
    }, BILLING_TX_OPTIONS)
    .catch(() => null);
  if (!synchronized) return { error: "카드 등록 상태를 안전하게 반영하지 못했습니다." };
  revalidatePath("/mypage/settings");
  revalidatePath("/checkout");
  if (synchronized === "SUCCEEDED") return { ok: true, status: synchronized };
  if (synchronized === "DECLINED" || synchronized === "EXPIRED") {
    return {
      error: "카드 등록이 완료되지 않았습니다. 필요하면 새 등록을 시작해 주세요.",
      status: synchronized,
    };
  }
  return {
    error: "카드 등록을 확인 중입니다. 새 요청을 만들지 말고 잠시 후 다시 확인해 주세요.",
    status: synchronized,
  };
}

export async function startBillingRegistrationAction(
  _previous: BillingSettingsActionState,
): Promise<BillingSettingsActionState> {
  const user = await requireShopUser();
  const featureEnabled = isBillingIntegrationEnabled(user.email);
  if (!isBillingReconciliationEnabled(user.email)) {
    return {
      error:
        "간편결제 카드 등록 연동이 아직 준비되지 않았습니다. 일반 카드결제를 이용해 주세요.",
    };
  }

  const requestBody = { externalCustomerId: user.id, returnTargetCode: "settings" as const };
  const requestFingerprint = billingRequestFingerprint(requestBody);
  const prepared = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-user-lifecycle:${user.id}`);
      await acquireTransactionLock(tx, `billing-registration:${user.id}`);
      const activeUser = await tx.shopUser.findFirst({
        where: {
          id: user.id,
          email: user.email,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!activeUser) {
        return { ok: false as const, error: "회원 상태를 확인할 수 없어 카드 등록을 차단했습니다." };
      }
      const existing = await tx.shopBillingRegistration.findFirst({
        where: {
          userId: user.id,
          OR: [
            { status: { in: [...REGISTRATION_OPEN_STATUSES] } },
            { status: "SUCCEEDED", paymentMethodId: null },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          return { ok: false as const, error: "진행 중인 카드 등록 요청을 확인해 주세요." };
        }
        return { ok: true as const, registration: existing };
      }
      if (!featureEnabled) {
        return {
          ok: false as const,
          error:
            "신규 카드 등록은 점검 중입니다. 기존 요청이 있다면 상태 조회를 이용해 주세요.",
        };
      }
      const registration = await tx.shopBillingRegistration.create({
        data: {
          userId: user.id,
          idempotencyKey: randomUUID(),
          requestFingerprint,
          status: "REQUESTING",
        },
      });
      return { ok: true as const, registration };
    })
    .catch(() => null);
  if (!prepared) {
    return { error: "간편결제 원장을 사용할 수 없어 카드 등록을 안전하게 차단했습니다." };
  }
  if (!prepared.ok) return { error: prepared.error };
  if (
    !featureEnabled &&
    prepared.registration.requestAttempts === 0 &&
    !prepared.registration.laonpayRegistrationId
  ) {
    return {
      error:
        "신규 카드 등록 전송은 점검 중입니다. 기능 재개 전에는 외부 요청을 시작하지 않습니다.",
    };
  }
  if (prepared.registration.laonpayRegistrationId) {
    const refreshed = await refreshKnownRegistration({
      localRegistrationId: prepared.registration.id,
      providerRegistrationId: prepared.registration.laonpayRegistrationId,
      userId: user.id,
    });
    if (
      refreshed.status !== "PENDING" &&
      refreshed.status !== "PROCESSING"
    ) {
      return refreshed;
    }
    if (!(await claimRegistrationAttempt(prepared.registration.id))) {
      return refreshed;
    }

    // ID를 알고 있어도 최초 POST 응답에서 hostedUrl을 잃을 수 있다. LAONPAY 계약상
    // 같은 key+동일 body의 남은 reconciliation POST 1회는 새 등록/KSNET 호출을
    // 만들지 않고 기존 resource와 hostedUrl만 회수한다.
    const reconciled = await createLaonpayBillingClient().createRegistrationIntent(
      user.id,
      prepared.registration.idempotencyKey,
    );
    if (
      !reconciled.ok ||
      reconciled.data.registrationId !== prepared.registration.laonpayRegistrationId
    ) {
      await markRegistrationUnknown({
        localRegistrationId: prepared.registration.id,
        userId: user.id,
        rejected: !reconciled.ok && reconciled.outcome === "REJECTED",
      });
      return {
        error:
          "카드 등록 요청을 확인하지 못했습니다. 새 요청을 만들지 말고 고객센터에 문의해 주세요.",
      };
    }
    const persisted = await persistCreatedRegistration({
      localRegistrationId: prepared.registration.id,
      userId: user.id,
      registrationId: reconciled.data.registrationId,
      status: reconciled.data.status,
      expiresAt: reconciled.data.expiresAt,
    });
    if (!persisted.ok) {
      return { error: "카드 등록 상태를 안전하게 반영하지 못했습니다." };
    }
    await setRegistrationCookie(
      prepared.registration.id,
      reconciled.data.registrationId,
      reconciled.data.expiresAt,
    );
    if (persisted.status === "PENDING" || persisted.status === "PROCESSING") {
      redirect(reconciled.data.hostedUrl);
    }
    if (persisted.status === "SUCCEEDED") {
      redirect(
        `${BILLING_SETTINGS_RETURN_URL}?billingRegistrationId=${encodeURIComponent(reconciled.data.registrationId)}&billingStatus=succeeded`,
      );
    }
    return {
      error:
        persisted.status === "UNKNOWN"
          ? "카드 등록 상태를 확인하지 못했습니다. 새로 요청하지 말고 고객센터에 문의해 주세요."
          : "카드 등록을 시작할 수 없습니다. 잠시 후 다시 확인해 주세요.",
    };
  }

  if (!(await claimRegistrationAttempt(prepared.registration.id))) {
    return {
      error:
        prepared.registration.status === "REQUESTING"
          ? "카드 등록 요청을 전송하고 있습니다. 중복 등록하지 말고 잠시 후 상태를 확인해 주세요."
          : "카드 등록 요청의 확인 횟수를 모두 사용했습니다. 새 요청을 만들지 말고 고객센터에 문의해 주세요.",
    };
  }
  const client = createLaonpayBillingClient();
  let result = await client.createRegistrationIntent(user.id, prepared.registration.idempotencyKey);
  if (!result.ok && result.outcome === "UNKNOWN") {
    // 첫 응답이 끝났다는 사실을 UNKNOWN으로 원자 기록한 뒤에만 동일 key/body
    // reconciliation POST 1회를 허용한다. REQUESTING/attempts=1인 실제 in-flight
    // 요청은 다른 탭이 선점할 수 없다.
    await markRegistrationUnknown({
      localRegistrationId: prepared.registration.id,
      userId: user.id,
    });
    if (await claimRegistrationAttempt(prepared.registration.id)) {
      result = await client.createRegistrationIntent(
        user.id,
        prepared.registration.idempotencyKey,
      );
    }
  }
  if (!result.ok) {
    await markRegistrationUnknown({
      localRegistrationId: prepared.registration.id,
      userId: user.id,
      // 명시적 거절은 응답 유실이 아니므로 동일 POST 대사 대상이 아니다.
      rejected: result.outcome === "REJECTED",
    });
    return {
      error:
        "카드 등록 요청 결과를 확인하지 못했습니다. 새로 요청하지 말고 고객센터에 문의해 주세요.",
    };
  }

  const registration = result.data;
  const persisted = await persistCreatedRegistration({
    localRegistrationId: prepared.registration.id,
    userId: user.id,
    registrationId: registration.registrationId,
    status: registration.status,
    expiresAt: registration.expiresAt,
  });
  if (!persisted.ok) {
    return { error: "카드 등록 상태를 안전하게 반영하지 못했습니다." };
  }
  await setRegistrationCookie(
    prepared.registration.id,
    registration.registrationId,
    registration.expiresAt,
  );

  if (persisted.status === "PENDING" || persisted.status === "PROCESSING") {
    redirect(registration.hostedUrl);
  }
  if (persisted.status === "SUCCEEDED") {
    redirect(
      `${BILLING_SETTINGS_RETURN_URL}?billingRegistrationId=${encodeURIComponent(registration.registrationId)}&billingStatus=succeeded`,
    );
  }
  return {
    error:
      persisted.status === "UNKNOWN"
        ? "카드 등록 상태를 확인하지 못했습니다. 새로 요청하지 말고 고객센터에 문의해 주세요."
        : "카드 등록을 시작할 수 없습니다. 잠시 후 다시 확인해 주세요.",
  };
}

export async function refreshBillingPaymentMethodsAction(
  _previous: BillingSettingsActionState,
): Promise<BillingSettingsActionState> {
  const user = await requireShopUser();
  if (!isBillingReconciliationEnabled(user.email)) {
    return { error: "간편결제 연동이 준비되지 않았습니다." };
  }

  const result = await createLaonpayBillingClient().listPaymentMethods(user.id);
  if (!result.ok) {
    return { error: "등록 카드 상태를 확인하지 못했습니다. 기존 상태를 유지합니다." };
  }

  const synchronized = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-user-lifecycle:${user.id}`);
      await acquireTransactionLock(tx, `billing-methods:${user.id}`);
      const activeUser = await tx.shopUser.findFirst({
        where: { id: user.id, email: user.email, deletedAt: null },
        select: { id: true },
      });
      if (!activeUser) throw new Error("활성 회원을 찾을 수 없음");
      const providerIds = result.data.paymentMethods.map((method) => method.id);
      const existingMethods = await tx.shopBillingPaymentMethod.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          userId: true,
          laonpayPaymentMethodId: true,
          status: true,
          deregisterIdempotencyKey: true,
        },
        orderBy: { id: "asc" },
      });
      for (const local of existingMethods) {
        await acquireTransactionLock(tx, `billing-method:${local.id}`);
      }
      const lockedExistingMethods = await tx.shopBillingPaymentMethod.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          userId: true,
          laonpayPaymentMethodId: true,
          status: true,
          deregisterIdempotencyKey: true,
        },
      });
      const existingByProviderId = new Map(
        lockedExistingMethods.map((method) => [method.laonpayPaymentMethodId, method]),
      );
      for (const method of result.data.paymentMethods) {
        const existing = existingByProviderId.get(method.id);
        if (existing && existing.userId !== user.id) {
          throw new Error("결제수단 소유권 불일치");
        }
        await upsertOwnedBillingPaymentMethod(tx, user.id, method);
      }
      await tx.shopBillingPaymentMethod.updateMany({
        where: {
          userId: user.id,
          status: { in: ["ACTIVE", "DEREGISTERING", "UNKNOWN"] },
          ...(providerIds.length ? { laonpayPaymentMethodId: { notIn: providerIds } } : {}),
        },
        data: { status: "UNKNOWN" },
      });
    })
    .then(() => true)
    .catch(() => false);
  if (!synchronized) {
    return { error: "등록 카드 상태를 안전하게 반영하지 못했습니다. 기존 상태를 유지합니다." };
  }
  revalidatePath("/mypage/settings");
  revalidatePath("/checkout");
  return {
    ok: true,
    message: "등록 카드 상태를 최신 정보로 확인했습니다.",
  };
}

export async function deregisterBillingPaymentMethodAction(
  localPaymentMethodId: string,
): Promise<BillingSettingsActionState> {
  const user = await requireShopUser();
  if (!isBillingIntegrationEnabled(user.email)) {
    return { error: "간편결제 연동이 준비되지 않았습니다." };
  }

  const prepared = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-method:${localPaymentMethodId}`);
      const method = await tx.shopBillingPaymentMethod.findFirst({
        where: { id: localPaymentMethodId, userId: user.id },
      });
      if (!method) return { ok: false as const, error: "등록 카드를 찾을 수 없습니다." };
      if (method.status === "DEREGISTERED") return { ok: true as const, done: true as const, method };
      const resumableUnsent =
        method.status === "DEREGISTERING" &&
        method.deregisterRequestAttempts === 0 &&
        method.deregisterIdempotencyKey !== null;
      if (method.status !== "ACTIVE" && !resumableUnsent) {
        return {
          ok: false as const,
          error: "카드 해지 또는 상태 확인을 이미 처리 중입니다. 상태 조회 후 다시 확인해 주세요.",
        };
      }
      const unsettledCharge = await tx.shopBillingCharge.findFirst({
        where: {
          paymentMethodId: method.id,
          userId: user.id,
          OR: [
            { status: { in: ["REQUESTING", "PENDING", "UNKNOWN", "CANCEL_REQUESTED"] } },
            {
              cancelRequest: {
                is: {
                  status: { in: ["REQUESTING", "REQUESTED", "PROCESSING", "UNKNOWN"] },
                },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (unsettledCharge) {
        return {
          ok: false as const,
          error: "결제 또는 취소 상태를 확인 중인 주문이 있어 카드를 해지할 수 없습니다.",
        };
      }
      const idempotencyKey =
        method.deregisterIdempotencyKey ?? randomUUID();
      const claimed = await tx.shopBillingPaymentMethod.update({
        where: { id: method.id },
        data: {
          status: "DEREGISTERING",
          deregisterIdempotencyKey: idempotencyKey,
          deregisterRequestAttempts: { increment: 1 },
        },
      });
      return { ok: true as const, done: false as const, method: claimed };
    })
    .catch(() => null);
  if (!prepared) return { error: "간편결제 원장을 확인하지 못해 카드 해지를 안전하게 차단했습니다." };
  if (!prepared.ok) return { error: prepared.error };
  if (prepared.done) {
    return { ok: true, message: "이미 해지된 카드입니다." };
  }

  // 해지는 등록/결제 생성과 달리 동일 POST reconciliation 계약이 없다.
  // timeout·5xx도 자동 재호출하지 않고 목록 상태 조회로만 확정한다.
  const result = await createLaonpayBillingClient().deregisterPaymentMethod(
    prepared.method.laonpayPaymentMethodId,
    user.id,
    prepared.method.deregisterIdempotencyKey!,
  );
  if (!result.ok) {
    await prisma
      .$transaction(async (tx) => {
        await acquireTransactionLock(tx, `billing-method:${prepared.method.id}`);
        const current = await tx.shopBillingPaymentMethod.findFirst({
          where: { id: prepared.method.id, userId: user.id },
        });
        if (current && current.status !== "DEREGISTERED") {
          await tx.shopBillingPaymentMethod.update({
            where: { id: current.id },
            data: { status: "UNKNOWN" },
          });
        }
      }, BILLING_TX_OPTIONS)
      .catch(() => undefined);
    return { error: "카드 해지 결과를 확인하지 못했습니다. 재요청하지 말고 상태 조회를 이용해 주세요." };
  }

  const responseBound =
    result.data.paymentMethod.id === prepared.method.laonpayPaymentMethodId;
  const finalized = await prisma
    .$transaction(async (tx) => {
      await acquireTransactionLock(tx, `billing-method:${prepared.method.id}`);
      const current = await tx.shopBillingPaymentMethod.findFirst({
        where: { id: prepared.method.id, userId: user.id },
      });
      if (
        !current ||
        current.laonpayPaymentMethodId !== prepared.method.laonpayPaymentMethodId
      ) {
        return false;
      }
      if (current.status === "DEREGISTERED") return true;
      if (!responseBound || result.data.paymentMethod.status !== "DEREGISTERED") {
        await tx.shopBillingPaymentMethod.update({
          where: { id: current.id },
          data: { status: "UNKNOWN" },
        });
        return false;
      }
      await tx.shopBillingPaymentMethod.update({
        where: { id: current.id },
        data: {
          status: mapPaymentMethodStatus(result.data.paymentMethod.status),
          providerDeregisteredAt: result.data.paymentMethod.deregisteredAt
            ? new Date(result.data.paymentMethod.deregisteredAt)
            : null,
        },
      });
      return true;
    }, BILLING_TX_OPTIONS)
    .catch(() => false);
  if (!finalized) {
    return {
      error:
        "카드 해지 결과의 결제수단 또는 상태를 확인하지 못했습니다. 재요청하지 말고 상태 조회를 이용해 주세요.",
    };
  }
  revalidatePath("/mypage/settings");
  revalidatePath("/checkout");
  return { ok: true, message: "카드 해지를 완료했습니다." };
}
