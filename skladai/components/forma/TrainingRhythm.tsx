"use client";

/**
 * FORMA — Rytm: ile realnie trenujesz i ile dostaje każda partia.
 *
 * ── Problem, który to rozwiązuje ─────────────────────────────────────────
 * Licznik „w tym tygodniu" jest bezużyteczny dla kogoś, kto ma rotację
 * trzech treningów i zmienną ilość czasu: raz pokaże 3, raz 1, a tempo
 * przez cały czas będzie takie samo. Dlatego wszystko liczy się w OKNIE
 * KROCZĄCYM (domyślnie 10 dni) i podaje jako tempo na 7 dni — jedną liczbę,
 * którą da się porównać z celem i śledzić z dnia na dzień.
 *
 * Objętość jest w SERIACH NA PARTIĘ, nie w przerzuconych kilogramach.
 * Kilogramy premiują przysiad nad wznosami bokiem i nie mówią nic o tym,
 * ile pracy dostał konkretny mięsień.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { listWorkouts, listSessions, getSessionForEdit } from "@/lib/workoutJournal";
import {
  rhythmFrom, rhythmVerdict, nextDueInDays, PART_NAME, PART_COLOR, WEEKLY_TARGET,
  DEFAULT_WINDOW, DEFAULT_TARGET, type RhythmSession, type RhythmResult,
} from "@/lib/training/rhythm";

const ORANGE = "var(--c-orange, #f97316)";
const dim = (a: number) => `rgba(var(--fg-rgb, 255,255,255),${a})`;
const TARGET_KEY = "wn_rhythm_target";

const CARD: React.CSSProperties = {
  padding: 15, borderRadius: 17, marginBottom: 13,
  background: dim(0.04), border: `1px solid ${dim(0.08)}`,
};
const HEAD: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
  color: dim(0.55), marginBottom: 10,
};

const DOW = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];
const nf = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function TrainingRhythm({ goBack }: { goBack: () => void }) {
  /* Cel czytany raz, przy pierwszym renderze — inicjalizator useState zamiast
     efektu, żeby nie było zbędnego przerysowania i ostrzeżenia o setState
     w efekcie. Na serwerze localStorage nie istnieje, stąd typeof. */
  const [target, setTarget] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TARGET;
    const v = Number(window.localStorage.getItem(TARGET_KEY));
    return Number.isFinite(v) && v >= 1 && v <= 7 ? v : DEFAULT_TARGET;
  });
  const [sessions, setSessions] = useState<RhythmSession[] | null>(null);

  const changeTarget = (v: number) => {
    const clamped = Math.min(6, Math.max(1, Math.round(v * 10) / 10));
    setTarget(clamped);
    localStorage.setItem(TARGET_KEY, String(clamped));
  };

  /** Wczytuje wszystkie sesje ze wszystkich treningów z ostatnich tygodni. */
  const load = useCallback(async () => {
    const workouts = await listWorkouts();
    const out: RhythmSession[] = [];
    for (const w of workouts) {
      const saved = await listSessions(w.id);
      for (const s of saved.slice(0, 20)) {
        const full = await getSessionForEdit(s.id);
        if (!full) continue;
        out.push({
          day: s.date,
          workoutName: w.name,
          entries: full.exercises.map((e) => ({ exerciseName: e.name, sets: e.sets.length })),
        });
      }
    }
    setSessions(out);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(raf);
  }, [load]);

  const r: RhythmResult | null = useMemo(
    () => (sessions ? rhythmFrom({ sessions, targetPerWeek: target, windowDays: DEFAULT_WINDOW }, 35) : null),
    [sessions, target],
  );

  if (!r) {
    return (
      <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 90 }}>
        <Header goBack={goBack} />
        <div style={{ padding: 40, textAlign: "center", color: dim(0.5), fontSize: 13 }}>Liczę…</div>
      </div>
    );
  }

  const verdict = rhythmVerdict(r);
  const due = nextDueInDays(r);
  const tone = verdict.tone === "good" ? "#5fd39a" : verdict.tone === "warn" ? "#fbbf24" : "#f87171";
  const pct = Math.min(100, (r.perWeek / Math.max(target, 0.1)) * 100);

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 90 }} data-testid="training-rhythm">
      <Header goBack={goBack} />

      {/* ── TEMPO ── */}
      <div style={CARD} data-testid="rhythm-pace">
        <div style={HEAD}>Twoje tempo</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ fontSize: 46, fontWeight: 900, lineHeight: 0.9, color: "var(--fg, #fff)", fontVariantNumeric: "tabular-nums" }}>
            {nf(r.perWeek)}
          </div>
          <div style={{ paddingBottom: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: dim(0.8) }}>treningu / 7 dni</div>
            <div style={{ fontSize: 11, color: dim(0.5) }}>
              {r.sessionsInWindow} {r.sessionsInWindow === 1 ? "trening" : r.sessionsInWindow < 5 ? "treningi" : "treningów"} w ostatnich {r.windowDays} dniach
            </div>
          </div>
        </div>

        {/* Pasek: gdzie jesteś względem celu */}
        <div style={{ marginTop: 13, position: "relative", height: 10, borderRadius: 99, background: dim(0.08), overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: tone, transition: "width .45s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: tone }}>{verdict.text}</span>
          <span style={{ fontSize: 11, color: dim(0.45) }}>cel {nf(target)}</span>
        </div>

        {/* Cel — do zmiany bez wychodzenia z ekranu */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${dim(0.07)}` }}>
          <span style={{ fontSize: 12, color: dim(0.6), flex: 1 }}>Ile treningów na 7 dni chcesz robić?</span>
          <button onClick={() => changeTarget(target - 0.5)} data-testid="rhythm-target-down" style={stepBtn}>−</button>
          <span data-testid="rhythm-target" style={{ minWidth: 34, textAlign: "center", fontSize: 15, fontWeight: 900, color: ORANGE, fontVariantNumeric: "tabular-nums" }}>
            {nf(target)}
          </span>
          <button onClick={() => changeTarget(target + 0.5)} data-testid="rhythm-target-up" style={stepBtn}>+</button>
        </div>
        <div style={{ fontSize: 10.5, color: dim(0.42), marginTop: 7 }}>
          {nf(target)} na tydzień = cykl {r.nextWorkout ? "3 treningów" : "treningów"} co ok. {nf(21 / target)} dnia.
        </div>
      </div>

      {/* ── NASTĘPNY ── */}
      <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 12 }} data-testid="rhythm-next">
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: due === 0 ? "rgba(var(--c-orange-rgb, 249,115,22),0.18)" : dim(0.06),
          border: `1px solid ${due === 0 ? "rgba(var(--c-orange-rgb, 249,115,22),0.35)" : dim(0.1)}`,
          fontSize: 17, fontWeight: 900, color: due === 0 ? ORANGE : dim(0.7),
        }}>
          {due === 0 ? "!" : nf(due ?? 0).replace(",0", "")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--fg, #fff)" }}>
            {due === 0 ? "Trening należy się dziś"
              : (due ?? 0) < 1 ? "Następny jeszcze dziś"
              : `Następny za ${nf(due ?? 0)} dnia`}
          </div>
          <div style={{ fontSize: 11.5, color: dim(0.6), marginTop: 2 }}>
            {r.nextWorkout ? `Wg rotacji: ${r.nextWorkout}. ` : ""}
            {r.daysSinceLast == null ? "Brak historii."
              : r.daysSinceLast === 0 ? "Ostatni trening był dzisiaj."
              : `Od ostatniego minął${r.daysSinceLast === 1 ? " 1 dzień" : `y ${r.daysSinceLast} dni`}.`}
          </div>
        </div>
      </div>

      {/* ── KALENDARZ ── */}
      <div style={CARD} data-testid="rhythm-calendar">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={HEAD}>Ostatnie 5 tygodni</div>
          <div style={{ fontSize: 10, color: dim(0.42), marginBottom: 10 }}>
            jaśniejsze tło = liczone okno {r.windowDays} dni
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 5 }}>
          {DOW.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 9, color: dim(0.35), fontWeight: 700 }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {r.days.map((d) => {
            const dt = new Date(d.day + "T12:00:00");
            const trained = d.sessions > 0;
            return (
              <div key={d.day} data-testid={trained ? "rhythm-day-trained" : "rhythm-day"} title={`${d.day}${trained ? ` — ${d.workoutNames.join(", ")}, ${d.totalSets} serii` : ""}`}
                style={{
                  aspectRatio: "1", borderRadius: 9, padding: 3,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  background: d.inWindow ? dim(0.13) : dim(0.028),
                  border: `1px solid ${trained ? "rgba(var(--c-orange-rgb, 249,115,22),0.4)" : dim(0.05)}`,
                }}>
                <span style={{ fontSize: 9.5, fontWeight: trained ? 800 : 500, color: trained ? "var(--fg, #fff)" : dim(0.32), lineHeight: 1 }}>
                  {dt.getDate()}
                </span>
                {trained && (
                  <span style={{ display: "flex", gap: 1.5, height: 4 }}>
                    {d.parts.slice(0, 4).map((p) => (
                      <span key={p} style={{ width: 4, height: 4, borderRadius: 99, background: PART_COLOR[p] }} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SERIE NA PARTIE ── */}
      <div style={CARD} data-testid="rhythm-parts">
        <div style={HEAD}>Serie na partię — tygodniowo</div>
        <div style={{ fontSize: 11, color: dim(0.5), marginTop: -5, marginBottom: 12 }}>
          Liczone z okna {r.windowDays} dni i przeliczone na 7. Seria główna liczy się w całości,
          wspomagająca w połowie.
        </div>

        {r.parts.map((p) => {
          const t = WEEKLY_TARGET[p.part];
          const scale = Math.max(t.max * 1.25, p.perWeek * 1.05, 1);
          const color = p.status === "ok" ? PART_COLOR[p.part] : p.status === "low" ? dim(0.3) : "#f87171";
          return (
            <div key={p.part} style={{ marginBottom: 11 }} data-testid="rhythm-part-row">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: dim(0.85) }}>{PART_NAME[p.part]}</span>
                <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: p.status === "ok" ? "var(--fg, #fff)" : color }}>
                  {nf(p.perWeek)}
                  <span style={{ fontSize: 10, color: dim(0.4), fontWeight: 600 }}> / {t.min}–{t.max}</span>
                </span>
              </div>
              <div style={{ position: "relative", height: 8, borderRadius: 99, background: dim(0.07), overflow: "hidden" }}>
                {/* pasmo zalecane */}
                <div style={{
                  position: "absolute", left: `${(t.min / scale) * 100}%`, width: `${((t.max - t.min) / scale) * 100}%`,
                  top: 0, bottom: 0, background: dim(0.09),
                }} />
                <div style={{ width: `${Math.min(100, (p.perWeek / scale) * 100)}%`, height: "100%", borderRadius: 99, background: color, transition: "width .45s ease" }} />
              </div>
            </div>
          );
        })}

        {r.unmatched.length > 0 && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 11, background: dim(0.05), fontSize: 10.5, color: dim(0.6) }} data-testid="rhythm-unmatched">
            <b style={{ color: dim(0.8) }}>Nie policzono:</b> {r.unmatched.join(", ")}.
            {" "}Tych ćwiczeń nie udało się pewnie przypisać do partii, więc celowo nie doliczam ich do objętości —
            wolę pokazać mniej niż skłamać. Otwórz ćwiczenie w mapie mięśni i wskaż dopasowanie, a zaczną się liczyć.
          </div>
        )}
      </div>

      {/* ── SKĄD TE LICZBY ── */}
      <div style={{ ...CARD, marginBottom: 0 }}>
        <div style={HEAD}>Skąd te liczby</div>
        <ul style={{ fontSize: 11, lineHeight: 1.6, color: dim(0.62), paddingLeft: 16, margin: 0, listStyle: "disc outside" }}>
          <li>Tempo liczone z <b>okna {r.windowDays} dni</b>, nie z kalendarzowego tygodnia — dzięki temu nie skacze, gdy cykl nie wpada równo w siedem dni.</li>
          <li>Objętość w <b>seriach na partię</b>. Kilogramy pominięte celowo: nie mówią, ile pracy dostał konkretny mięsień.</li>
          <li>Widełki {WEEKLY_TARGET.chest.min}–{WEEKLY_TARGET.chest.max} serii to typowy zakres, w którym mieści się większość planów — dolna granica to próg postępu, górna to miejsce, gdzie zaczyna brakować regeneracji.</li>
          {r.cycleDays != null && <li>Pełny obrót rotacji zajmuje Ci ostatnio <b>{nf(r.cycleDays)} dnia</b>, średni odstęp między treningami to {r.avgGap != null ? nf(r.avgGap) : "—"} dnia.</li>}
        </ul>
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 10, cursor: "pointer",
  background: dim(0.07), border: `1px solid ${dim(0.14)}`,
  color: "var(--fg, #fff)", fontSize: 16, fontWeight: 800, lineHeight: 1,
};

function Header({ goBack }: { goBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={goBack} aria-label="Wróć" style={{
        width: 38, height: 38, borderRadius: 12, cursor: "pointer",
        background: dim(0.06), border: `1px solid ${dim(0.12)}`, color: "var(--fg, #fff)", fontSize: 18,
      }}>‹</button>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--fg, #fff)" }}>Rytm treningowy</h2>
        <p style={{ fontSize: 12, color: dim(0.7) }}>Ile realnie trenujesz i co dostaje każda partia</p>
      </div>
    </div>
  );
}
