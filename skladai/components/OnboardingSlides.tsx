"use client";

import { useState } from "react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const SLIDES = [
  { icon: "📸", title: "Zeskanuj etykietę", desc: "Zrób zdjęcie składu produktu — żywności, kosmetyku lub suplementu", color: "#6efcb4", bg: "rgba(110,252,180,0.06)" },
  { icon: "🤖", title: "AI analizuje skład", desc: "Sztuczna inteligencja czyta składniki i ocenia je pod kątem Twojego zdrowia", color: "#3b82f6", bg: "rgba(59,130,246,0.06)" },
  { icon: "🎯", title: "Spersonalizowane wyniki", desc: "Ostrzeżenia o alergenach, ocena od 1 do 10, tańsze alternatywy", color: "#C084FC", bg: "rgba(192,132,252,0.06)" },
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
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0a0e0c" }}>
      <div style={{ padding: "20px 22px 24px", position: "relative", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 300, height: 250,
          background: `radial-gradient(ellipse, ${slide.color}15, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Slide content */}
        <div key={current} style={{ animation: "fadeSlide 0.4s ease", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Icon */}
          <div style={{
            width: 140, height: 140, margin: "30px auto 28px",
            borderRadius: 36, background: slide.bg,
            border: `1.5px solid ${slide.color}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 56, position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: -12,
              background: `radial-gradient(circle, ${slide.color}15, transparent 70%)`,
              animation: "breathe 3s ease-in-out infinite",
            }} />
            <span style={{ position: "relative" }}>{slide.icon}</span>
          </div>

          {/* Text */}
          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 10 }}>{slide.title}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: "21px", padding: "0 10px" }}>{slide.desc}</div>
          </div>
        </div>

        {/* Bottom controls */}
        <div>
          {/* Dots */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}>
            {SLIDES.map((_, i) => (
              <div key={i} onClick={() => setCurrent(i)} style={{
                width: current === i ? 24 : 6, height: 6, borderRadius: 3,
                background: current === i ? "#6efcb4" : "rgba(255,255,255,0.1)",
                transition: "all 0.3s ease", cursor: "pointer",
              }} />
            ))}
          </div>

          {/* Button */}
          <button onClick={handleNext} style={{
            width: "100%", padding: 16, borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #6efcb4, #3dd990)",
            color: "#0a0f0d", fontWeight: 800, fontSize: 15, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(110,252,180,0.2)",
          }}>
            {current < SLIDES.length - 1 ? "Dalej →" : "🔍 Zacznij skanować!"}
          </button>

          {/* Skip */}
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.2)", cursor: "pointer" }} onClick={finish}>
            Pomiń
          </div>
        </div>
      </div>
    </div>
  );
}
