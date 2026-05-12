/**
 * Loading state dla /wyniki/[id] — kluczowe dla iOS WKWebView.
 *
 * Bez tego pliku Next.js zwraca pusty HTML shell podczas SSR
 * /wyniki/[id] (dynamic route). Jeśli Vercel serverless function
 * ma cold start, WKWebView czeka na response, po swoim ~30s
 * timeout pokazuje native "This page couldn't load" error. User
 * widzi pustą czarną stronę z błędem zamiast zrozumieć że apka
 * pracuje.
 *
 * Ten loader renderuje się NATYCHMIAST gdy router.push("/wyniki/X")
 * triggeruje nawigację — Next.js streams loading.tsx zanim
 * serverside page komponent się skończy. WKWebView dostaje
 * natychmiast valid HTML → nigdy nie pokazuje native error.
 */
export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0e0c",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
    >
      {/* Spinning mint ring — matches the rest of the app's loaders */}
      <div
        style={{
          width: 48,
          height: 48,
          border: "4px solid rgba(110,252,180,0.18)",
          borderTopColor: "#6efcb4",
          borderRadius: "50%",
          animation: "wynikiLoadSpin 0.9s linear infinite",
        }}
      />
      <p
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 600,
          letterSpacing: 0.2,
        }}
      >
        Ładuję wynik...
      </p>
      <style>{`
        @keyframes wynikiLoadSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
