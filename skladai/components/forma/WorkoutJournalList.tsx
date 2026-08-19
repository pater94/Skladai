"use client";

/**
 * FORMA — Dziennik treningowy, ekran "Lista treningów" (Faza 2/4).
 * Korzysta WYŁĄCZNIE z warstwy danych lib/workoutJournal (Faza 1).
 * Akcent: pomarańcz #f97316. Liczby białe. Jeden akcent na ekran.
 */

import { useEffect, useState, useCallback } from "react";
import { History, FileText } from "lucide-react";
import {
  listWorkouts, createWorkout, startSession,
  getWorkoutWithExercises, getLastFinishedSession, listSessions,
  type WnWorkout,
} from "@/lib/workoutJournal";

interface WorkoutMeta {
  exerciseCount: number;
  lastFinishedAt: string | null;
  lastVolume: number | null;
  lastSessionId: string | null;
  /** Ile treningów już zapisano — bez tego karta wygląda, jakby był tylko ostatni. */
  sessionCount: number;
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h temu`;
  const d = Math.floor(h / 24);
  if (d === 1) return "wczoraj";
  if (d < 7) return `${d} dni temu`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} tyg. temu`;
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export default function WorkoutJournalList({
  goBack,
  openWorkout,
  onImport,
  onOpenSummary,
  onQuickLog,
  onOpenHistory,
}: {
  goBack: () => void;
  openWorkout: (sessionId: string, workoutId: string) => void;
  onImport?: () => void;
  onOpenSummary?: (sessionId: string) => void;
  onQuickLog?: () => void;
  /** Wszystkie zapisane sesje treningu + zmiana nazwy. */
  onOpenHistory?: (workoutId: string, name: string) => void;
}) {
  const [workouts, setWorkouts] = useState<WnWorkout[]>([]);
  const [meta, setMeta] = useState<Record<string, WorkoutMeta>>({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listWorkouts();
    setWorkouts(list);
    setLoading(false);
    // meta per trening (równolegle)
    const entries = await Promise.all(
      list.map(async (w): Promise<[string, WorkoutMeta]> => {
        const [full, last, saved] = await Promise.all([
          getWorkoutWithExercises(w.id),
          getLastFinishedSession(w.id),
          listSessions(w.id),
        ]);
        const lastVolume = last
          ? last.sets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0)
          : null;
        return [w.id, {
          exerciseCount: full?.exercises.length ?? 0,
          lastFinishedAt: last?.finished_at ?? null,
          lastVolume: lastVolume && lastVolume > 0 ? Math.round(lastVolume) : null,
          lastSessionId: last?.id ?? null,
          sessionCount: saved.length,
        }];
      })
    );
    setMeta(Object.fromEntries(entries));
  }, []);

  // odroczone o klatkę — bez synchronicznego setState w efekcie
  useEffect(() => {
    const raf = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(raf);
  }, [load]);

  const handleStart = async (workoutId: string) => {
    if (starting) return;
    setStarting(workoutId);
    const session = await startSession(workoutId);
    setStarting(null);
    if (session) openWorkout(session.id, workoutId);
  };

