"use client";

import { useState, useEffect } from "react";

interface AnalyzingAnimationProps {
  mode: string;
  loadingMessage?: string;
  isDark: boolean;
}

const MODE_COLORS: Record<string, string> = {
  food: "#6efcb4",
  cosmetics: "#C084FC",
  suplement: "#3b82f6",
  meal: "#FBBF24",
  forma: "#F97316",
};

const MODE_RGB: Record<string, string> = {
  food: "110,252,180",
  cosmetics: "192,132,252",
  suplement: "59,130,246",
  meal: "251,191,36",
  forma: "249,115,22",
};

const STEPS = [
  { icon: "📷", text: "Odczytywanie tekstu (OCR)" },
  { icon: "🧪", text: "Identyfikacja składników" },
  { icon: "⚠️", text: "Ocena bezpieczeństwa" },
  { icon: "✅", text: "Generowanie wyniku" },
];

const STAGE_LABELS = [
  "Czytam etykietę...",
  "Analizuję składniki...",
  "Oceniam bezpieczeństwo...",
  "Przygotowuję wynik...",
];

export default function AnalyzingAnimation({ mode, isDark }: AnalyzingAnimationProps) {
  const [loadStage, setLoadStage] = useState(0);

  const mint = MODE_COLORS[mode] || MODE_COLORS.food;
  const rgb = MODE_RGB[mode] || MODE_RGB.food;

  useEffect(() => {
    setLoadStage(0);
    const t1 = setTimeout(() => setLoadStage(1), 800);
    const t2 = setTimeout(() => setLoadStage(2), 2200);
    const t3 = setTimeout(() => setLoadStage(3), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Circle progress: circumference = 2*PI*52 ≈ 327
  const circumference = 327;
  const strokeOffset = circumference - (circumference * (loadStage / 3));

  return (
    <div className={`rounded-[24px] overflow-hidden anim-fade-scale ${isDark ? "velvet-card" : "card-elevated"}`}>
      <div style={{ padding: "40px 24px 30px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {/* Ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: 0, left: "50%", transform: "translateX(-50%)",
            width: 300, height: 300,
            background: `radial-gradient(circle, rgba(${rgb},0.1), transparent 65%)`,
            animation: "breathe 3s ease-in-out infinite",
          }}
        />

        {/* Ring */}
        <div style={{ position: "relative", width: 120, height: 120, marginBottom: 28 }}>
          {/* Conic gradient background */}
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            background: `conic-gradient(from 0deg, transparent, ${mint}30, transparent, ${mint}15, transparent)`,
            animation: "spinSlow 3s linear infinite",
          }} />
          <svg width="120" height="120" style={{ position: "absolute", top: 0, left: 0 }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
            <circle
              cx="60" cy="60" r="52" fill="none" stroke={mint} strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 38 }}>🔬</span>
          </div>
        </div>

        {/* Stage label */}
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginBottom: 6, textAlign: "center" }}>
          {STAGE_LABELS[loadStage]}
        </div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12.5, marginBottom: 32 }}>
          To potrwa kilka sekund
        </div>

        {/* Steps glass card */}
        <div style={{
          width: "100%",
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 16, padding: 16,
        }}>
          {STEPS.map((s, i) => {
            const done = i < loadStage;
            const active = i === loadStage;
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: i < 3 ? 12 : 0,
                  opacity: done || active ? 1 : 0.25,
                  transition: "all 0.5s ease",
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: done ? "rgba(34,197,94,0.12)" : active ? `rgba(${rgb},0.1)` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${done ? "rgba(34,197,94,0.2)" : active ? `rgba(${rgb},0.15)` : "rgba(255,255,255,0.04)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, transition: "all 0.4s ease",
                }}>
                  {done ? "✓" : s.icon}
                </div>
                <span style={{
                  fontSize: 13,
                  fontWeight: done || active ? 600 : 400,
                  color: done ? "#22c55e" : active ? mint : "rgba(255,255,255,0.3)",
                  transition: "all 0.4s ease",
                }}>
                  {s.text}
                </span>
                {active && (
                  <div style={{
                    marginLeft: "auto", width: 16, height: 16,
                    borderRadius: "50%",
                    border: `2px solid ${mint}33`,
                    borderTopColor: mint,
                    animation: "spinSlow 0.7s linear infinite",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
