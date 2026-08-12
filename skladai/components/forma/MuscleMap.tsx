"use client";

/**
 * FORMA — Interaktywna mapa mięśni dla ćwiczenia (écorché).
 *
 * • Sylwetka anatomiczna przód/tył — mięśnie rysowane krzywymi, ze STRIACJĄ
 *   (włóknami) w kierunku przebiegu włókien i widocznymi ścięgnami.
 * • Skala CIEPLNA: im mocniej pracuje partia, tym gorętszy kolor
 *   (szary → bursztyn → pomarańcz → czerwony).
 * • Głowy mięśni to osobne, klikalne kształty z własną intensywnością.
 * • ANIMACJA: sylwetka wykonuje ruch danego ćwiczenia; pracujące mięśnie
 *   pulsują w fazie koncentrycznej.
 * • Widok startowy dobierany automatycznie do strony, po której jest praca
 *   (wiosłowanie otwiera się na plecach, wyciskanie na klatce).
 */

import { useEffect, useMemo, useState } from "react";
import { MUSCLES, type MuscleId } from "@/lib/anatomy/muscles";
import type { ExerciseAnatomy, MuscleActivation, ActivationRole } from "@/lib/anatomy/exercises";
import { BODY, LIMB_UNDERLAY, TENDONS, FRONT_REGIONS, BACK_REGIONS, PIVOT, type Region, type Segment } from "./anatomyFigure";
import { MOTIONS, archetypeOf, smilValues } from "./anatomyMotion";

const ORANGE = "var(--c-orange, #f97316)";
const ORANGE_RGB = "var(--c-orange-rgb, 249,115,22)";

/** Skala cieplna — od ledwie pracującego do maksymalnie obciążonego. */
const HEAT = ["#5b6472", "#d99a2b", "#f08a2c", "#f2621f", "#e0231c"];
const HEAT_LABEL = ["śladowo", "słabo", "średnio", "mocno", "maksymalnie"];
const INACTIVE = "rgba(var(--fg-rgb, 255,255,255),0.05)";

const ROLE_LABEL: Record<ActivationRole, string> = {
  primary: "główny", secondary: "wspomagający", support: "pomocniczy", stabilizer: "stabilizator",
};

/** Realny wkład danej głowy w pracę ćwiczenia (% całości). */
function contributionOf(act: MuscleActivation | undefined, headId?: string): number | null {
  if (!act) return null;
  if (!headId) return act.share;
  if (!act.heads) return act.share / Math.max(1, MUSCLES[act.muscle].heads.length);
  const pct = act.heads[headId];
  if (pct == null) return 0;
  return (act.share * pct) / 100;
}
function levelOf(c: number | null): number {
  if (c == null) return -1;
  if (c >= 15) return 4;
  if (c >= 8) return 3;
  if (c >= 4) return 2;
  if (c >= 1.5) return 1;
  return 0;
}

/** Linie striacji (włókna) w obrębie kształtu — przycinane clipPath-em. */
function fiberLines(key: string, angle: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  // prostopadły krok między włóknami
  const px = -dy, py = dx;
  const lines = [];
  for (let i = -7; i <= 7; i++) {
    const ox = px * i * 3.2, oy = py * i * 3.2;
    lines.push(
      <line key={`${key}-f${i}`}
        x1={110 + ox - dx * 90} y1={220 + oy - dy * 90}
        x2={110 + ox + dx * 90} y2={220 + oy + dy * 90}
        stroke="rgba(0,0,0,0.28)" strokeWidth="0.7" />
    );
  }
  return lines;
}

