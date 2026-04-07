import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Capacitor / WKWebView aggressively caches HTML and old chunks. Force the
  // hybrid app shell, the API responses, and the dynamic result pages to
  // revalidate on every load so users always pick up the latest deploy.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/wyniki/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
