import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getShopUser } from "@/lib/auth";
import { logoutAction } from "./(auth)/actions";
import { fontDisplay, fontMono } from "./fonts";
import { CartBadge } from "@/components/cart-badge";
import { GrainOverlay } from "@/components/grain-overlay";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  metadataBase: new URL("https://laonshop.com"),
  title: { default: "LAON SHOP — 미래를 입다", template: "%s · LAON SHOP" },
  description: "LAON SHOP — 상의·아우터·원피스부터 가방·액세서리까지, 공간에서 만나는 미래지향 셀렉트샵. 전 상품 무료배송.",
  openGraph: {
    siteName: "LAON SHOP",
    locale: "ko_KR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getShopUser();

  return (
    <html lang="ko" className={`${fontDisplay.variable} ${fontMono.variable}`}>
      <head>
        {/* Pretendard(globals.css @import) CDN 선연결 — 렌더 블로킹 체인 완화 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* a11y — 키보드 사용자 본문 바로가기 (포커스 시에만 노출) */}
        <a
          href="#main"
          className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-[var(--radius-md)] focus:bg-raised focus:px-4 focus:py-2 focus:text-step--1 focus:text-fg"
        >
          본문 바로가기
        </a>
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
                    <Link
                      href="/search"
                      className="rounded-[var(--radius-sm)] px-3 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                    >
                      검색
                    </Link>
                  </nav>
                </div>
                <nav className="flex items-center gap-1 text-step--1 sm:gap-2">
                  <Link
                    href="/cart"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg sm:px-3"
                  >
                    장바구니
                    <CartBadge />
                  </Link>
                  {user ? (
                    <>
                      <Link
                        href="/mypage"
                        className="max-w-[7rem] truncate whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg sm:px-3"
                      >
                        {user.name}님
                      </Link>
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-2 text-fg-subtle transition-colors duration-fast hover:text-fg sm:px-3"
                        >
                          로그아웃
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-2 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg sm:px-3"
                      >
                        로그인
                      </Link>
                      <Link
                        href="/register"
                        className="whitespace-nowrap rounded-[var(--radius-pill)] bg-accent-cyan px-4 py-2 font-medium text-void shadow-glow-cyan transition-[filter] duration-fast hover:brightness-110"
                      >
                        회원가입
                      </Link>
                    </>
                  )}
                </nav>
              </div>
              {/* 모바일 — 젠더 카테고리 진입 경로 (데스크톱 nav가 hidden sm:flex라 뷰포트 절반에서 끊기는 동선 복원) */}
              <nav className="flex h-10 items-center gap-1 border-t border-line px-3 text-step--1 sm:hidden">
                <Link
                  href="/shop/men"
                  className="rounded-[var(--radius-sm)] px-3 py-1.5 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                >
                  남성의류
                </Link>
                <Link
                  href="/shop/women"
                  className="rounded-[var(--radius-sm)] px-3 py-1.5 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                >
                  여성의류
                </Link>
                <Link
                  href="/search"
                  className="rounded-[var(--radius-sm)] px-3 py-1.5 text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
                >
                  검색
                </Link>
              </nav>
            </div>
          </header>

          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none sm:px-6">
            {children}
          </main>

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
                  <Link href="/policy/shipping" className="text-fg-muted transition-colors hover:text-accent-cyan">
                    배송 안내
                  </Link>
                  <Link href="/support" className="text-fg-muted transition-colors hover:text-accent-cyan">
                    자주 묻는 질문
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

              {/* 전자상거래법 제10조 필수 표시 — 값은 ㈜커스텀오더 사업자등록증 서류와 글자까지 일치 (신고번호는 발급 후 기재) */}
              <div className="mt-10 border-t border-line pt-6 text-step--1 leading-relaxed text-fg-subtle">
                <p>
                  상호: (주)커스텀오더 &nbsp;|&nbsp; 대표: 유준혁 &nbsp;|&nbsp; 사업자등록번호: 864-88-03054 &nbsp;|&nbsp;
                  통신판매업신고: 신고 예정
                </p>
                <p>사업장 소재지: 경기도 성남시 수정구 청계산로 686, 415호 (판교반도아이비밸리)</p>
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
                <p className="mt-3">© LAON SHOP · ㈜커스텀오더. 결제는 KSPAY(KSNET)로 안전하게 처리됩니다.</p>
              </div>
            </div>
          </footer>
        </SmoothScroll>

        <GrainOverlay />
      </body>
    </html>
  );
}
