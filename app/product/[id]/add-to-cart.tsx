"use client";
import { Button, cn } from "@/lib/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToCart } from "@/lib/cart";

interface Props {
  product: { id: string; name: string; price: number; imageUrl: string | null };
  sizes: string[];
}

export function AddToCart({ product, sizes }: Props) {
  const router = useRouter();
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
    <div className="space-y-4">
      {sizes.length > 0 && (
        <div>
          <div className="mb-1.5 text-sm font-medium text-gray-700">사이즈</div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={cn(
                  "h-10 min-w-12 rounded-lg border px-3 text-sm font-medium",
                  size === s
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-sm font-medium text-gray-700">수량</div>
        <div className="inline-flex items-center rounded-lg border border-gray-300">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-10 text-lg text-gray-600">
            −
          </button>
          <span className="w-10 text-center text-sm font-medium tabular-nums">{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)} className="h-10 w-10 text-lg text-gray-600">
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button type="button" variant="secondary" size="xl" onClick={() => add(false)}>
          장바구니 담기
        </Button>
        <Button type="button" size="xl" onClick={() => add(true)}>
          바로 구매
        </Button>
      </div>
    </div>
  );
}
