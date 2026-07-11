export const CHECKOUT_NONCE_KEY = "laonshop-checkout-nonce";

export type CheckoutIdempotencyPayload = {
  method: string;
  items: Array<{ productId: string; qty: number; size?: string | null }>;
  receiverName: string;
  receiverPhone: string;
  zipcode?: string;
  address: string;
  addressDetail?: string;
  billingCardId?: string;
};

export async function createCheckoutIdempotencyKey(
  payload: CheckoutIdempotencyPayload,
  nonce: string,
  _requestTime = Date.now(), // 회귀 검증용 시각. 시간 경계가 키를 바꾸지 않도록 해시에는 포함하지 않는다.
): Promise<string> {
  const canonical = {
    nonce,
    method: payload.method,
    items: [...payload.items]
      .map((item) => ({
        productId: item.productId,
        qty: item.qty,
        size: item.size?.trim() || null,
      }))
      .sort((a, b) => `${a.productId}:${a.size ?? ""}`.localeCompare(`${b.productId}:${b.size ?? ""}`)),
    receiverName: payload.receiverName.trim(),
    receiverPhone: payload.receiverPhone.trim(),
    zipcode: payload.zipcode?.trim() || "",
    address: payload.address.trim(),
    addressDetail: payload.addressDetail?.trim() || "",
    billingCardId: payload.billingCardId ?? "",
  };
  const data = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCheckoutNonce(): string {
  if (typeof window === "undefined") return "initial";
  return localStorage.getItem(CHECKOUT_NONCE_KEY) ?? "initial";
}

export function rotateCheckoutNonce(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHECKOUT_NONCE_KEY, globalThis.crypto.randomUUID());
}
