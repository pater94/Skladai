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
    color: "110,252,180",
  },
  {
    icon: "🤖",
    title: "AI analizuje skład",
    desc: "Sztuczna inteligencja czyta składniki i ocenia je pod kątem Twojego zdrowia",
    color: "59,130,246",
  },
  {
    icon: "🎯",
    title: "Spersonalizowane wyniki",
    desc: "Ostrzeżenia o alergenach, ocena od 1 do 10, tańsze alternatywy",
    color: "192,132,252",
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
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between"
      style={{ background: "#0a0f0d" }}
    >
      {/* Ambient tła per slajd */}
      <div
        className="absolute pointer-events-none transition-all duration-700"
        style={{
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 400,
          background: `radial-gradient(ellipse, rgba(${slide.color},0.15), transparent 70%)`,
        }}
      />

      {/* Skip top-right */}
      <div className="w-full max-w-sm px-6 pt-14 flex justify-end relative z-10">
        <button onClick={finish} style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          Pomiń
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-sm relative z-10">
        {/* Icon container with glow */}
        <div className="relative mb-8">
          {/* Glow behind */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle, rgba(${slide.color},0.15), transparent 70%)`,
              animation: "breathe 3s ease-in-out infinite",
              transform: "scale(1.8)",
            }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 140,
              height: 140,
              borderRadius: 36,
              background: `rgba(${slide.color},0.06)`,
              border: `1.5px solid rgba(${slide.color},0.2)`,
            }}
          >
            <span style={{ fontSize: 56, animation: "float 3s ease-in-out infinite" }}>
              {slide.icon}
            </span>
          </div>
        </div>

        {/* Title + desc with fadeSlide */}
        <h2
          key={`t-${current}`}
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#fff",
            textAlign: "center",
            marginBottom: 10,
            animation: "fadeSlide 0.5s ease both",
          }}
        >
          {slide.title}
        </h2>
        <p
          key={`d-${current}`}
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
            lineHeight: "21px",
            maxWidth: 280,
            animation: "fadeSlide 0.5s ease 0.1s both",
          }}
        >
          {slide.desc}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-sm px-6 pb-12 flex flex-col items-center relative z-10">
        {/* Dots — clickable */}
        <div className="flex gap-2.5 mb-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: current === i ? 24 : 6,
                height: 6,
                borderRadius: 3,
                background: current === i ? "#6efcb4" : "rgba(255,255,255,0.1)",
                transition: "all 0.3s ease",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleNext}
          className="w-full active:scale-[0.97] transition-transform"
          style={{
            padding: 16,
            borderRadius: 14,
            background: "linear-gradient(135deg, #6efcb4, #3dd990)",
            color: "#0a0f0d",
            fontWeight: 800,
            fontSize: 15,
            boxShadow: "0 4px 20px rgba(110,252,180,0.2)",
            border: "none",
          }}
        >
          {current < SLIDES.length - 1 ? "Dalej →" : "🔍 Zacznij skanować!"}
        </button>
      </div>
    </div>
  );
}
