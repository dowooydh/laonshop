"use client";
import { Button, cn } from "@/lib/ui";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToCart } from "@/lib/cart";

interface Props {
  product: { id: string; name: string; price: number; imageUrl: string | null };
  sizes: string[];
  soldOut?: boolean;
}

export function AddToCart({ product, sizes, soldOut = false }: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [size, setSize] = useState(sizes[0] ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const add = (goCart: boolean) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
      size,
      imageUrl: product.imageUrl,
    });
    if (goCart) {
      router.push("/cart");
    } else {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2000);
    }
  };

  return (
    <motion.div
      className="min-w-0 space-y-6"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {sizes.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-step--1 uppercase tracking-widest text-fg-subtle">
            사이즈
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={cn(
                  "h-[44px] min-w-[56px] rounded-[var(--radius-md)] border px-3 text-sm font-medium transition-colors",
                  size === s
                    ? "border-accent-cyan bg-[color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] text-fg shadow-glow-cyan"
                    : "border-line bg-raised text-fg-muted hover:bg-overlay hover:text-fg",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 font-mono text-step--1 uppercase tracking-widest text-fg-subtle">
          수량
        </div>
        <div className="inline-flex items-center rounded-[var(--radius-md)] border border-line bg-raised">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-[44px] w-[44px] items-center justify-center text-lg text-fg-muted transition-colors hover:text-fg"
            aria-label="수량 감소"
          >
            −
          </button>
          <span className="w-[48px] text-center font-mono text-sm font-semibold tabular-nums text-fg">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="flex h-[44px] w-[44px] items-center justify-center text-lg text-fg-muted transition-colors hover:text-fg"
            aria-label="수량 증가"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3 pt-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="px-3 text-sm min-[360px]:px-4 min-[360px]:text-step-0 sm:px-6 sm:text-step-1"
          disabled={soldOut}
          onClick={() => add(false)}
        >
          {added ? "담았습니다 ✓" : "장바구니 담기"}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="xl"
          className="px-3 text-sm min-[360px]:px-4 min-[360px]:text-step-0 sm:px-6 sm:text-step-1"
          disabled={soldOut}
          onClick={() => add(true)}
        >
          {soldOut ? "품절" : "바로 구매"}
        </Button>
      </div>
    </motion.div>
  );
}
