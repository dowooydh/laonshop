"use client";
import { Button, cn } from "@/lib/ui";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToCart } from "@/lib/cart";

interface Props {
  product: { id: string; name: string; price: number; imageUrl: string | null };
  sizes: string[];
}

export function AddToCart({ product, sizes }: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [size, setSize] = useState(sizes[0] ?? "");
  const [qty, setQty] = useState(1);

  const add = (goCart: boolean) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
      size,
      imageUrl: product.imageUrl,
    });
    if (goCart) router.push("/cart");
    else router.refresh();
  };

  return (
    <motion.div
      className="space-y-6"
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
                  "h-11 min-w-14 rounded-[var(--radius-md)] border px-3 text-sm font-medium transition-colors",
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
            className="flex h-11 w-11 items-center justify-center text-lg text-fg-muted transition-colors hover:text-fg"
            aria-label="수량 감소"
          >
            −
          </button>
          <span className="w-12 text-center font-mono text-sm font-semibold tabular-nums text-fg">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="flex h-11 w-11 items-center justify-center text-lg text-fg-muted transition-colors hover:text-fg"
            aria-label="수량 증가"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button type="button" variant="outline" size="xl" onClick={() => add(false)}>
          장바구니 담기
        </Button>
        <Button type="button" variant="primary" size="xl" onClick={() => add(true)}>
          바로 구매
        </Button>
      </div>
    </motion.div>
  );
}
