"use client";

import { useEffect, useState } from "react";

interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
}

export function getScoreColor(score: number | null | undefined) {
  // null/undefined = label was unreadable (v4 enforcement). Neutral gray
  // with explicit "Brak etykiety" label so user doesn't see a misleading
  // "Słaby" red score on a scan we couldn't actually evaluate.
  if (score == null) return { color: "#71717a", bg: "#f4f4f5", gradient: ["#a1a1aa", "#52525b"], label: "Brak etykiety" };
  if (score >= 8) return { color: "#16a34a", bg: "#dcfce7", gradient: ["#4ade80", "#16a34a"], label: "Doskonały" };
  if (score >= 6) return { color: "#65a30d", bg: "#ecfccb", gradient: ["#a3e635", "#65a30d"], label: "Dobry" };
  if (score >= 4) return { color: "#ea580c", bg: "#fff7ed", gradient: ["#fb923c", "#ea580c"], label: "Przeciętny" };
  return { color: "#dc2626", bg: "#fef2f2", gradient: ["#f87171", "#dc2626"], label: "Słaby" };
}

export default function ScoreRing({ score, size = 120 }: ScoreRingProps) {
  const [progress, setProgress] = useState(0);
  const { color, gradient } = getScoreColor(score);

  const strokeWidth = Math.max(size * 0.065, 4);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 10) * circumference;

  const id = `sg-${size}-${score ?? "n"}`;

  useEffect(() => {
    // null score → ring stays at 0% (visually empty) instead of erroring
    const target = typeof score === "number" ? score : 0;
    const t = setTimeout(() => setProgress(target), 150);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full opacity-20 blur-xl"
        style={{ backgroundColor: color }}
      />
      <svg width={size} height={size} className="transform -rotate-90 relative z-10">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={`url(#${id})`}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        {typeof score === "number" ? (
          <>
            <span className="font-bold leading-none" style={{ fontSize: size * 0.34, color }}>
              {score}
            </span>
            <span className="font-bold text-gray-300 leading-none" style={{ fontSize: size * 0.11 }}>
              /10
            </span>
          </>
        ) : (
          // Brak etykiety — score=null. Show a question mark instead of
          // a number so the user immediately sees the scan didn't yield
          // a usable rating.
          <span className="font-bold leading-none" style={{ fontSize: size * 0.34, color }}>
            ?
          </span>
        )}
      </div>
    </div>
  );
}
