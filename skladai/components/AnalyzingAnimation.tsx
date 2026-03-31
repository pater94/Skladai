"use client";

import { useState, useEffect } from "react";

interface AnalyzingAnimationProps {
  mode: string;
  loadingMessage?: string;
  isDark: boolean;
}

interface AnalysisStep {
  icon: string;
  text: string;
}

const STEPS_BY_MODE: Record<string, AnalysisStep[]> = {
  food: [
    { icon: "📷", text: "Odczytywanie tekstu z etykiety..." },
    { icon: "🔬", text: "Identyfikacja składników..." },
    { icon: "⚠️", text: "Wykrywanie alergenów i dodatków..." },
    { icon: "📊", text: "Obliczanie wartości odżywczych..." },
    { icon: "🏆", text: "Generowanie oceny zdrowotnej..." },
  ],
  cosmetics: [
    { icon: "📷", text: "Odczytywanie składu INCI..." },
    { icon: "🧪", text: "Identyfikacja substancji aktywnych..." },
    { icon: "⚠️", text: "Analiza potencjalnych drażniaczy..." },
    { icon: "💜", text: "Ocena bezpieczeństwa składników..." },
    { icon: "🏆", text: "Generowanie oceny produktu..." },
  ],
  suplement: [
    { icon: "📷", text: "Odczytywanie składu suplementu..." },
    { icon: "💊", text: "Identyfikacja substancji aktywnych..." },
    { icon: "⚠️", text: "Sprawdzanie dawkowania..." },
    { icon: "🔬", text: "Analiza interakcji składników..." },
    { icon: "🏆", text: "Generowanie oceny suplementu..." },
  ],
  meal: [
    { icon: "📷", text: "Rozpoznawanie dania..." },
    { icon: "🍽️", text: "Identyfikacja składników..." },
    { icon: "📊", text: "Szacowanie porcji..." },
    { icon: "🔢", text: "Obliczanie makroskładników..." },
    { icon: "🏆", text: "Finalizacja analizy..." },
  ],
  forma: [
    { icon: "📷", text: "Analiza sylwetki..." },
    { icon: "💪", text: "Ocena proporcji ciała..." },
    { icon: "📐", text: "Pomiary wizualne..." },
    { icon: "📊", text: "Porównanie z wzorcami..." },
    { icon: "🏆", text: "Generowanie raportu..." },
  ],
};

const MODE_COLORS: Record<string, { primary: string; glow: string; gradient: string }> = {
  food: { primary: "#10b981", glow: "rgba(16, 185, 129, 0.3)", gradient: "from-emerald-500 via-green-400 to-emerald-500" },
  cosmetics: { primary: "#C084FC", glow: "rgba(192, 132, 252, 0.3)", gradient: "from-fuchsia-500 via-purple-400 to-violet-500" },
  suplement: { primary: "#3b82f6", glow: "rgba(59, 130, 246, 0.3)", gradient: "from-blue-500 via-blue-400 to-blue-500" },
  meal: { primary: "#f59e0b", glow: "rgba(245, 158, 11, 0.3)", gradient: "from-orange-500 via-amber-400 to-orange-500" },
  forma: { primary: "#F97316", glow: "rgba(249, 115, 22, 0.3)", gradient: "from-orange-500 via-red-500 to-orange-500" },
};

export default function AnalyzingAnimation({ mode, loadingMessage, isDark }: AnalyzingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const steps = STEPS_BY_MODE[mode] || STEPS_BY_MODE.food;
  const colors = MODE_COLORS[mode] || MODE_COLORS.food;

  // Advance steps every ~2.5s, loop on last step
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, [steps.length]);

  // Elapsed time counter
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs((prev) => prev + 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  const progress = Math.min(95, ((currentStep + 1) / steps.length) * 90 + (elapsedMs % 2500) / 2500 * (90 / steps.length));

  return (
    <div className={`rounded-[24px] overflow-hidden anim-fade-scale ${isDark ? "velvet-card" : "card-elevated"}`}>
      {/* Top glow bar */}
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
          animation: "shimmer 2s infinite",
          backgroundSize: "200% 100%",
        }}
      />

      <div className="p-6 pb-5">
        {/* Animated center icon */}
        <div className="flex justify-center mb-5">
          <div className="relative w-24 h-24">
            {/* Spinning ring */}
            <svg className="absolute inset-0 w-full h-full" style={{ animation: "spinSlow 3s linear infinite" }}>
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke={colors.primary}
                strokeWidth="2"
                strokeDasharray="70 200"
                strokeLinecap="round"
                opacity="0.4"
              />
            </svg>
            {/* Counter-spinning ring */}
            <svg className="absolute inset-0 w-full h-full" style={{ animation: "spinSlow 2s linear infinite reverse" }}>
              <circle
                cx="48"
                cy="48"
                r="38"
                fill="none"
                stroke={colors.primary}
                strokeWidth="1.5"
                strokeDasharray="40 160"
                strokeLinecap="round"
                opacity="0.25"
              />
            </svg>
            {/* Pulsing glow */}
            <div
              className="absolute inset-3 rounded-full"
              style={{
                background: `radial-gradient(circle, ${colors.glow}, transparent)`,
                animation: "breathe 2s ease-in-out infinite",
              }}
            />
            {/* Step emoji */}
            <span className="absolute inset-0 flex items-center justify-center text-4xl transition-all duration-500" style={{ transform: "scale(1)", animation: "float 3s ease-in-out infinite" }}>
              {steps[currentStep].icon}
            </span>
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center mb-5">
          <p className={`text-[16px] font-bold mb-0.5 ${isDark ? "text-white" : "text-gray-800"}`}>
            {loadingMessage || "Analizuję..."}
          </p>
          <p className={`text-[12px] font-medium ${isDark ? "text-white/30" : "text-gray-400"}`}>
            {elapsedSec}s
          </p>
        </div>

        {/* Steps list */}
        <div className="space-y-2 mb-5">
          {steps.map((step, i) => {
            const isComplete = i < currentStep;
            const isActive = i === currentStep;
            return (
              <div
                key={i}
                className="flex items-center gap-3 transition-all duration-500"
                style={{
                  opacity: isComplete ? 0.5 : isActive ? 1 : 0.2,
                  transform: isActive ? "translateX(4px)" : "translateX(0)",
                }}
              >
                {/* Status indicator */}
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {isComplete ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill={colors.primary} opacity="0.2" />
                      <path d="M5 8l2 2 4-4" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : isActive ? (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        background: colors.primary,
                        boxShadow: `0 0 8px ${colors.glow}`,
                        animation: "breathe 1.5s ease-in-out infinite",
                      }}
                    />
                  ) : (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
                    />
                  )}
                </div>
                {/* Step text */}
                <p
                  className={`text-[13px] font-medium transition-colors duration-300 ${
                    isActive
                      ? isDark ? "text-white" : "text-gray-800"
                      : isComplete
                      ? isDark ? "text-white/40" : "text-gray-400"
                      : isDark ? "text-white/15" : "text-gray-300"
                  }`}
                >
                  {step.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
