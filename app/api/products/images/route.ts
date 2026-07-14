import { prisma } from "@/lib/db";
import { getProductDetailImages } from "@/lib/product-detail-images";
import { NextRequest, NextResponse } from "next/server";

const MAX_PRODUCT_IDS = 50;
const MAX_PRODUCT_ID_LENGTH = 64;

export async function GET(request: NextRequest) {
  const ids = Array.from(new Set(request.nextUrl.searchParams.getAll("id")));
  if (
    ids.length === 0 ||
    ids.length > MAX_PRODUCT_IDS ||
    ids.some((id) => id.length === 0 || id.length > MAX_PRODUCT_ID_LENGTH)
  ) {
    return NextResponse.json({ error: "상품 식별값을 확인해 주세요." }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true, name: true, category: true, gender: true, imageUrl: true },
  });
  const images = Object.fromEntries(
    products.map((product) => [product.id, getProductDetailImages(product)[0]?.src ?? null]),
  );

  return NextResponse.json(
    { images },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