  const handleNew = async () => {
    if (starting) return;
    setStarting("new");
    const w = await createWorkout("Nowy trening");
    if (w) {
      const session = await startSession(w.id);
      setStarting(null);
      if (session) { openWorkout(session.id, w.id); return; }
    }
    setStarting(null);
    void load();
  };

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={goBack} aria-label="Wróć" style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)",
          color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer",
        }}>‹</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--fg, #fff)", letterSpacing: "-0.02em" }}>Treningi</h2>
          <p style={{ fontSize: 12.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>Wybierz dzień, by zacząć</p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "5px 11px", borderRadius: 99, flexShrink: 0,
          background: "rgba(var(--c-orange-rgb, 249,115,22),0.15)", color: "var(--c-orange, #f97316)",
          border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.3)",
        }}>Forma</span>
      </div>

      {/* Najszybsza ścieżka — zapis treningu bez przepisywania wszystkiego */}
      {onQuickLog && (
        <button
          onClick={onQuickLog}
          data-testid="workout-quick-log"
          className="w-full active:scale-[0.98] transition-transform"
          style={{
            marginTop: 16, padding: "14px 16px", borderRadius: 16, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 11, textAlign: "left",
            background: "linear-gradient(135deg, rgba(var(--c-orange-rgb, 249,115,22),0.18), rgba(var(--c-orange-rgb, 249,115,22),0.06))",
            border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.35)",
          }}
        >
          <span style={{ fontSize: 21, flexShrink: 0 }}>⚡</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: "var(--fg, #fff)" }}>Szybki zapis treningu</span>
            <span style={{ display: "block", fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.72)", marginTop: 2 }}>
              Wypełnię z ostatniego razu — zmień datę i ciężary
            </span>
          </span>
          <span style={{ color: "var(--c-orange, #f97316)", fontSize: 20, flexShrink: 0 }}>›</span>
        </button>
      )}

      {/* Lista */}
      <div className="flex flex-col gap-2.5 mt-5">
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(var(--fg-rgb, 255,255,255),0.4)", fontSize: 13 }}>
            Ładowanie…
          </div>
        )}

        {!loading && workouts.length === 0 && (
          <div style={{
            textAlign: "center", padding: "36px 20px", borderRadius: 16,
            background: "rgba(var(--fg-rgb, 255,255,255),0.03)", border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.1)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📓</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg, #fff)" }}>Brak treningów</div>
            <div style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 4 }}>
              Stwórz pierwszy trening (np. {"„"}Góra A{"”"}) i zacznij logować serie.
            </div>
          </div>
        )}

        {!loading && workouts.map((w) => {
          const m = meta[w.id];
          const rel = relativeTime(m?.lastFinishedAt ?? null);
          const canSummary = !!(onOpenSummary && m?.lastSessionId);
          return (
            <div key={w.id} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <button
                onClick={() => handleStart(w.id)}
                disabled={starting === w.id}
                data-testid="workout-card"
                className="text-left active:scale-[0.985] transition-transform"
                style={{
                  flex: 1, minWidth: 0,
                  display: "flex", alignItems: "center", gap: 12, position: "relative", overflow: "hidden",
                  padding: "14px 16px 14px 18px", borderRadius: 16, cursor: "pointer",
                  background: "rgba(var(--fg-rgb, 255,255,255),0.04)",
                  border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)",
                  opacity: starting === w.id ? 0.6 : 1,
                }}
              >
                {/* pasek akcentu po lewej */}
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "linear-gradient(180deg, var(--c-orange, #f97316), var(--c-orange-3, #ea580c))" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--fg, #fff)" }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 3 }}>
                    {m ? `${m.exerciseCount} ${m.exerciseCount === 1 ? "ćwiczenie" : "ćwiczeń"}` : "…"}
                    {m && m.sessionCount > 0 ? ` · ${m.sessionCount} ${m.sessionCount === 1 ? "zapis" : "zapisów"}` : ""}
                    {rel ? ` · ostatnio ${rel}` : ""}
                  </div>
                </div>
                {m?.lastVolume != null && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--fg, #fff)" }}>{m.lastVolume.toLocaleString("pl-PL")}</div>
                    <div style={{ fontSize: 10, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>objętość</div>
                  </div>
                )}
                <span style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.3)", fontSize: 20, flexShrink: 0 }}>›</span>
              </button>
              {onOpenHistory && (
                <button
                  onClick={() => onOpenHistory(w.id, w.name)}
                  aria-label={`Historia i edycja treningu ${w.name}`}
                  title="Historia i edycja"
                  data-testid="workout-history-btn"
                  className="active:scale-95 transition-transform"
                  style={{
                    width: 46, flexShrink: 0, borderRadius: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(var(--fg-rgb, 255,255,255),0.05)",
                    border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)",
                    color: "rgba(var(--fg-rgb, 255,255,255),0.75)",
                  }}
                ><History size={18} /></button>
              )}
              {canSummary && (
                <button
                  onClick={() => onOpenSummary!(m!.lastSessionId!)}
                  aria-label={`Podsumowanie ostatniego treningu ${w.name}`}
                  title="Podsumowanie ostatniego treningu"
                  data-testid="workout-summary-btn"
                  className="active:scale-95 transition-transform"
                  style={{
                    width: 46, flexShrink: 0, borderRadius: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(var(--c-orange-rgb, 249,115,22),0.1)",
                    border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.25)",
                    color: "var(--c-orange, #f97316)",
                  }}
                ><FileText size={18} /></button>
              )}
            </div>
          );
        })}
      </div>

      {/* Nowy trening */}
      <button
        onClick={handleNew}
        disabled={starting === "new"}
        data-testid="workout-new"
        className="w-full active:scale-[0.98] transition-transform"
        style={{
          marginTop: 18, padding: "15px", borderRadius: 16, cursor: "pointer", border: "none",
          background: "linear-gradient(135deg, var(--c-orange, #f97316), var(--c-orange-3, #ea580c))",
          color: "#fff", fontSize: 15, fontWeight: 800,
          boxShadow: "0 6px 22px rgba(var(--c-orange-rgb, 249,115,22),0.3)",
          opacity: starting === "new" ? 0.6 : 1,
        }}
      >
        {starting === "new" ? "Tworzę…" : "+ Nowy trening"}
      </button>

      {onImport && (
        <button
          onClick={onImport}
          data-testid="workout-import-entry"
          className="w-full active:scale-[0.98] transition-transform"
          style={{
            marginTop: 10, padding: "13px", borderRadius: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "rgba(var(--c-orange-rgb, 249,115,22),0.1)",
            border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.28)",
            color: "var(--c-orange, #f97316)", fontSize: 14, fontWeight: 800,
          }}
        >
          📷 Zaimportuj trening ze zdjęcia
        </button>
      )}
    </div>
  );
}
