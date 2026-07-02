import type { MetadataRoute } from "next";

// 개인·결제 경로 색인 차단 + 사이트맵 안내
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/cart", "/checkout", "/mypage", "/order/", "/api/", "/login", "/register", "/design-system", "/search"],
      },
    ],
    sitemap: "https://laonshop.com/sitemap.xml",
  };
}
