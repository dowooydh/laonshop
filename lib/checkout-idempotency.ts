export const CHECKOUT_NONCE_KEY = "laonshop-checkout-nonce";

type CheckoutNonceCrypto = {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
};

export type CheckoutIdempotencyPayload = {
  method: string;
  items: Array<{ productId: string; qty: number; size?: string | null }>;
  receiverName: string;
  receiverPhone: string;
  zipcode?: string;
  address: string;
  addressDetail?: string;
  billingCardId?: string;
  demoIssuer?: string;
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
    demoIssuer: payload.demoIssuer ?? "",
  };
  const data = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCheckoutNonce(): string {
  if (typeof window === "undefined") return "initial";
  return localStorage.getItem(CHECKOUT_NONCE_KEY) ?? "initial";
}

export function createCheckoutNonce(cryptoApi: CheckoutNonceCrypto | null | undefined = globalThis.crypto): string {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 오래된 브라우저에서도 장바구니 의미 변경을 구분할 수 있는 불투명 nonce를 만든다.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function rotateCheckoutNonce(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHECKOUT_NONCE_KEY, createCheckoutNonce());
}
