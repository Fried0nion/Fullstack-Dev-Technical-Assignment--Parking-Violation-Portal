import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy /api/* to the Go backend so the browser never has to deal
  // with CORS during local development.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:8080/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
