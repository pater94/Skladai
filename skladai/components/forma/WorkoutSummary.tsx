"use client";

/**
 * FORMA — Podsumowanie treningu. Jeden ekran, bez przewijania strony.
 *
 * Cała treść mieści się w JEDNEJ karcie o wysokości ekranu: nagłówek, staty
 * i stopka stoją w miejscu, a przewija się wyłącznie lista ćwiczeń. Dzięki temu
 * zrzut ekranu zawsze łapie komplet — nazwę treningu, objętość, serie i markę.
 *
 * Liczby idą krojem Inter z `tabular-nums`, żeby kolumny TOP i 1RM stały równo
 * niezależnie od cyfr. Bez emoji — ekran ma wyglądać jak raport, nie jak czat.
 *
 * Warstwa danych bez zmian: wszystko pochodzi z getSessionSummary().
 */

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { inter } from "@/lib/fonts";
import { getSessionSummary, type WnSessionSummary, type WnSummaryExercise } from "@/lib/workoutJournal";

// ── paleta ekranu (kontrast wg specyfikacji, nie obniżać) ──
const PRIMARY = "#F2EEE6";
const SERIES = "rgba(242,238,230,0.62)";
const META = "rgba(242,238,230,0.46)";
const LINE = "rgba(242,238,230,0.12)";
const CARD_BG = "#0B0B0C";
const ACCENT = "#F26419";

/** Liczba po polsku: przecinek dziesiętny, spacja jako separator tysięcy. */
const num = (n: number) => n.toLocaleString("pl-PL");

/** Seria w formie „127,5 × 5". Bez ciężaru (masa ciała) — same powtórzenia. */
function setLabel(s: { weight: number | null; reps: number | null; duration: number | null }, kind: string): string {
  if (kind === "duration" || (s.duration != null && s.weight == null && s.reps == null)) {
    return s.duration != null ? `${s.duration}s` : "—";
  }
  if (kind === "bodyweight") return s.reps != null ? num(s.reps) : "—";
  if (s.weight != null && s.reps != null) return `${num(s.weight)} × ${num(s.reps)}`;
  if (s.weight != null) return num(s.weight);
  if (s.reps != null) return num(s.reps);
  return "—";
}

/** Kolumna TOP: najcięższa seria (albo najwięcej powtórzeń przy masie ciała). */
function topValue(ex: WnSummaryExercise): string {
  if (ex.kind === "bodyweight") return ex.topReps != null ? num(ex.topReps) : "—";
  return ex.topWeight != null ? num(ex.topWeight) : "—";
}

