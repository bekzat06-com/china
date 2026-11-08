import type { NextConfig } from "next";

// Заголовки безопасности для всех ответов
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // импорт Excel/CSV до 5 МБ (с запасом на служебные данные)
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  // standalone-сборка нужна только для Docker-образа (см. Dockerfile)
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
