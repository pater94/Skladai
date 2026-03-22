"use client";

import { useEffect, useState } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
}

function getScoreColor(score: number) {
  if (score >= 8) return { color: "#2E7D32", bg: "#E8F5E9" };
  if (score >= 6) return { color: "#558B2F", bg: "#F1F8E9" };
  if (score >= 4) return { color: "#F57F17", bg: "#FFF8E1" };
  return { color: "#B71C1C", bg: "#FFEBEE" };
}

export default function ScoreRing({ score, size = 120 }: ScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const { color, bg } = getScoreColor(score);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 10) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill={bg}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-gray-400">/10</span>
      </div>
    </div>
  );
}

export { getScoreColor };
