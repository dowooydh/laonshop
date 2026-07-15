import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 엔진(.so.node)을 Vercel serverless 번들에 포함 (Turbopack/webpack 번들링 제외)
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // 로컬 모바일 테스트(Android emulator) dev 접속 허용 — Next 15 future major 경고 제거.
  // dev server 전용이라 프로덕션 빌드에는 영향 없음. 10.0.2.2 = 에뮬레이터→호스트 루프백.
  allowedDevOrigins: ["127.0.0.1", "10.0.2.2"],
  images: {
    localPatterns: [
      { pathname: "/products/gallery/**", search: "" },
      { pathname: "/products/detail/**", search: "?v=20260715-editorial" },
      { pathname: "/brand/**", search: "" },
    ],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" }, // 엄선 상품·모델 이미지
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
