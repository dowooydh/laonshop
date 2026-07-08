"use server";
// 주문 생성 + KSPAY 인증결제창 호출. 가격은 서버에서 상품 재조회로 신뢰(위변조 차단).
import { prisma } from "@/lib/db";
import { getPgProvider } from "@/lib/kspay";
import { payOldCert } from "@/lib/kspay/webfep";
import { generateMoid, sanitizePgParam } from "@/lib/format";
import { z } from "zod";
import { requireShopUser } from "@/lib/auth";
import { BILLING_TEST_EMAILS, approveBillingMock, approvePaymentMock } from "@/lib/billing";

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
    .min(1, "장바구니가 비어 있습니다."),
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

export async function createOrderAction(input: CheckoutInput): Promise<CheckoutResult> {
  const user = await requireShopUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "입력값을 확인해 주세요." };
  const d = parsed.data;

  const products = await prisma.product.findMany({
    where: { id: { in: d.items.map((i) => i.productId) }, active: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));

  // throw 금지 — 서버액션 reject 시 클라이언트 pending이 안 풀린다. 항상 {ok:false}로 반환.
  const gone = d.items.filter((it) => !pmap.get(it.productId));
  if (gone.length > 0) {
    return { ok: false, error: "판매가 종료된 상품이 장바구니에 있습니다. 장바구니를 정리한 뒤 다시 시도해 주세요." };
  }
  const soldOut = d.items.filter((it) => pmap.get(it.productId)!.stock < it.qty);
  if (soldOut.length > 0) {
    const name = pmap.get(soldOut[0].productId)!.name;
    return { ok: false, error: `품절된 상품이 있습니다: ${name}` };
  }

  let total = 0;
  const itemsData = d.items.map((it) => {
    const p = pmap.get(it.productId)!;
    total += p.price * it.qty;
    return { productId: p.id, name: p.name, price: p.price, qty: it.qty, size: it.size || null };
  });

  // 우편번호·상세주소는 주문 스냅샷 문자열로 합성 보관 (ShopOrder.address 단일 컬럼 유지)
  const fullAddress = [d.zipcode ? `[${d.zipcode}]` : "", d.address, d.addressDetail || ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  // ── 원클릭(빌링) — 결제창 없이 등록 카드로 승인 ──────────────────────
  if (d.method === "oneclick") {
    // 카드 선택: billingCardId 지정 시 본인 소유 검증(IDOR 차단), 미지정 시 첫 등록 카드
    const card = d.billingCardId
      ? await prisma.shopBillingCard.findFirst({ where: { id: d.billingCardId, userId: user.id } })
      : await prisma.shopBillingCard.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (!card) return { ok: false, error: "등록된 카드가 없습니다. 설정에서 카드를 먼저 등록해 주세요." };
    if (!BILLING_TEST_EMAILS.includes(user.email)) {
      return { ok: false, error: "원클릭 결제는 서비스 준비 중입니다. 카드·간편결제를 이용해 주세요." };
    }

    const moid = generateMoid();
    const order = await prisma.shopOrder.create({
      data: {
        userId: user.id,
        status: "PENDING",
        totalAmount: total,
        moid,
        receiverName: d.receiverName,
        receiverPhone: d.receiverPhone,
        address: fullAddress,
        items: { create: itemsData },
      },
    });

    // NEEDS_PG_SPEC: 실제 빌링 승인 호출 위치 — 계약 후 billingToken으로 KSNET /billing/pay 요청.
    await approveBillingMock(order.id, card.maskedCardNumb);
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  // ── 수기결제(구인증) — KSNET WEBFEP /card/pay/oldcert. 카드정보는 즉시 폐기 ──
  if (d.method === "manual") {
    if (!d.manualCard) return { ok: false, error: "카드 정보를 입력해 주세요." };
    // 계약 전(KSPAY_API_KEY 미설정) 실승인 불가 — 테스트 계정 외에는 준비 중 안내
    if (!process.env.KSPAY_API_KEY && !BILLING_TEST_EMAILS.includes(user.email)) {
      return { ok: false, error: "수기결제는 서비스 준비 중입니다. 카드·간편결제를 이용해 주세요." };
    }

    const goodsName =
      itemsData.length > 1 ? `${itemsData[0].name} 외 ${itemsData.length - 1}건` : itemsData[0].name;
    const moid = generateMoid();
    const order = await prisma.shopOrder.create({
      data: {
        userId: user.id,
        status: "PENDING",
        totalAmount: total,
        moid,
        receiverName: d.receiverName,
        receiverPhone: d.receiverPhone,
        address: fullAddress,
        items: { create: itemsData },
      },
    });

    const mc = d.manualCard;
    const masked = `${mc.cardNo.slice(0, 4)}-${mc.cardNo.slice(4, 6)}**-****-${mc.cardNo.slice(-4)}`;
    const result = await payOldCert({
      orderNumb: moid,
      userName: user.name,
      userEmail: user.email,
      productName: sanitizePgParam(goodsName),
      totalAmount: total,
      cardNumb: mc.cardNo,
      expiryDate: `${mc.expYy}${mc.expMm}`, // yyMM
      password2: mc.pw2,
      userInfo: mc.birth6,
      payload: order.id,
    });

    if (result === null) {
      // KSPAY_API_KEY 미설정(사업부 계약 전) — 테스트 계정 한정 mock 승인 (위 가드 통과분)
      await approvePaymentMock(order.id, `수기결제 ${masked}`);
      return { ok: true, redirect: `/order/${order.id}?receipt=1` };
    }
    if (!result.ok) {
      await prisma.shopOrder.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED" } });
      return { ok: false, error: `카드 승인이 거절되었습니다: ${result.message}` };
    }
    await prisma.shopOrder.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        approvalNo: result.approvalNumb,
        pgTrno: result.tid,
        cardName: `${result.cardName} (수기)`,
      },
    });
    return { ok: true, redirect: `/order/${order.id}?receipt=1` };
  }

  const moid = generateMoid();
  const order = await prisma.shopOrder.create({
    data: {
      userId: user.id,
      status: "PENDING",
      totalAmount: total,
      moid,
      receiverName: d.receiverName,
      receiverPhone: d.receiverPhone,
      address: fullAddress,
      items: { create: itemsData },
    },
  });

  const base = process.env.SHOP_APP_URL ?? "http://localhost:3003";
  const goodsName =
    itemsData.length > 1 ? `${itemsData[0].name} 외 ${itemsData.length - 1}건` : itemsData[0].name;

  const res = await getPgProvider().createAuthOrder({
    paymentId: order.id, // 패스스루 a = orderId
    payMethod: d.method as "card" | "kakaopay" | "naverpay" | "bank", // oneclick은 위에서 조기 반환

    moid,
    amount: total,
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
