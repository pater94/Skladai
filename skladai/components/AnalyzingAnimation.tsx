"use client";

import { useState, useEffect } from "react";

interface AnalyzingAnimationProps {
  mode: string;
  loadingMessage?: string;
  isDark: boolean;
}

const STEPS = [
  { icon: "📖", text: "Czytam etykietę..." },
  { icon: "🧪", text: "Analizuję składniki..." },
  { icon: "📚", text: "Porównuję z bazą..." },
  { icon: "⭐", text: "Przygotowuję ocenę..." },
];

// Delays for each step to become active: 0ms, 800ms, 2000ms, 3200ms
const STEP_DELAYS = [0, 800, 2000, 3200];
const PROGRESS_VALUES = [10, 35, 60, 90];

const MODE_COLORS: Record<string, { ring: string; rgb: string }> = {
  food: { ring: "#6efcb4", rgb: "110,252,180" },
  cosmetics: { ring: "#C084FC", rgb: "192,132,252" },
  suplement: { ring: "#3b82f6", rgb: "59,130,246" },
  meal: { ring: "#FBBF24", rgb: "251,191,36" },
  forma: { ring: "#F97316", rgb: "249,115,22" },
};

export default function AnalyzingAnimation({ mode, isDark }: AnalyzingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const colors = MODE_COLORS[mode] || MODE_COLORS.food;

  useEffect(() => {
    const timers = STEP_DELAYS.map((delay, i) =>
      setTimeout(() => setCurrentStep(i), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const progress = PROGRESS_VALUES[currentStep] || 10;

  return (
    <div className={`rounded-[24px] overflow-hidden anim-fade-scale relative ${isDark ? "velvet-card" : "card-elevated"}`}>
      {/* 1. Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 300,
          height: 200,
          background: `radial-gradient(ellipse, rgba(${colors.rgb},0.12), transparent 70%)`,
          animation: "breathe 2.5s ease-in-out infinite",
        }}
      />

      <div className="relative p-6">
        {/* 2. Podwójny animowany ring */}
        <div className="flex justify-center mb-5">
          <div className="relative" style={{ width: 120, height: 120 }}>
            {/* Outer ring */}
            <svg className="absolute inset-0" width="120" height="120" style={{ animation: "spinSlow 2s linear infinite" }}>
              <circle cx="60" cy="60" r="54" fill="none" stroke={`rgba(${colors.rgb},0.08)`} strokeWidth="3" />
              <circle cx="60" cy="60" r="54" fill="none" stroke={colors.ring} strokeWidth="3" strokeDasharray="80 260" strokeLinecap="round" />
            </svg>
            {/* Inner ring */}
            <svg className="absolute inset-0" width="120" height="120" style={{ animation: "spinSlow 3s linear infinite reverse" }}>
              <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(192,132,252,0.3)" strokeWidth="2" strokeDasharray="40 250" strokeLinecap="round" />
            </svg>
            {/* Center emoji */}
            <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 36 }}>
              🔬
            </span>
          </div>
        </div>

        {/* 3. Etapy analizy */}
        <div className="space-y-1.5 mb-5">
          {STEPS.map((step, i) => {
            const isCompleted = i < currentStep;
            const isActive = i === currentStep;
            const isPending = i > currentStep;

            return (
              <div
                key={i}
                className="flex items-center"
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  marginBottom: 6,
                  opacity: isPending ? 0.2 : isCompleted ? 0.4 : 1,
                  background: isActive ? `rgba(${colors.rgb},0.06)` : "transparent",
                  border: isActive ? `1px solid rgba(${colors.rgb},0.12)` : "1px solid transparent",
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                  transition: "all 0.5s cubic-bezier(.4,0,.2,1)",
                }}
              >
                {/* Icon box */}
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 28, height: 28, borderRadius: 8 }}
                >
                  {isCompleted ? (
                    <span style={{ fontSize: 14, color: "rgba(34,197,94,0.6)" }}>✓</span>
                  ) : (
                    <span style={{ fontSize: 15 }}>{step.icon}</span>
                  )}
                </div>
                {/* Text */}
                <span
                  style={{
                    fontSize: 13,
                    marginLeft: 8,
                    flex: 1,
                    color: isCompleted
                      ? "rgba(34,197,94,0.6)"
                      : isActive
                      ? (isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)")
                      : (isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"),
                    textDecoration: isCompleted ? "line-through" : "none",
                    transition: "color 0.5s",
                  }}
                >
                  {step.text}
                </span>
                {/* Mini spinner for active step */}
                {isActive && (
                  <div
                    className="flex-shrink-0"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `2px solid transparent`,
                      borderTopColor: colors.ring,
                      animation: "spinSlow 0.6s linear infinite",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 4. Progress bar */}
        <div style={{ width: "80%", height: 3, margin: "0 auto", borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${colors.ring}66, ${colors.ring}, ${colors.ring}66)`,
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s linear infinite",
              transition: "width 0.8s ease",
            }}
          />
        </div>

        {/* 5. Tekst */}
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 16 }}>
          To potrwa kilka sekund
        </p>
      </div>
    </div>
  );
}
