import type { NextConfig } from "next";

const backendInternalUrl = (
  process.env.SAUNA_BACKEND_INTERNAL_URL ??
  process.env.SAUNA_API_INTERNAL_URL ??
  (process.env.NODE_ENV === "production" ? "https://api.sauna.wrenzeal.top" : "http://127.0.0.1:19588")
).replace(/\/$/, "");

const allowedDevOrigins = (process.env.SAUNA_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    return [
      {
        source: "/api/sauna/:path*",
        destination: `${backendInternalUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
