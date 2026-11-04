"use server";

import { requireShopAdmin } from "@/lib/auth";
import { recordShipment, markShipmentDelivered } from "@/lib/commerce/mutations";
import type { CommerceActionState } from "@/lib/commerce/policy";
import { revalidatePath } from "next/cache";

export async function saveShipment(_previous: CommerceActionState, formData: FormData): Promise<CommerceActionState> {
  const admin = await requireShopAdmin();
  const input = Object.fromEntries(["orderId", "carrier", "trackingNumber", "note"].map((key) => [key, formData.get(key) ?? ""]));
  const result = await recordShipment(admin.id, input);
  if (result.status === "success") { revalidatePath("/admin"); revalidatePath("/admin/orders"); revalidatePath(`/order/${input.orderId}`); }
  return result;
}

export async function completeShipment(_previous: CommerceActionState, formData: FormData): Promise<CommerceActionState> {
  const admin = await requireShopAdmin();
  const input = { orderId: formData.get("orderId"), note: formData.get("note") ?? "" };
  const result = await markShipmentDelivered(admin.id, input);
  if (result.status === "success") { revalidatePath("/admin"); revalidatePath("/admin/orders"); revalidatePath(`/order/${input.orderId}`); }
  return result;
}
