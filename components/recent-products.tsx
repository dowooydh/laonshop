"use client";

// 최근 본 상품 — localStorage 기반 (심사용 몰, 서버 저장 불필요). 최대 8개 보관, 4개 노출.
import { useEffect, useState } from "react";
import { ProductCard } from "./product-card";
import {
  hydrateMissingProductImages,
  mergeResolvedProductImages,
  safeProductImageUrl,
  sanitizeStoredProductImages,
} from "@/lib/product-image";

const KEY = "laonshop-recent";
const MAX = 8;

export type RecentItem = { id: string; name: string; price: number; imageUrl: string | null };

function read(): RecentItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentItem[];
    const { items, migrated } = sanitizeStoredProductImages(stored);

    // 최근 본 상품 목록은 보존하고, 재생성 전인 왜곡 상세컷 참조만 제거한다.
    if (migrated) {
      try {
        localStorage.setItem(KEY, JSON.stringify(items));
      } catch {
        // 저장 공간 오류가 나도 현재 세션의 최근 상품 목록은 유지한다.
      }
    }
    return items;
  } catch {
    return [];
  }
}

/** 상품 상세 마운트 시 열람 기록 (렌더 없음) */
export function RecordView({ item }: { item: RecentItem }) {
  useEffect(() => {
    const safeItem = { ...item, imageUrl: safeProductImageUrl(item.imageUrl) };
    const next = [safeItem, ...read().filter((r) => r.id !== item.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  }, [item]);
  return null;
}

/** 최근 본 상품 스트립 — 기록 없으면 렌더하지 않음 */
export function RecentProducts({ excludeId }: { excludeId?: string }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const stored = read();
    setItems(stored.filter((r) => r.id !== excludeId).slice(0, 4));

    void hydrateMissingProductImages(stored, (item) => item.id).then((hydrated) => {
      if (cancelled || !hydrated.migrated) return;
      const resolved = Object.fromEntries(hydrated.items.map((item) => [item.id, item.imageUrl]));
      const latest = read();
      const merged = mergeResolvedProductImages(latest, (item) => item.id, resolved);
      if (!merged.migrated) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(merged.items));
      } catch {
        // 저장 실패 시에도 현재 화면에서는 복구된 이미지를 보여준다.
      }
      setItems(merged.items.filter((r) => r.id !== excludeId).slice(0, 4));
    });

    return () => {
      cancelled = true;
    };
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="space-y-5 border-t border-line pt-8">
      <h2 className="text-xl font-bold tracking-tight text-fg">최근 본 상품</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-5">
        {items.map((product) => <ProductCard key={product.id} {...product} sizes="(min-width: 640px) 25vw, 50vw" />)}
      </div>
    </section>
  );
}
