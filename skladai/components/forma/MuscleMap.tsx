"use client";

/**
 * FORMA — Interaktywna mapa mięśni dla ćwiczenia.
 *
 * Sylwetka (przód / tył) z partiami wycieniowanymi wg realnego udziału w pracy.
 * Tam gdzie mięsień ma wyraźnie odrębne GŁOWY (klatka, naramienny, triceps,
 * czworogłowy, łydka, czworoboczny…) każda głowa jest osobnym, klikalnym
 * kształtem i ma własną intensywność — widać, która pracuje mocniej.
 *
 * Tap / hover → panel z pełnym opisem: funkcja, przyczepy, rozkład głów,
 * wskazówki treningowe i niuans specyficzny dla tego ćwiczenia.
 */

import { useMemo, useState } from "react";
import { MUSCLES, type MuscleId } from "@/lib/anatomy/muscles";
import type { ExerciseAnatomy, MuscleActivation, ActivationRole } from "@/lib/anatomy/exercises";

const ORANGE = "var(--c-orange, #f97316)";
const ORANGE_RGB = "var(--c-orange-rgb, 249,115,22)";

// ── pomocnicze kształty ──
/** Elipsa jako ścieżka (spójny render + łatwe lustrzane odbicie). */
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

interface Region {
  muscle: MuscleId;
  head?: string;
  d: string;
  /** true → renderuj też odbicie lustrzane (parzyste partie) */
  mirror?: boolean;
}

// ─────────────────────── SYLWETKA (wspólny podkład) ───────────────────────
// Proporcje: barki 58–142, talia 80–120, biodra 76–124. Tors zajmuje sporo
// miejsca (tam jest najwięcej partii), nogi skrócone dla czytelności na telefonie.
const BODY: string[] = [
  ell(100, 25, 15, 18),                                         // głowa
  "M 92 40 h 16 v 14 q -8 5 -16 0 z",                           // szyja
  // tors z V-kształtem (barki → talia → biodra)
  "M 72 60 C 60 64 55 74 57 88 L 64 118 L 80 148 L 78 174 L 122 174 L 120 148 L 136 118 L 143 88 C 145 74 140 64 128 60 Z",
  ell(48, 100, 12, 24), ell(152, 100, 12, 24),                  // ramiona
  ell(40, 146, 10, 24), ell(160, 146, 10, 24),                  // przedramiona
  ell(36, 177, 7, 9), ell(164, 177, 7, 9),                      // dłonie
  ell(86, 220, 17, 48), ell(114, 220, 17, 48),                  // uda
  ell(86, 272, 12, 10), ell(114, 272, 12, 10),                  // kolana
  ell(86, 312, 11, 34), ell(114, 312, 11, 34),                  // podudzia
  "M 76 350 h 20 v 11 h -20 z", "M 104 350 h 20 v 11 h -20 z",  // stopy
];

