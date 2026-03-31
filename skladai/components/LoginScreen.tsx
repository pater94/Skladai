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
    accent: "#10b981",
  },
  {
    icon: "🛡️",
    title: "Chroń swoje zdrowie",
    desc: "AI ostrzeże Cię przed alergenami i szkodliwymi składnikami zanim kupisz.",
    accent: "#3b82f6",
  },
  {
    icon: "📈",
    title: "Kontroluj formę",
    desc: "Śledź kalorie, makro i postępy. Lepsza forma zaczyna się od etykiety.",
    accent: "#C084FC",
  },
];

export default function LoginScreen({ onSkip }: LoginScreenProps) {
  const [activeCard, setActiveCard] = useState(0);

  // Auto-rotate value cards every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % VALUE_CARDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-between relative overflow-hidden"
      style={{ background: "#0a0f0d" }}
    >
      {/* Ambient mesh background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[300px] h-[300px] rounded-full opacity-20 blur-[100px]"
          style={{
            background: "radial-gradient(circle, #10b981, transparent)",
            top: "-80px",
            left: "-60px",
            animation: "float1 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[250px] h-[250px] rounded-full opacity-15 blur-[80px]"
          style={{
            background: "radial-gradient(circle, #06b6d4, transparent)",
            bottom: "10%",
            right: "-40px",
            animation: "float2 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[200px] h-[200px] rounded-full opacity-10 blur-[90px]"
          style={{
            background: "radial-gradient(circle, #6efcb4, transparent)",
            top: "40%",
            left: "30%",
            animation: "float3 12s ease-in-out infinite",
          }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col items-center z-10 w-full max-w-sm px-6 pt-16">
        {/* Logo with breathe glow */}
        <div
          className="w-20 h-20 rounded-[22px] flex items-center justify-center mb-5"
          style={{
            background: "linear-gradient(135deg, #059669, #10b981)",
            animation: "breathe 3s ease-in-out infinite",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <path d="M6 14V8a2 2 0 012-2h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M30 6h6a2 2 0 012 2v6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M38 30v6a2 2 0 01-2 2h-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M14 38H8a2 2 0 01-2-2v-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <text x="22" y="28" textAnchor="middle" fill="white" fontSize="20" fontWeight="800" fontFamily="-apple-system, system-ui, sans-serif">S</text>
          </svg>
        </div>

        {/* Brand */}
        <h1
          className="text-[32px] font-black tracking-tight mb-1"
          style={{
            background: "linear-gradient(135deg, #6efcb4, #10b981, #06b6d4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          SkładAI
        </h1>
        <p className="text-[14px] font-medium mb-10">
          <span className="text-gray-500">Twój osobisty </span>
          <span
            style={{
              background: "linear-gradient(135deg, #6efcb4, #3b82f6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ekspert składu
          </span>
        </p>

        {/* Value cards — ALL 3 always visible, active one highlighted */}
        <div className="w-full space-y-2.5 mb-6">
          {VALUE_CARDS.map((card, i) => {
            const isActive = activeCard === i;
            return (
              <button
                key={i}
                onClick={() => setActiveCard(i)}
                className="w-full text-left p-4 rounded-2xl border transition-all duration-500"
                style={{
                  background: isActive ? `rgba(${card.accent === "#10b981" ? "16,185,129" : card.accent === "#3b82f6" ? "59,130,246" : "192,132,252"},0.08)` : "rgba(255,255,255,0.02)",
                  borderColor: isActive ? `rgba(${card.accent === "#10b981" ? "16,185,129" : card.accent === "#3b82f6" ? "59,130,246" : "192,132,252"},0.25)` : "rgba(255,255,255,0.04)",
                  opacity: isActive ? 1 : 0.45,
                }}
              >
                <div className="flex items-start gap-3.5">
                  <span className="text-[28px] flex-shrink-0">{card.icon}</span>
                  <div>
                    <p className={`font-bold text-[14px] mb-0.5 transition-colors duration-500 ${isActive ? "text-white" : "text-white/50"}`}>
                      {card.title}
                    </p>
                    <p className={`text-[12px] leading-snug transition-colors duration-500 ${isActive ? "text-gray-400" : "text-gray-600"}`}>
                      {card.desc}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="z-10 w-full max-w-sm px-6 pb-10 flex flex-col items-center gap-3">
        {/* Google sign-in */}
        <button
          className="w-full py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-3 border transition-all active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.12)",
            color: "#fff",
          }}
          onClick={() => { /* TODO: Supabase Auth — Google */ }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Kontynuuj z Google
        </button>

        {/* Apple sign-in */}
        <button
          className="w-full py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-3 border transition-all active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.12)",
            color: "#fff",
          }}
          onClick={() => { /* TODO: Supabase Auth — Apple */ }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22" fill="white">
            <path d="M14.94 11.58c-.02-2.27 1.85-3.36 1.93-3.41-1.05-1.54-2.69-1.75-3.27-1.77-1.39-.14-2.72.82-3.43.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.89-3.71 2.26-1.59 2.75-.41 6.83 1.14 9.07.76 1.1 1.66 2.33 2.84 2.29 1.14-.05 1.57-.74 2.95-.74 1.38 0 1.77.74 2.97.71 1.23-.02 2.01-1.12 2.75-2.22.87-1.27 1.23-2.51 1.25-2.57-.03-.01-2.4-.92-2.42-3.66h-.04zM12.68 4.56c.63-.76 1.05-1.82.93-2.88-.9.04-1.99.6-2.64 1.36-.58.67-1.08 1.74-.95 2.77 1 .08 2.03-.51 2.66-1.25z" />
          </svg>
          Kontynuuj z Apple
        </button>

        {/* Skip link */}
        <button
          onClick={onSkip}
          className="mt-2 text-[13px] text-gray-500 font-medium hover:text-gray-400 transition-colors"
        >
          Pomiń — korzystaj bez konta
        </button>

        {/* Privacy */}
        <p className="text-[11px] text-gray-600 text-center mt-1 leading-relaxed">
          Logując się, akceptujesz{" "}
          <span className="text-emerald-500/70 underline">regulamin</span> i{" "}
          <span className="text-emerald-500/70 underline">politykę prywatności</span>
        </p>
      </div>
    </div>
  );
}
