import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.12"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      { protocol: "https", hostname: "*.cloudflarestorage.com", pathname: "/**" },
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "store.storeimages.cdn-apple.com", pathname: "/**" },
      { protocol: "https", hostname: "*.apple.com", pathname: "/**" },
      { protocol: "https", hostname: "images.samsung.com", pathname: "/**" },
      { protocol: "https", hostname: "*.samsung.com", pathname: "/**" },
      { protocol: "https", hostname: "*.vivo.com", pathname: "/**" },
      { protocol: "https", hostname: "*.vivoglobal.com", pathname: "/**" },
      { protocol: "https", hostname: "*.oppo.com", pathname: "/**" },
      { protocol: "https", hostname: "image01.oneplus.net", pathname: "/**" },
      { protocol: "https", hostname: "*.oneplus.com", pathname: "/**" },
      { protocol: "https", hostname: "*.motorola.com", pathname: "/**" },
      { protocol: "https", hostname: "*.nothing.tech", pathname: "/**" },
      { protocol: "https", hostname: "*.flipkart.com", pathname: "/**" },
      { protocol: "https", hostname: "*.flixcart.com", pathname: "/**" },
      { protocol: "https", hostname: "m.media-amazon.com", pathname: "/**" },
      { protocol: "https", hostname: "*.ssl-images-amazon.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
