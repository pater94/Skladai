import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Build ID wstrzyknięty z Vercela (krótki commit SHA) — pokazywany w Profilu
  // przy przycisku "Aktualizuj", żeby user mógł zweryfikować że apka wskoczyła
  // na nowszą wersję. Lokalnie/poza Vercelem → "dev".
  env: {
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
  },
  // Capacitor / WKWebView aggressively caches HTML and old chunks. Force the
  // hybrid app shell, the API responses, and the dynamic result pages to
  // revalidate on every load so users always pick up the latest deploy.
  async headers() {
    // Globalne nagłówki bezpieczeństwa (App Store/Play + automaty bezpieczeństwa
    // je sprawdzają). Świadomie BEZ sztywnego CSP — WebView Capacitora + Next
    // hydration łatwo zepsuć, a teksty od AI renderujemy jako React text (auto-
    // escape), więc ryzyko XSS jest niskie. CSP do dodania osobno z testami.
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "browsing-topics=(), interest-cohort=()" },
    ];
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
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
