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
  const isLast = current === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0a0e0c" }}>
      <div style={{ padding: "20px 22px 24px", position: "relative", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "300px", height: "250px",
          background: `radial-gradient(ellipse, ${slide.color}15, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Slide content */}
        <div key={current} style={{ animation: "fadeSlide 0.4s ease", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Icon */}
          <div style={{
            width: "140px", height: "140px", margin: "30px auto 28px",
            borderRadius: "36px", background: slide.bg,
            border: `1.5px solid ${slide.color}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "56px", position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: "-12px",
              background: `radial-gradient(circle, ${slide.color}15, transparent 70%)`,
              animation: "breathe 3s ease-in-out infinite",
            }} />
            <span style={{ position: "relative" }}>{slide.icon}</span>
          </div>

          {/* Text */}
          <div style={{ textAlign: "center", marginBottom: "50px" }}>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: "10px" }}>{slide.title}</div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", lineHeight: "21px", padding: "0 10px" }}>{slide.desc}</div>
          </div>
        </div>

        {/* Bottom controls */}
        <div>
          {/* Dots */}
          <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "24px" }}>
            {SLIDES.map((_, i) => (
              <div key={i} onClick={() => setCurrent(i)} style={{
                width: current === i ? "24px" : "6px", height: "6px", borderRadius: "3px",
                background: current === i ? slide.color : "rgba(255,255,255,0.1)",
                transition: "all 0.3s ease", cursor: "pointer",
              }} />
            ))}
          </div>

          {/* Main CTA button */}
          <button type="button" onClick={handleNext} style={{
            width: "100%", padding: "16px", borderRadius: "14px", border: "none",
            background: `linear-gradient(135deg, ${slide.color}, ${slide.color}cc)`,
            color: "#0a0f0d", fontWeight: 800, fontSize: "15px", cursor: "pointer",
            boxShadow: `0 4px 20px ${slide.color}33`,
          }}>
            {isLast ? "🔍 Zacznij skanować!" : "Dalej →"}
          </button>

          {/* Skip */}
          <button type="button" onClick={finish} style={{
            display: "block", width: "100%", textAlign: "center",
            marginTop: "12px", fontSize: "12px", color: "rgba(255,255,255,0.2)",
            cursor: "pointer", background: "none", border: "none", padding: "8px",
          }}>
            Pomiń
          </button>
        </div>
      </div>
    </div>
  );
}
