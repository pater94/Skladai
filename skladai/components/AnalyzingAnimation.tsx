"use client";

import { useState, useEffect } from "react";

interface AnalyzingAnimationProps {
  mode: string;
}

const MODE_COLORS: Record<string, { accent: string; dark: string; rgb: string; glow: string }> = {
  food: { accent: "#6efcb4", dark: "#3dd990", rgb: "110,252,180", glow: "rgba(110,252,180,0.12)" },
  cosmetics: { accent: "#C084FC", dark: "#a855f7", rgb: "192,132,252", glow: "rgba(192,132,252,0.12)" },
  suplement: { accent: "#3b82f6", dark: "#2563eb", rgb: "59,130,246", glow: "rgba(59,130,246,0.12)" },
  meal: { accent: "#FBBF24", dark: "#f59e0b", rgb: "251,191,36", glow: "rgba(251,191,36,0.12)" },
  forma: { accent: "#F97316", dark: "#ea580c", rgb: "249,115,22", glow: "rgba(249,115,22,0.12)" },
};

const DEFAULT_STEPS = [
  { text: "Czytam etykietę...", icon: "📖" },
  { text: "Analizuję składniki...", icon: "🧪" },
  { text: "Porównuję z bazą...", icon: "📚" },
  { text: "Przygotowuję ocenę...", icon: "⭐" },
];

const MEAL_STEPS = [
  { text: "Rozpoznaję danie...", icon: "🍽️" },
  { text: "Szacuję składniki...", icon: "🥗" },
  { text: "Obliczam kalorie...", icon: "🔥" },
  { text: "Przygotowuję ocenę...", icon: "⭐" },
];

const FORMA_STEPS = [
  { text: "Skanuję Twoją sylwetkę...", icon: "📸" },
  { text: "Szacuję masę mięśniową i tkankę tłuszczową...", icon: "🧬" },
  { text: "Porównuję z Twoimi celami...", icon: "🎯" },
  { text: "Przygotowuję wskazówki...", icon: "💡" },
];

// Step timings: 2.5s, 4.5s, 4.5s, then wait for API
const STEP_DELAYS = [2500, 7000, 11500]; // cumulative ms for steps 1, 2, 3

export default function AnalyzingAnimation({ mode }: AnalyzingAnimationProps) {
  const [step, setStep] = useState(0);
  const c = MODE_COLORS[mode] || MODE_COLORS.food;
  const steps = mode === "forma" ? FORMA_STEPS : mode === "meal" ? MEAL_STEPS : DEFAULT_STEPS;

  useEffect(() => {
    setStep(0);
    const timers = STEP_DELAYS.map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const progressPct = ((step + 1) / 4) * 100;

  return (
    <div style={{ padding: "30px 22px 30px", position: "relative" }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 300, height: 200, background: `radial-gradient(ellipse, ${c.glow}, transparent 70%)`, animation: "breathe 2.5s ease-in-out infinite", pointerEvents: "none" }} />

      {/* Spinner rings */}
      <div style={{ textAlign: "center", marginBottom: 32, position: "relative" }}>
        <div style={{ width: 120, height: 120, margin: "0 auto", position: "relative" }}>
          <svg width="120" height="120" style={{ position: "absolute", animation: "spinSlow 2s linear infinite" }}>
            <circle cx="60" cy="60" r="54" fill="none" stroke={`rgba(${c.rgb},0.08)`} strokeWidth="3" />
            <circle cx="60" cy="60" r="54" fill="none" stroke={c.accent} strokeWidth="3" strokeDasharray="80 260" strokeLinecap="round" />
          </svg>
          <svg width="120" height="120" style={{ position: "absolute", animation: "spinSlow 3s linear infinite reverse" }}>
            <circle cx="60" cy="60" r="46" fill="none" stroke={`rgba(${c.rgb},0.06)`} strokeWidth="2" />
            <circle cx="60" cy="60" r="46" fill="none" stroke={`rgba(${c.rgb},0.3)`} strokeWidth="2" strokeDasharray="40 250" strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 24, borderRadius: "50%", background: `rgba(${c.rgb},0.04)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🔬</div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ maxWidth: 280, margin: "0 auto 30px" }}>
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", marginBottom: 6, borderRadius: 12,
              background: active ? `rgba(${c.rgb},0.06)` : "transparent",
              border: active ? `1px solid rgba(${c.rgb},0.12)` : "1px solid transparent",
              opacity: done ? 0.4 : active ? 1 : 0.2,
              transition: "all 0.5s cubic-bezier(.4,0,.2,1)",
              transform: active ? "scale(1.02)" : "scale(1)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: done ? `rgba(${c.rgb},0.15)` : active ? `rgba(${c.rgb},0.1)` : "rgba(255,255,255,0.03)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                color: done ? c.accent : undefined,
              }}>{done ? "✓" : s.icon}</div>
              <span style={{
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: done ? `rgba(${c.rgb},0.6)` : active ? c.accent : "rgba(255,255,255,0.2)",
                textDecoration: done ? "line-through" : "none",
              }}>{s.text}</span>
              {active && <div style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", border: `2px solid rgba(${c.rgb},0.2)`, borderTopColor: c.accent, animation: "spinSlow 0.6s linear infinite" }} />}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={{ width: "80%", height: 3, margin: "0 auto", background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${c.dark}, ${c.accent}, ${c.dark})`, backgroundSize: "200% 100%", borderRadius: 2, transition: "width 0.5s ease", animation: "shimmer 1.5s linear infinite" }} />
      </div>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>To potrwa kilka sekund</div>
    </div>
  );
}
