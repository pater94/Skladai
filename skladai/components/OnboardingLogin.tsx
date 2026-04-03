"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface OnboardingLoginProps {
  onSkip: () => void;
}

const cards = [
  { icon: "💰", title: "Oszczędzaj na zakupach", desc: "Znajdź tańsze produkty z tym samym składem. Nie przepłacaj za logo.", color: "#FBBF24", bg: "rgba(251,191,36,0.06)" },
  { icon: "🛡️", title: "Chroń swoje zdrowie", desc: "AI ostrzeże Cię przed alergenami i szkodliwymi składnikami zanim kupisz.", color: "#6efcb4", bg: "rgba(110,252,180,0.06)" },
  { icon: "📈", title: "Kontroluj formę", desc: "Śledź kalorie, makro i postępy. Lepsza forma zaczyna się od etykiety.", color: "#3b82f6", bg: "rgba(59,130,246,0.06)" },
];

function ScannerLogo({ size = 72, filterId = "glow" }: { size?: number; filterId?: string }) {
  return (
    <div style={{ width: size, height: size, margin: "0 auto", position: "relative" }}>
      <div style={{ position: "absolute", inset: -10, background: "radial-gradient(circle, rgba(110,252,180,0.2), transparent 70%)", animation: "breathe 3s ease-in-out infinite" }} />
      <svg width={size} height={size} viewBox="0 0 512 512" style={{ position: "relative" }}>
        <defs>
          <filter id={filterId}><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width="512" height="512" rx="108" fill="#0a0f0d" />
        <circle cx="256" cy="256" r="200" fill="rgba(110,252,180,0.05)" />
        <g stroke="#6efcb4" strokeWidth="16" strokeLinecap="round" fill="none" filter={`url(#${filterId})`}>
          <path d="M120 200 L120 140 Q120 120 140 120 L200 120" />
          <path d="M312 120 L372 120 Q392 120 392 140 L392 200" />
          <path d="M392 312 L392 372 Q392 392 372 392 L312 392" />
          <path d="M200 392 L140 392 Q120 392 120 372 L120 312" />
        </g>
        <line x1="150" y1="256" x2="362" y2="256" stroke="#6efcb4" strokeWidth="3" opacity="0.3" />
        <text x="256" y="290" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="900" fontSize="180" fill="#6efcb4">S</text>
      </svg>
    </div>
  );
}

