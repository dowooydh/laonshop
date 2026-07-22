"use client";
import { formatKrw } from "@/lib/format";
import { Button, Checkbox, EmptyState, FieldError, Input, Label, Spinner, buttonVariants, cn } from "@/lib/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AddressInput } from "@/components/address-input";
import { KspayCheckout } from "@/components/kspay-checkout";
import { CART_STORAGE_KEY, cartTotal, getCart, type CartItem } from "@/lib/cart";
import { createCheckoutIdempotencyKey, getCheckoutNonce } from "@/lib/checkout-idempotency";
import { useRouter } from "next/navigation";
import {
  getManualPaymentIssuerLabel,
  isManualPaymentDemoInput,
  isManualPaymentFormComplete,
  type ManualPaymentCardInput,
  type ManualPaymentMode,
} from "@/lib/manual-payment-demo";
import {
  createOrderAction,
  findCheckoutOrderAction,
} from "./actions";
import { ManualPaymentDialog } from "./manual-payment-dialog";

export type CheckoutInitial = {
  receiverName: string;
  receiverPhone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
};
export type CheckoutBillingPaymentMethod = {
  id: string;
  cardName: string;
  cardLast4: string;
  cardType: string;
};

function cartDisplayFingerprint(items: CartItem[]): string {
  return JSON.stringify(
    items
      .map((item) => ({
        productId: item.productId,
        size: item.size ?? "",
        qty: item.qty,
        name: item.name,
        price: item.price,
      }))
      .sort((left, right) =>
        `${left.productId}\u0000${left.size}`.localeCompare(
          `${right.productId}\u0000${right.size}`,
        ),
      ),
  );
}

