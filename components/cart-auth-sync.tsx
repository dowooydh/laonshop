"use client";

// 카트 소유권 동기화 — localStorage 카트가 로그인 세션을 따라가게 한다.
// 규칙: ① 로그아웃·세션만료·탈퇴(로그인→비로그인) 시 카트 비움
//      ② 다른 계정으로 전환 시 이전 계정 카트 비움
//      ③ 게스트가 담고 로그인하면 카트 승계(표준 UX)
import { useEffect } from "react";
import { clearCart } from "@/lib/cart";

const OWNER_KEY = "laonshop-cart-owner"; // ""=게스트, 그 외=userId

export function CartAuthSync({ userId }: { userId: string | null }) {
  useEffect(() => {
    const prev = localStorage.getItem(OWNER_KEY);
    const cur = userId ?? "";

    if (prev === null) {
      // 소유권 기록이 없는 첫 방문 — 비로그인인데 카트가 남아 있으면
      // 이 기능 도입 전(또는 이전 사용자)의 잔여 카트이므로 정리
      if (!userId) clearCart();
    } else if (prev !== "" && prev !== cur) {
      // 로그인 사용자(prev)가 로그아웃했거나 다른 계정으로 바뀜
      clearCart();
    }

    localStorage.setItem(OWNER_KEY, cur);
  }, [userId]);

  return null;
}
