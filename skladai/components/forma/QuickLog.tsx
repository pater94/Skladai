"use client";

/**
 * FORMA — Szybkie zapisanie treningu (także minionego).
 *
 * Cel: pokonać barierę „nie chce mi się klepać w telefon". Wybierasz trening,
 * apka SAMA wypełnia wszystkie ćwiczenia i serie z ostatniego razu, ty zmieniasz
 * tylko datę i ciężary — plusami/minusami, bez klawiatury — i zapisujesz.
 *
 * Progres liczony jest INDEKSEM SIŁY, więc seria 15×100 kg i 5×120 kg są
 * porównywalne, a apka wie, czy to postęp czy regres.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listWorkouts, createWorkout, getWorkoutTemplate, logSession, strengthIndex,
  type WnWorkout, type TemplateExercise, type TemplateSet,
} from "@/lib/workoutJournal";

const ORANGE = "var(--c-orange, #f97316)";
const ORANGE_RGB = "var(--c-orange-rgb, 249,115,22)";
const GREEN = "#5fd39a";
const RED = "#f87171";

interface EditEx extends TemplateExercise { prev: TemplateSet[] }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() - offset);
  if (offset === 0) return "Dziś";
  if (offset === 1) return "Wczoraj";
  return d.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
};

export default function QuickLog({ goBack, onSaved }: { goBack: () => void; onSaved: () => void }) {
  const [workouts, setWorkouts] = useState<WnWorkout[]>([]);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [date, setDate] = useState(iso(new Date()));
  const [exercises, setExercises] = useState<EditEx[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void listWorkouts().then(setWorkouts); }, []);

  /** Po wyborze treningu — wciągnij szablon z ostatniej sesji TEGO treningu. */
  const loadTemplate = useCallback(async (id: string) => {
    setLoading(true); setError(null);
    const tpl = await getWorkoutTemplate(id);
    setExercises(tpl.map((t) => ({ ...t, prev: t.sets.map((s) => ({ ...s })) })));
    setLoading(false);
  }, []);

  const pickWorkout = (id: string) => { setWorkoutId(id); void loadTemplate(id); };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    const w = await createWorkout(name);
    setCreating(false);
    if (!w) { setError("Nie udało się utworzyć treningu."); return; }
    setWorkouts((p) => [...p, w]);
    setNewName("");
    pickWorkout(w.id);
  };

  // ── edycja serii ──
  const bump = (ei: number, si: number, field: "weight" | "reps", delta: number) => {
    setExercises((p) => p.map((ex, i) => i !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((s, j) => {
        if (j !== si) return s;
        const cur = s[field] ?? (field === "weight" ? 0 : 0);
        const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
        return { ...s, [field]: next || null };
      }),
    }));
  };
  const setField = (ei: number, si: number, field: "weight" | "reps", val: string) => {
    const n = val.trim() === "" ? null : Math.max(0, parseFloat(val.replace(",", ".")));
    setExercises((p) => p.map((ex, i) => i !== ei ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j === si ? { ...s, [field]: Number.isFinite(n as number) ? n : null } : s),
    }));
  };
  const addSet = (ei: number) => setExercises((p) => p.map((ex, i) => {
    if (i !== ei) return ex;
    const last = ex.sets[ex.sets.length - 1];
    return { ...ex, sets: [...ex.sets, last ? { ...last } : { weight: null, reps: null, duration: null }] };
  }));
  const removeSet = (ei: number, si: number) => setExercises((p) => p.map((ex, i) =>
    i !== ei ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== si) }));

  /** Czy dzisiejszy wynik bije poprzedni — liczone indeksem siły. */
  const verdict = (ex: EditEx) => {
    const now = Math.max(...ex.sets.map((s) => strengthIndex(s.weight, s.reps) ?? 0), 0);
    const before = Math.max(...ex.prev.map((s) => strengthIndex(s.weight, s.reps) ?? 0), 0);
    if (!now || !before) return null;
    const d = Math.round((now - before) * 10) / 10;
    if (Math.abs(d) <= 1) return { d: 0, txt: "bez zmian", color: "rgba(var(--fg-rgb, 255,255,255),0.6)" };
    return d > 0
      ? { d, txt: `+${d} pkt siły`, color: GREEN }
      : { d, txt: `${d} pkt siły`, color: RED };
  };

  const filled = useMemo(
    () => exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.weight != null || s.reps != null).length, 0),
    [exercises]
  );

  const handleSave = async () => {
    if (!workoutId || saving) return;
    setError(null);
    if (!filled) { setError("Uzupełnij choć jedną serię."); return; }
    setSaving(true);
    const id = await logSession({
      workoutId, date,
      exercises: exercises.map((ex) => ({ exerciseId: ex.exerciseId, sets: ex.sets })),
    });
    setSaving(false);
    if (id) onSaved(); else setError("Nie udało się zapisać. Sprawdź połączenie.");
  };

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 90 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} aria-label="Wróć" style={backBtn}>‹</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--fg, #fff)" }}>Szybki zapis</h2>
          <p style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.72)" }}>Wypełnię za Ciebie — zmień tylko ciężary</p>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 12, fontSize: 12.5, background: "rgba(var(--c-red-rgb, 239,68,68),0.12)", color: "var(--c-red, #ef4444)", border: "1px solid rgba(var(--c-red-rgb, 239,68,68),0.25)" }}>{error}</div>
      )}

      {/* KROK 1 — który trening */}
      <div style={label}>1 · Który trening</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 6 }}>
        {workouts.map((w) => (
          <button key={w.id} onClick={() => pickWorkout(w.id)} data-testid="ql-workout"
            style={chip(workoutId === w.id)}>{w.name}</button>
        ))}
      </div>
      {!workoutId && (
        <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="albo wpisz nowy, np. Nogi"
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            data-testid="ql-new-name" style={{ ...input, flex: 1 }} />
          <button onClick={() => void handleCreate()} disabled={!newName.trim() || creating}
            style={{ ...chip(false), opacity: newName.trim() ? 1 : 0.45, fontWeight: 800 }}>
            {creating ? "…" : "Dodaj"}
          </button>
        </div>
      )}

      {workoutId && (
        <>
          {/* KROK 2 — kiedy */}
          <div style={{ ...label, marginTop: 20 }}>2 · Kiedy</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            {[0, 1, 2, 3].map((off) => {
              const d = new Date(); d.setDate(d.getDate() - off);
              const v = iso(d);
              return (
                <button key={off} onClick={() => setDate(v)} data-testid="ql-day" style={chip(date === v)}>
                  {dayLabel(off)}
                </button>
              );
            })}
            <input type="date" value={date} max={iso(new Date())} onChange={(e) => setDate(e.target.value)}
              data-testid="ql-date" style={{ ...input, width: 150, colorScheme: "dark" }} />
          </div>

          {/* KROK 3 — ćwiczenia */}
          <div style={{ ...label, marginTop: 20 }}>
            3 · Ćwiczenia {exercises.length > 0 && <span style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.6)", fontWeight: 600 }}>· wypełnione z ostatniego razu</span>}
          </div>

          {loading && <div style={{ padding: 26, textAlign: "center", fontSize: 13, color: "rgba(var(--fg-rgb, 255,255,255),0.68)" }}>Wczytuję szablon…</div>}

          {!loading && exercises.length === 0 && (
            <div style={{ padding: "22px 18px", borderRadius: 14, textAlign: "center", background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.12)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg, #fff)" }}>Ten trening nie ma jeszcze ćwiczeń</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.68)", marginTop: 5 }}>
                Zapisz go raz przez {"„"}Nowy trening{"”"} albo import ze zdjęcia — potem będzie się wypełniał sam.
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {exercises.map((ex, ei) => {
              const v = verdict(ex);
              const byReps = ex.kind === "bodyweight";
              return (
                <div key={ex.exerciseId} data-testid="ql-exercise" style={card}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, color: "var(--fg, #fff)" }}>{ex.name}</div>
                    {v && <div style={{ fontSize: 11, fontWeight: 800, color: v.color, flexShrink: 0 }}>{v.txt}</div>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {ex.sets.map((s, si) => {
                      const p = ex.prev[si];
                      return (
                        <div key={si} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 16, fontSize: 11.5, fontWeight: 700, color: "rgba(var(--fg-rgb, 255,255,255),0.6)" }}>{si + 1}</span>
                          {!byReps && (
                            <div style={stepper}>
                              <button onClick={() => bump(ei, si, "weight", -2.5)} style={stepBtn} aria-label="mniej kg">−</button>
                              <input inputMode="decimal" value={s.weight ?? ""} onChange={(e) => setField(ei, si, "weight", e.target.value)}
                                style={stepInput} aria-label="ciężar" />
                              <button onClick={() => bump(ei, si, "weight", 2.5)} style={stepBtn} aria-label="więcej kg">+</button>
                            </div>
                          )}
                          <div style={stepper}>
                            <button onClick={() => bump(ei, si, "reps", -1)} style={stepBtn} aria-label="mniej powtórzeń">−</button>
                            <input inputMode="numeric" value={s.reps ?? ""} onChange={(e) => setField(ei, si, "reps", e.target.value)}
                              style={stepInput} aria-label="powtórzenia" />
                            <button onClick={() => bump(ei, si, "reps", 1)} style={stepBtn} aria-label="więcej powtórzeń">+</button>
                          </div>
                          {p && (p.weight != null || p.reps != null) && (
                            <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.52)", whiteSpace: "nowrap" }}>
                              było {p.weight != null ? `${p.weight}×` : ""}{p.reps ?? "—"}
                            </span>
                          )}
                          <button onClick={() => removeSet(ei, si)} aria-label="Usuń serię" style={delBtn}>×</button>
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={() => addSet(ei)} style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
                    + Kolejna seria
                  </button>
                </div>
              );
            })}
          </div>

          {exercises.length > 0 && (
            <button onClick={() => void handleSave()} disabled={saving} data-testid="ql-save"
              className="w-full active:scale-[0.98] transition-transform"
              style={{ ...primaryBtn, marginTop: 20, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Zapisuję…" : `Zapisz trening · ${filled} ${filled === 1 ? "seria" : "serii"}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.66)", marginBottom: 9 };
const backBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" };
const card: React.CSSProperties = { padding: "13px 13px 11px", borderRadius: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.045)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.09)" };
const input: React.CSSProperties = { padding: "9px 12px", borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)", color: "var(--fg, #fff)", fontSize: 13, fontWeight: 600, outline: "none" };
const primaryBtn: React.CSSProperties = { padding: "15px", borderRadius: 16, border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`, boxShadow: `0 6px 22px rgba(${ORANGE_RGB},0.3)` };
const stepper: React.CSSProperties = { display: "flex", alignItems: "center", gap: 0, borderRadius: 10, overflow: "hidden", background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)", flex: 1, minWidth: 0 };
const stepBtn: React.CSSProperties = { width: 30, height: 34, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "none", color: "var(--fg, #fff)", fontSize: 17, fontWeight: 800, cursor: "pointer" };
const stepInput: React.CSSProperties = { flex: 1, minWidth: 0, width: "100%", padding: "8px 2px", textAlign: "center", background: "none", border: "none", color: "var(--fg, #fff)", fontSize: 14.5, fontWeight: 800, outline: "none" };
const delBtn: React.CSSProperties = { width: 26, height: 30, flexShrink: 0, borderRadius: 8, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.55)", fontSize: 15, cursor: "pointer" };

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 700,
    background: active ? `rgba(${ORANGE_RGB},0.18)` : "rgba(var(--fg-rgb, 255,255,255),0.055)",
    border: `1px solid ${active ? `rgba(${ORANGE_RGB},0.45)` : "rgba(var(--fg-rgb, 255,255,255),0.1)"}`,
    color: active ? ORANGE : "rgba(var(--fg-rgb, 255,255,255),0.85)",
  };
}
