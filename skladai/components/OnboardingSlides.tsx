"use client";

import { useState } from "react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    icon: "📷",
    title: "Skanuj etykiety",
    desc: "Zrób zdjęcie składu produktu — AI przeanalizuje każdy składnik i poda ocenę zdrowotności",
    color: "#10b981",
  },
  {
    icon: "🧪",
    title: "Poznaj co jesz",
    desc: "Wykrywaj alergeny, szkodliwe dodatki i ukryty cukier. Porównuj produkty i wybieraj mądrzej",
    color: "#3b82f6",
  },
  {
    icon: "📈",
    title: "Śledź postępy",
    desc: "Dziennik żywienia, cele kaloryczne, osiągnięcia i analiza trendów — wszystko w jednym miejscu",
    color: "#f59e0b",
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

  const slide = SLIDES[current];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between"
      style={{ background: "#0a0f0d" }}
    >
      {/* Background glow */}
      <div
        className="absolute w-[300px] h-[300px] rounded-full opacity-15 blur-[100px] top-1/4 left-1/2 -translate-x-1/2 transition-all duration-700"
        style={{ background: `radial-gradient(circle, ${slide.color}, transparent)` }}
      />

      {/* Skip */}
      <div className="w-full max-w-sm px-6 pt-12 flex justify-end">
        <button
          onClick={() => {
            localStorage.setItem("skladai_onboarding_done", "1");
            onComplete();
          }}
          className="text-[13px] text-gray-500 font-medium"
        >
          Pomiń
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-sm">
        <div
          className="w-28 h-28 rounded-[32px] flex items-center justify-center mb-8 transition-all duration-500"
          style={{
            background: `${slide.color}15`,
            border: `2px solid ${slide.color}30`,
          }}
        >
          <span className="text-6xl" style={{ animation: "float 3s ease-in-out infinite" }}>
            {slide.icon}
          </span>
        </div>

        <h2
          className="text-[26px] font-black text-white text-center mb-3 transition-all duration-500"
          key={`title-${current}`}
          style={{ animation: "fadeInUp 0.5s ease both" }}
        >
          {slide.title}
        </h2>
        <p
          className="text-[15px] text-gray-400 text-center leading-relaxed transition-all duration-500"
          key={`desc-${current}`}
          style={{ animation: "fadeInUp 0.5s ease 0.1s both" }}
        >
          {slide.desc}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-sm px-6 pb-12 flex flex-col items-center gap-6">
        {/* Dots */}
        <div className="flex gap-2.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-full transition-all duration-400"
              style={{
                width: current === i ? 24 : 8,
                background: current === i ? slide.color : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl font-bold text-[16px] text-white active:scale-[0.97] transition-all"
          style={{
            background: `linear-gradient(135deg, ${slide.color}, ${slide.color}cc)`,
            boxShadow: `0 8px 30px ${slide.color}30`,
          }}
        >
          {current < SLIDES.length - 1 ? "Dalej" : "Zaczynajmy!"}
        </button>
      </div>
    </div>
  );
}
