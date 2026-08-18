"use client";

/**
 * FORMA — edycja ZAPISANEGO treningu.
 *
 * Pozwala poprawić to, co już jest w dzienniku: nazwę treningu, datę sesji,
 * ciężary i powtórzenia, dopisać albo wyrzucić ćwiczenie, w ostateczności
 * usunąć całą sesję. Bez tego jedyną drogą na literówkę w dacie albo źle
 * odczytany ciężar z importu było wpisanie treningu od nowa.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSessionForEdit, updateSessionDate, replaceSessionSets, deleteSession,
  renameWorkout, type TemplateSet, type WnKind, type WnExercise,
} from "@/lib/workoutJournal";
import AddExercise from "./AddExercise";

const ORANGE = "var(--c-orange, #f97316)";
const ORANGE_RGB = "var(--c-orange-rgb, 249,115,22)";
const RED = "var(--c-red, #ef4444)";

interface EditEx { exerciseId: string; name: string; kind: WnKind; sets: TemplateSet[] }

export default function SessionEdit({
  sessionId, goBack, onSaved,
}: {
  sessionId: string;
  goBack: () => void;
  /** Wywoływane po zapisie albo usunięciu — ekran wywołujący odświeża listę. */
  onSaved: () => void;
}) {
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState("");
  const [origName, setOrigName] = useState("");
  const [date, setDate] = useState("");
  const [origDate, setOrigDate] = useState("");
  const [exercises, setExercises] = useState<EditEx[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getSessionForEdit(sessionId);
    if (!s) { setError("Nie udało się wczytać treningu."); setLoading(false); return; }
    setWorkoutId(s.workoutId);
    setWorkoutName(s.workoutName); setOrigName(s.workoutName);
    setDate(s.date); setOrigDate(s.date);
    setExercises(s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })));
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(raf);
  }, [load]);

  // ── edycja serii ──
  const bump = (ei: number, si: number, field: "weight" | "reps", delta: number) =>
    setExercises((p) => p.map((ex, i) => i !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((s, j) => j !== si ? s : {
        ...s, [field]: Math.max(0, Math.round(((s[field] ?? 0) + delta) * 100) / 100) || null,
      }),
    }));

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

  const removeExercise = (ei: number) => setExercises((p) => p.filter((_, i) => i !== ei));

  const addExercise = (ex: WnExercise) => setExercises((p) =>
    p.some((e) => e.exerciseId === ex.id) ? p
      : [...p, { exerciseId: ex.id, name: ex.name, kind: ex.kind, sets: [{ weight: null, reps: null, duration: null }] }]);

  const filled = useMemo(
    () => exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.weight != null || s.reps != null || s.duration != null).length, 0),
    [exercises],
  );

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    if (!filled) { setError("Trening bez ani jednej serii — uzupełnij dane albo usuń go w całości."); return; }
    setSaving(true);

    const okSets = await replaceSessionSets(sessionId, exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets })));
    if (!okSets) { setSaving(false); setError("Nie udało się zapisać serii. Sprawdź połączenie."); return; }

    if (date && date !== origDate) {
      const okDate = await updateSessionDate(sessionId, date);
      if (!okDate) { setSaving(false); setError("Serie zapisane, ale nie udało się zmienić daty."); return; }
    }
    if (workoutId && workoutName.trim() && workoutName.trim() !== origName) {
      const okName = await renameWorkout(workoutId, workoutName);
      if (!okName) { setSaving(false); setError("Serie zapisane, ale nie udało się zmienić nazwy."); return; }
    }
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await deleteSession(sessionId);
    setSaving(false);
    if (ok) onSaved(); else setError("Nie udało się usunąć treningu.");
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: "center", color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>Wczytuję trening…</div>;
  }

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 90 }} data-testid="session-edit">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} aria-label="Wróć" style={backBtn}>‹</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--fg, #fff)" }}>Edytuj trening</h2>
          <p style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.72)" }}>Popraw nazwę, datę albo wyniki</p>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 12, fontSize: 12.5, background: "rgba(var(--c-red-rgb, 239,68,68),0.12)", color: RED, border: "1px solid rgba(var(--c-red-rgb, 239,68,68),0.25)" }}>{error}</div>
      )}

      {/* Nazwa */}
      <div style={label}>Nazwa treningu</div>
      <input
        value={workoutName} onChange={(e) => setWorkoutName(e.target.value)}
        disabled={!workoutId} data-testid="se-name"
        placeholder="np. Góra A"
        style={{ ...input, width: "100%", fontSize: 15, fontWeight: 700, opacity: workoutId ? 1 : 0.5 }}
      />
      {workoutId && workoutName.trim() !== origName && (
        <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.6)", marginTop: 6 }}>
          Zmiana nazwy dotyczy wszystkich sesji tego treningu.
        </div>
      )}

      {/* Data */}
      <div style={{ ...label, marginTop: 18 }}>Data</div>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="se-date"
        style={{ ...input, width: 172, colorScheme: "dark" }} />

      {/* Ćwiczenia */}
      <div style={{ ...label, marginTop: 20 }}>Ćwiczenia · {filled} {filled === 1 ? "seria" : "serii"}</div>

      <div className="flex flex-col gap-2.5">
        {exercises.map((ex, ei) => {
          const byReps = ex.kind === "bodyweight";
          return (
            <div key={ex.exerciseId} data-testid="se-exercise" style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, color: "var(--fg, #fff)" }}>{ex.name}</div>
                <button onClick={() => removeExercise(ei)} data-testid="se-remove-exercise"
                  aria-label={`Usuń ćwiczenie ${ex.name} z tego treningu`}
                  style={{ ...delBtn, width: 30, color: RED }}>×</button>
              </div>

              <div className="flex flex-col gap-1.5">
                {ex.sets.map((s, si) => (
                  <div key={si} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 16, fontSize: 11.5, fontWeight: 700, color: "rgba(var(--fg-rgb, 255,255,255),0.6)" }}>{si + 1}</span>
                    {!byReps && (
                      <div style={stepper}>
                        <button onClick={() => bump(ei, si, "weight", -2.5)} style={stepBtn} aria-label="mniej kg">−</button>
                        <input inputMode="decimal" value={s.weight ?? ""} onChange={(e) => setField(ei, si, "weight", e.target.value)} style={stepInput} aria-label="ciężar" />
                        <button onClick={() => bump(ei, si, "weight", 2.5)} style={stepBtn} aria-label="więcej kg">+</button>
                      </div>
                    )}
                    <div style={stepper}>
                      <button onClick={() => bump(ei, si, "reps", -1)} style={stepBtn} aria-label="mniej powtórzeń">−</button>
                      <input inputMode="numeric" value={s.reps ?? ""} onChange={(e) => setField(ei, si, "reps", e.target.value)} style={stepInput} aria-label="powtórzenia" />
                      <button onClick={() => bump(ei, si, "reps", 1)} style={stepBtn} aria-label="więcej powtórzeń">+</button>
                    </div>
                    <button onClick={() => removeSet(ei, si)} aria-label="Usuń serię" style={delBtn}>×</button>
                  </div>
                ))}
              </div>

              <button onClick={() => addSet(ei)} style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
                + Kolejna seria
              </button>
            </div>
          );
        })}
      </div>

      <AddExercise onAdded={addExercise} exclude={exercises.map((e) => e.exerciseId)} />

      <button onClick={() => void handleSave()} disabled={saving} data-testid="se-save"
        className="w-full active:scale-[0.98] transition-transform"
        style={{ ...primaryBtn, marginTop: 20, opacity: saving ? 0.6 : 1 }}>
        {saving ? "Zapisuję…" : "Zapisz zmiany"}
      </button>

      {/* Usunięcie — dwa kliknięcia, bo to jedyna nieodwracalna akcja na ekranie */}
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} data-testid="se-delete"
          style={{ ...ghostBtn, marginTop: 10, color: RED }}>
          Usuń ten trening z dziennika
        </button>
      ) : (
        <div style={{ marginTop: 10, padding: 14, borderRadius: 14, background: "rgba(var(--c-red-rgb, 239,68,68),0.09)", border: "1px solid rgba(var(--c-red-rgb, 239,68,68),0.28)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg, #fff)" }}>Usunąć trening z {date}?</div>
          <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.7)", marginTop: 4 }}>
            Znikną wszystkie {filled} serii z tej sesji. Tego nie da się cofnąć.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", color: "var(--fg, #fff)" }}>Zostaw</button>
            <button onClick={() => void handleDelete()} disabled={saving} data-testid="se-delete-confirm"
              style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: RED, color: "#fff" }}>
              {saving ? "Usuwam…" : "Usuń"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.66)", marginBottom: 9 };
const backBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" };
const card: React.CSSProperties = { padding: "13px 13px 11px", borderRadius: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.045)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.09)" };
const input: React.CSSProperties = { padding: "10px 13px", borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)", color: "var(--fg, #fff)", fontSize: 13.5, fontWeight: 600, outline: "none" };
const primaryBtn: React.CSSProperties = { padding: "15px", borderRadius: 16, border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`, boxShadow: `0 6px 22px rgba(${ORANGE_RGB},0.3)` };
const ghostBtn: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 14, cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" };
const stepper: React.CSSProperties = { display: "flex", alignItems: "center", borderRadius: 10, overflow: "hidden", background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)", flex: 1, minWidth: 0 };
const stepBtn: React.CSSProperties = { width: 30, height: 34, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "none", color: "var(--fg, #fff)", fontSize: 17, fontWeight: 800, cursor: "pointer" };
const stepInput: React.CSSProperties = { flex: 1, minWidth: 0, width: "100%", padding: "8px 2px", textAlign: "center", background: "none", border: "none", color: "var(--fg, #fff)", fontSize: 14.5, fontWeight: 800, outline: "none" };
const delBtn: React.CSSProperties = { width: 26, height: 30, flexShrink: 0, borderRadius: 8, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.55)", fontSize: 15, cursor: "pointer" };
