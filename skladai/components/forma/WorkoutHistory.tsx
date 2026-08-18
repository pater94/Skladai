"use client";

/**
 * FORMA — historia jednego treningu.
 *
 * Pokazuje WSZYSTKIE zapisane sesje tego treningu, nie tylko ostatnią. To
 * właśnie brak tej listy sprawiał wrażenie, że nowy zapis „nadpisał" poprzedni:
 * dane siedziały w bazie, ale ekran pokazywał wyłącznie najnowszą sesję.
 * Stąd też wchodzi się w edycję konkretnego dnia.
 */

import { useCallback, useEffect, useState } from "react";
import {
  listSessions, renameWorkout, archiveWorkout, type SavedSession,
} from "@/lib/workoutJournal";

const ORANGE = "var(--c-orange, #f97316)";
const RED = "var(--c-red, #ef4444)";

function prettyDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(d + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default function WorkoutHistory({
  workoutId, workoutName, goBack, onEditSession, onArchived,
}: {
  workoutId: string;
  workoutName: string;
  goBack: () => void;
  onEditSession: (sessionId: string) => void;
  onArchived: () => void;
}) {
  const [name, setName] = useState(workoutName);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSessions(await listSessions(workoutId));
    setLoading(false);
  }, [workoutId]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(raf);
  }, [load]);

  const saveName = async () => {
    const n = name.trim();
    if (!n || n === workoutName || savingName) return;
    setSavingName(true);
    const ok = await renameWorkout(workoutId, n);
    setSavingName(false);
    if (ok) { setNameSaved(true); setTimeout(() => setNameSaved(false), 2200); }
  };

  const handleArchive = async () => {
    const ok = await archiveWorkout(workoutId);
    if (ok) onArchived();
  };

  const totalSets = sessions.reduce((n, s) => n + s.setCount, 0);

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 90 }} data-testid="workout-history">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} aria-label="Wróć" style={backBtn}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--fg, #fff)" }}>Historia treningu</h2>
          <p style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.72)" }}>
            {loading ? "…" : `${sessions.length} ${sessions.length === 1 ? "zapisany trening" : "zapisanych treningów"} · ${totalSets} serii`}
          </p>
        </div>
      </div>

      {/* Nazwa */}
      <div style={label}>Nazwa</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void saveName()}
          onKeyDown={(e) => { if (e.key === "Enter") void saveName(); }}
          data-testid="wh-name"
          style={{ ...input, flex: 1, fontSize: 15, fontWeight: 700 }} />
        <button onClick={() => void saveName()} disabled={!name.trim() || name.trim() === workoutName || savingName}
          data-testid="wh-name-save"
          style={{
            padding: "0 16px", borderRadius: 11, border: "none", fontSize: 13, fontWeight: 800, color: "#fff",
            cursor: "pointer", background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`,
            opacity: name.trim() && name.trim() !== workoutName && !savingName ? 1 : 0.4,
          }}>{savingName ? "…" : "Zmień"}</button>
      </div>
      {nameSaved && <div style={{ fontSize: 11.5, color: "var(--c-green, #22c55e)", marginTop: 6 }}>Nazwa zmieniona ✓</div>}

      {/* Sesje */}
      <div style={{ ...label, marginTop: 22 }}>Zapisane treningi</div>

      {loading && <div style={{ padding: 26, textAlign: "center", fontSize: 13, color: "rgba(var(--fg-rgb, 255,255,255),0.6)" }}>Wczytuję…</div>}

      {!loading && sessions.length === 0 && (
        <div style={{ padding: "22px 18px", borderRadius: 14, textAlign: "center", background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.12)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg, #fff)" }}>Brak zapisanych treningów</div>
          <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.68)", marginTop: 5 }}>
            Zapisz pierwszy przez szybki zapis albo import ze zdjęcia.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sessions.map((s) => (
          <button key={s.id} onClick={() => onEditSession(s.id)} data-testid="wh-session"
            className="text-left active:scale-[0.985] transition-transform"
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              padding: "13px 15px", borderRadius: 15, cursor: "pointer",
              background: "rgba(var(--fg-rgb, 255,255,255),0.045)",
              border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.09)",
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg, #fff)" }}>{prettyDate(s.date)}</div>
              <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.6)", marginTop: 3 }}>
                {s.exerciseCount} {s.exerciseCount === 1 ? "ćwiczenie" : "ćwiczeń"} · {s.setCount} serii
                {s.volume > 0 ? ` · ${s.volume.toLocaleString("pl-PL")} kg objętości` : ""}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: ORANGE, flexShrink: 0 }}>Edytuj ›</span>
          </button>
        ))}
      </div>

      {/* Ukrycie treningu — sesje zostają w bazie, więc to nie jest kasowanie danych */}
      {!confirmArchive ? (
        <button onClick={() => setConfirmArchive(true)} data-testid="wh-archive"
          style={{ ...ghostBtn, marginTop: 22, color: RED }}>
          Ukryj ten trening z listy
        </button>
      ) : (
        <div style={{ marginTop: 22, padding: 14, borderRadius: 14, background: "rgba(var(--c-red-rgb, 239,68,68),0.09)", border: "1px solid rgba(var(--c-red-rgb, 239,68,68),0.28)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg, #fff)" }}>Ukryć {"„"}{workoutName}{"”"}?</div>
          <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.7)", marginTop: 4 }}>
            Zniknie z listy treningów, ale {totalSets} serii zostaje w bazie — historia ćwiczeń nic nie traci.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setConfirmArchive(false)} style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", color: "var(--fg, #fff)" }}>Zostaw</button>
            <button onClick={() => void handleArchive()} data-testid="wh-archive-confirm"
              style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: RED, color: "#fff" }}>Ukryj</button>
          </div>
        </div>
      )}
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.66)", marginBottom: 9 };
const backBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" };
const input: React.CSSProperties = { padding: "10px 13px", borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)", color: "var(--fg, #fff)", fontSize: 13.5, fontWeight: 600, outline: "none" };
const ghostBtn: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 14, cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" };
