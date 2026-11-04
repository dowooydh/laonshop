"use server";

import { requireShopUser } from "@/lib/auth";
import { createVerifiedReview } from "@/lib/commerce/mutations";
import type { CommerceActionState } from "@/lib/commerce/policy";
import { revalidatePath } from "next/cache";

export async function submitProductReview(_previous: CommerceActionState, formData: FormData): Promise<CommerceActionState> {
  const user = await requireShopUser();
  const result = await createVerifiedReview(user.id, Object.fromEntries(["orderItemId", "rating", "content"].map((key) => [key, formData.get(key)])));
  if (result.status === "success" && result.productId) revalidatePath(`/product/${result.productId}`);
  return { status: result.status, message: result.message };
}
