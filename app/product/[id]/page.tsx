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
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
        ← 전체 상품
      </Link>
      <div className="mt-3 grid gap-8 md:grid-cols-2">
        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl ?? ""} alt={product.name} className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-400">{product.category}</div>
          <h1 className="mt-1 text-xl font-bold text-gray-900">{product.name}</h1>
          <div className="mt-2 text-2xl font-extrabold text-gray-900">{formatKrw(product.price)}</div>
          {product.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
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
