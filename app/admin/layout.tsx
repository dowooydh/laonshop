import type { Metadata } from "next";
import { requireShopAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireShopAdmin();
  return children;
}
