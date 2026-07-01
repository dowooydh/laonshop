// 장바구니 — localStorage 기반 (심사용 더미몰, 가볍게). 주문 시 서버로 전달.
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  size: string;
  imageUrl: string | null;
}

const KEY = "ryushop-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("ryushop-cart-change"));
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
  window.dispatchEvent(new Event("ryushop-cart-change"));
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, c) => sum + c.price * c.qty, 0);
}
