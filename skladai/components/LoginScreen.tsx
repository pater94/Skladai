"use client";

import { useState, useEffect } from "react";

interface LoginScreenProps {
  onSkip: () => void;
}

const cards = [
  { icon: "💰", title: "Oszczędzaj na zakupach", desc: "Znajdź tańsze produkty z tym samym składem. Nie przepłacaj za logo.", color: "#FBBF24", bg: "rgba(251,191,36,0.06)" },
  { icon: "🛡️", title: "Chroń swoje zdrowie", desc: "AI ostrzeże Cię przed alergenami i szkodliwymi składnikami zanim kupisz.", color: "#6efcb4", bg: "rgba(110,252,180,0.06)" },
  { icon: "📈", title: "Kontroluj formę", desc: "Śledź kalorie, makro i postępy. Lepsza forma zaczyna się od etykiety.", color: "#3b82f6", bg: "rgba(59,130,246,0.06)" },
];

export default function LoginScreen({ onSkip }: LoginScreenProps) {
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActiveCard(c => (c + 1) % 3), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0e0c", position: "relative", overflow: "hidden" }}>
      <div style={{ padding: "12px 22px 28px", position: "relative", overflow: "hidden" }}>
        {/* Ambient */}
        <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", width: 350, height: 220, background: "radial-gradient(ellipse at 30% 40%, rgba(110,252,180,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(59,130,246,0.05) 0%, transparent 50%)", pointerEvents: "none" }} />

        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 10, position: "relative" }}>
          <div style={{ width: 78, height: 78, margin: "0 auto 14px", position: "relative" }}>
            <div style={{ position: "absolute", inset: -12, background: "radial-gradient(circle, rgba(110,252,180,0.2), transparent 70%)", animation: "breathe 3s ease-in-out infinite" }} />
            <svg width="78" height="78" viewBox="0 0 512 512" style={{ position: "relative" }}>
              <defs><filter id="iconGlow"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              <rect width="512" height="512" rx="108" fill="#0a0f0d" />
              <circle cx="256" cy="256" r="200" fill="rgba(110,252,180,0.05)" />
              <g stroke="#6efcb4" strokeWidth="16" strokeLinecap="round" fill="none" filter="url(#iconGlow)">
                <path d="M120 200 L120 140 Q120 120 140 120 L200 120" /><path d="M312 120 L372 120 Q392 120 392 140 L392 200" />
                <path d="M392 312 L392 372 Q392 392 372 392 L312 392" /><path d="M200 392 L140 392 Q120 392 120 372 L120 312" />
              </g>
              <line x1="150" y1="256" x2="362" y2="256" stroke="#6efcb4" strokeWidth="3" opacity="0.3" />
              <text x="256" y="290" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="900" fontSize="180" fill="#6efcb4">S</text>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            Skład<span style={{ color: "#6efcb4" }}>AI</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: "30px" }}>
            Twój osobisty{" "}<span style={{ background: "linear-gradient(135deg, #6efcb4, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ekspert składu</span>
          </div>
        </div>

        {/* Value cards */}
        <div style={{ marginBottom: 24, marginTop: 20 }}>
          {cards.map((c, i) => (
            <div key={i} onClick={() => setActiveCard(i)} style={{
              display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 15px", marginBottom: 8, borderRadius: 16, cursor: "pointer",
              background: activeCard === i ? c.bg : "rgba(255,255,255,0.015)",
              border: activeCard === i ? `1.5px solid ${c.color}25` : "1.5px solid rgba(255,255,255,0.04)",
              transform: activeCard === i ? "scale(1.01)" : "scale(1)",
              transition: "all 0.5s cubic-bezier(.4,0,.2,1)",
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: activeCard === i ? `${c.color}15` : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0, transition: "all 0.4s ease" }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: activeCard === i ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)", transition: "color 0.3s ease", marginBottom: 3 }}>{c.title}</div>
                <div style={{ fontSize: 12.5, lineHeight: "17px", color: activeCard === i ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)", transition: "color 0.3s ease" }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Google */}
        <button style={{ width: "100%", padding: 15, borderRadius: 14, background: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", marginBottom: 10 }} onClick={() => { /* TODO: Supabase Auth — Google */ }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: "#333" }}>Kontynuuj z Google</span>
        </button>

        {/* Apple */}
        <button style={{ width: "100%", padding: 15, borderRadius: 14, background: "#000", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", marginBottom: 18 }} onClick={() => { /* TODO: Supabase Auth — Apple */ }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: "#fff" }}>Kontynuuj z Apple</span>
        </button>

        {/* Skip */}
        <div style={{ textAlign: "center" }}>
          <button onClick={onSkip} style={{ background: "none", border: "none", fontSize: 12.5, color: "rgba(255,255,255,0.25)", cursor: "pointer" }}>Pomiń — korzystaj bez konta</button>
        </div>

        {/* Privacy */}
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 10, color: "rgba(255,255,255,0.12)" }}>
          Logując się akceptujesz <a href="/privacy" style={{ textDecoration: "underline", color: "inherit" }}>Politykę prywatności</a>
        </div>
      </div>
    </div>
  );
}