function buildShareText(s: WnSessionSummary): string {
  const d = new Date(s.date).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  const lines: string[] = [];
  lines.push(`${s.workoutName ?? "Trening"} · ${d}`);
  lines.push(`${num(s.totalVolume)} kg objętości · ${s.totalSets} serii${s.prCount ? ` · ${s.prCount} PR` : ""}`);
  lines.push("");
  for (const ex of s.exercises) {
    const sets = ex.sets.map((st) => setLabel(st, ex.kind)).join(" · ");
    const extra = ex.est1RM != null ? ` (1RM ${num(ex.est1RM)})` : "";
    lines.push(`${ex.name}${ex.isPR ? " [PR]" : ""}`);
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

  const dateStr = sum
    ? new Date(sum.date).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const exCount = sum?.exercises.length ?? 0;

  return (
    <div
      className={inter.className}
      data-testid="workout-summary"
      style={{
        // Dokładnie tyle, ile zostaje w kontenerze przewijania: okno minus dolna
        // nawigacja (68 px + safe area) minus górny padding strony (24 px).
        // Pasek i „Gotowe" mają stałą wysokość, więc karta poniżej dostaje flex:1
        // i strona nie ma czego przewijać.
        height: "calc(100dvh - 68px - env(safe-area-inset-bottom, 0px) - 24px)",
        minHeight: 420,
        display: "flex",
        flexDirection: "column",
        fontVariantNumeric: "tabular-nums",
        animation: "fadeInUp 0.35s ease both",
      }}
    >
      {/* ── Pasek górny ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexShrink: 0 }}>
        <button
          onClick={goBack}
          aria-label="Wróć"
          style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(242,238,230,0.05)", border: `1px solid ${LINE}`,
            color: PRIMARY, fontSize: 17,
          }}
        >←</button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: PRIMARY }}>Podsumowanie</div>
        <button
          onClick={() => void doShare()}
          data-testid="summary-share"
          className="active:scale-95 transition-transform"
          style={{
            display: "flex", alignItems: "center", gap: 7, flexShrink: 0, cursor: "pointer",
            padding: "9px 14px", borderRadius: 10,
            background: "transparent", border: `1px solid ${LINE}`,
            color: ACCENT, fontSize: 13, fontWeight: 600,
          }}
        >
          <Share2 size={14} />
          {copied ? "Skopiowano" : "Udostępnij"}
        </button>
      </div>

      {/* ── Karta ── */}
      <div
        style={{
          flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
          borderRadius: 10, background: CARD_BG, border: `1px solid ${LINE}`, overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: META }}>
            Ładowanie…
          </div>
        ) : !sum || exCount === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: PRIMARY }}>Brak zapisanych serii</div>
            <div style={{ fontSize: 12, color: SERIES }}>Zaloguj serie w treningu, by zobaczyć podsumowanie.</div>
          </div>
        ) : (
          <>
            {/* Marka + data */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 14px 0", flexShrink: 0 }}>
              <div style={{
                width: 17, height: 17, borderRadius: 4, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: ACCENT, color: CARD_BG, fontSize: 11, fontWeight: 700, lineHeight: 1,
              }}>S</div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: PRIMARY }}>SkładAI</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: META }}>{dateStr}</span>
            </div>

            {/* Nazwa treningu + staty w jednej linii */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "10px 14px 12px", flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY, lineHeight: 1.1, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sum.workoutName ?? "Trening"}
                </div>
                <div style={{ fontSize: 11.5, color: SERIES, marginTop: 4 }}>
                  {exCount} {exCount === 1 ? "ćwiczenie" : exCount < 5 ? "ćwiczenia" : "ćwiczeń"} · ukończony
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexShrink: 0 }}>
                {[
                  { v: num(sum.totalVolume), l: "kg", accent: false },
                  { v: String(sum.totalSets), l: "serii", accent: false },
                  { v: String(sum.prCount), l: "PR", accent: true },
                ].map((s) => (
                  <div key={s.l} style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.05, color: s.accent ? ACCENT : PRIMARY }}>{s.v}</div>
                    <div style={{ fontSize: 9.5, color: META, marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nagłówek tabeli */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
              borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`,
              fontSize: 9, fontWeight: 600, letterSpacing: "1.3px", textTransform: "uppercase", color: META, flexShrink: 0,
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>Ćwiczenie</span>
              <span style={{ width: 62, textAlign: "right" }}>Top</span>
              <span style={{ width: 56, textAlign: "right" }}>1RM</span>
            </div>

            {/* Lista ćwiczeń — JEDYNY element, który się przewija */}
            <div data-testid="summary-list" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 14px" }}>
              {sum.exercises.map((ex, i) => (
                <div key={ex.exerciseId} style={{ padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {/* nazwa i tag PR trzymają się razem — tag przylega do tekstu,
                        a nie odjeżdża na drugi koniec wiersza */}
                    <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ minWidth: 0, fontSize: 13, fontWeight: 600, color: PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ex.name}
                      </span>
                      {ex.isPR && (
                        <span style={{
                          flexShrink: 0, fontSize: 8.5, fontWeight: 600, letterSpacing: "0.6px",
                          padding: "1px 4px", borderRadius: 3,
                          border: `1px solid ${ACCENT}`, color: ACCENT, lineHeight: 1.5,
                        }}>PR</span>
                      )}
                    </span>
                    <span style={{ width: 62, textAlign: "right", flexShrink: 0, fontSize: 13.5, fontWeight: 700, color: PRIMARY }}>
                      {topValue(ex)}
                    </span>
                    <span style={{ width: 56, textAlign: "right", flexShrink: 0, fontSize: 12, fontWeight: 600, color: ACCENT }}>
                      {ex.est1RM != null ? num(ex.est1RM) : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0 6px", marginTop: 3, fontSize: 10.5, color: SERIES, lineHeight: 1.5 }}>
                    {ex.sets.map((st, k) => (
                      <span key={k}>
                        {k > 0 && <span style={{ color: LINE, marginRight: 6 }}>·</span>}
                        {setLabel(st, ex.kind)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Stopka karty */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 14px", borderTop: `1px solid ${LINE}`, fontSize: 9.5, color: META, flexShrink: 0,
            }}>
              <span>skladai.com</span>
              <span>Dziennik treningowy</span>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
