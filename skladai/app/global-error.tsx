"use client";

/**
 * Global error boundary — łapie najwyższy poziom React errors
 * gdy nawet RootLayout się wywali (rzadkie ale możliwe).
 *
 * Musi renderować własny <html>+<body> bo zastępuje cały root.
 * Bez tego użytkownik w Capacitor WKWebView dostaje native
 * "This page couldn't load" — fatal UX dla app store review.
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError] root crash:", error);
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "var(--bg, #0a0e0c)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 360,
            width: "100%",
            padding: 28,
            borderRadius: 22,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 36,
              marginBottom: 14,
            }}
          >
            ⚠️
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: 0,
              marginBottom: 10,
              letterSpacing: "-0.01em",
            }}
          >
            Coś poszło nie tak
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.55,
              margin: 0,
              marginBottom: 22,
            }}
          >
            Aplikacja napotkała nieoczekiwany błąd. Spróbuj ponownie albo zrestartuj
            aplikację.
          </p>
          <button
            onClick={reset}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 16,
              background: "linear-gradient(135deg,var(--c-mint, #6efcb4) 0%,var(--c-green-2, #3dd990) 100%)",
              color: "var(--c-ink, #0a0e0c)",
              fontWeight: 800,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 6px 22px rgba(var(--c-mint-rgb, 110,252,180), 0.25)",
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  );
}
