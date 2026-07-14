// 장바구니 — localStorage 기반 (심사용 더미몰, 가볍게). 주문 시 서버로 전달.
import { rotateCheckoutNonce } from "@/lib/checkout-idempotency";
import { safeProductImageUrl, sanitizeStoredProductImages } from "@/lib/product-image";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  size: string;
  imageUrl: string | null;
}

export const CART_STORAGE_KEY = "laonshop-cart";

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
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]") as CartItem[];
    const { items, migrated } = sanitizeStoredProductImages(stored);

    // 상품·수량·사이즈와 체크아웃 nonce는 그대로 두고 왜곡된 이미지 참조만 제거한다.
    if (migrated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // 저장 공간 오류가 나도 메모리의 장바구니 내용은 그대로 반환한다.
      }
    }
    return items;
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  const changed = cartIdentity(getCart()) !== cartIdentity(items);
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  // 장바구니 내용 변경이 새 주문 의도를 구분한다. 시간 버킷 없이도 동일 제출은 안정적으로
  // 같은 키를 유지하고, 사용자가 카트를 수정하면 새 멱등 nonce를 발급한다.
  if (changed) rotateCheckoutNonce();
  window.dispatchEvent(new Event("laonshop-cart-change"));
}

export function addToCart(item: CartItem): void {
  const cart = getCart();
  const found = cart.find((c) => c.productId === item.productId && c.size === item.size);
  const safeItem = { ...item, imageUrl: safeProductImageUrl(item.imageUrl) };
  if (found) {
    found.qty += item.qty;
    found.imageUrl = safeItem.imageUrl;
  } else cart.push(safeItem);
  saveCart(cart);
}

export function clearCart(): void {
  localStorage.removeItem(CART_STORAGE_KEY);
  rotateCheckoutNonce();
  window.dispatchEvent(new Event("laonshop-cart-change"));
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, c) => sum + c.price * c.qty, 0);
}
