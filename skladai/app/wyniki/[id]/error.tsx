"use client";

/**
 * Error boundary dla /wyniki/[id]. Łapie cracha w render layer
 * (np. malformed result w localStorage, brakujący field, runtime
 * error w jakimś sub-komponencie).
 *
 * Bez tego user widzi WKWebView native error page ("This page
 * couldn't load") zamiast czytelnego "spróbuj ponownie" UI.
 *
 * Render dopasowany stylistycznie do reszty aplikacji: dark bg,
 * mint accent, glass cards.
 */
import { useEffect } from "react";

export default function WynikiError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Zaloguj do konsoli — w produkcji Sentry/Vercel logs to wyłapie
    console.error("[/wyniki/[id]] render error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0e0c",
        display: "flex",
        flexDirection: "column",
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
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(110,252,180,0.08)",
            border: "1px solid rgba(110,252,180,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
            fontSize: 26,
          }}
        >
          ⚠️
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#ffffff",
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
          Nie udało się wyświetlić wyniku skanu. Najczęściej pomaga ponowna próba lub
          powrót na stronę główną i zeskanowanie produktu jeszcze raz.
        </p>
        <button
          onClick={reset}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 16,
            background: "linear-gradient(135deg,#6efcb4 0%,#3dd990 100%)",
            color: "#0a0e0c",
            fontWeight: 800,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 6px 22px rgba(110,252,180,0.25)",
          }}
        >
          Spróbuj ponownie
        </button>
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.href = "/";
          }}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "12px 18px",
            borderRadius: 14,
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            fontWeight: 600,
            fontSize: 13,
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
          }}
        >
          Wróć do skanera
        </button>
      </div>
    </div>
  );
}
