"use client";

import { useState, useEffect } from "react";

interface LoginScreenProps {
  onSkip: () => void;
}

const VALUE_CARDS = [
  {
    icon: "💰",
    title: "Oszczędzaj na zakupach",
    desc: "Znajdź tańsze produkty z tym samym składem. Nie przepłacaj za logo.",
    color: "#FBBF24",
    bgActive: "rgba(251,191,36,0.06)",
    borderActive: "rgba(251,191,36,0.25)",
  },
  {
    icon: "🛡️",
    title: "Chroń swoje zdrowie",
    desc: "AI ostrzeże Cię przed alergenami i szkodliwymi składnikami zanim kupisz.",
    color: "#6efcb4",
    bgActive: "rgba(110,252,180,0.06)",
    borderActive: "rgba(110,252,180,0.25)",
  },
  {
    icon: "📈",
    title: "Kontroluj formę",
    desc: "Śledź kalorie, makro i postępy. Lepsza forma zaczyna się od etykiety.",
    color: "#3b82f6",
    bgActive: "rgba(59,130,246,0.06)",
    borderActive: "rgba(59,130,246,0.25)",
  },
];

export default function LoginScreen({ onSkip }: LoginScreenProps) {
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % VALUE_CARDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center relative overflow-hidden"
      style={{ background: "#0a0f0d" }}
    >
      {/* 1. Ambient mesh */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-30px",
          left: "50%",
          transform: "translateX(-50%)",
          width: 350,
          height: 220,
          background: "radial-gradient(ellipse at 30% 40%, rgba(110,252,180,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(59,130,246,0.05) 0%, transparent 50%)",
        }}
      />

      <div className="flex flex-col items-center z-10 w-full max-w-sm px-6 pt-14">
        {/* 2. Logo Scanner Mint with glow */}
        <div className="relative" style={{ width: 78, height: 78, marginBottom: 14 }}>
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(circle, rgba(110,252,180,0.2), transparent 70%)",
              animation: "breathe 3s ease-in-out infinite",
            }}
          />
          <div
            className="relative w-full h-full rounded-[20px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
          >
            <svg width="42" height="42" viewBox="0 0 44 44" fill="none">
              <path d="M6 14V8a2 2 0 012-2h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M30 6h6a2 2 0 012 2v6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M38 30v6a2 2 0 01-2 2h-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M14 38H8a2 2 0 01-2-2v-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <text x="22" y="28" textAnchor="middle" fill="white" fontSize="20" fontWeight="800" fontFamily="-apple-system, system-ui, sans-serif">S</text>
            </svg>
          </div>
        </div>

        {/* 3. Nazwa apki */}
        <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
          Skład<span style={{ color: "#6efcb4" }}>AI</span>
        </p>

        {/* 4. Główny nagłówek */}
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 4 }}>
          Twój osobisty
        </h1>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 24, background: "linear-gradient(135deg, #6efcb4, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          ekspert składu
        </h1>

        {/* 5. Karty wartości — 3 zawsze widoczne */}
        <div className="w-full" style={{ marginBottom: 24 }}>
          {VALUE_CARDS.map((card, i) => {
            const isActive = activeCard === i;
            return (
              <button
                key={i}
                onClick={() => setActiveCard(i)}
                className="w-full text-left flex items-start"
                style={{
                  padding: "14px 15px",
                  borderRadius: 16,
                  gap: 12,
                  marginBottom: 8,
                  background: isActive ? card.bgActive : "rgba(255,255,255,0.015)",
                  border: `1.5px solid ${isActive ? card.borderActive : "rgba(255,255,255,0.04)"}`,
                  transform: isActive ? "scale(1.01)" : "scale(1)",
                  transition: "all 0.5s cubic-bezier(.4,0,.2,1)",
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 42, height: 42, borderRadius: 12, background: isActive ? `${card.color}15` : "rgba(255,255,255,0.03)" }}
                >
                  <span style={{ fontSize: 22 }}>{card.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                    marginBottom: 2,
                    transition: "color 0.5s cubic-bezier(.4,0,.2,1)",
                  }}>
                    {card.title}
                  </p>
                  <p style={{
                    fontSize: 12.5,
                    lineHeight: "17px",
                    color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)",
                    transition: "color 0.5s cubic-bezier(.4,0,.2,1)",
                  }}>
                    {card.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="z-10 w-full max-w-sm px-6 pb-8 mt-auto flex flex-col items-center">
        {/* 6. Przycisk Google */}
        <button
          className="w-full flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
          style={{
            padding: 15,
            borderRadius: 14,
            background: "#fff",
            border: "none",
            marginBottom: 10,
          }}
          onClick={() => { /* TODO: Supabase Auth — Google */ }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: "#333" }}>Kontynuuj z Google</span>
        </button>

        {/* 7. Przycisk Apple */}
        <button
          className="w-full flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
          style={{
            padding: 15,
            borderRadius: 14,
            background: "#000",
            border: "1px solid rgba(255,255,255,0.12)",
            marginBottom: 18,
          }}
          onClick={() => { /* TODO: Supabase Auth — Apple */ }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22" fill="white">
            <path d="M14.94 11.58c-.02-2.27 1.85-3.36 1.93-3.41-1.05-1.54-2.69-1.75-3.27-1.77-1.39-.14-2.72.82-3.43.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.89-3.71 2.26-1.59 2.75-.41 6.83 1.14 9.07.76 1.1 1.66 2.33 2.84 2.29 1.14-.05 1.57-.74 2.95-.74 1.38 0 1.77.74 2.97.71 1.23-.02 2.01-1.12 2.75-2.22.87-1.27 1.23-2.51 1.25-2.57-.03-.01-2.4-.92-2.42-3.66h-.04zM12.68 4.56c.63-.76 1.05-1.82.93-2.88-.9.04-1.99.6-2.64 1.36-.58.67-1.08 1.74-.95 2.77 1 .08 2.03-.51 2.66-1.25z" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: "#fff" }}>Kontynuuj z Apple</span>
        </button>

        {/* 8. Link pominięcia */}
        <button
          onClick={onSkip}
          style={{ fontSize: 12.5, color: "rgba(255,255,255,0.25)", cursor: "pointer", background: "none", border: "none" }}
        >
          Pomiń — korzystaj bez konta
        </button>

        {/* 9. Polityka prywatności */}
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", marginTop: 14, textAlign: "center" }}>
          Logując się akceptujesz{" "}
          <a href="/privacy" style={{ textDecoration: "underline", color: "rgba(255,255,255,0.12)" }}>Politykę prywatności</a>
        </p>
      </div>
    </div>
  );
}
