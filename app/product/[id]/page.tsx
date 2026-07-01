import { prisma } from "@/lib/db";
import { Amount } from "@/lib/ui";
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
    <div className="space-y-8">
      <Link
        href="/"
        className="group inline-flex items-center gap-2 font-mono text-step--1 uppercase tracking-widest text-fg-subtle transition-colors hover:text-fg-muted"
      >
        <span className="transition-transform group-hover:-translate-x-0.5">←</span>
        전체 상품
      </Link>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
        {/* 이미지 패널 */}
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-raised p-3 shadow-elev2 md:p-4">
            <div className="pointer-events-none absolute -inset-x-16 -top-24 h-56 bg-accent-cyan/10 blur-3xl" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] bg-overlay shadow-glow-cyan">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl ?? ""}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 상세 */}
        <div className="flex flex-col md:py-2">
          <div className="font-mono text-step--1 uppercase tracking-widest text-accent-cyan">
            {product.category}
          </div>
          <h1 className="mt-3 font-display text-step-3 font-bold leading-tight tracking-tight text-fg">
            {product.name}
          </h1>

          <div className="mt-5 flex items-baseline gap-1">
            <Amount value={product.price} className="text-step-2 text-fg" />
          </div>

          {product.description && (
            <p className="mt-6 whitespace-pre-wrap text-step-0 leading-relaxed text-fg-muted">
              {product.description}
            </p>
          )}

          <div className="mt-8 border-t border-line pt-8">
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
