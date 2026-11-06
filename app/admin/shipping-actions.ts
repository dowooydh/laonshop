"use server";

import { requireShopAdmin } from "@/lib/auth";
import { recordShipment, markShipmentDelivered } from "@/lib/commerce/mutations";
import type { CommerceActionState } from "@/lib/commerce/policy";

export async function saveShipment(_previous: CommerceActionState, formData: FormData): Promise<CommerceActionState> {
  const admin = await requireShopAdmin();
  const input = Object.fromEntries(["orderId", "carrier", "trackingNumber", "note"].map((key) => [key, formData.get(key) ?? ""]));
  const result = await recordShipment(admin.id, input);
  // force-dynamic 화면은 action 전환이 끝난 뒤 클라이언트에서 갱신한다.
  return result;
}

export async function completeShipment(_previous: CommerceActionState, formData: FormData): Promise<CommerceActionState> {
  const admin = await requireShopAdmin();
  const input = { orderId: formData.get("orderId"), note: formData.get("note") ?? "" };
  const result = await markShipmentDelivered(admin.id, input);
  // force-dynamic 화면은 action 전환이 끝난 뒤 클라이언트에서 갱신한다.
  return result;
}
