import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 엔진(.so.node)을 Vercel serverless 번들에 포함 (Turbopack/webpack 번들링 제외)
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  images: {
    // 더미 상품 이미지 (picsum). 실상품 이미지 도메인은 추후 추가.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
};

export default nextConfig;
