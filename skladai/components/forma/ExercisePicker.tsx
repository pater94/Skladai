"use client";

/**
 * FORMA — „Do którego ćwiczenia to przypisać?"
 *
 * Pokazywane, gdy ani lokalny matcher, ani AI nie są pewne, jakie ćwiczenie
 * użytkownik ma na myśli. Wybór zapisuje się TRWALE (rememberMapping), więc
 * pytanie pada tylko raz na daną nazwę.
 */

import { useMemo, useState } from "react";
import { MUSCLES } from "@/lib/anatomy/muscles";
import type { ExerciseAnatomy } from "@/lib/anatomy/exercises";
import { rememberMapping, searchCatalog, type MatchCandidate } from "@/lib/anatomy/matcher";

const ORANGE = "var(--c-orange, #f97316)";
const ORANGE_RGB = "var(--c-orange-rgb, 249,115,22)";

/** Główna partia ćwiczenia — do etykiety na liście. */
function mainMuscleName(ex: ExerciseAnatomy): string {
  const top = [...ex.activation].sort((a, b) => b.share - a.share)[0];
  return top ? MUSCLES[top.muscle].group : "";
}

export default function ExercisePicker({
  rawName, candidates, onPicked,
}: {
  rawName: string;
  candidates: MatchCandidate[];
  onPicked: (ex: ExerciseAnatomy) => void;
}) {
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Brak kandydatów (np. korekta zapamiętanego wyboru) → od razu pełny katalog z wyszukiwarką.
  const showAll = browsing || candidates.length === 0;
  const list = useMemo<ExerciseAnatomy[]>(() => {
    if (showAll) return searchCatalog(query);
    return candidates.map((c) => c.ex);
  }, [showAll, query, candidates]);

  const pick = async (ex: ExerciseAnatomy) => {
    if (saving) return;
    setSaving(ex.id);
    await rememberMapping(rawName, ex.id);
    onPicked(ex);
  };

  return (
    <div
      data-testid="exercise-picker"
      style={{
        marginTop: 22, padding: "16px 16px 14px", borderRadius: 18,
        background: `linear-gradient(150deg, rgba(${ORANGE_RGB},0.1), rgba(var(--fg-rgb, 255,255,255),0.03))`,
        border: `1px solid rgba(${ORANGE_RGB},0.24)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>🧩</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 900, color: "var(--fg, #fff)" }}>Które to ćwiczenie?</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.78)", marginTop: 3 }}>
            Zapisałeś je jako {"„"}<strong style={{ color: ORANGE }}>{rawName}</strong>{"”"}. Wskaż odpowiednik, a pokażę pracujące
            mięśnie. Zapamiętam wybór — zapytam tylko raz.
          </div>
        </div>
      </div>

      {/* Wyszukiwarka (gdy przeglądamy cały katalog) */}
      {showAll && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Szukaj, np. wyciskanie, przysiad, biceps…"
          data-testid="exercise-picker-search"
          style={{
            width: "100%", marginTop: 12, padding: "10px 12px", borderRadius: 11,
            background: "rgba(var(--fg-rgb, 255,255,255),0.06)",
            border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)",
            color: "var(--fg, #fff)", fontSize: 13.5, outline: "none",
          }}
        />
      )}

      {/* Lista kandydatów */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, maxHeight: showAll ? 320 : undefined, overflowY: showAll ? "auto" : undefined }}>
        {list.length === 0 && (
          <div style={{ padding: "14px 4px", textAlign: "center", fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.68)" }}>
            Brak wyników — spróbuj innego słowa.
          </div>
        )}
        {list.map((ex, i) => {
          const cand = candidates.find((c) => c.ex.id === ex.id);
          const isTop = !showAll && i === 0 && !!cand;
          return (
            <button
              key={ex.id}
              onClick={() => void pick(ex)}
              disabled={!!saving}
              data-testid="exercise-picker-option"
              className="w-full text-left active:scale-[0.99] transition-transform"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, cursor: "pointer",
                background: isTop ? `rgba(${ORANGE_RGB},0.13)` : "rgba(var(--fg-rgb, 255,255,255),0.04)",
                border: `1px solid ${isTop ? `rgba(${ORANGE_RGB},0.32)` : "rgba(var(--fg-rgb, 255,255,255),0.07)"}`,
                opacity: saving && saving !== ex.id ? 0.5 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--fg, #fff)" }}>{ex.name}</div>
                <div style={{ fontSize: 10.5, color: "rgba(var(--fg-rgb, 255,255,255),0.72)", marginTop: 2 }}>
                  {mainMuscleName(ex)} · {ex.pattern}
                </div>
              </div>
              {isTop && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 99, flexShrink: 0, background: `rgba(${ORANGE_RGB},0.2)`, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {cand?.why === "podpowiedź AI" ? "AI" : "najlepsze"}
                </span>
              )}
              <span style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.55)", fontSize: 17, flexShrink: 0 }}>›</span>
            </button>
          );
        })}
      </div>

      {/* Przełącznik: kandydaci ↔ cały katalog */}
      <button
        onClick={() => { setBrowsing((b) => !b); setQuery(""); }}
        data-testid="exercise-picker-browse"
        style={{
          width: "100%", marginTop: 10, padding: "9px", borderRadius: 11, cursor: "pointer",
          background: "rgba(var(--fg-rgb, 255,255,255),0.05)",
          border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)",
          color: "rgba(var(--fg-rgb, 255,255,255),0.82)", fontSize: 12, fontWeight: 700,
        }}
      >
        {showAll ? (candidates.length ? "‹ Pokaż podpowiedzi" : "Anuluj") : "🔍 Żadne z tych — przeglądaj wszystkie"}
      </button>
    </div>
  );
}
