"use client";

/**
 * FORMA — Dziennik treningowy, ekran "Historia ćwiczenia".
 * Rekord + szacowany 1RM (Epley/Brzycki) subtelnie z boku, przyrost od startu
 * (kg + %), wykres najcięższej serii w czasie + lista sesji (z 1RM per sesja).
 * Akcent pomarańcz #f97316. Liczby białe. Przyrosty zielone.
 */

import { useEffect, useState } from "react";
import {
  getExercise, getExerciseHistory, getExerciseStats, estimate1RM,
  type WnExercise, type WnHistoryPoint, type WnExerciseStats,
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
  const [stats, setStats] = useState<WnExerciseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ex, hist, st] = await Promise.all([
        getExercise(exerciseId),
        getExerciseHistory(exerciseId),
        getExerciseStats(exerciseId),
      ]);
      if (cancelled) return;
      setExercise(ex);
      setHistory(hist);
      setStats(st);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  const byReps = exercise?.kind === "bodyweight";
  const unit = byReps ? "" : " kg";
  const valOf = (p: WnHistoryPoint) => (byReps ? p.topReps : p.topWeight);
  const has1RM = !byReps && stats?.best1RM != null;

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 60 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} aria-label="Wróć" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: "var(--fg, #fff)" }}>{exercise?.name ?? "Ćwiczenie"}</h2>
          <p style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>Progres w czasie</p>
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
          {/* HERO: rekord + 1RM subtelnie z boku */}
          <div style={{ padding: "16px 18px", borderRadius: 18, marginBottom: 12, background: "linear-gradient(145deg, rgba(var(--c-orange-rgb, 249,115,22),0.1), rgba(var(--c-orange-rgb, 249,115,22),0.02))", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.2)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={miniLabel}>Rekord</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "var(--fg, #fff)", lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {stats?.record ?? "—"}<span style={{ fontSize: 17, fontWeight: 700, color: "rgba(var(--fg-rgb, 255,255,255),0.55)" }}>{stats?.record != null ? unit : ""}</span>
                </div>
              </div>
              {has1RM && (
                <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: 12, borderLeft: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" }}>
                  <div style={{ ...miniLabel, color: "rgba(var(--c-orange-rgb, 249,115,22),0.9)" }}>Szac. 1RM</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--c-orange, #f97316)", lineHeight: 1.05 }}>≈{stats!.best1RM}<span style={{ fontSize: 12, fontWeight: 700 }}> kg</span></div>
                  <div style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginTop: 2 }}>z {stats!.best1RMWeight}kg × {stats!.best1RMReps}</div>
                </div>
              )}
            </div>

            {/* Przyrost od startu — kg + % */}
            {stats?.addedAbs != null && stats.addedAbs !== 0 && (
              <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)", display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.55)" }}>Od startu</span>
                <span style={{ fontSize: 17, fontWeight: 900, color: stats.addedAbs > 0 ? GREEN : "#f87171" }}>
                  {stats.addedAbs > 0 ? "+" : ""}{stats.addedAbs}{unit}
                </span>
                {stats.addedPct != null && stats.addedPct !== 0 && (
                  <span style={{ fontSize: 13, fontWeight: 800, padding: "2px 8px", borderRadius: 99, color: stats.addedPct > 0 ? GREEN : "#f87171", background: stats.addedPct > 0 ? "rgba(95,211,154,0.14)" : "rgba(248,113,113,0.14)" }}>
                    {stats.addedPct > 0 ? "+" : ""}{stats.addedPct}%
                  </span>
                )}
                {stats.firstDate && (
                  <span style={{ fontSize: 10.5, color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginLeft: "auto" }}>
                    od {new Date(stats.firstDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "2-digit" })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3 staty */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <Stat label="Sesje" value={String(stats?.sessions ?? 0)} color="var(--fg, #fff)" />
            <Stat label="Ten tydzień" value={fmtDelta(stats?.weekDelta, unit)} color={deltaColor(stats?.weekDelta)} />
            {has1RM
              ? <Stat label="Teraz 1RM" value={stats?.current1RM != null ? `≈${stats.current1RM} kg` : "—"} color="var(--c-orange, #f97316)" />
              : <Stat label="Ostatnio" value={stats?.lastTop != null ? `${stats.lastTop}${unit}` : "—"} color="var(--fg, #fff)" />
            }
          </div>

          {/* Wykres */}
          <ProgressChart history={history} valOf={valOf} unit={unit} record={stats?.record ?? null} />

          {/* Historia sesji */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginBottom: 10 }}>Historia sesji</div>
            <div className="flex flex-col gap-2">
              {[...history].reverse().map((p) => {
                const top = valOf(p);
                const isPR = stats?.record != null && top != null && top === stats.record;
                const reps = p.sets.map((s) => s.reps ?? "—").join(",");
                // najlepszy szac. 1RM tej sesji (weighted)
                let s1rm: number | null = null;
                if (!byReps) for (const s of p.sets) { const e = estimate1RM(s.weight_kg, s.reps); if (e != null && (s1rm == null || e > s1rm)) s1rm = e; }
                return (
                  <div key={p.sessionId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 13, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg, #fff)" }}>
                        {new Date(p.finishedAt).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
                        {isPR && <span style={{ marginLeft: 7 }}>🏆</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 2 }}>
                        {reps} powt.{s1rm != null && <span style={{ marginLeft: 7, color: "rgba(var(--c-orange-rgb, 249,115,22),0.75)" }}>≈1RM {s1rm} kg</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--fg, #fff)", flexShrink: 0 }}>{top != null ? `${top}${unit}` : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metodologia 1RM — subtelna nota */}
          {has1RM && (
            <div style={{ marginTop: 14, fontSize: 10.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.35)", textAlign: "center" }}>
              1RM szacowany wzorami Epleya i Brzyckiego (średnia). Najdokładniejszy dla serii do ~12 powtórzeń.
            </div>
          )}
        </>
      )}
    </div>
  );
}

const miniLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginBottom: 4 };

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "13px 6px", borderRadius: 14, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
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
        {[0, 0.5, 1].map((g) => {
          const y = padTop + g * (H - padTop - padBottom);
          return <line key={g} x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(var(--fg-rgb, 255,255,255),0.06)" strokeWidth="1" />;
        })}
        {areaPts && <polygon points={areaPts} fill="url(#wnChartFill)" />}
        <polyline points={linePts} fill="none" stroke="var(--c-orange, #f97316)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p.t)} cy={sy(p.v)} r={i === prIdx ? 4.5 : 2.6} fill={i === prIdx ? "var(--c-orange, #f97316)" : "var(--bg-panel, #0a0f0d)"} stroke="var(--c-orange, #f97316)" strokeWidth="1.6" />
        ))}
        {prIdx >= 0 && (
          <text x={Math.min(Math.max(sx(pts[prIdx].t), 22), W - 22)} y={Math.max(sy(pts[prIdx].v) - 9, 12)} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--c-orange, #f97316)">
            PR {pts[prIdx].v}{unit}
          </text>
        )}
        <text x={padX} y={H - 6} fontSize="9" fill="rgba(var(--fg-rgb, 255,255,255),0.4)">{fmtDate(minX)}</text>
        {pts.length > 1 && <text x={W - padX} y={H - 6} textAnchor="end" fontSize="9" fill="rgba(var(--fg-rgb, 255,255,255),0.4)">{fmtDate(maxX)}</text>}
      </svg>
    </div>
  );
}
