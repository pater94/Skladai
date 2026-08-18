"use client";

/**
 * FORMA — dopisanie ćwiczenia do treningu.
 *
 * Jeden kontrolka używana wszędzie tam, gdzie użytkownik układa listę ćwiczeń:
 * w szybkim zapisie i w edycji zapisanego treningu. Podpowiada nazwy, których
 * już używał, żeby ta sama „ławka" nie zapisała się raz jako „Wyciskanie
 * leżąc", a raz jako „wyciskanie płaskie" i nie rozbiła historii progresu.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { listExercises, findOrCreateExercise, type WnExercise } from "@/lib/workoutJournal";

const ORANGE = "var(--c-orange, #f97316)";

export default function AddExercise({
  onAdded, exclude = [], label = "+ Dodaj ćwiczenie",
}: {
  /** Wywoływane po utworzeniu/znalezieniu ćwiczenia. */
  onAdded: (ex: WnExercise) => void;
  /** ID ćwiczeń już obecnych na liście — nie podpowiadamy ich drugi raz. */
  exclude?: string[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState<WnExercise[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open && !all.length) void listExercises().then(setAll); }, [open, all.length]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const excluded = useMemo(() => new Set(exclude), [exclude]);
  const hints = useMemo(() => {
    const q = name.trim().toLowerCase();
    return all
      .filter((e) => !excluded.has(e.id))
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [all, name, excluded]);

  const commit = async (raw?: string) => {
    const n = (raw ?? name).trim();
    if (!n || busy) return;
    setBusy(true);
    const ex = await findOrCreateExercise(n, "weighted");
    setBusy(false);
    if (!ex) return;
    setName(""); setOpen(false);
    onAdded(ex);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} data-testid="add-exercise-open"
        className="w-full active:scale-[0.98] transition-transform"
        style={{
          marginTop: 12, padding: 13, borderRadius: 14, cursor: "pointer",
          background: "rgba(var(--fg-rgb, 255,255,255),0.04)",
          border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.18)",
          color: "rgba(var(--fg-rgb, 255,255,255),0.75)", fontSize: 14, fontWeight: 700,
        }}>{label}</button>
    );
  }

  return (
    <div style={{
      marginTop: 12, padding: 14, borderRadius: 14,
      background: "rgba(var(--fg-rgb, 255,255,255),0.04)",
      border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)",
    }}>
      <input
        ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa ćwiczenia (np. Wyciskanie leżąc)"
        data-testid="add-exercise-name"
        onKeyDown={(e) => { if (e.key === "Enter") void commit(); if (e.key === "Escape") setOpen(false); }}
        style={{
          width: "100%", padding: "11px 13px", borderRadius: 11, outline: "none", fontSize: 14,
          background: "rgba(var(--fg-rgb, 255,255,255),0.06)",
          border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.14)", color: "var(--fg, #fff)",
        }}
      />

      {hints.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {hints.map((h) => (
            <button key={h.id} onClick={() => void commit(h.name)} data-testid="add-exercise-hint"
              style={{
                padding: "6px 11px", borderRadius: 99, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: "rgba(var(--fg-rgb, 255,255,255),0.06)",
                border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)",
                color: "rgba(var(--fg-rgb, 255,255,255),0.85)",
              }}>{h.name}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => { setOpen(false); setName(""); }}
          style={{
            flex: 1, padding: 10, borderRadius: 11, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
            background: "rgba(var(--fg-rgb, 255,255,255),0.05)", color: "rgba(var(--fg-rgb, 255,255,255),0.7)",
          }}>Anuluj</button>
        <button onClick={() => void commit()} disabled={!name.trim() || busy} data-testid="add-exercise-save"
          style={{
            flex: 1, padding: 10, borderRadius: 11, border: "none", fontSize: 13, fontWeight: 800, color: "#fff",
            cursor: name.trim() ? "pointer" : "default", opacity: name.trim() && !busy ? 1 : 0.5,
            background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`,
          }}>{busy ? "Dodaję…" : "Dodaj"}</button>
      </div>
    </div>
  );
}
