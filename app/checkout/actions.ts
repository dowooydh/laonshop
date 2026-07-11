"use server";
// 주문 생성 + KSPAY 인증결제창 호출. 가격은 서버에서 상품 재조회로 신뢰(위변조 차단).
import { prisma } from "@/lib/db";
import { getPgProvider } from "@/lib/kspay";
import { isKspayRestLiveEnabled, payOldCert } from "@/lib/kspay/webfep";
import { sanitizePgParam } from "@/lib/format";
import { z } from "zod";
import { requireShopUser } from "@/lib/auth";
import { BILLING_TEST_EMAILS } from "@/lib/billing";
import {
  acquireTransactionLock,
  createIdempotentMoid,
  lockAndValidateInventory,
  PAYMENT_PROCESSING_MARKER,
} from "@/lib/order-guard";

const schema = z.object({
  // KSPAY 결제창 수단 — 가상계좌는 KSNET 미지원으로 제외.
  // oneclick = 등록 카드(빌링) 결제창 없는 승인 / manual = 수기결제(구인증) 카드정보 직접 입력.
  method: z.enum(["card", "kakaopay", "naverpay", "bank", "oneclick", "manual"]).default("card"),
  items: z
    .array(
      z.object({
        productId: z.string(),
        qty: z.number().int().positive().max(99, "수량은 1회 최대 99개까지 주문할 수 있습니다."),
        size: z.string().optional(),
      }),
    )
    .min(1, "장바구니가 비어 있습니다.")
    .max(50, "한 번에 주문할 수 있는 상품 종류를 초과했습니다."),
  idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/, "주문 요청 식별값이 올바르지 않습니다."),
  receiverName: z.string().trim().min(1, "받는 분 이름을 입력해 주세요.").max(30),
  receiverPhone: z.string().trim().min(1, "연락처를 입력해 주세요.").max(20),
  zipcode: z.union([z.string().trim().max(10), z.literal("")]).optional(),
  address: z.string().trim().min(1, "배송지를 입력해 주세요.").max(200),
  addressDetail: z.union([z.string().trim().max(100), z.literal("")]).optional(),
  // oneclick 전용 — 결제에 사용할 등록 카드 (미지정 시 첫 카드)
  billingCardId: z.string().optional(),
  // manual(구인증) 전용 — 카드정보는 승인 요청 후 즉시 폐기, 저장·로그 금지 (절대 규칙 2)
  manualCard: z
    .object({
      cardNo: z.string().regex(/^\d{15,16}$/, "카드번호 15~16자리를 입력해 주세요."),
      expMm: z.string().regex(/^(0[1-9]|1[0-2])$/, "유효기간 월(MM)을 확인해 주세요."),
      expYy: z.string().regex(/^\d{2}$/, "유효기간 연도(YY)를 확인해 주세요."),
      pw2: z.string().regex(/^\d{2}$/, "비밀번호 앞 2자리를 입력해 주세요."),
      birth6: z.string().regex(/^\d{6}(\d{4})?$/, "생년월일 6자리(법인카드는 사업자번호 10자리)를 입력해 주세요."),
    })
    .optional(),
});

export type CheckoutInput = z.input<typeof schema>;
export type CheckoutResult =
  | { ok: true; formAction: string; formFields: Record<string, string> }
  | { ok: true; redirect: string }
  | { ok: false; error: string };

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

