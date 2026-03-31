"use client";

import { useState } from "react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const mint = "#6efcb4";

const SLIDES = [
  {
    icon: "📸",
    title: "Skanuj etykietę",
    desc: "Zrób zdjęcie etykiety — AI przeanalizuje skład i powie Ci co naprawdę jesz.",
    color: mint,
    color2: "#3dd990",
    ambientRgb: "110,252,180",
  },
  {
    icon: "✨",
    title: "Sprawdź kosmetyki",
    desc: "Sprawdź co nakładasz na skórę. AI oceni bezpieczeństwo każdego składnika.",
    color: "#C084FC",
    color2: "#7c3aed",
    ambientRgb: "192,132,252",
  },
  {
    icon: "💊",
    title: "Oceń suplementy",
    desc: "Sprawdź jakość i dawkowanie suplementów. Wykryjemy tanie wypełniacze.",
    color: "#3b82f6",
    color2: "#1d4ed8",
    ambientRgb: "59,130,246",
  },
  {
    icon: "🎯",
    title: "Twój profil zdrowotny",
    desc: "Uzupełnij profil — AI dostosuje analizę do Twoich alergii i celów.",
    color: "#FBBF24",
    color2: "#f59e0b",
    ambientRgb: "251,191,36",
  },
];

export default function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [current, setCurrent] = useState(0);

  const finish = () => {
    localStorage.setItem("onboardingCompleted", "true");
    onComplete();
  };

  const handleNext = () => {
    if (current < SLIDES.length - 1) setCurrent(current + 1);
    else finish();
  };

  const slide = SLIDES[current];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: "#0a0e0c" }}
    >
      <div style={{ padding: "20px 24px 30px", position: "relative", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Ambient */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -30, left: "50%", transform: "translateX(-50%)",
            width: 350, height: 250,
            background: `radial-gradient(ellipse, rgba(${slide.ambientRgb},0.1), transparent 65%)`,
            transition: "background 0.5s ease",
          }}
        />

        <div style={{ textAlign: "center", paddingTop: 60, position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Icon */}
          <div style={{
            width: 100, height: 100, margin: "0 auto 24px", borderRadius: 28,
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 44,
          }}>
            {slide.icon}
          </div>

          {/* Title */}
          <div
            key={`t-${current}`}
            style={{
              fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10,
              animation: "fadeSlide 0.5s ease both",
            }}
          >
            {slide.title}
          </div>

          {/* Description */}
          <div
            key={`d-${current}`}
            style={{
              fontSize: 14, color: "rgba(255,255,255,0.4)",
              lineHeight: "21px", maxWidth: 280, margin: "0 auto 40px",
              animation: "fadeSlide 0.5s ease 0.1s both",
            }}
          >
            {slide.desc}
          </div>

          <div style={{ marginTop: "auto", width: "100%", maxWidth: 340 }}>
            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32 }}>
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrent(i)}
                  style={{
                    width: i === current ? 24 : 6,
                    height: 6, borderRadius: 3,
                    background: i === current ? slide.color : "rgba(255,255,255,0.1)",
                    transition: "all 0.4s cubic-bezier(.4,0,.2,1)",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            {/* Gradient border button */}
            <div style={{
              position: "relative", borderRadius: 15, padding: 2,
              background: `linear-gradient(135deg, ${slide.color}, ${slide.color2})`,
              backgroundSize: "200% 200%",
              animation: "gradientShift 3s ease infinite",
              marginBottom: 12,
            }}>
              <button
                onClick={handleNext}
                style={{
                  width: "100%", padding: 15, borderRadius: 13,
                  border: "none", background: "#0a0e0c",
                  color: slide.color, fontWeight: 800, fontSize: 15,
                  cursor: "pointer",
                }}
              >
                {current < SLIDES.length - 1 ? "Dalej →" : "Zaczynamy! 🚀"}
              </button>
            </div>

            {/* Skip */}
            {current < SLIDES.length - 1 && (
              <button
                onClick={finish}
                style={{
                  display: "block", width: "100%", textAlign: "center",
                  background: "none", border: "none",
                  color: "rgba(255,255,255,0.2)", fontSize: 13, cursor: "pointer",
                }}
              >
                Pomiń
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
