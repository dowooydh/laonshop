"use client";

// 최근 본 상품 — localStorage 기반 (심사용 몰, 서버 저장 불필요). 최대 8개 보관, 4개 노출.
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatKrw } from "@/lib/format";

const KEY = "laonshop-recent";
const MAX = 8;

export type RecentItem = { id: string; name: string; price: number; imageUrl: string | null };

function read(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentItem[];
  } catch {
    return [];
  }
}

/** 상품 상세 마운트 시 열람 기록 (렌더 없음) */
export function RecordView({ item }: { item: RecentItem }) {
  useEffect(() => {
    const next = [item, ...read().filter((r) => r.id !== item.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  }, [item]);
  return null;
}

/** 최근 본 상품 스트립 — 기록 없으면 렌더하지 않음 */
export function RecentProducts({ excludeId }: { excludeId?: string }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(read().filter((r) => r.id !== excludeId).slice(0, 4));
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="border-t border-line pt-8">
      <h2 className="font-mono text-step--1 uppercase tracking-widest text-fg-subtle">최근 본 상품</h2>
      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-4 sm:grid-cols-4">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/product/${p.id}`}
            className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised transition-[border-color,box-shadow] duration-base hover:border-accent-cyan hover:shadow-glow-cyan"
          >
            {p.imageUrl && (
              <Image
                src={p.imageUrl}
                alt={p.name}
                fill
                sizes="(min-width: 640px) 25vw, 50vw"
                className="object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.06]"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void via-void/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <div className="truncate text-step--1 font-semibold text-fg">{p.name}</div>
              <div className="mt-0.5 font-mono text-step--1 font-bold text-fg">{formatKrw(p.price)}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