export async function createOrderAction(input: CheckoutInput): Promise<CheckoutResult> {
  const user = await requireShopUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };
  const d = parsed.data;

  // 우편번호·상세주소는 주문 스냅샷 문자열로 합성 보관 (ShopOrder.address 단일 컬럼 유지)
  const fullAddress = [d.zipcode ? `[${d.zipcode}]` : "", d.address, d.addressDetail || ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  let billingCard: { id: string; maskedCardNumb: string } | null = null;
  if (d.method === "oneclick") {
    billingCard = d.billingCardId
      ? await prisma.shopBillingCard.findFirst({
          where: { id: d.billingCardId, userId: user.id },
          select: { id: true, maskedCardNumb: true },
        })
      : await prisma.shopBillingCard.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
          select: { id: true, maskedCardNumb: true },
        });
    if (!billingCard) return { ok: false, error: "등록된 카드가 없습니다. 설정에서 카드를 먼저 등록해 주세요." };
    if (!BILLING_TEST_EMAILS.includes(user.email)) {
      return { ok: false, error: "원클릭 결제는 서비스 준비 중입니다. 카드·간편결제를 이용해 주세요." };
    }
  }

  if (d.method === "manual") {
    if (!d.manualCard) return { ok: false, error: "카드 정보를 입력해 주세요." };
    if (!isKspayRestLiveEnabled() && !BILLING_TEST_EMAILS.includes(user.email)) {
      return { ok: false, error: "수기결제는 서비스 준비 중입니다. 카드·간편결제를 이용해 주세요." };
    }
  }

  // 동일 사용자·동일 체크아웃 요청은 같은 moid를 사용한다. DB advisory lock으로 다중 탭과
  // 네트워크 재전송을 직렬화하고, 상품 행 잠금 안에서 재고 확인과 주문 생성을 원자화한다.
  const prepared = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `checkout:${user.id}:${d.idempotencyKey}`);
    const moid = createIdempotentMoid(user.id, d.idempotencyKey);
    const existing = await tx.shopOrder.findUnique({ where: { moid }, include: { items: true } });

    if (existing) {
      if (existing.userId !== user.id) return { ok: false as const, error: "주문 요청을 처리할 수 없습니다." };
      if (existing.status === "PAID") return { ok: true as const, order: existing };
      if (existing.status === "CANCELED" || existing.status === "CANCEL_REQUESTED") {
        return { ok: false as const, error: "이미 처리된 주문입니다. 주문내역을 확인해 주세요." };
      }
      if (existing.approvalNo === PAYMENT_PROCESSING_MARKER) {
        return { ok: false as const, error: "결제 결과를 확인 중입니다. 잠시 후 주문내역을 확인해 주세요." };
      }
      const inventory = await lockAndValidateInventory(tx, existing.items, existing.id);
      if (!inventory.ok) return inventory;
      const order = await tx.shopOrder.update({
        where: { id: existing.id },
        data: { status: "PENDING" },
        include: { items: true },
      });
      return { ok: true as const, order };
    }

    const inventory = await lockAndValidateInventory(tx, d.items);
    if (!inventory.ok) return inventory;
    const order = await tx.shopOrder.create({
      data: {
        userId: user.id,
        status: "PENDING",
        totalAmount: inventory.total,
        moid,
        receiverName: d.receiverName,
        receiverPhone: d.receiverPhone,
        address: fullAddress,
        items: { create: inventory.items },
      },
      include: { items: true },
    });
    return { ok: true as const, order };
  }, TX_OPTIONS).catch(() => null);

  if (!prepared) return { ok: false, error: "주문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const order = prepared.order;
  if (order.status === "PAID") return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  const goodsName =
    order.items.length > 1 ? `${order.items[0].name} 외 ${order.items.length - 1}건` : order.items[0].name;

  // ── 원클릭(빌링) — 결제창 없이 등록 카드로 승인 ──────────────────────
  if (d.method === "oneclick") {
    // NEEDS_PG_SPEC: 실제 빌링 승인 호출 위치 — 계약 후 billingToken으로 KSNET /billing/pay 요청.
    const approved = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `order:${order.id}`);
      const current = await tx.shopOrder.findUnique({ where: { id: order.id }, include: { items: true } });
      if (!current || current.userId !== user.id) return { ok: false as const, error: "주문을 찾을 수 없습니다." };
      if (current.status === "PAID") return { ok: true as const };
      if (current.status !== "PENDING") return { ok: false as const, error: "이미 처리된 주문입니다." };
      const inventory = await lockAndValidateInventory(tx, current.items, current.id);
      if (!inventory.ok) {
        await tx.shopOrder.update({ where: { id: current.id }, data: { status: "FAILED" } });
        return inventory;
      }
      await tx.shopOrder.update({
        where: { id: current.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          approvalNo: `MB${Date.now().toString().slice(-8)}`,
          cardName: `등록카드 ${billingCard!.maskedCardNumb}`,
        },
      });
      return { ok: true as const };
    }, TX_OPTIONS).catch(() => null);
    if (!approved) return { ok: false, error: "결제 상태를 확인하지 못했습니다. 주문내역을 확인해 주세요." };
    if (!approved.ok) return { ok: false, error: approved.error };
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  // ── 수기결제(구인증) — KSNET WEBFEP /card/pay/oldcert. 카드정보는 즉시 폐기 ──
  if (d.method === "manual") {
    const mc = d.manualCard!;
    const masked = `${mc.cardNo.slice(0, 4)}-${mc.cardNo.slice(4, 6)}**-****-${mc.cardNo.slice(-4)}`;
    const manual = await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, `order:${order.id}`);
      const current = await tx.shopOrder.findUnique({ where: { id: order.id }, include: { items: true } });
      if (!current || current.userId !== user.id) return { ok: false as const, error: "주문을 찾을 수 없습니다." };
      if (current.status === "PAID") return { ok: true as const };
      if (current.status !== "PENDING") return { ok: false as const, error: "이미 처리된 주문입니다." };
      const inventory = await lockAndValidateInventory(tx, current.items, current.id);
      if (!inventory.ok) {
        await tx.shopOrder.update({ where: { id: current.id }, data: { status: "FAILED" } });
        return inventory;
      }
      const result = await payOldCert({
        orderNumb: current.moid,
        userName: user.name,
        userEmail: user.email,
        productName: sanitizePgParam(goodsName),
        totalAmount: current.totalAmount,
        cardNumb: mc.cardNo,
        expiryDate: `${mc.expYy}${mc.expMm}`,
        password2: mc.pw2,
        userInfo: mc.birth6,
        payload: current.id,
      });
      if (result === null) {
        await tx.shopOrder.update({
          where: { id: current.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            approvalNo: `MB${Date.now().toString().slice(-8)}`,
            cardName: `수기결제 ${masked}`,
          },
        });
        return { ok: true as const };
      }
      if (!result.ok) {
        if (!result.indeterminate) {
          await tx.shopOrder.update({ where: { id: current.id }, data: { status: "FAILED" } });
        }
        return { ok: false as const, error: result.message };
      }
      await tx.shopOrder.update({
        where: { id: current.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          approvalNo: result.approvalNumb,
          pgTrno: result.tid,
          cardName: `${result.cardName} (수기)`,
        },
      });
      return { ok: true as const };
    }, TX_OPTIONS).catch(() => null);
    if (!manual) return { ok: false, error: "결제 상태를 확인하지 못했습니다. 주문내역을 확인해 주세요." };
    if (!manual.ok) return { ok: false, error: manual.error };
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  const base = process.env.SHOP_APP_URL ?? "http://localhost:3003";

  const res = await getPgProvider().createAuthOrder({
    paymentId: order.id, // 패스스루 a = orderId
    payMethod: d.method as "card" | "kakaopay" | "naverpay" | "bank", // oneclick은 위에서 조기 반환

    moid: order.moid,
    amount: order.totalAmount,
    goodsName: sanitizePgParam(goodsName),
    ordername: sanitizePgParam(user.name),
    buyerPhone: d.receiverPhone.replace(/\D/g, ""),
    buyerEmail: user.email,
    storeId: "2999199999", // 테스트 MID (실제 sndStoreid는 KSPAY_STORE_ID env 사용)
    returnUrl: `${base}/order/${order.id}`,
    callbackUrl: `${base}/api/pg/kspay/callback`,
  });

  if (res.formAction && res.formFields) {
    return { ok: true, formAction: res.formAction, formFields: res.formFields };
  }
  // mock 모드 등 — shop은 kspay 전제
  return { ok: false, error: "결제창을 열 수 없습니다. (PG 설정 확인)" };
}
