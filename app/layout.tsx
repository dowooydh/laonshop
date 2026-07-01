import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getShopUser } from "@/lib/auth";
import { logoutAction } from "./(auth)/actions";
import { fontDisplay, fontMono } from "./fonts";
import { GrainOverlay } from "@/components/grain-overlay";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  title: "LAON SHOP — 미래를 입다",
  description: "㈜커스텀오더 LAON SHOP. 상의·하의·아우터를 공간에서 만나는 미래지향 셀렉트샵.",
};

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getShopUser();

  return (
    <html lang="ko" className={`${fontDisplay.variable} ${fontMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SmoothScroll>
          <header className="sticky top-0 z-40 border-b border-line">
            <div className="glass">
              <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-6">
                  <Link
                    href="/"
                    className="font-display text-xl font-bold tracking-tight text-fg transition-[text-shadow] duration-base hover:[text-shadow:0_0_22px_color-mix(in_oklab,var(--accent-cyan)_60%,transparent)]"
                  >
                    LAON<span className="text-accent-cyan">SHOP</span>
                  </Link>
                  <nav className="hidden items-center gap-1 text-step--1 sm:flex">
                    <Link
                      href="/shop/men"
                      className="rounded-[var(--radius-sm)] px-3 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                    >
                      남성의류
                    </Link>
                    <Link
                      href="/shop/women"
                      className="rounded-[var(--radius-sm)] px-3 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                    >
                      여성의류
                    </Link>
                  </nav>
                </div>
                <nav className="flex items-center gap-1 text-step--1 sm:gap-2">
                  <Link
                    href="/cart"
                    className="rounded-[var(--radius-sm)] px-3 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                  >
                    장바구니
                  </Link>
                  {user ? (
                    <>
                      <Link
                        href="/mypage"
                        className="rounded-[var(--radius-sm)] px-3 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                      >
                        {user.name}님
                      </Link>
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="rounded-[var(--radius-sm)] px-3 py-2 text-fg-subtle transition-colors duration-fast hover:text-fg"
                        >
                          로그아웃
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="rounded-[var(--radius-sm)] px-3 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                      >
                        로그인
                      </Link>
                      <Link
                        href="/register"
                        className="rounded-[var(--radius-pill)] bg-accent-cyan px-4 py-2 font-medium text-void shadow-glow-cyan transition-[filter] duration-fast hover:brightness-110"
                      >
                        회원가입
                      </Link>
                    </>
                  )}
                </nav>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>

          {/* 카드사 심사 필수 — 사업자정보 + 정책 링크 (통신판매번호는 신고 후 기재) */}
          <footer className="border-t border-line bg-base">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-sm">
                  <p className="font-display text-lg font-bold text-fg">
                    LAON<span className="text-accent-cyan">SHOP</span>
                  </p>
                  <p className="mt-3 text-step--1 leading-relaxed text-fg-muted">
                    입는 것을 공간에서 만나는 ㈜커스텀오더의 미래지향 셀렉트샵.
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-step--1">
                  <Link href="/policy/terms" className="text-fg-muted transition-colors hover:text-accent-cyan">
                    이용약관
                  </Link>
                  <Link href="/policy/privacy" className="text-fg-muted transition-colors hover:text-accent-cyan">
                    개인정보처리방침
                  </Link>
                  <Link href="/policy/refund" className="text-fg-muted transition-colors hover:text-accent-cyan">
                    청약철회·교환·환불 안내
                  </Link>
                  <a
                    href="https://pf.kakao.com/_UhNxdn/chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg-muted transition-colors hover:text-accent-cyan"
                  >
                    카카오톡 문의
                  </a>
                </div>
              </div>

              <div className="mt-10 border-t border-line pt-6 text-step--1 leading-relaxed text-fg-subtle">
                <p>상호: ㈜커스텀오더 &nbsp;|&nbsp; 대표: 유준혁 &nbsp;|&nbsp; 사업자등록번호: 864-88-03054</p>
                <p>통신판매업신고: 신고 예정 &nbsp;|&nbsp; 개인정보보호책임자: 유준혁</p>
                <p>주소: 경기도 성남시 수정구 청계산로 686, 415호 (판교반도아이비밸리)</p>
                <p>
                  고객센터:{" "}
                  <a href="tel:070-4044-7008" className="text-fg-muted hover:text-accent-cyan">
                    070-4044-7008
                  </a>{" "}
                  (평일 09:00–18:00) &nbsp;|&nbsp; 이메일:{" "}
                  <a href="mailto:custom_sales@customorder.co.kr" className="text-fg-muted hover:text-accent-cyan">
                    custom_sales@customorder.co.kr
                  </a>
                </p>
                <p className="mt-3">
                  ⓘ 통신판매업 신고번호는 신고 완료 후 기재됩니다(카드사 심사용).
                </p>
                <p className="mt-1">© LAON SHOP · ㈜커스텀오더. 결제는 KSPAY(KSNET)로 안전하게 처리됩니다.</p>
              </div>
            </div>
          </footer>
        </SmoothScroll>

        <GrainOverlay />
      </body>
    </html>
  );
}
