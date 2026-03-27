"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

// ── Types ──

interface ProgressChartProps {
  data: { date: string; value: number }[];
  label: string;
  color?: string;
  predictionDays?: number;
  showPrediction?: boolean;
  invertTrend?: boolean;
  targetValue?: number;
  targetLabel?: string;
}

// ── Linear regression ──

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${day}.${month}`;
  } catch {
    return iso;
  }
}

function daysSinceEpoch(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 86400000);
}

function uniqueDates(data: { date: string }[]): number {
  const dates = new Set(data.map((d) => d.date.split("T")[0]));
  return dates.size;
}

// ── Component ──

export default function ProgressChart({
  data,
  label,
  color = "#F97316",
  predictionDays = 90,
  showPrediction = true,
  invertTrend = false,
  targetValue,
  targetLabel,
}: ProgressChartProps) {
  // Not enough data
  if (data.length < 2) {
    return (
      <div
        className="rounded-2xl p-5 text-center"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
          Dodaj więcej wyników żeby zobaczyć wykres progresu
        </p>
      </div>
    );
  }

  const sorted = useMemo(
    () => [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [data]
  );

  // Prediction requires 3+ entries from DIFFERENT dates
  const numUniqueDates = uniqueDates(sorted);
  const canPredict = showPrediction && sorted.length >= 3 && numUniqueDates >= 3;

  // Build regression
  const regression = useMemo(() => {
    if (!canPredict) return null;
    const base = daysSinceEpoch(sorted[0].date);
    const pts = sorted.map((d) => ({
      x: daysSinceEpoch(d.date) - base,
      y: d.value,
    }));
    return { ...linearRegression(pts), base };
  }, [sorted, canPredict]);

  // Build chart data
  const chartData = useMemo(() => {
    const points = sorted.map((d) => ({
      date: formatDateShort(d.date),
      rawDate: d.date,
      value: d.value,
      prediction: undefined as number | undefined,
    }));

    if (regression) {
      const base = regression.base;
      const lastDay = daysSinceEpoch(sorted[sorted.length - 1].date) - base;
      // Add prediction point at end of real data
      points[points.length - 1].prediction = points[points.length - 1].value;

      const predDays = [30, 60, 90].filter((d) => d <= predictionDays);
      for (const pd of predDays) {
        const day = lastDay + pd;
        const val = Math.round((regression.slope * day + regression.intercept) * 10) / 10;
        if (val > 0) {
          const futureDate = new Date(sorted[sorted.length - 1].date);
          futureDate.setDate(futureDate.getDate() + pd);
          points.push({
            date: formatDateShort(futureDate.toISOString()),
            rawDate: futureDate.toISOString(),
            value: undefined as unknown as number,
            prediction: val,
          });
        }
      }
    }

    return points;
  }, [sorted, regression, predictionDays]);

  // Prediction text
  const predictionText = useMemo(() => {
    if (!regression) return null;
    const base = regression.base;
    const lastDay = daysSinceEpoch(sorted[sorted.length - 1].date) - base;

    const preds: string[] = [];
    for (const pd of [30, 60]) {
      const day = lastDay + pd;
      const val = Math.round((regression.slope * day + regression.intercept) * 10) / 10;
      if (val > 0) {
        preds.push(`${val}${label} za ${pd} dni`);
      }
    }

    if (preds.length === 0) return null;

    const trendBad = invertTrend
      ? regression.slope > 0.001
      : regression.slope < -0.001;

    return {
      text: `Przy tym tempie: ${preds.join(", ")}`,
      warning: trendBad,
    };
  }, [regression, sorted, label, invertTrend]);

  const lighterColor = color + "80";

  // Message when not enough unique dates for prediction
  const noPredictionMsg = showPrediction && sorted.length >= 2 && numUniqueDates < 3
    ? "Dodaj więcej wyników z różnych dni żeby zobaczyć predykcję"
    : null;

  return (
    <div>
      <div
        className="rounded-2xl p-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}${label}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#1A1A1A",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "#fff",
              }}
              formatter={(val: unknown, name: unknown) => {
                const displayName = name === "prediction" ? "Predykcja" : "Twój wynik";
                return [`${val} ${label}`, displayName];
              }}
              labelFormatter={(l: unknown) => `Data: ${l}`}
            />
            {targetValue !== undefined && (
              <ReferenceLine
                y={targetValue}
                stroke="#10B981"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: targetLabel || `Cel: ${targetValue}${label}`,
                  position: "right",
                  style: { fontSize: 10, fill: "#10B981" },
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#grad-${color.replace("#", "")})`}
              dot={{ r: 4, fill: color, stroke: "#111111", strokeWidth: 2 }}
              connectNulls={false}
            />
            {canPredict && (
              <Area
                type="monotone"
                dataKey="prediction"
                stroke={lighterColor}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                fill="none"
                dot={{ r: 3, fill: lighterColor, stroke: "#111111", strokeWidth: 1.5 }}
                connectNulls={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <span className="block w-5 h-[3px] rounded-full" style={{ backgroundColor: color }} />
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>Twoje wyniki</span>
          </div>
          {canPredict && (
            <div className="flex items-center gap-2">
              <span className="block w-5 h-[3px] rounded-full" style={{ backgroundColor: lighterColor, background: `repeating-linear-gradient(90deg, ${lighterColor} 0, ${lighterColor} 4px, transparent 4px, transparent 7px)` }} />
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>Predykcja</span>
            </div>
          )}
        </div>
      </div>

      {/* No prediction message */}
      {noPredictionMsg && (
        <div className="rounded-xl p-3 mt-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            {noPredictionMsg}
          </p>
        </div>
      )}

      {/* Prediction card */}
      {predictionText && (
        <div
          className="rounded-xl p-3 mt-2"
          style={{
            background: predictionText.warning
              ? "rgba(239,68,68,0.06)"
              : `${color}0F`,
            border: predictionText.warning
              ? "1px solid rgba(239,68,68,0.15)"
              : `1px solid ${color}20`,
          }}
        >
          <p style={{ fontSize: "12px", color: predictionText.warning ? "#EF4444" : color }}>
            {predictionText.warning
              ? "⚠️ Uwaga: obecny trend prowadzi w złą stronę. Rozważ korekty."
              : `📈 ${predictionText.text}`}
          </p>
        </div>
      )}
    </div>
  );
}
