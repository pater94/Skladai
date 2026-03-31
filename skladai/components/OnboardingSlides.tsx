"use client";

import { useState } from "react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    icon: "📸",
    title: "Zeskanuj etykietę",
    desc: "Zrób zdjęcie składu produktu — żywności, kosmetyku lub suplementu",
    color: "#6efcb4",
    ambientRgb: "110,252,180",
  },
  {
    icon: "🤖",
    title: "AI analizuje skład",
    desc: "Sztuczna inteligencja czyta składniki i ocenia je pod kątem Twojego zdrowia",
    color: "#3b82f6",
    ambientRgb: "59,130,246",
  },
  {
    icon: "🎯",
    title: "Spersonalizowane wyniki",
    desc: "Ostrzeżenia o alergenach, ocena od 1 do 10, tańsze alternatywy",
    color: "#C084FC",
    ambientRgb: "192,132,252",
  },
];

export default function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [current, setCurrent] = useState(0);

  const handleNext = () => {
    if (current < SLIDES.length - 1) {
      setCurrent(current + 1);
    } else {
      localStorage.setItem("skladai_onboarding_done", "1");
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem("skladai_onboarding_done", "1");
    onComplete();
  };

  const slide = SLIDES[current];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between"
      style={{ background: "#0a0f0d" }}
    >
      {/* Ambient glow — changes per slide */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[120px] transition-all duration-700"
        style={{
          background: `radial-gradient(circle, rgba(${slide.ambientRgb},0.15), transparent 70%)`,
          top: "-100px",
        }}
      />

      {/* Skip button top-right */}
      <div className="w-full max-w-sm px-6 pt-14 flex justify-end relative z-10">
        <button
          onClick={handleSkip}
          className="text-[12px] font-medium"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Pomiń
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-sm relative z-10">
        {/* Icon container with glow */}
        <div className="relative mb-10">
          {/* Glow behind icon */}
          <div
            className="absolute inset-0 rounded-[36px]"
            style={{
              background: `radial-gradient(circle, rgba(${slide.ambientRgb},0.15), transparent 70%)`,
              animation: "breathe 3s ease-in-out infinite",
              transform: "scale(1.5)",
            }}
          />
          <div
            className="relative w-[140px] h-[140px] rounded-[36px] flex items-center justify-center transition-all duration-500"
            style={{
              background: `rgba(${slide.ambientRgb},0.06)`,
              border: `1.5px solid rgba(${slide.ambientRgb},0.2)`,
            }}
          >
            <span className="text-[56px]" style={{ animation: "float 3s ease-in-out infinite" }}>
              {slide.icon}
            </span>
          </div>
        </div>

        {/* Title + description with fadeSlide */}
        <h2
          className="text-[26px] font-black text-white text-center mb-3"
          key={`title-${current}`}
          style={{ animation: "fadeSlide 0.5s ease both" }}
        >
          {slide.title}
        </h2>
        <p
          className="text-[15px] text-gray-400 text-center leading-relaxed max-w-[280px]"
          key={`desc-${current}`}
          style={{ animation: "fadeSlide 0.5s ease 0.1s both" }}
        >
          {slide.desc}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-sm px-6 pb-12 flex flex-col items-center gap-6 relative z-10">
        {/* Dots */}
        <div className="flex gap-2.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-[6px] rounded-full transition-all duration-400"
              style={{
                width: current === i ? 24 : 6,
                background: current === i ? slide.color : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        {/* Next / Start button */}
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl font-bold text-[16px] text-white active:scale-[0.97] transition-all"
          style={{
            background: `linear-gradient(135deg, ${slide.color}, ${slide.color}bb)`,
            boxShadow: `0 8px 30px rgba(${slide.ambientRgb},0.25)`,
          }}
        >
          {current < SLIDES.length - 1 ? "Dalej →" : "🔍 Zacznij skanować!"}
        </button>
      </div>
    </div>
  );
}