export function CheckoutForm({
  initial,
  manualPaymentMode,
  billingPaymentMethods,
}: {
  initial: CheckoutInitial;
  manualPaymentMode: ManualPaymentMode;
  billingPaymentMethods: CheckoutBillingPaymentMethod[];
}) {
  const router = useRouter();
  // 결제수단 구성 — KSNET 김민규 팀장 가이드(2026-07): 카드/카카오/네이버/실시간계좌이체/수기(구인증).
  // 가상계좌는 KSNET 미지원+심사 거절 사유로 제외.
  const METHODS = [
    { id: "card", label: "카드결제", desc: "신용카드 (인증결제)", enabled: true },
    { id: "kakaopay", label: "카카오페이", desc: "카카오페이 간편결제", enabled: true },
    { id: "naverpay", label: "네이버페이", desc: "네이버페이 간편결제", enabled: true },
    { id: "bank", label: "실시간 계좌이체", desc: "은행 계좌 즉시 이체", enabled: true },
    ...(billingPaymentMethods.length > 0
      ? [{ id: "oneclick", label: "등록카드 결제", desc: "LAONPAY 간편결제", enabled: true }]
      : []),
  ];
  const manualMethod =
    manualPaymentMode === "review-demo" ? "manual_demo" : "manual";
  const manualPaymentAvailable = manualPaymentMode !== "disabled";
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(initial);
  const [method, setMethod] = useState("card");
  const [billingCardId, setBillingCardId] = useState(billingPaymentMethods[0]?.id ?? "");
  const [manualCard, setManualCard] = useState<ManualPaymentCardInput>({
    issuerCode: "",
    cardNo: "",
    expMm: "",
    expYy: "",
    pw2: "",
    birth6: "",
  });
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [pay, setPay] = useState<{ formAction: string; formFields: Record<string, string> } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [oneclickUncertain, setOneclickUncertain] = useState(false);
  const [agree, setAgree] = useState(false);
  const submitLockedRef = useRef(false);
  const displayedItemsRef = useRef<CartItem[]>([]);
  const manualTriggerRef = useRef<HTMLButtonElement>(null);
  const manualReturnFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const initialItems = getCart();
    displayedItemsRef.current = initialItems;
    setItems(initialItems);
    setReady(true);
  }, []);

  useEffect(() => {
    const selectedExists = billingPaymentMethods.some(
      (card) => card.id === billingCardId,
    );
    if (!selectedExists) {
      setBillingCardId(billingPaymentMethods[0]?.id ?? "");
    }
    if (billingPaymentMethods.length === 0 && method === "oneclick") {
      setMethod("card");
      setError(
        "등록 카드 상태가 변경되어 일반 카드결제로 전환했습니다.",
      );
    }
  }, [billingCardId, billingPaymentMethods, method]);

  useEffect(() => {
    const synchronizeCart = () => {
      if (submitLockedRef.current) return;
      const nextItems = getCart();
      if (
        cartDisplayFingerprint(nextItems) ===
        cartDisplayFingerprint(displayedItemsRef.current)
      ) {
        return;
      }
      displayedItemsRef.current = nextItems;
      setItems(nextItems);
      setAgree(false);
      setError(
        "다른 화면에서 장바구니가 변경되었습니다. 주문 상품과 결제금액을 다시 확인하고 동의해 주세요.",
      );
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        synchronizeCart();
        router.refresh();
      }
    };
    const refreshOnHistoryRestore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        synchronizeCart();
        router.refresh();
      }
    };
    const refreshOnStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY || event.key === null) synchronizeCart();
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    window.addEventListener("pageshow", refreshOnHistoryRestore);
    window.addEventListener("storage", refreshOnStorage);
    window.addEventListener("laonshop-cart-change", synchronizeCart);
    return () => {
      document.removeEventListener("visibilitychange", refreshOnVisible);
      window.removeEventListener("pageshow", refreshOnHistoryRestore);
      window.removeEventListener("storage", refreshOnStorage);
      window.removeEventListener("laonshop-cart-change", synchronizeCart);
    };
  }, [router]);

  const total = cartTotal(items);
  const interactionLocked = pending || oneclickUncertain;
  const manualSelectionComplete =
    manualPaymentMode === "review-demo"
      ? isManualPaymentDemoInput(manualCard)
      : isManualPaymentFormComplete(manualCard);
  const isManualSelected = method === manualMethod;

  const submit = async () => {
    if (submitLockedRef.current) return;
    submitLockedRef.current = true;
    setError("");
    if (!form.receiverName || !form.receiverPhone || !form.address) {
      setError("배송 정보를 모두 입력해 주세요.");
      submitLockedRef.current = false;
      return;
    }
    if (!agree) {
      setError("주문 내용 확인 및 구매조건에 동의해 주세요.");
      submitLockedRef.current = false;
      return;
    }
    if (isManualSelected && !manualSelectionComplete) {
      setError("수기결제 카드 정보를 모두 입력해 주세요.");
      manualReturnFocusRef.current = manualTriggerRef.current;
      setManualDialogOpen(true);
      submitLockedRef.current = false;
      return;
    }
    if (method === "oneclick" && !billingCardId) {
      setError("등록 카드를 선택해 주세요.");
      submitLockedRef.current = false;
      return;
    }
    setPending(true);
    let keepLocked = false;
    let checkoutIdempotencyKey: string | null = null;
    try {
      // 다른 탭에서 장바구니가 바뀌었을 수 있으므로 제출 직전에 다시 읽는다.
      const currentItems = getCart();
      if (currentItems.length === 0) {
        setItems([]);
        setError("장바구니가 비어 있습니다.");
        submitLockedRef.current = false;
        return;
      }
      if (
        cartDisplayFingerprint(currentItems) !==
        cartDisplayFingerprint(displayedItemsRef.current)
      ) {
        displayedItemsRef.current = currentItems;
        setItems(currentItems);
        setAgree(false);
        setError(
          "장바구니가 변경되어 결제를 시작하지 않았습니다. 주문 상품과 결제금액을 다시 확인하고 동의해 주세요.",
        );
        submitLockedRef.current = false;
        return;
      }
      const orderInput = {
        method: method as "card" | "kakaopay" | "naverpay" | "bank" | "oneclick" | "manual" | "manual_demo",
        items: currentItems.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size })),
        ...form,
        ...(method === "oneclick" ? { billingCardId } : {}),
        ...(method === "manual"
          ? { manualCard: { ...manualCard, cardNo: manualCard.cardNo.replace(/[\s-]/g, "") } }
          : {}),
        ...(method === "manual_demo"
          ? { demoIssuer: manualCard.issuerCode }
          : {}),
      };
      const idempotencyKey = await createCheckoutIdempotencyKey(orderInput, getCheckoutNonce());
      checkoutIdempotencyKey = idempotencyKey;
      const res = await createOrderAction({ ...orderInput, idempotencyKey });
      if (!res.ok) {
        if (res.recoveryOrderId) {
          window.location.href = `/order/${encodeURIComponent(res.recoveryOrderId)}`;
          return;
        }
        setError(res.error);
      } else if ("redirect" in res) {
        // 결제창 없는 수기결제 승인 완료 후 주문 확인으로 이동
        window.location.href = res.redirect;
        return;
      } else {
        setPay({ formAction: res.formAction, formFields: res.formFields });
      }
    } catch {
      if (method === "oneclick" && checkoutIdempotencyKey) {
        keepLocked = true;
        setOneclickUncertain(true);
        setError(
          "등록카드 결제 응답을 확인하지 못했습니다. 중복 결제를 막기 위해 다시 결제하지 말고 주문 상태를 확인해 주세요.",
        );
        try {
          const recovered = await findCheckoutOrderAction({
            idempotencyKey: checkoutIdempotencyKey,
          });
          if (recovered.ok) {
            window.location.href = `/order/${encodeURIComponent(recovered.orderId)}`;
            return;
          }
        } catch {
          // 네트워크가 복구되지 않은 경우에도 재승인하지 않고 주문내역 확인만 안내한다.
        }
      } else {
        setError(
          "주문 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      setPending(false);
      if (!keepLocked) submitLockedRef.current = false;
    }
  };

  if (pay) return <KspayCheckout formAction={pay.formAction} formFields={pay.formFields} />;
  if (!ready)
    return (
      <div
        className="flex justify-center py-24"
        role="status"
        aria-live="polite"
      >
        <Spinner />
        <span className="sr-only">주문 정보를 불러오는 중입니다.</span>
      </div>
    );
  if (items.length === 0)
    return (
      <EmptyState
        title="장바구니가 비어 있습니다"
        description="마음에 드는 상품을 담아보세요"
        action={
          <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
            쇼핑하러 가기
          </Link>
        }
      />
    );

  return (
    <div className="mx-auto min-w-0 max-w-lg space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">Checkout</p>
        <h1 className="font-display text-step-2 font-bold tracking-tight text-fg">주문/결제</h1>
      </header>

      {/* 01 주문 상품 */}
      <section className="rounded-[var(--radius-lg)] border border-line bg-raised p-[20px]">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-mono text-step--1 text-fg-subtle">01</span>
          <span className="text-step-0 font-semibold text-fg">주문 상품</span>
        </div>
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li
              key={`${c.productId}-${c.size}`}
              className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5 text-step--1"
            >
              <span className="min-w-[min(100%,8rem)] flex-1 text-fg-muted [overflow-wrap:anywhere]">
                {c.name}
                {c.size ? ` (${c.size})` : ""} × {c.qty}
              </span>
              <span className="min-w-0 max-w-full text-right font-mono font-medium text-fg [overflow-wrap:anywhere]">
                {formatKrw(c.price * c.qty)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 02 배송 정보 — 최근 주문/회원정보로 프리필됨 */}
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-[20px]">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-step--1 text-fg-subtle">02</span>
            <span className="text-step-0 font-semibold text-fg">배송 정보</span>
          </div>
          {initial.address && (
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">저장된 배송지</span>
          )}
        </div>
        <div>
          <Label htmlFor="rn">받는 분</Label>
          <Input id="rn" value={form.receiverName} disabled={interactionLocked} onChange={(e) => setForm({ ...form, receiverName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="rp">연락처</Label>
          <Input id="rp" inputMode="numeric" placeholder="010-0000-0000" value={form.receiverPhone} disabled={interactionLocked} onChange={(e) => setForm({ ...form, receiverPhone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="co-zipcode">배송지</Label>
          <AddressInput
            idPrefix="co"
            initial={{ zipcode: initial.zipcode, address: initial.address, addressDetail: initial.addressDetail }}
            disabled={interactionLocked}
            onChange={(v) => setForm((f) => ({ ...f, zipcode: v.zipcode, address: v.address, addressDetail: v.addressDetail }))}
          />
        </div>
      </section>

      {/* 03 결제수단 */}
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-raised p-[20px]">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-step--1 text-fg-subtle">03</span>
          <span className="text-step-0 font-semibold text-fg">결제수단</span>
        </div>
        {manualPaymentAvailable ? (
          <div
            role="group"
            aria-label="결제방식 선택"
            className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2"
          >
            <button
              type="button"
              disabled={interactionLocked}
              aria-pressed={!isManualSelected}
              onClick={() => {
                if (isManualSelected) setMethod("card");
                setError("");
              }}
              className={cn(
                "min-h-[68px] min-w-0 rounded-[var(--radius-md)] border p-3 text-left transition-colors duration-fast",
                !isManualSelected
                  ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] shadow-glow-cyan"
                  : "border-line bg-overlay hover:bg-raised",
              )}
            >
              <span className="block break-keep text-step--1 font-semibold text-fg">
                카드·간편결제
              </span>
              <span className="mt-1 block break-keep text-[12px] leading-4 text-fg-subtle">
                인증결제·간편결제·계좌이체
              </span>
            </button>
            <button
              ref={manualTriggerRef}
              type="button"
              disabled={interactionLocked}
              aria-pressed={isManualSelected}
              onClick={(event) => {
                setMethod(manualMethod);
                manualReturnFocusRef.current = event.currentTarget;
                setManualDialogOpen(true);
                setError("");
              }}
              className={cn(
                "min-h-[68px] min-w-0 rounded-[var(--radius-md)] border p-3 text-left transition-colors duration-fast",
                isManualSelected
                  ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] shadow-glow-cyan"
                  : "border-line bg-overlay hover:bg-raised",
              )}
            >
              <span className="block break-keep text-step--1 font-semibold text-fg">
                수기결제
              </span>
              <span className="mt-1 block break-keep text-[12px] leading-4 text-fg-subtle">
                카드사 선택 후 구인증 입력
              </span>
            </button>
          </div>
        ) : null}

        {!isManualSelected ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2 sm:grid-cols-2">
            {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.enabled || interactionLocked}
              aria-pressed={method === m.id}
              onClick={() => {
                if (!m.enabled) return;
                setMethod(m.id);
                setError("");
              }}
              className={cn(
                "min-h-11 min-w-0 rounded-[var(--radius-md)] border p-3 text-left transition-colors duration-fast sm:p-3.5",
                !m.enabled && "cursor-not-allowed border-line opacity-60",
                method === m.id && m.enabled
                  ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-fg shadow-glow-cyan"
                  : "border-line bg-raised hover:bg-overlay",
              )}
            >
              <div
                className={cn(
                  "break-keep text-[12px] font-medium leading-5 min-[360px]:text-[13px] sm:text-step-0",
                  m.enabled ? "text-fg" : "text-fg-subtle",
                )}
              >
                {m.label}
              </div>
              <div className="mt-0.5 break-keep text-[12px] leading-4 text-fg-subtle sm:text-step--1">
                {m.desc}
              </div>
            </button>
            ))}
          </div>
        ) : (
          <div className="min-w-0 space-y-3 rounded-[var(--radius-md)] border border-accent-cyan/25 bg-accent-cyan/5 p-[16px]">
            {manualSelectionComplete ? (
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-[min(100%,10rem)] flex-1">
                  <p className="text-step--1 font-semibold text-fg">
                    {getManualPaymentIssuerLabel(manualCard.issuerCode)} · •••• {manualCard.cardNo.slice(-4)}
                  </p>
                  <p className="mt-1 break-keep text-[12px] leading-5 text-fg-subtle">
                    {manualPaymentMode === "review-demo"
                      ? "실제 승인 없이 결제 완료 화면을 확인하는 심사용 시연입니다."
                      : "입력한 카드정보는 승인 요청 후 저장하지 않습니다."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="min-h-11 shrink-0"
                  disabled={interactionLocked}
                  onClick={(event) => {
                    manualReturnFocusRef.current = event.currentTarget;
                    setManualDialogOpen(true);
                  }}
                >
                  정보 수정
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 w-full !h-auto !whitespace-normal"
                disabled={interactionLocked}
                onClick={(event) => {
                  manualReturnFocusRef.current = event.currentTarget;
                  setManualDialogOpen(true);
                }}
              >
                카드사·카드정보 입력
              </Button>
            )}
          </div>
        )}
        {method === "oneclick" && (
          <div className="min-w-0 space-y-2 rounded-[var(--radius-md)] border border-line bg-overlay p-[16px]">
            <p className="text-step--1 font-medium text-fg">등록 카드 선택</p>
            <div className="grid min-w-0 grid-cols-1 gap-2">
              {billingPaymentMethods.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  disabled={interactionLocked}
                  aria-pressed={billingCardId === card.id}
                  onClick={() => {
                    setBillingCardId(card.id);
                    setError("");
                  }}
                  className={cn(
                    "flex min-h-[48px] min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left",
                    billingCardId === card.id
                      ? "border-accent-cyan bg-accent-cyan/10 text-fg"
                      : "border-line bg-raised text-fg-muted hover:bg-overlay",
                  )}
                >
                  <span className="min-w-[min(100%,8rem)] flex-1 text-step--1 font-semibold [overflow-wrap:anywhere]">
                    {card.cardName} · •••• {card.cardLast4}
                  </span>
                  <span className="text-[0.72rem] text-fg-subtle [overflow-wrap:anywhere]">
                    {card.cardType === "UNKNOWN"
                      ? "카드 유형 미확인"
                      : card.cardType}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-step--1 leading-relaxed text-fg-subtle">
              라온샵은 카드번호나 PG 빌링키를 보관하지 않고 불투명 결제수단 ID만 사용합니다.
            </p>
          </div>
        )}
      </section>

      {/* 전자상거래법 제13조 — 재화 대금 외 배송비 고지 (전 상품 무료배송) */}
      <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-line bg-overlay px-[20px] py-[16px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-step--1 text-fg-muted">
          <span className="min-w-[min(100%,8rem)] flex-1">상품 금액</span>
          <span className="min-w-0 max-w-full text-right font-mono [overflow-wrap:anywhere]">{formatKrw(total)}</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-step--1 text-fg-muted">
          <span className="min-w-[min(100%,8rem)] flex-1">배송비</span>
          <span className="shrink-0 whitespace-nowrap font-mono text-success">무료</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-2.5">
          <span className="min-w-[min(100%,8rem)] flex-1 text-step-0 text-fg-muted">총 결제금액</span>
          <span className="min-w-0 max-w-full text-right font-mono text-step-1 font-extrabold text-fg [overflow-wrap:anywhere]">
            {formatKrw(total)}
          </span>
        </div>
      </div>

      {/* 전자상거래법 제8조 — 결제 전 주문내용 확인·구매조건 동의 (심사 캡처 요소) */}
      <Checkbox
        checked={agree}
        disabled={interactionLocked}
        onChange={(e) => setAgree(e.target.checked)}
      >
        [필수] 주문 상품·결제 정보를 확인하였으며,{" "}
        <Link href="/policy/terms" target="_blank" className="text-fg underline underline-offset-2 hover:text-accent-cyan">
          이용약관
        </Link>
        ,{" "}
        <Link href="/policy/privacy" target="_blank" className="text-fg underline underline-offset-2 hover:text-accent-cyan">
          개인정보처리방침
        </Link>{" "}
        및{" "}
        <Link href="/policy/refund" target="_blank" className="text-fg underline underline-offset-2 hover:text-accent-cyan">
          청약철회·환불 정책
        </Link>
        에 동의합니다.
      </Checkbox>

      <FieldError>{error}</FieldError>
      {oneclickUncertain ? (
        <div
          role="status"
          className="space-y-2 rounded-[var(--radius-md)] border border-warning/35 bg-warning/5 p-3 text-step--1 leading-relaxed text-fg-muted"
        >
          <p>
            이 화면에서는 결제를 다시 실행할 수 없습니다. 네트워크를 복구한 뒤
            주문내역에서 결제 상태 조회를 이용해 주세요.
          </p>
          <Link
            href="/mypage"
            className={`${buttonVariants({ variant: "outline", size: "lg" })} min-h-12 w-full !h-auto py-3 text-center !whitespace-normal`}
          >
            주문내역에서 상태 확인
          </Link>
        </div>
      ) : null}
      <Button
        type="button"
        size="xl"
        className="min-h-[56px] min-w-0 max-w-full flex-wrap gap-x-2 gap-y-1 px-[clamp(4px,3vw,1.5rem)] py-3 text-center !h-auto !whitespace-normal leading-tight"
        loading={pending}
        disabled={!agree || interactionLocked}
        onClick={submit}
      >
        <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{formatKrw(total)}</span>
        <span className="max-w-full break-keep">결제하기</span>
      </Button>

      <p className="text-center text-step--1 text-fg-subtle">
        {method === "oneclick"
          ? "등록카드 결제는 LAONPAY 서버에서 안전하게 처리됩니다."
          : method === "manual_demo"
            ? "심사용 시연 결제이며 실제 카드 승인·청구는 발생하지 않습니다."
          : "결제는 KSPAY(KSNET) 인증결제창에서 안전하게 진행됩니다."}
      </p>

      {manualPaymentMode !== "disabled" ? (
        <ManualPaymentDialog
          open={manualDialogOpen}
          mode={manualPaymentMode}
          value={manualCard}
          disabled={interactionLocked}
          returnFocusRef={manualReturnFocusRef}
          onChange={setManualCard}
          onClose={() => setManualDialogOpen(false)}
          onComplete={() => setError("")}
        />
      ) : null}
    </div>
  );
}