export default function MuscleMap({ anatomy }: { anatomy: ExerciseAnatomy }) {
  const actByMuscle = useMemo(() => {
    const m = new Map<MuscleId, MuscleActivation>();
    anatomy.activation.forEach((a) => m.set(a.muscle, a));
    return m;
  }, [anatomy]);

  /** Po której stronie ciała jest większość pracy — decyduje o widoku startowym. */
  const dominantView = useMemo<"front" | "back">(() => {
    let front = 0, back = 0;
    for (const a of anatomy.activation) {
      const v = MUSCLES[a.muscle].view;
      if (v === "front") front += a.share;
      else if (v === "back") back += a.share;
      else { front += a.share / 2; back += a.share / 2; }
    }
    return back > front ? "back" : "front";
  }, [anatomy]);

  const [view, setView] = useState<"front" | "back">(dominantView);
  const [selected, setSelected] = useState<{ muscle: MuscleId; head?: string } | null>(null);
  const [hover, setHover] = useState<{ muscle: MuscleId; head?: string } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  // Uwaga: przy zmianie ćwiczenia komponent jest remountowany przez key={anatomy.id}
  // w ExerciseHistory — dzięki temu widok startowy wylicza się od nowa bez efektu.

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setReduced(mq.matches); if (mq.matches) setPlaying(false); };
    // odczyt początkowy odroczony o klatkę — bez synchronicznego setState w efekcie
    const raf = requestAnimationFrame(sync);
    mq.addEventListener?.("change", sync);
    return () => { cancelAnimationFrame(raf); mq.removeEventListener?.("change", sync); };
  }, []);

  const ranked = useMemo(() => [...anatomy.activation].sort((a, b) => b.share - a.share), [anatomy]);
  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;

  const archetype = useMemo(() => archetypeOf(anatomy), [anatomy]);
  const motion = MOTIONS[archetype];
  const animate = playing && !reduced;

  const active = hover ?? selected;
  const activeMuscle = active ? MUSCLES[active.muscle] : null;
  const activeAct = active ? actByMuscle.get(active.muscle) : undefined;

  const selectMuscle = (id: MuscleId) => {
    const m = MUSCLES[id];
    if (m.view === "back" && view === "front") setView("back");
    if (m.view === "front" && view === "back") setView("front");
    setSelected((prev) => (prev?.muscle === id && !prev.head ? null : { muscle: id }));
  };

  /** Rysuje jeden mięsień: wypełnienie cieplne + włókna + obrys. */
  const renderRegion = (r: Region, idx: number) => {
    const act = actByMuscle.get(r.muscle);
    const contribution = contributionOf(act, r.head);
    const lvl = levelOf(contribution);
    const isSel = selected?.muscle === r.muscle;
    const isHov = hover?.muscle === r.muscle;
    const head = r.head ? MUSCLES[r.muscle].heads.find((h) => h.id === r.head) : undefined;
    const clipId = `wnclip-${view}-${idx}`;
    const hot = lvl >= 3;

    return (
      <g key={`${view}-${idx}`}
        onClick={() => setSelected({ muscle: r.muscle, head: r.head })}
        onMouseEnter={() => setHover({ muscle: r.muscle, head: r.head })}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: "pointer" }}
      >
        <defs><clipPath id={clipId}><path d={r.d} /></clipPath></defs>
        <path
          d={r.d}
          fill={lvl >= 0 ? HEAT[lvl] : INACTIVE}
          stroke={isSel || isHov ? "#fff" : "rgba(0,0,0,0.45)"}
          strokeWidth={isSel || isHov ? 1.6 : 0.6}
          style={{ transition: "fill .25s ease" }}
        >
          <title>
            {MUSCLES[r.muscle].name}{head ? ` — ${head.name}` : ""}
            {contribution != null ? ` · ${contribution.toFixed(1)}% pracy (${HEAT_LABEL[lvl]})` : " · nie pracuje"}
          </title>
        </path>
        {/* włókna mięśniowe */}
        {lvl >= 0 && (
          <g clipPath={`url(#${clipId})`} style={{ pointerEvents: "none" }} opacity={lvl >= 2 ? 0.5 : 0.32}>
            {fiberLines(clipId, r.fiber)}
          </g>
        )}
        {/* puls pracy w fazie koncentrycznej */}
        {animate && hot && (
          <path d={r.d} fill="#fff" opacity="0" style={{ pointerEvents: "none" }}>
            <animate attributeName="opacity" values="0;0.30;0" dur={`${motion.dur}s`} repeatCount="indefinite" />
          </path>
        )}
      </g>
    );
  };

  /** Grupa segmentu z animacją obrotu w stawie (zwykła funkcja — nie komponent). */
  const joint = (range: [number, number] | undefined, pivot: readonly [number, number], children: React.ReactNode) => {
    if (!range || !animate) return <g>{children}</g>;
    return (
      <g>
        <animateTransform attributeName="transform" type="rotate"
          values={smilValues(range, pivot[0], pivot[1])}
          dur={`${motion.dur}s`} repeatCount="indefinite" calcMode="spline"
          keyTimes="0;0.5;1" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
        {children}
      </g>
    );
  };

  const bySeg = (s: Segment) => regions.filter((r) => r.segment === s && !r.center);
  const centerRegions = regions.filter((r) => r.center);
  const idxOf = (r: Region) => regions.indexOf(r);

  /** Podkład („skóra") danego segmentu — jedzie razem z mięśniami w tej grupie. */
  const limbSkin = (s: Segment) => (
    <g fill="rgba(var(--fg-rgb, 255,255,255),0.055)" stroke="rgba(var(--fg-rgb, 255,255,255),0.13)" strokeWidth="0.8" style={{ pointerEvents: "none" }}>
      {LIMB_UNDERLAY[s].map((d, i) => <path key={`${s}${i}`} d={d} />)}
    </g>
  );

  /** Zawartość jednej połowy ciała (mięśnie parzyste + kończyny w stawach). */
  const halfBody = (
    <>
      {bySeg("torso").map((r) => renderRegion(r, idxOf(r)))}
      {joint(motion.shoulder, PIVOT.shoulder, (
        <>
          {limbSkin("armUpper")}
          {bySeg("armUpper").map((r) => renderRegion(r, idxOf(r)))}
          {joint(motion.elbow, PIVOT.elbow, (
            <>
              {limbSkin("armFore")}
              {bySeg("armFore").map((r) => renderRegion(r, idxOf(r)))}
            </>
          ))}
        </>
      ))}
      {joint(motion.hip, PIVOT.hip, (
        <>
          {limbSkin("thigh")}
          {bySeg("thigh").map((r) => renderRegion(r, idxOf(r)))}
          {joint(motion.knee, PIVOT.knee, (
            <>
              {limbSkin("shin")}
              {bySeg("shin").map((r) => renderRegion(r, idxOf(r)))}
            </>
          ))}
        </>
      ))}
    </>
  );

  return (
    <div style={{ marginTop: 22 }}>
      {/* Nagłówek */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>
            Pracujące mięśnie
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 3 }}>
            {anatomy.name} · <span style={{ color: ORANGE, fontWeight: 700 }}>{anatomy.pattern}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", flexShrink: 0 }}>
          {(["front", "back"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} data-testid={`muscle-view-${v}`}
              style={{
                padding: "5px 11px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800,
                background: view === v ? ORANGE : "transparent",
                color: view === v ? "#fff" : "rgba(var(--fg-rgb, 255,255,255),0.6)",
              }}>
              {v === "front" ? "Przód" : "Tył"}
            </button>
          ))}
        </div>
      </div>

      {/* Sylwetka */}
      <div style={{ borderRadius: 18, padding: "8px 8px 6px", background: "radial-gradient(120% 90% at 50% 8%, rgba(var(--fg-rgb, 255,255,255),0.07), rgba(var(--fg-rgb, 255,255,255),0.02))", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
        <svg viewBox="0 0 220 430" width="100%" style={{ display: "block", maxHeight: 420, margin: "0 auto" }}
          role="img" data-testid="muscle-map-svg"
          aria-label={`Mapa mięśni — ${anatomy.name}, widok ${view === "front" ? "z przodu" : "z tyłu"}`}>
          <g>
            {/* delikatny ruch całej sylwetki (przysiad / wspięcie) */}
            {animate && motion.bodyY && (
              <animateTransform attributeName="transform" type="translate"
                values={`0 ${motion.bodyY[0]}; 0 ${motion.bodyY[1]}; 0 ${motion.bodyY[0]}`}
                dur={`${motion.dur}s`} repeatCount="indefinite" calcMode="spline"
                keyTimes="0;0.5;1" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
            )}
            {/* podkład: sylwetka + ścięgna */}
            <g fill="rgba(var(--fg-rgb, 255,255,255),0.055)" stroke="rgba(var(--fg-rgb, 255,255,255),0.13)" strokeWidth="0.8">
              {BODY.map((d, i) => <path key={`b${i}`} d={d} />)}
            </g>
            <g fill="rgba(var(--fg-rgb, 255,255,255),0.17)" style={{ pointerEvents: "none" }}>
              {TENDONS.map((d, i) => <path key={`t${i}`} d={d} />)}
            </g>
            {/* mięśnie centralne (brzuch) */}
            {centerRegions.map((r) => renderRegion(r, idxOf(r)))}
            {/* lewa i prawa połowa */}
            <g>{halfBody}</g>
            <g transform="translate(220,0) scale(-1,1)">{halfBody}</g>
          </g>
        </svg>

        {/* Sterowanie animacją + faza ruchu */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 0" }}>
          <button onClick={() => setPlaying((p) => !p)} disabled={reduced} data-testid="muscle-anim-toggle"
            style={{
              padding: "5px 10px", borderRadius: 9, cursor: reduced ? "default" : "pointer", flexShrink: 0,
              background: animate ? `rgba(${ORANGE_RGB},0.16)` : "rgba(var(--fg-rgb, 255,255,255),0.06)",
              border: `1px solid ${animate ? `rgba(${ORANGE_RGB},0.32)` : "rgba(var(--fg-rgb, 255,255,255),0.1)"}`,
              color: animate ? ORANGE : "rgba(var(--fg-rgb, 255,255,255),0.55)", fontSize: 11, fontWeight: 800,
            }}>
            {animate ? "⏸ Zatrzymaj" : "▶ Pokaż ruch"}
          </button>
          <span style={{ fontSize: 10.5, color: "rgba(var(--fg-rgb, 255,255,255),0.45)", flex: 1, minWidth: 0 }}>
            {reduced ? "Animacje wyłączone w ustawieniach systemu" : motion.label}
          </span>
        </div>

        {/* Legenda cieplna */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center", padding: "8px 4px 2px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>słabiej</span>
          {HEAT.map((c, i) => (
            <span key={i} title={HEAT_LABEL[i]} style={{ width: 24, height: 9, borderRadius: 3, background: c, border: "1px solid rgba(0,0,0,0.3)" }} />
          ))}
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>mocniej</span>
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.32)", marginLeft: 4 }}>· dotknij partii</span>
        </div>
      </div>

      {/* Panel szczegółów */}
      {activeMuscle && (
        <div data-testid="muscle-detail" style={{
          marginTop: 12, padding: "15px 16px", borderRadius: 18,
          background: `linear-gradient(150deg, rgba(${ORANGE_RGB},0.09), rgba(var(--fg-rgb, 255,255,255),0.03))`,
          border: `1px solid rgba(${ORANGE_RGB},0.22)`, animation: "fadeInUp 0.25s ease both",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--fg, #fff)", lineHeight: 1.2 }}>{activeMuscle.name}</div>
              <div style={{ fontSize: 11, fontStyle: "italic", color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 2 }}>{activeMuscle.latin}</div>
            </div>
            {activeAct ? (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: HEAT[levelOf(activeAct.share)], lineHeight: 1 }}>{activeAct.share}%</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 3 }}>
                  {ROLE_LABEL[activeAct.role]}
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 99, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>nie pracuje</span>
            )}
          </div>

          {activeMuscle.heads.length > 0 && (
            <div style={{ marginTop: 13 }}>
              <div style={sectionLabel}>Które głowy pracują</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 7 }}>
                {activeMuscle.heads.map((h) => {
                  const pct = activeAct?.heads?.[h.id];
                  const contrib = activeAct ? contributionOf(activeAct, h.id) : null;
                  const isActiveHead = active?.head === h.id;
                  const lvl = levelOf(contrib);
                  return (
                    <div key={h.id} style={{ opacity: activeAct && pct === 0 ? 0.45 : 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: isActiveHead ? 900 : 700, color: isActiveHead ? ORANGE : "var(--fg, #fff)", flex: 1, minWidth: 0 }}>{h.name}</span>
                        {pct != null && (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--fg, #fff)", flexShrink: 0 }}>
                            {pct}%
                            {contrib != null && <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(var(--fg-rgb, 255,255,255),0.42)" }}> · {contrib.toFixed(1)}% pracy</span>}
                          </span>
                        )}
                      </div>
                      {pct != null && (
                        <div style={{ height: 5, borderRadius: 3, marginTop: 4, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", borderRadius: 3, background: lvl >= 0 ? HEAT[lvl] : "#5b6472" }} />
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, lineHeight: 1.45, color: "rgba(var(--fg-rgb, 255,255,255),0.5)", marginTop: 3 }}>{h.role}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeAct?.note && (
            <div style={{ marginTop: 13, padding: "10px 12px", borderRadius: 12, background: `rgba(${ORANGE_RGB},0.1)`, border: `1px solid rgba(${ORANGE_RGB},0.2)` }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", color: ORANGE, marginBottom: 4 }}>W tym ćwiczeniu</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.8)" }}>{activeAct.note}</div>
            </div>
          )}

          <Block label="Co robi" text={activeMuscle.action} />
          <Block label="Przyczepy" text={activeMuscle.attach} />
          <Block label="Jak trenować" text={activeMuscle.training} />
          {activeMuscle.fact && <Block label="Warto wiedzieć" text={activeMuscle.fact} accent />}

          <button onClick={() => { setSelected(null); setHover(null); }}
            style={{ marginTop: 12, width: "100%", padding: "9px", borderRadius: 11, cursor: "pointer", background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "rgba(var(--fg-rgb, 255,255,255),0.6)", fontSize: 12, fontWeight: 700 }}>
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
            const lvl = levelOf(a.share);
            return (
              <button key={a.muscle} onClick={() => selectMuscle(a.muscle)} data-testid="muscle-rank-row"
                className="w-full active:scale-[0.99] transition-transform"
                style={{
                  display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer",
                  padding: "9px 11px", borderRadius: 12,
                  background: isSel ? `rgba(${ORANGE_RGB},0.12)` : "rgba(var(--fg-rgb, 255,255,255),0.035)",
                  border: `1px solid ${isSel ? `rgba(${ORANGE_RGB},0.3)` : "rgba(var(--fg-rgb, 255,255,255),0.06)"}`,
                }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, flexShrink: 0, background: HEAT[lvl] }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--fg, #fff)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  <div style={{ height: 4, borderRadius: 2, marginTop: 5, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, a.share * 1.5)}%`, height: "100%", borderRadius: 2, background: HEAT[lvl] }} />
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

      {anatomy.tip && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.6px", textTransform: "uppercase", color: ORANGE, marginBottom: 5 }}>💡 Technika — co zmienia akcenty</div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(var(--fg-rgb, 255,255,255),0.78)" }}>{anatomy.tip}</div>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 10, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.34)", textAlign: "center" }}>
        Wartości procentowe są szacunkowe — analiza biomechaniczna (dźwignie, zakres ruchu, pozycja stawów)
        skorelowana z danymi EMG z literatury. Animacja jest uproszczoną ilustracją wzorca ruchu.
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
