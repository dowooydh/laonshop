// 장바구니 — localStorage 기반 (심사용 더미몰, 가볍게). 주문 시 서버로 전달.
import { rotateCheckoutNonce } from "@/lib/checkout-idempotency";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  size: string;
  imageUrl: string | null;
}

const KEY = "laonshop-cart";

function cartIdentity(items: CartItem[]): string {
  return JSON.stringify(
    items
      .map(({ productId, size, qty }) => ({ productId, size, qty }))
      .sort((a, b) => `${a.productId}:${a.size}`.localeCompare(`${b.productId}:${b.size}`)),
  );
}

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  const changed = cartIdentity(getCart()) !== cartIdentity(items);
  localStorage.setItem(KEY, JSON.stringify(items));
  // 장바구니 내용 변경이 새 주문 의도를 구분한다. 시간 버킷 없이도 동일 제출은 안정적으로
  // 같은 키를 유지하고, 사용자가 카트를 수정하면 새 멱등 nonce를 발급한다.
  if (changed) rotateCheckoutNonce();
  window.dispatchEvent(new Event("laonshop-cart-change"));
}

export function addToCart(item: CartItem): void {
  const cart = getCart();
  const found = cart.find((c) => c.productId === item.productId && c.size === item.size);
  if (found) found.qty += item.qty;
  else cart.push(item);
  saveCart(cart);
}

export function clearCart(): void {
  localStorage.removeItem(KEY);
  rotateCheckoutNonce();
  window.dispatchEvent(new Event("laonshop-cart-change"));
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, c) => sum + c.price * c.qty, 0);
}
