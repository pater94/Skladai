"use client";

/**
 * FORMA — Dziennik treningowy, ekran "Historia ćwiczenia" (Faza 4/4).
 * Wykres najcięższej serii w czasie + lista sesji. Dane z lib/workoutJournal.
 * Akcent pomarańcz #f97316. Liczby białe. Przyrosty zielone.
 */

import { useEffect, useState } from "react";
import {
  getExercise, getExerciseHistory, getExerciseProgress,
  type WnExercise, type WnHistoryPoint, type WnExerciseProgress,
} from "@/lib/workoutJournal";

const GREEN = "#5fd39a";

export default function ExerciseHistory({
  goBack, exerciseId,
}: {
  goBack: () => void;
  exerciseId: string;
}) {
  const [exercise, setExercise] = useState<WnExercise | null>(null);
  const [history, setHistory] = useState<WnHistoryPoint[]>([]);
  const [prog, setProg] = useState<WnExerciseProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ex, hist, p] = await Promise.all([
        getExercise(exerciseId),
        getExerciseHistory(exerciseId),
        getExerciseProgress(exerciseId),
      ]);
      if (cancelled) return;
      setExercise(ex);
      setHistory(hist);
      setProg(p);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  const byReps = exercise?.kind === "bodyweight";
  const unit = byReps ? "" : " kg";
  const valOf = (p: WnHistoryPoint) => (byReps ? p.topReps : p.topWeight);

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 60 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} aria-label="Wróć" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: "var(--fg, #fff)" }}>{exercise?.name ?? "Ćwiczenie"}</h2>
          <p style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>Najcięższa seria w czasie</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>Ładowanie…</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "44px 20px", borderRadius: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.03)", border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.1)" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📈</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg, #fff)" }}>Brak ukończonych sesji</div>
          <div style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 4 }}>Zaloguj i zakończ trening, by zobaczyć progres.</div>
        </div>
      ) : (
        <>
          {/* 3 staty */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <Stat label="Rekord" value={prog?.record != null ? `${prog.record}${unit}` : "—"} color="var(--fg, #fff)" />
            <Stat label="Ten tydzień" value={fmtDelta(prog?.weekDelta, unit)} color={deltaColor(prog?.weekDelta)} />
            <Stat label="Od startu" value={fmtDelta(prog?.sinceStartDelta, unit)} color={deltaColor(prog?.sinceStartDelta)} />
          </div>

          {/* Wykres */}
          <ProgressChart history={history} valOf={valOf} unit={unit} record={prog?.record ?? null} />

          {/* Historia sesji */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginBottom: 10 }}>Historia sesji</div>
            <div className="flex flex-col gap-2">
              {[...history].reverse().map((p) => {
                const top = valOf(p);
                const isPR = prog?.record != null && top != null && top === prog.record;
                const reps = p.sets.map((s) => s.reps ?? "—").join(",");
                return (
                  <div key={p.sessionId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 13, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg, #fff)" }}>
                        {new Date(p.finishedAt).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
                        {isPR && <span style={{ marginLeft: 7 }}>🏆</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 2 }}>{reps} powt.</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--fg, #fff)", flexShrink: 0 }}>{top != null ? `${top}${unit}` : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "13px 6px", borderRadius: 14, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
      <div style={{ fontSize: 17, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function fmtDelta(d: number | null | undefined, unit: string): string {
  if (d == null || d === 0) return "—";
  return `${d > 0 ? "↑" : "↓"} ${Math.abs(d)}${unit}`;
}
function deltaColor(d: number | null | undefined): string {
  if (d == null || d === 0) return "rgba(var(--fg-rgb, 255,255,255),0.5)";
  return d > 0 ? GREEN : "#f87171";
}

// ── Wykres najcięższej serii w czasie ──
function ProgressChart({
  history, valOf, unit, record,
}: {
  history: WnHistoryPoint[];
  valOf: (p: WnHistoryPoint) => number | null;
  unit: string;
  record: number | null;
}) {
  const pts = history.map((p) => ({ t: new Date(p.finishedAt).getTime(), v: valOf(p) })).filter((p): p is { t: number; v: number } => p.v != null);
  if (pts.length < 1) return null;

  const W = 320, H = 150, padX = 10, padTop = 24, padBottom = 22;
  const xs = pts.map((p) => p.t);
  const vs = pts.map((p) => p.v);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minV = Math.min(...vs), maxV = Math.max(...vs);
  const rangeX = maxX - minX || 1;
  const rangeV = maxV - minV || 1;
  const sx = (t: number) => padX + ((t - minX) / rangeX) * (W - 2 * padX);
  const sy = (v: number) => padTop + (1 - (v - minV) / rangeV) * (H - padTop - padBottom);

  const linePts = pts.map((p) => `${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join(" ");
  const areaPts = pts.length > 1
    ? `${sx(pts[0].t).toFixed(1)},${(H - padBottom).toFixed(1)} ${linePts} ${sx(pts[pts.length - 1].t).toFixed(1)},${(H - padBottom).toFixed(1)}`
    : "";
  // punkt rekordu
  const prIdx = record != null ? pts.findIndex((p) => p.v === record) : -1;

  const fmtDate = (t: number) => new Date(t).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

  return (
    <div style={{ borderRadius: 16, padding: "8px 6px 4px", background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} aria-label="Wykres progresu">
        <defs>
          <linearGradient id="wnChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-orange, #f97316)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--c-orange, #f97316)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* siatka hairline */}
        {[0, 0.5, 1].map((g) => {
          const y = padTop + g * (H - padTop - padBottom);
          return <line key={g} x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(var(--fg-rgb, 255,255,255),0.06)" strokeWidth="1" />;
        })}
        {areaPts && <polygon points={areaPts} fill="url(#wnChartFill)" />}
        <polyline points={linePts} fill="none" stroke="var(--c-orange, #f97316)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* punkty */}
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p.t)} cy={sy(p.v)} r={i === prIdx ? 4.5 : 2.6} fill={i === prIdx ? "var(--c-orange, #f97316)" : "var(--bg-panel, #0a0f0d)"} stroke="var(--c-orange, #f97316)" strokeWidth="1.6" />
        ))}
        {/* etykieta PR */}
        {prIdx >= 0 && (
          <text x={Math.min(Math.max(sx(pts[prIdx].t), 22), W - 22)} y={Math.max(sy(pts[prIdx].v) - 9, 12)} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--c-orange, #f97316)">
            PR {pts[prIdx].v}{unit}
          </text>
        )}
        {/* etykiety dat (pierwsza / ostatnia) */}
        <text x={padX} y={H - 6} fontSize="9" fill="rgba(var(--fg-rgb, 255,255,255),0.4)">{fmtDate(minX)}</text>
        {pts.length > 1 && <text x={W - padX} y={H - 6} textAnchor="end" fontSize="9" fill="rgba(var(--fg-rgb, 255,255,255),0.4)">{fmtDate(maxX)}</text>}
      </svg>
    </div>
  );
}
