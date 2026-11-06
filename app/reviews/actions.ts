"use server";

import { requireShopUser } from "@/lib/auth";
import { createVerifiedReview } from "@/lib/commerce/mutations";
import type { CommerceActionState } from "@/lib/commerce/policy";

export async function submitProductReview(_previous: CommerceActionState, formData: FormData): Promise<CommerceActionState> {
  const user = await requireShopUser();
  const result = await createVerifiedReview(user.id, Object.fromEntries(["orderItemId", "rating", "content"].map((key) => [key, formData.get(key)])));
  // 동적 페이지의 새 GET은 클라이언트의 action pending 종료 후 수행한다.
  return { status: result.status, message: result.message };
}