// ─────────────────────── PRZÓD ───────────────────────
const FRONT_REGIONS: Region[] = [
  // czworoboczny — górna część widoczna od przodu (skos szyja → bark)
  { muscle: "traps", head: "upper", d: "M 97 48 L 66 66 L 80 76 L 97 60 Z", mirror: true },
  // naramienny
  { muscle: "delts", head: "front", d: ell(63, 74, 14, 14), mirror: true },
  { muscle: "delts", head: "side", d: ell(53, 84, 8, 12), mirror: true },
  // klatka piersiowa — trzy pasma (góra / środek / dół)
  { muscle: "chest", head: "clavicular", d: "M 74 64 Q 86 61 98 64 L 98 79 Q 85 77 72 82 Z", mirror: true },
  { muscle: "chest", head: "sternal", d: "M 72 83 Q 85 79 98 81 L 98 96 Q 84 96 71 98 Z", mirror: true },
  { muscle: "chest", head: "abdominal", d: "M 71 99 Q 84 97 98 98 L 98 112 Q 85 115 76 110 Z", mirror: true },
  // zębaty przedni (ząbki pod klatką)
  { muscle: "serratus", head: "main", d: "M 68 104 l 9 -2 l -1 6 l -8 2 z M 69 114 l 9 -2 l -1 6 l -8 2 z", mirror: true },
  // biceps (dwie głowy) + ramienny
  { muscle: "biceps", head: "long", d: ell(43, 97, 6, 17), mirror: true },
  { muscle: "biceps", head: "short", d: ell(52, 99, 6, 16), mirror: true },
  { muscle: "brachialis", head: "main", d: ell(46, 122, 7, 9), mirror: true },
  // przedramię
  { muscle: "forearms", head: "flexors", d: ell(41, 144, 8, 21), mirror: true },
  // brzuch (centralnie — bez odbicia)
  { muscle: "abs", head: "upper", d: "M 89 116 h 22 v 30 h -22 z" },
  { muscle: "abs", head: "lower", d: "M 90 148 h 20 v 26 h -20 z" },
  { muscle: "obliques", head: "external", d: "M 78 116 q 9 -2 10 4 l -1 40 q -8 4 -12 -6 z", mirror: true },
  { muscle: "core_deep", head: "main", d: "M 84 176 h 32 v 11 h -32 z" },
  // biodra + uda
  { muscle: "hip_flexors", head: "psoas", d: ell(92, 184, 7, 9), mirror: true },
  { muscle: "quads", head: "vastus_lateralis", d: ell(76, 218, 8, 36), mirror: true },
  { muscle: "quads", head: "rectus_femoris", d: ell(88, 214, 9, 38), mirror: true },
  { muscle: "quads", head: "vastus_medialis", d: ell(93, 250, 7, 17), mirror: true },
  { muscle: "adductors", head: "magnus", d: ell(97, 206, 6, 24), mirror: true },
  // podudzie
  { muscle: "tibialis", head: "main", d: ell(82, 310, 6, 26), mirror: true },
  { muscle: "calves", head: "gastro_lateral", d: ell(91, 306, 6, 21), mirror: true },
];

// ─────────────────────── TYŁ ───────────────────────
const BACK_REGIONS: Region[] = [
  // czworoboczny — trzy części (góra / środek / dół)
  { muscle: "traps", head: "upper", d: "M 99 48 L 64 68 L 82 78 L 99 62 Z", mirror: true },
  { muscle: "traps", head: "middle", d: "M 86 80 L 99 80 L 99 106 L 82 102 Z", mirror: true },
  { muscle: "traps", head: "lower", d: "M 92 108 L 99 108 L 99 144 L 95 140 Z", mirror: true },
  // naramienny tylny
  { muscle: "delts", head: "rear", d: ell(63, 75, 14, 14), mirror: true },
  // okolica łopatki: stożek rotatorów + obły większy
  { muscle: "rotator_cuff", head: "infraspinatus", d: ell(76, 82, 8, 6), mirror: true },
  { muscle: "teres_major", head: "main", d: ell(72, 93, 8, 5), mirror: true },
  // równoległoboczne (anatomicznie POD czworobocznym — pokazane obok dla czytelności)
  { muscle: "rhomboids", head: "major_minor", d: "M 82 84 L 90 82 L 90 100 L 80 96 Z", mirror: true },
  // najszerszy grzbietu — skrzydła
  { muscle: "lats", head: "upper", d: "M 88 92 L 68 96 Q 60 108 64 122 L 88 124 Z", mirror: true },
  { muscle: "lats", head: "lower", d: "M 88 125 L 64 124 Q 66 142 84 160 L 93 140 Z", mirror: true },
  // triceps (trzy głowy)
  { muscle: "triceps", head: "long", d: ell(52, 97, 6, 18), mirror: true },
  { muscle: "triceps", head: "lateral", d: ell(43, 95, 6, 16), mirror: true },
  { muscle: "triceps", head: "medial", d: ell(47, 120, 6, 10), mirror: true },
  { muscle: "forearms", head: "extensors", d: ell(41, 145, 8, 21), mirror: true },
  // prostownik grzbietu — kolumny wzdłuż kręgosłupa
  { muscle: "erectors", head: "longissimus", d: "M 94 112 h 6 v 60 h -6 z", mirror: true },
  { muscle: "erectors", head: "iliocostalis", d: "M 86 122 h 6 v 48 h -6 z", mirror: true },
  // pośladki
  { muscle: "glutes", head: "maximus", d: ell(88, 192, 15, 19), mirror: true },
  { muscle: "glutes", head: "medius", d: ell(75, 177, 8, 10), mirror: true },
  // dwugłowe uda
  { muscle: "hamstrings", head: "bf_long", d: ell(79, 234, 9, 30), mirror: true },
  { muscle: "hamstrings", head: "semitendinosus", d: ell(93, 234, 8, 30), mirror: true },
  // łydki
  { muscle: "calves", head: "gastro_lateral", d: ell(80, 300, 7, 20), mirror: true },
  { muscle: "calves", head: "gastro_medial", d: ell(91, 300, 7, 22), mirror: true },
  { muscle: "calves", head: "soleus", d: ell(86, 331, 8, 13), mirror: true },
];

