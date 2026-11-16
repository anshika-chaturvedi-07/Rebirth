import type { NextConfig } from "next";

// The browser talks to /api on the same origin; Next.js forwards it to FastAPI.
// Same-origin requests keep the httpOnly session cookie simple and secure.
const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