export default function OnboardingLogin({ onSkip }: OnboardingLoginProps) {
  const [slide, setSlide] = useState(0);
  const [activeCard, setActiveCard] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [activeQuote, setActiveQuote] = useState(0);
  const handleAppleSignIn = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        console.error("Apple sign in error:", error.message);
      }
    } catch (e) {
      console.error("Apple sign in failed:", e);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        console.error("Google sign in error:", error.message);
      }
    } catch (e) {
      console.error("Google sign in failed:", e);
    }
  };

  useEffect(() => {
    if (slide === 0) {
      const interval = setInterval(() => setActiveCard(c => (c + 1) % 3), 3000);
      return () => clearInterval(interval);
    }
  }, [slide]);

  useEffect(() => {
    if (slide === 1) {
      const interval = setInterval(() => setActiveQuote(q => (q + 1) % 2), 4000);
      return () => clearInterval(interval);
    }
  }, [slide]);

  const next = () => { if (slide < 2) setSlide(slide + 1); };

  const slideBase = (index: number): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    padding: "12px 22px 0",
    opacity: slide === index ? 1 : 0,
    transform: slide === index ? "translateX(0)" : slide > index ? "translateX(-30px)" : "translateX(30px)",
    transition: "all 0.4s cubic-bezier(.4,0,.2,1)",
    pointerEvents: slide === index ? "auto" : "none",
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
    overflowY: "auto",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "#0a0e0c", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Safe area top spacer */}
      <div style={{ height: 50, flexShrink: 0 }} />

      {/* Slides container */}
      <div
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const diff = touchStart - e.changedTouches[0].clientX;
          if (diff > 50 && slide < 2) setSlide(slide + 1);
          if (diff < -50 && slide > 0) setSlide(slide - 1);
        }}
      >

        {/* SLIDE A — Value Cards */}
        <div style={slideBase(0)}>
          <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", width: 350, height: 220, background: "radial-gradient(ellipse at 30% 40%, rgba(110,252,180,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(59,130,246,0.05) 0%, transparent 50%)", pointerEvents: "none" }} />

          <div style={{ textAlign: "center", marginBottom: 8, position: "relative" }}>
            <div style={{ marginBottom: 12 }}>
              <ScannerLogo size={72} filterId="glowA" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Skład<span style={{ color: "#6efcb4" }}>AI</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: "28px" }}>
              Twój osobisty{" "}
              <span style={{ background: "linear-gradient(135deg, #6efcb4, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ekspert składu</span>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {cards.map((c, i) => (
              <div key={i} onClick={() => setActiveCard(i)} style={{
                display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 14px", marginBottom: 7, borderRadius: 16, cursor: "pointer",
                background: activeCard === i ? c.bg : "rgba(255,255,255,0.015)",
                border: activeCard === i ? `1.5px solid ${c.color}25` : "1.5px solid rgba(255,255,255,0.04)",
                transform: activeCard === i ? "scale(1.01)" : "scale(1)",
                transition: "all 0.5s cubic-bezier(.4,0,.2,1)",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: activeCard === i ? `${c.color}15` : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, transition: "all 0.4s ease" }}>{c.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: activeCard === i ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)", transition: "color 0.3s ease", marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 12.5, lineHeight: "17px", color: activeCard === i ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.55)", transition: "color 0.3s ease" }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SLIDE B — Social Proof */}
        <div style={slideBase(1)}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280, background: "linear-gradient(180deg, rgba(110,252,180,0.06) 0%, transparent 100%)", pointerEvents: "none" }} />

          <div style={{ textAlign: "center", marginBottom: 20, position: "relative" }}>
            <div style={{ marginBottom: 14 }}>
              <ScannerLogo size={72} filterId="glowB" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 6 }}>
              Sprawdzone przez tysiące
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              Dołącz do społeczności świadomych konsumentów
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[
              { num: "2 min", desc: "Wystarczą żeby sprawdzić produkt", color: "#6efcb4" },
              { num: "~340 zł", desc: "Oszczędzasz rocznie na lepszych wyborach", color: "#FBBF24" },
              { num: "100%", desc: "Darmowe skanowanie bez limitów", color: "#3b82f6" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: "16px 8px", borderRadius: 14, textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginBottom: 5, letterSpacing: "-0.02em" }}>{s.num}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", lineHeight: "14px" }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", position: "relative", minHeight: 110 }}>
            <div style={{ position: "absolute", top: -6, left: 16, fontSize: 28, color: "rgba(110,252,180,0.35)", fontWeight: 900 }}>&ldquo;</div>
            {[
              { text: "Dzięki SkładAI wybieram suplementy mądrzej — znalazłem tańsze zamienniki i odstawiłem te, które nie działają.", author: "— Paweł, użytkownik SkładAI" },
              { text: "Dzięki SkładAI przestałam przepłacać za kosmetyki. Znalazłam zamienniki z lepszym składem.", author: "— Kasia, użytkowniczka SkładAI" },
            ].map((q, i) => (
              <div key={i} style={{ position: i === 0 ? "relative" : "absolute", top: i === 0 ? undefined : 16, left: i === 0 ? undefined : 18, right: i === 0 ? undefined : 18, opacity: activeQuote === i ? 1 : 0, transition: "opacity 0.4s ease" }}>
                <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: "20px", fontStyle: "italic", padding: "4px 0" }}>
                  {q.text}
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 8, fontStyle: "normal" }}>
                  {q.author}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SLIDE C — Login */}
        <div style={slideBase(2)}>
          <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", width: 300, height: 180, background: "radial-gradient(ellipse, rgba(110,252,180,0.1), transparent 70%)", animation: "breathe 3s ease-in-out infinite", pointerEvents: "none" }} />

          <div style={{ textAlign: "center", marginBottom: 20, position: "relative" }}>
            <div style={{ marginBottom: 16 }}>
              <ScannerLogo size={76} filterId="glowC" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: "32px", marginBottom: 8 }}>
              Jedz mądrzej.{" "}
              <span style={{ background: "linear-gradient(135deg, #6efcb4, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Oszczędzaj więcej.</span>
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
              Buduj formę świadomie.
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 22, flexWrap: "wrap" }}>
            {[
              { emoji: "💰", text: "Oszczędzaj", color: "#FBBF24" },
              { emoji: "🛡️", text: "Chroń zdrowie", color: "#6efcb4" },
              { emoji: "📈", text: "Kontroluj formę", color: "#3b82f6" },
            ].map((p, i) => (
              <div key={i} style={{ padding: "8px 14px", borderRadius: 20, background: `${p.color}0A`, border: `1px solid ${p.color}20`, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12 }}>{p.emoji}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: p.color }}>{p.text}</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginBottom: 22, padding: 18, borderRadius: 18, background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.1)" }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: "#FBBF24", marginBottom: 4, letterSpacing: "-0.03em" }}>~340 zł</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>tyle oszczędzasz rocznie wybierając mądrzej</div>
          </div>

          {/* Google */}
          <button onClick={handleGoogleSignIn} style={{ width: "100%", padding: 15, borderRadius: 14, background: "rgba(255,255,255,0.5)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span style={{ fontWeight: 700, fontSize: 14.5, color: "#333" }}>Kontynuuj z Google</span>
          </button>

          {/* Apple */}
          <button onClick={handleAppleSignIn} style={{ width: "100%", padding: 15, borderRadius: 14, background: "#000", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            <span style={{ fontWeight: 700, fontSize: 14.5, color: "#fff" }}>Kontynuuj z Apple</span>
          </button>

          {/* Skip */}
          <div style={{ textAlign: "center" }}>
            <button onClick={onSkip} style={{ background: "none", border: "none", fontSize: 12.5, color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>Pomiń — korzystaj bez konta</button>
          </div>

          {/* Privacy */}
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
            Logując się akceptujesz{" "}
            <Link href="/privacy" style={{ textDecoration: "underline", color: "inherit" }}>Politykę prywatności</Link>
          </div>
        </div>
      </div>

      {/* Bottom — Dots + Dalej */}
      <div style={{ padding: "0 22px 32px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} onClick={() => setSlide(i)} style={{
              width: slide === i ? 24 : 6, height: 6, borderRadius: 3,
              background: slide === i ? "#6efcb4" : "rgba(255,255,255,0.1)",
              transition: "all 0.3s ease", cursor: "pointer",
              boxShadow: slide === i ? "0 0 8px rgba(110,252,180,0.4)" : "none",
            }} />
          ))}
        </div>

        {slide < 2 && (
          <button onClick={next} style={{
            width: "100%", padding: 16, borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #6efcb4, #3dd990)",
            color: "#0a0f0d", fontWeight: 800, fontSize: 15, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(110,252,180,0.2)",
          }}>
            Dalej →
          </button>
        )}
      </div>
    </div>
  );
}