// ── intensywność ──
/** Realny wkład danej głowy w pracę ćwiczenia (% całości). */
function contributionOf(act: MuscleActivation | undefined, headId?: string): number | null {
  if (!act) return null;
  if (!headId) return act.share;
  if (!act.heads) return act.share / Math.max(1, MUSCLES[act.muscle].heads.length);
  const pct = act.heads[headId];
  if (pct == null) return 0;
  return (act.share * pct) / 100;
}

/** 0–4 poziom cieniowania na podstawie wkładu procentowego. */
function levelOf(contribution: number | null): number {
  if (contribution == null) return -1;
  if (contribution >= 15) return 4;
  if (contribution >= 8) return 3;
  if (contribution >= 4) return 2;
  if (contribution >= 1.5) return 1;
  return 0;
}

const LEVEL_FILL = [
  `rgba(${ORANGE_RGB},0.16)`,
  `rgba(${ORANGE_RGB},0.30)`,
  `rgba(${ORANGE_RGB},0.50)`,
  `rgba(${ORANGE_RGB},0.74)`,
  `rgba(${ORANGE_RGB},0.96)`,
];
const INACTIVE_FILL = "rgba(var(--fg-rgb, 255,255,255),0.06)";

const ROLE_LABEL: Record<ActivationRole, string> = {
  primary: "główny",
  secondary: "wspomagający",
  support: "pomocniczy",
  stabilizer: "stabilizator",
};

