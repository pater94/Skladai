"use client";

/**
 * FORMA — Skondensowane podsumowanie treningu (jeden ekran do zrzutu/wysłania).
 * Brandowana karta: nazwa + data, staty (objętość/serie/rekordy), lista ćwiczeń
 * z seriami w zwartej formie + top i szac. 1RM. Natywne "Udostępnij" (jeśli
 * dostępne) generuje wersję tekstową. Akcent pomarańcz #f97316.
 */

import { useEffect, useState } from "react";
import { getSessionSummary, type WnSessionSummary, type WnSummaryExercise } from "@/lib/workoutJournal";

const ORANGE = "#f97316";

/** Zwarty zapis serii: weighted "100×5", bodyweight "8", duration "60s". */
function setLabel(s: { weight: number | null; reps: number | null; duration: number | null }, kind: string): string {
  if (kind === "duration" || (s.duration != null && s.weight == null && s.reps == null)) return s.duration != null ? `${s.duration}s` : "—";
  if (kind === "bodyweight") return s.reps != null ? `${s.reps}` : "—";
  if (s.weight != null && s.reps != null) return `${s.weight}×${s.reps}`;
  if (s.weight != null) return `${s.weight}kg`;
  if (s.reps != null) return `${s.reps}`;
  return "—";
}

function topLabel(ex: WnSummaryExercise): string {
  if (ex.kind === "bodyweight") return ex.topReps != null ? `${ex.topReps} powt.` : "";
  return ex.topWeight != null ? `${ex.topWeight} kg` : "";
}

function buildShareText(s: WnSessionSummary): string {
  const d = new Date(s.date).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  const lines: string[] = [];
  lines.push(`💪 ${s.workoutName ?? "Trening"} · ${d}`);
  lines.push(`${s.totalVolume.toLocaleString("pl-PL")} kg objętości · ${s.totalSets} serii${s.prCount ? ` · ${s.prCount}× PR 🏆` : ""}`);
  lines.push("");
  for (const ex of s.exercises) {
    const sets = ex.sets.map((st) => setLabel(st, ex.kind)).join(", ");
    const extra = ex.est1RM != null ? ` (≈1RM ${ex.est1RM} kg)` : "";
    lines.push(`${ex.isPR ? "🏆 " : ""}${ex.name}`);
    lines.push(`   ${sets}${extra}`);
  }
  lines.push("");
  lines.push("via SkładAI — skladai.com");
  return lines.join("\n");
}

export default function WorkoutSummary({ goBack, sessionId }: { goBack: () => void; sessionId: string }) {
  const [sum, setSum] = useState<WnSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let c = false;
    getSessionSummary(sessionId).then((s) => { if (!c) { setSum(s); setLoading(false); } });
    return () => { c = true; };
  }, [sessionId]);

  const canShare = typeof navigator !== "undefined" && typeof (navigator as Navigator).share === "function";

  const doShare = async () => {
    if (!sum) return;
    const text = buildShareText(sum);
    try {
      if (canShare) { await (navigator as Navigator).share({ text }); return; }
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* anulowano */ }
  };

  const dateStr = sum ? new Date(sum.date).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 60 }}>
      {/* Header nawigacyjny (poza kartą — nie wchodzi w zrzut jeśli user go przytnie) */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} aria-label="Wróć" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: "var(--fg, #fff)" }}>Podsumowanie</h2>
          <p style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>Zrób zrzut ekranu i wyślij 📸</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>Ładowanie…</div>
      ) : !sum || sum.exercises.length === 0 ? (
        <div style={{ textAlign: "center", padding: "44px 20px", borderRadius: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.03)", border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.1)" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🏋️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg, #fff)" }}>Brak zapisanych serii</div>
          <div style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 4 }}>Zaloguj serie w treningu, by zobaczyć podsumowanie.</div>
        </div>
      ) : (
        <>
          {/* ── KARTA DO ZRZUTU ── */}
          <div style={{ borderRadius: 22, overflow: "hidden", background: "linear-gradient(160deg, rgba(var(--c-orange-rgb, 249,115,22),0.14), rgba(var(--bg-rgb, 10,14,12),0.6) 42%)", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.25)", boxShadow: "0 10px 40px rgba(0,0,0,0.35)" }}>
            <div style={{ padding: "18px 18px 16px" }}>
              {/* Brand + data */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`, color: "#fff", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>S</div>
                <span style={{ fontSize: 13, fontWeight: 900, color: "var(--fg, #fff)", letterSpacing: "-0.01em" }}>SkładAI</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", textTransform: "capitalize" }}>{dateStr}</span>
              </div>

              {/* Nazwa treningu */}
              <h3 style={{ fontSize: 24, fontWeight: 900, color: "var(--fg, #fff)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{sum.workoutName ?? "Trening"}</h3>

              {/* Staty */}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {[
                  { v: sum.totalVolume.toLocaleString("pl-PL"), l: "kg objętości" },
                  { v: String(sum.totalSets), l: "serii" },
                  { v: String(sum.prCount), l: sum.prCount === 1 ? "rekord 🏆" : "rekordy 🏆" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", padding: "11px 4px", borderRadius: 13, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg, #fff)", lineHeight: 1.1 }}>{s.v}</div>
                    <div style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 3 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Ćwiczenia */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 0 }}>
                {sum.exercises.map((ex, i) => {
                  const sets = ex.sets.map((st) => setLabel(st, ex.kind));
                  const top = topLabel(ex);
                  return (
                    <div key={ex.exerciseId} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid rgba(var(--fg-rgb, 255,255,255),0.06)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--fg, #fff)", flex: 1, minWidth: 0 }}>
                          {ex.isPR && <span style={{ marginRight: 5 }}>🏆</span>}{ex.name}
                        </div>
                        {top && <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--fg, #fff)", flexShrink: 0 }}>{top}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3 }}>
                        <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.55)", flex: 1, minWidth: 0 }}>{sets.join(" · ")}</div>
                        {ex.est1RM != null && <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(var(--c-orange-rgb, 249,115,22),0.85)", flexShrink: 0 }}>≈1RM {ex.est1RM}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stopka brandowa */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)", textAlign: "center", fontSize: 10.5, fontWeight: 600, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>
                Śledź swój progres · skladai.com
              </div>
            </div>
          </div>

          {/* ── AKCJE (poza kartą) ── */}
          <button onClick={() => void doShare()} className="w-full active:scale-[0.98] transition-transform" style={{ marginTop: 16, padding: "14px", borderRadius: 16, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`, color: "#fff", fontSize: 15, fontWeight: 800, boxShadow: "0 6px 22px rgba(var(--c-orange-rgb, 249,115,22),0.3)" }}>
            {copied ? "✓ Skopiowano do schowka" : canShare ? "📤 Udostępnij" : "📋 Kopiuj jako tekst"}
          </button>
          <button onClick={goBack} className="w-full active:scale-95 transition-transform" style={{ marginTop: 10, background: "none", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px" }}>
            Gotowe
          </button>
        </>
      )}
    </div>
  );
}
