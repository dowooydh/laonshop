"use client";
import { useEffect } from "react";
import { clearCart } from "@/lib/cart";

// 결제 완료(PAID) 시 장바구니 비우기
export function ClearCartOnPaid() {
  useEffect(() => {
    clearCart();
  }, []);
  return null;
}