export default function MuscleMap({ anatomy }: { anatomy: ExerciseAnatomy }) {
  const [view, setView] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState<{ muscle: MuscleId; head?: string } | null>(null);
  const [hover, setHover] = useState<{ muscle: MuscleId; head?: string } | null>(null);

  const actByMuscle = useMemo(() => {
    const m = new Map<MuscleId, MuscleActivation>();
    anatomy.activation.forEach((a) => m.set(a.muscle, a));
    return m;
  }, [anatomy]);

  const ranked = useMemo(
    () => [...anatomy.activation].sort((a, b) => b.share - a.share),
    [anatomy]
  );

  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;

  const active = hover ?? selected;
  const activeMuscle = active ? MUSCLES[active.muscle] : null;
  const activeAct = active ? actByMuscle.get(active.muscle) : undefined;

  /** Wybór z rankingu — przełącza widok, jeśli mięsień jest po drugiej stronie. */
  const selectMuscle = (id: MuscleId) => {
    const m = MUSCLES[id];
    if (m.view === "back" && view === "front") setView("back");
    if (m.view === "front" && view === "back") setView("front");
    setSelected((prev) => (prev?.muscle === id && !prev.head ? null : { muscle: id }));
  };

  const renderRegion = (r: Region, key: string, mirrored: boolean) => {
    const act = actByMuscle.get(r.muscle);
    const contribution = contributionOf(act, r.head);
    const lvl = levelOf(contribution);
    const isSel = selected?.muscle === r.muscle;
    const isHov = hover?.muscle === r.muscle;
    const head = r.head ? MUSCLES[r.muscle].heads.find((h) => h.id === r.head) : undefined;
    return (
      <path
        key={key}
        d={r.d}
        fill={lvl >= 0 ? LEVEL_FILL[lvl] : INACTIVE_FILL}
        stroke={isSel || isHov ? ORANGE : "rgba(var(--fg-rgb, 255,255,255),0.16)"}
        strokeWidth={isSel || isHov ? 1.8 : 0.7}
        style={{ cursor: "pointer", transition: "fill .18s ease, stroke .18s ease" }}
        transform={mirrored ? "translate(200,0) scale(-1,1)" : undefined}
        onClick={() => setSelected({ muscle: r.muscle, head: r.head })}
        onMouseEnter={() => setHover({ muscle: r.muscle, head: r.head })}
        onMouseLeave={() => setHover(null)}
      >
        <title>
          {MUSCLES[r.muscle].name}
          {head ? ` — ${head.name}` : ""}
          {contribution != null ? ` · ${contribution.toFixed(1)}%` : " · nie pracuje"}
        </title>
      </path>
    );
  };

  return (
    <div style={{ marginTop: 22 }}>
      {/* Nagłówek sekcji */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>
            Pracujące mięśnie
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 3 }}>
            {anatomy.name} · <span style={{ color: ORANGE, fontWeight: 700 }}>{anatomy.pattern}</span>
          </div>
        </div>
        {/* Przełącznik przód / tył */}
        <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", flexShrink: 0 }}>
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              data-testid={`muscle-view-${v}`}
              style={{
                padding: "5px 11px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 11.5, fontWeight: 800,
                background: view === v ? ORANGE : "transparent",
                color: view === v ? "#fff" : "rgba(var(--fg-rgb, 255,255,255),0.6)",
              }}
            >
              {v === "front" ? "Przód" : "Tył"}
            </button>
          ))}
        </div>
      </div>

      {/* Sylwetka */}
      <div style={{ borderRadius: 18, padding: "10px 8px 6px", background: "rgba(var(--fg-rgb, 255,255,255),0.035)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
        <svg
          viewBox="0 0 200 372"
          width="100%"
          style={{ display: "block", maxHeight: 400, margin: "0 auto" }}
          role="img"
          aria-label={`Mapa mięśni — ${anatomy.name}, widok ${view === "front" ? "z przodu" : "z tyłu"}`}
          data-testid="muscle-map-svg"
        >
          {/* podkład sylwetki */}
          <g fill="rgba(var(--fg-rgb, 255,255,255),0.05)" stroke="rgba(var(--fg-rgb, 255,255,255),0.1)" strokeWidth="0.8">
            {BODY.map((d, i) => <path key={`b${i}`} d={d} />)}
          </g>
          {/* partie mięśniowe */}
          <g>
            {regions.map((r, i) => (
              <g key={`r${i}`}>
                {renderRegion(r, `r${i}a`, false)}
                {r.mirror && renderRegion(r, `r${i}b`, true)}
              </g>
            ))}
          </g>
        </svg>

        {/* Legenda intensywności */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", padding: "6px 4px 2px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>mniej</span>
          {LEVEL_FILL.map((f, i) => (
            <span key={i} style={{ width: 22, height: 8, borderRadius: 3, background: f, border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" }} />
          ))}
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>więcej</span>
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.32)", marginLeft: 4 }}>· dotknij partii, by poznać szczegóły</span>
        </div>
      </div>

      {/* Panel szczegółów */}
      {activeMuscle && (
        <div
          data-testid="muscle-detail"
          style={{
            marginTop: 12, padding: "15px 16px", borderRadius: 18,
            background: "linear-gradient(150deg, rgba(var(--c-orange-rgb, 249,115,22),0.09), rgba(var(--fg-rgb, 255,255,255),0.03))",
            border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.22)",
            animation: "fadeInUp 0.25s ease both",
          }}
        >
          {/* Nagłówek */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--fg, #fff)", lineHeight: 1.2 }}>{activeMuscle.name}</div>
              <div style={{ fontSize: 11, fontStyle: "italic", color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 2 }}>{activeMuscle.latin}</div>
            </div>
            {activeAct ? (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: ORANGE, lineHeight: 1 }}>{activeAct.share}%</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 3 }}>
                  {ROLE_LABEL[activeAct.role]}
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 99, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>
                nie pracuje
              </span>
            )}
          </div>

          {/* Rozkład głów */}
          {activeMuscle.heads.length > 0 && (
            <div style={{ marginTop: 13 }}>
              <div style={sectionLabel}>Które głowy pracują</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 7 }}>
                {activeMuscle.heads.map((h) => {
                  const pct = activeAct?.heads?.[h.id];
                  const contrib = activeAct ? contributionOf(activeAct, h.id) : null;
                  const isActiveHead = active?.head === h.id;
                  return (
                    <div key={h.id} style={{ opacity: activeAct && pct === 0 ? 0.45 : 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: isActiveHead ? 900 : 700, color: isActiveHead ? ORANGE : "var(--fg, #fff)", flex: 1, minWidth: 0 }}>
                          {h.name}
                        </span>
                        {pct != null && (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--fg, #fff)", flexShrink: 0 }}>
                            {pct}%
                            {contrib != null && <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(var(--fg-rgb, 255,255,255),0.42)" }}> · {contrib.toFixed(1)}% pracy</span>}
                          </span>
                        )}
                      </div>
                      {pct != null && (
                        <div style={{ height: 5, borderRadius: 3, marginTop: 4, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, rgba(${ORANGE_RGB},0.55), ${ORANGE})` }} />
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, lineHeight: 1.45, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 3 }}>{h.role}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Niuans dla tego ćwiczenia */}
          {activeAct?.note && (
            <div style={{ marginTop: 13, padding: "10px 12px", borderRadius: 12, background: `rgba(${ORANGE_RGB},0.1)`, border: `1px solid rgba(${ORANGE_RGB},0.2)` }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", color: ORANGE, marginBottom: 4 }}>
                W tym ćwiczeniu
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.8)" }}>{activeAct.note}</div>
            </div>
          )}

          {/* Encyklopedia */}
          <Block label="Co robi" text={activeMuscle.action} />
          <Block label="Przyczepy" text={activeMuscle.attach} />
          <Block label="Jak trenować" text={activeMuscle.training} />
          {activeMuscle.fact && <Block label="Warto wiedzieć" text={activeMuscle.fact} accent />}

          <button
            onClick={() => { setSelected(null); setHover(null); }}
            style={{ marginTop: 12, width: "100%", padding: "9px", borderRadius: 11, cursor: "pointer", background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "rgba(var(--fg-rgb, 255,255,255),0.6)", fontSize: 12, fontWeight: 700 }}
          >
            Zamknij
          </button>
        </div>
      )}

      {/* Ranking zaangażowania */}
      <div style={{ marginTop: 14 }}>
        <div style={sectionLabel}>Ranking zaangażowania</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
          {ranked.map((a) => {
            const m = MUSCLES[a.muscle];
            const isSel = selected?.muscle === a.muscle;
            return (
              <button
                key={a.muscle}
                onClick={() => selectMuscle(a.muscle)}
                data-testid="muscle-rank-row"
                className="w-full active:scale-[0.99] transition-transform"
                style={{
                  display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer",
                  padding: "9px 11px", borderRadius: 12,
                  background: isSel ? `rgba(${ORANGE_RGB},0.12)` : "rgba(var(--fg-rgb, 255,255,255),0.035)",
                  border: `1px solid ${isSel ? `rgba(${ORANGE_RGB},0.3)` : "rgba(var(--fg-rgb, 255,255,255),0.06)"}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--fg, #fff)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.name}
                  </div>
                  <div style={{ height: 4, borderRadius: 2, marginTop: 5, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, a.share * 1.5)}%`, height: "100%", borderRadius: 2, background: `linear-gradient(90deg, rgba(${ORANGE_RGB},0.5), ${ORANGE})` }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "var(--fg, #fff)" }}>{a.share}%</div>
                  <div style={{ fontSize: 9, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>{ROLE_LABEL[a.role]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wskazówka techniczna do ćwiczenia */}
      {anatomy.tip && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.6px", textTransform: "uppercase", color: ORANGE, marginBottom: 5 }}>
            💡 Technika — co zmienia akcenty
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(var(--fg-rgb, 255,255,255),0.78)" }}>{anatomy.tip}</div>
        </div>
      )}

      {/* Zastrzeżenie metodologiczne */}
      <div style={{ marginTop: 12, fontSize: 10, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.34)", textAlign: "center" }}>
        Wartości procentowe są szacunkowe — pochodzą z analizy biomechanicznej (dźwignie, zakres ruchu, pozycja stawów)
        skorelowanej z danymi EMG z literatury. Traktuj je jako mapę akcentów treningowych, nie jako pomiar.
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase",
  color: "rgba(var(--fg-rgb, 255,255,255),0.42)",
};

function Block({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={sectionLabel}>{label}</div>
      <div style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 4, color: accent ? "rgba(var(--fg-rgb, 255,255,255),0.72)" : "rgba(var(--fg-rgb, 255,255,255),0.78)", fontStyle: accent ? "italic" : "normal" }}>
        {text}
      </div>
    </div>
  );
}
