"use client";

/**
 * FORMA — Dziennik treningowy, ekran "Aktywny trening" (Faza 3/4).
 * Najważniejszy ekran: logowanie serii + progres + offline draft.
 * Logika danych WYŁĄCZNIE z lib/workoutJournal (Faza 1).
 *
 * Akcent pomarańcz #f97316. Liczby białe. Przyrosty zielone #5fd39a,
 * spadki czerwone #f87171 (wyjątek semantyczny). Wskaźnik progresu =
 * najcięższa seria (kg); bodyweight → powtórzenia.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getWorkoutWithExercises, getLastFinishedSession, getExerciseStats, getExerciseHistory,
  upsertSet, deleteSetByKey, finishSession, findOrCreateExercise, addExerciseToWorkout,
  saveActiveDraft, getActiveDraft, clearActiveDraft,
  type WnWorkoutWithExercises, type WnExercise, type WnKind, type WnExerciseStats, type WnHistoryPoint,
} from "@/lib/workoutJournal";

const GREEN = "#5fd39a";
const RED = "#f87171";

interface EditableSet { setIndex: number; weight: string; reps: string; duration: string; }

// "73,5" → 73.5 ; "" → null
function num(s: string): number | null {
  const t = (s || "").replace(",", ".").trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}
function setTop(sets: EditableSet[], byReps: boolean): number | null {
  let top: number | null = null;
  for (const s of sets) {
    const v = byReps ? num(s.reps) : num(s.weight);
    if (v == null) continue;
    if (top == null || v > top) top = v;
  }
  return top;
}

export default function ActiveWorkout({
  goBack, sessionId, workoutId, openExerciseHistory, onOpenSummary, onOpenTimer,
}: {
  goBack: () => void;
  sessionId: string;
  workoutId: string;
  openExerciseHistory: (exerciseId: string) => void;
  onOpenSummary: (sessionId: string) => void;
  onOpenTimer: () => void;
}) {
  const [workout, setWorkout] = useState<WnWorkoutWithExercises | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  // sety per exerciseId (edytowalne)
  const [setsBy, setSetsBy] = useState<Record<string, EditableSet[]>>({});
  // ghost "Ostatnio" per exerciseId
  const [ghostBy, setGhostBy] = useState<Record<string, string>>({});
  // staty (rekord, przyrost, 1RM) + historia per exerciseId
  const [progBy, setProgBy] = useState<Record<string, WnExerciseStats>>({});
  const [histBy, setHistBy] = useState<Record<string, WnHistoryPoint[]>>({});
  const [addingOpen, setAddingOpen] = useState(false);
  const [newExName, setNewExName] = useState("");

  // mapa exerciseId → kind
  const kindBy = useMemo(() => {
    const m: Record<string, WnKind> = {};
    workout?.exercises.forEach((e) => { m[e.exercise.id] = e.exercise.kind; });
    return m;
  }, [workout]);

  // ── Ładowanie: szablon + podpowiedzi z ostatniej sesji / draft ──
  const load = useCallback(async () => {
    setLoading(true);
    const w = await getWorkoutWithExercises(workoutId);
    setWorkout(w);
    const exIds = (w?.exercises ?? []).map((e) => e.exercise.id);

    // Draft (wznowienie po reloadzie) — jeśli pasuje do tej sesji.
    const draft = await getActiveDraft();
    const draftMatches = draft && draft.sessionId === sessionId;

    const last = await getLastFinishedSession(workoutId);
    const sets: Record<string, EditableSet[]> = {};
    const ghost: Record<string, string> = {};

    const kindOf = (id: string): WnKind => (w?.exercises.find((e) => e.exercise.id === id)?.exercise.kind ?? "weighted");
    for (const exId of exIds) {
      // ghost z ostatniej sesji
      const lastSets = (last?.sets ?? []).filter((s) => s.exercise_id === exId).sort((a, b) => a.set_index - b.set_index);
      if (lastSets.length) {
        const byReps = kindOf(exId) === "bodyweight";
        const repsList = lastSets.map((s) => s.reps ?? "—").join(",");
        const topW = Math.max(...lastSets.map((s) => s.weight_kg ?? 0));
        ghost[exId] = byReps
          ? `Ostatnio: ${repsList} powt.`
          : `Ostatnio: ${repsList}${topW > 0 ? ` × ${topW} kg` : ""}`;
      }
      // wstępne wypełnienie: draft > ostatnia sesja > 1 pusta seria
      if (draftMatches) {
        const ds = draft!.sets.filter((s) => s.exerciseId === exId).sort((a, b) => a.setIndex - b.setIndex);
        if (ds.length) {
          sets[exId] = ds.map((s) => ({ setIndex: s.setIndex, weight: s.weightKg?.toString() ?? "", reps: s.reps?.toString() ?? "", duration: s.durationSec?.toString() ?? "" }));
          continue;
        }
      }
      if (lastSets.length) {
        sets[exId] = lastSets.map((s, i) => ({ setIndex: i, weight: s.weight_kg?.toString() ?? "", reps: s.reps?.toString() ?? "", duration: s.duration_sec?.toString() ?? "" }));
      } else {
        sets[exId] = [{ setIndex: 0, weight: "", reps: "", duration: "" }];
      }
    }
    setSetsBy(sets);
    setGhostBy(ghost);
    setLoading(false);

    // staty + historia (równolegle, nie blokuje renderu)
    const prog: Record<string, WnExerciseStats> = {};
    const hist: Record<string, WnHistoryPoint[]> = {};
    await Promise.all(exIds.map(async (exId) => {
      prog[exId] = await getExerciseStats(exId);
      hist[exId] = await getExerciseHistory(exId);
    }));
    setProgBy(prog);
    setHistBy(hist);
  }, [workoutId, sessionId]);

  // load tylko raz (kindBy zmienia się po pierwszym setWorkout, ale chronimy ref-em)
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workoutId, sessionId]);

  // ── Zapis draftu lokalnie (offline safety) ──
  const persistDraft = useCallback((next: Record<string, EditableSet[]>) => {
    const flat = Object.entries(next).flatMap(([exId, list]) =>
      list.map((s) => ({ exerciseId: exId, setIndex: s.setIndex, weightKg: num(s.weight), reps: num(s.reps), durationSec: num(s.duration) }))
    );
    void saveActiveDraft({ sessionId, workoutId, sets: flat, updatedAt: new Date().toISOString() });
  }, [sessionId, workoutId]);

  // Które serie są zapisane (✓). Klucz = exId:setIndex.
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  // Zapis serii do Supabase + oznaczenie jako zapisana (✓). Offline → upsertSet
  // kolejkuje, ale oznaczamy zapisaną bo draft + kolejka gwarantują trwałość.
  const saveSet = useCallback((exId: string, setIndex: number, w: number | null, r: number | null, d: number | null) => {
    if (w == null && r == null && d == null) return;
    void upsertSet({ sessionId, exerciseId: exId, setIndex, weightKg: w, reps: r, durationSec: d });
    setSavedKeys((prev) => { const n = new Set(prev); n.add(`${exId}:${setIndex}`); return n; });
  }, [sessionId]);

  const updateField = (exId: string, setIndex: number, field: "weight" | "reps" | "duration", value: string) => {
    setSetsBy((prev) => {
      const list = (prev[exId] ?? []).map((s) => s.setIndex === setIndex ? { ...s, [field]: value } : s);
      const next = { ...prev, [exId]: list };
      persistDraft(next);
      return next;
    });
    // edycja → seria "brudna" (do ponownego zapisu)
    setSavedKeys((prev) => { const k = `${exId}:${setIndex}`; if (!prev.has(k)) return prev; const n = new Set(prev); n.delete(k); return n; });
  };

  // zapis serii (na blur pola lub klik znacznika „zapisz")
  const commitSet = (exId: string, setIndex: number) => {
    const s = (setsBy[exId] ?? []).find((x) => x.setIndex === setIndex);
    if (!s) return;
    saveSet(exId, setIndex, num(s.weight), num(s.reps), num(s.duration));
  };

  const addSet = (exId: string) => {
    setSetsBy((prev) => {
      const list = prev[exId] ?? [];
      const nextIndex = list.length ? Math.max(...list.map((s) => s.setIndex)) + 1 : 0;
      const next = { ...prev, [exId]: [...list, { setIndex: nextIndex, weight: "", reps: "", duration: "" }] };
      persistDraft(next);
      return next;
    });
  };

  // „Taka sama" — duplikuje ostatnią WYPEŁNIONĄ serię + od razu zapisuje (1 klik).
  const addSameSet = (exId: string) => {
    const list = setsBy[exId] ?? [];
    const src = [...list].reverse().find((s) => num(s.weight) != null || num(s.reps) != null || num(s.duration) != null) ?? list[list.length - 1];
    const nextIndex = list.length ? Math.max(...list.map((s) => s.setIndex)) + 1 : 0;
    const ns: EditableSet = { setIndex: nextIndex, weight: src?.weight ?? "", reps: src?.reps ?? "", duration: src?.duration ?? "" };
    const next = { ...setsBy, [exId]: [...list, ns] };
    setSetsBy(next);
    persistDraft(next);
    saveSet(exId, nextIndex, num(ns.weight), num(ns.reps), num(ns.duration));
  };

  // Usuwa serię: z widoku, z bazy (po kluczu) i z listy zapisanych.
  const deleteSetRow = (exId: string, setIndex: number) => {
    setSetsBy((prev) => {
      const next = { ...prev, [exId]: (prev[exId] ?? []).filter((s) => s.setIndex !== setIndex) };
      persistDraft(next);
      return next;
    });
    setSavedKeys((prev) => { const k = `${exId}:${setIndex}`; if (!prev.has(k)) return prev; const n = new Set(prev); n.delete(k); return n; });
    void deleteSetByKey({ sessionId, exerciseId: exId, setIndex });
  };

  const handleAddExercise = async () => {
    const name = newExName.trim();
    if (!name) return;
    const ex = await findOrCreateExercise(name, "weighted");
    if (ex) {
      await addExerciseToWorkout(workoutId, ex.id);
      setNewExName(""); setAddingOpen(false);
      await load();
    }
  };

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    await finishSession(sessionId);
    await clearActiveDraft();
    // Po zakończeniu → skondensowane podsumowanie (do zrzutu / wysłania).
    onOpenSummary(sessionId);
  };

  // ── Podsumowanie sesji (na żywo) ──
  const summary = useMemo(() => {
    let volume = 0, series = 0, prDziś = 0;
    for (const [exId, list] of Object.entries(setsBy)) {
      const byReps = kindBy[exId] === "bodyweight";
      const record = progBy[exId]?.record ?? null;
      for (const s of list) {
        const w = num(s.weight), r = num(s.reps);
        if (w != null || r != null || num(s.duration) != null) series++;
        if (w != null && r != null) volume += w * r;
        const metric = byReps ? r : w;
        if (record != null && metric != null && metric > record) prDziś++;
      }
    }
    return { volume: Math.round(volume), series, prDziś };
  }, [setsBy, kindBy, progBy]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: "center", color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>Ładowanie treningu…</div>;
  }

  const exDate = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 90 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={goBack} aria-label="Wróć" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--fg, #fff)" }}>{workout?.name ?? "Trening"}</h2>
          <p style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>{exDate} · {workout?.exercises.length ?? 0} ćwiczeń</p>
        </div>
        {/* Timer odpoczynku — tutaj, bo pływający guzik pokazuje się dopiero po odpaleniu */}
        <button onClick={onOpenTimer} aria-label="Timer odpoczynku" title="Timer odpoczynku" className="active:scale-95 transition-transform" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--c-orange-rgb, 249,115,22),0.12)", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.28)", color: "var(--c-orange, #f97316)", fontSize: 17, cursor: "pointer" }}>⏱</button>
      </div>

      {/* Pasek podsumowania */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[
          { v: summary.volume.toLocaleString("pl-PL"), l: "Objętość" },
          { v: summary.series, l: "Serie" },
          { v: summary.prDziś, l: "Rekordy dziś" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 14, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: "var(--fg, #fff)" }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Karty ćwiczeń */}
      <div className="flex flex-col gap-3">
        {(workout?.exercises ?? []).map((we) => {
          const ex = we.exercise;
          const kind = ex.kind;
          const byReps = kind === "bodyweight";
          const list = setsBy[ex.id] ?? [];
          const prog = progBy[ex.id];
          const record = prog?.record ?? null;
          const week = prog?.weekDelta ?? null;
          const liveTop = setTop(list, byReps);
          return (
            <ExerciseCard
              key={ex.id}
              ex={ex} kind={kind} byReps={byReps}
              list={list} ghost={ghostBy[ex.id]} record={record} weekDelta={week}
              addedAbs={prog?.addedAbs ?? null} addedPct={prog?.addedPct ?? null} best1RM={prog?.best1RM ?? null}
              history={histBy[ex.id] ?? []} liveTop={liveTop}
              onField={updateField} onCommit={commitSet} onAddSet={addSet} onSame={addSameSet} onDelete={deleteSetRow}
              saved={savedKeys}
              onOpenHistory={() => openExerciseHistory(ex.id)}
            />
          );
        })}
      </div>

      {/* Dodaj ćwiczenie */}
      {!addingOpen ? (
        <button onClick={() => setAddingOpen(true)} className="w-full active:scale-[0.98] transition-transform" style={{ marginTop: 14, padding: "13px", borderRadius: 14, cursor: "pointer", background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.15)", color: "rgba(var(--fg-rgb, 255,255,255),0.7)", fontSize: 14, fontWeight: 700 }}>
          + Dodaj ćwiczenie
        </button>
      ) : (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" }}>
          <input
            value={newExName} onChange={(e) => setNewExName(e.target.value)} autoFocus
            placeholder="Nazwa ćwiczenia (np. Wyciskanie płaskie)"
            onKeyDown={(e) => { if (e.key === "Enter") void handleAddExercise(); }}
            style={{ width: "100%", padding: "11px 13px", borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)", color: "var(--fg, #fff)", fontSize: 14, outline: "none" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => { setAddingOpen(false); setNewExName(""); }} style={{ flex: 1, padding: "10px", borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Anuluj</button>
            <button onClick={() => void handleAddExercise()} style={{ flex: 1, padding: "10px", borderRadius: 11, background: "var(--c-orange, #f97316)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Dodaj</button>
          </div>
        </div>
      )}

      {/* Zakończ trening */}
      <button onClick={() => void handleFinish()} disabled={finishing} data-testid="workout-finish" className="w-full active:scale-[0.98] transition-transform" style={{ marginTop: 20, padding: "16px", borderRadius: 16, cursor: "pointer", border: "none", background: "linear-gradient(135deg, var(--c-orange, #f97316), var(--c-orange-3, #ea580c))", color: "#fff", fontSize: 15, fontWeight: 800, boxShadow: "0 6px 22px rgba(var(--c-orange-rgb, 249,115,22),0.3)", opacity: finishing ? 0.6 : 1 }}>
        {finishing ? "Zapisuję…" : "Zakończ trening"}
      </button>
    </div>
  );
}

// ── Karta pojedynczego ćwiczenia ──
function ExerciseCard({
  ex, kind, byReps, list, ghost, record, weekDelta, addedAbs, addedPct, best1RM, history, liveTop,
  onField, onCommit, onAddSet, onSame, onDelete, saved, onOpenHistory,
}: {
  ex: WnExercise; kind: WnKind; byReps: boolean;
  list: EditableSet[]; ghost?: string; record: number | null; weekDelta: number | null;
  addedAbs: number | null; addedPct: number | null; best1RM: number | null;
  history: WnHistoryPoint[]; liveTop: number | null;
  onField: (exId: string, setIndex: number, field: "weight" | "reps" | "duration", v: string) => void;
  onCommit: (exId: string, setIndex: number) => void;
  onAddSet: (exId: string) => void;
  onSame: (exId: string) => void;
  onDelete: (exId: string, setIndex: number) => void;
  saved: Set<string>;
  onOpenHistory: () => void;
}) {
  const anyFilled = list.some((s) => num(s.weight) != null || num(s.reps) != null || num(s.duration) != null);
  const showWeight = kind === "weighted" || kind === "weighted_bw";
  const showReps = kind !== "duration";
  const showDuration = kind === "duration";

  return (
    <div style={{ padding: "14px 14px 12px", borderRadius: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
      {/* Nagłówek karty: nazwa (tap → historia) + chip progresu tygodniowego */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={onOpenHistory} style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--fg, #fff)" }}>{ex.name}</span>
        </button>
        {weekDelta != null && weekDelta !== 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 800, padding: "3px 8px", borderRadius: 99, color: weekDelta > 0 ? GREEN : RED, background: weekDelta > 0 ? "rgba(95,211,154,0.14)" : "rgba(248,113,113,0.14)" }}>
            {weekDelta > 0 ? "↑" : "↓"} {Math.abs(weekDelta)}{byReps ? " powt." : " kg"}
          </span>
        )}
      </div>

      {ghost && <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginBottom: 10 }}>{ghost}</div>}

      {/* Serie */}
      <div className="flex flex-col gap-1.5">
        {list.map((s, i) => {
          const metric = byReps ? num(s.reps) : num(s.weight);
          const isPR = record != null && metric != null && metric > record;
          return (
            <div key={s.setIndex} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 20, textAlign: "center", fontSize: 12, fontWeight: 700, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>{i + 1}</span>
              {showWeight && (
                <input inputMode="decimal" value={s.weight} placeholder="kg"
                  onChange={(e) => onField(ex.id, s.setIndex, "weight", e.target.value)}
                  onBlur={() => onCommit(ex.id, s.setIndex)}
                  style={fieldStyle} />
              )}
              {showReps && (
                <input inputMode="numeric" value={s.reps} placeholder="powt."
                  onChange={(e) => onField(ex.id, s.setIndex, "reps", e.target.value)}
                  onBlur={() => onCommit(ex.id, s.setIndex)}
                  style={fieldStyle} />
              )}
              {showDuration && (
                <input inputMode="numeric" value={s.duration} placeholder="czas (s)"
                  onChange={(e) => onField(ex.id, s.setIndex, "duration", e.target.value)}
                  onBlur={() => onCommit(ex.id, s.setIndex)}
                  style={{ ...fieldStyle, flex: 2 }} />
              )}
              {(() => {
                const hasVal = num(s.weight) != null || num(s.reps) != null || num(s.duration) != null;
                const isSaved = saved.has(`${ex.id}:${s.setIndex}`);
                return (
                  <button
                    onClick={() => onCommit(ex.id, s.setIndex)}
                    disabled={!hasVal}
                    aria-label={isSaved ? "Zapisano" : "Zapisz serię"}
                    title={isSaved ? "Zapisano" : "Zapisz"}
                    style={{
                      width: 32, height: 32, flexShrink: 0, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: hasVal ? "pointer" : "default",
                      background: !hasVal ? "transparent" : isSaved ? "rgba(95,211,154,0.16)" : "rgba(var(--fg-rgb, 255,255,255),0.06)",
                      border: !hasVal ? "1px solid rgba(var(--fg-rgb, 255,255,255),0.06)" : isSaved ? "1px solid rgba(95,211,154,0.4)" : "1px solid rgba(var(--fg-rgb, 255,255,255),0.14)",
                      color: isSaved ? GREEN : "rgba(var(--fg-rgb, 255,255,255),0.45)", fontSize: 14, fontWeight: 800,
                    }}
                  >
                    {isPR ? "🏆" : "✓"}
                  </button>
                );
              })()}
              <button
                onClick={() => onDelete(ex.id, s.setIndex)}
                aria-label="Usuń serię"
                title="Usuń serię"
                className="active:scale-90 transition-transform"
                style={{ width: 30, height: 32, flexShrink: 0, borderRadius: 9, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)", color: "rgba(var(--fg-rgb, 255,255,255),0.4)", fontSize: 16, cursor: "pointer" }}
              >×</button>
            </div>
          );
        })}
      </div>

      {/* Dodawanie serii — „Taka sama" dubluje ostatnią (1 klik, auto-zapis) */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => onSame(ex.id)}
          disabled={!anyFilled}
          className="active:scale-[0.97] transition-transform"
          style={{
            flex: 1, padding: "9px", borderRadius: 10, cursor: anyFilled ? "pointer" : "default", fontSize: 12.5, fontWeight: 800,
            background: anyFilled ? "rgba(var(--c-orange-rgb, 249,115,22),0.14)" : "rgba(var(--fg-rgb, 255,255,255),0.04)",
            border: anyFilled ? "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.3)" : "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)",
            color: anyFilled ? "var(--c-orange, #f97316)" : "rgba(var(--fg-rgb, 255,255,255),0.35)",
          }}
        >
          + Taka sama
        </button>
        <button
          onClick={() => onAddSet(ex.id)}
          className="active:scale-[0.97] transition-transform"
          style={{ flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "rgba(var(--fg-rgb, 255,255,255),0.7)" }}
        >
          + Pusta seria
        </button>
      </div>

      {/* Stopka: rekord + ≈1RM + przyrost od startu (kg/%) + sparkline */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(var(--fg-rgb, 255,255,255),0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.55)" }}>
            Rekord <strong style={{ color: "var(--fg, #fff)" }}>{record != null ? `${record}${byReps ? "" : " kg"}` : "—"}</strong>
            {liveTop != null && record != null && liveTop > record && <span style={{ color: GREEN, marginLeft: 6 }}>nowy! 🏆</span>}
          </div>
          {!byReps && best1RM != null && (
            <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(var(--c-orange-rgb, 249,115,22),0.85)" }}>≈1RM {best1RM} kg</div>
          )}
          <div style={{ flex: 1 }} />
          <Sparkline history={history} byReps={byReps} />
        </div>
        {addedAbs != null && addedAbs !== 0 && (
          <div style={{ fontSize: 11, marginTop: 6, color: addedAbs > 0 ? GREEN : RED, fontWeight: 600 }}>
            Od startu {addedAbs > 0 ? "+" : ""}{addedAbs}{byReps ? " powt." : " kg"}
            {addedPct != null && addedPct !== 0 && <span style={{ opacity: 0.85 }}> ({addedPct > 0 ? "+" : ""}{addedPct}%)</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: 10, textAlign: "center",
  background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)",
  color: "var(--fg, #fff)", fontSize: 14, fontWeight: 700, outline: "none",
};

function Sparkline({ history, byReps }: { history: WnHistoryPoint[]; byReps: boolean }) {
  const vals = history.map((p) => (byReps ? p.topReps : p.topWeight)).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const w = 56, h = 18;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--c-orange, #f97316)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
