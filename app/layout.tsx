import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getShopUser } from "@/lib/auth";
import { logoutAction } from "./(auth)/actions";

export const metadata: Metadata = {
  title: "LAON SHOP — 데일리 의류 쇼핑몰",
  description: "LAON SHOP 의류 쇼핑몰. 데일리룩·아우터·상의·하의.",
};

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getShopUser();

  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="text-xl font-extrabold tracking-tight text-gray-900">
              LAON<span className="text-blue-600">SHOP</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/cart" className="text-gray-600 hover:text-gray-900">
                🛒 장바구니
              </Link>
              {user ? (
                <>
                  <Link href="/mypage" className="text-gray-600 hover:text-gray-900">
                    {user.name}님
                  </Link>
                  <form action={logoutAction}>
                    <button type="submit" className="text-gray-400 hover:text-gray-700">
                      로그아웃
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-gray-600 hover:text-gray-900">
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                  >
                    회원가입
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

        {/* 카드사 심사 필수 — 사업자정보 + 정책 링크 (통신판매번호·연락처는 확정 후 기재) */}
        <footer className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-8 text-xs leading-relaxed text-gray-500">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-medium text-gray-700">
              <Link href="/policy/terms" className="hover:underline">
                이용약관
              </Link>
              <Link href="/policy/privacy" className="hover:underline">
                개인정보처리방침
              </Link>
              <Link href="/policy/refund" className="hover:underline">
                청약철회·교환·환불 안내
              </Link>
            </div>
            <p className="font-semibold text-gray-700">LAON SHOP</p>
            <p className="mt-1">
              상호: ㈜커스텀오더 | 대표: 유준혁 | 사업자등록번호: 864-88-03054
            </p>
            <p>통신판매업신고: 신고 예정 | 개인정보보호책임자: 유준혁</p>
            <p>주소: 경기도 성남시 수정구 청계산로 686, 415호 (판교반도아이비밸리) | 고객센터: 준비중 | 이메일: 준비중</p>
            <p className="mt-2 text-[11px] text-gray-400">
              ⓘ 통신판매업 신고번호와 고객센터 연락처는 신고·개설 완료 후 기재됩니다(카드사 심사용).
            </p>
            <p className="mt-1 text-[11px] text-gray-400">© LAON SHOP. 결제는 KSPAY(KSNET)로 안전하게 처리됩니다.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
