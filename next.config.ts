import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 엔진(.so.node)을 Vercel serverless 번들에 포함 (Turbopack/webpack 번들링 제외)
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" }, // 엄선 상품·모델 이미지
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
