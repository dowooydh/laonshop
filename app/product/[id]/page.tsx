import { prisma } from "@/lib/db";
import { formatKrw } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "./add-to-cart";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || !product.active) notFound();

  const sizes = (product.sizes ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div>
      <Link href="/" className="text-sm text-fg-subtle hover:text-fg-muted">
        ← 전체 상품
      </Link>
      <div className="mt-3 grid gap-8 md:grid-cols-2">
        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-overlay">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl ?? ""} alt={product.name} className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="text-sm font-medium text-accent-cyan">{product.category}</div>
          <h1 className="mt-1 text-xl font-bold text-fg">{product.name}</h1>
          <div className="mt-2 text-2xl font-extrabold text-fg">{formatKrw(product.price)}</div>
          {product.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
              {product.description}
            </p>
          )}
          <div className="mt-6">
            <AddToCart
              product={{ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl }}
              sizes={sizes}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
