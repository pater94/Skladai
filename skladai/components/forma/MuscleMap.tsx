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

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MUSCLES, type MuscleId } from "@/lib/anatomy/muscles";
import { STANCES, poseFor, mergePose, lerpPose, type Pose } from "./exercisePose";

// Three.js dociągany dopiero przy wejściu w widok 3D — nie obciąża reszty apki.
const MuscleModel3D = dynamic(() => import("./MuscleModel3D"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 460, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.6)" }}>
      Ładuję model 3D…
    </div>
  ),
});
import type { ExerciseAnatomy, MuscleActivation, ActivationRole } from "@/lib/anatomy/exercises";
import { FRONT_PLATE, BACK_PLATE, FRONT_MODESTY, MODESTY_FILL, ANATOMY_ATTRIBUTION, type PlateRegion } from "./anatomyPlate";
import { MOTIONS, archetypeOf } from "./anatomyMotion";

const ORANGE = "var(--c-orange, #f97316)";
const ORANGE_RGB = "var(--c-orange-rgb, 249,115,22)";

/** Skala cieplna — od ledwie pracującego do maksymalnie obciążonego. */
const HEAT = ["#5b6472", "#d99a2b", "#f08a2c", "#f2621f", "#e0231c"];
const HEAT_LABEL = ["śladowo", "słabo", "średnio", "mocno", "maksymalnie"];

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
  // Opisy encyklopedyczne domyślnie ZWINIĘTE — ekran ma nie być przeładowany.
  const [expanded, setExpanded] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  // Tryb prezentacji: plansza anatomiczna (2D) albo obracany model (3D).
  const [mode, setMode] = useState<"plate" | "model">("plate");
  const [pose3d, setPose3d] = useState<Pose | null>(null);
  const poseRaf = useRef<number>(0);

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
  const plate = view === "front" ? FRONT_PLATE : BACK_PLATE;

  // Animacja techniki w 3D: płynne przejście start ⇄ koniec ruchu.
  const archetypeForPose = useMemo(() => archetypeOf(anatomy), [anatomy]);
  const movement = useMemo(() => poseFor(anatomy, archetypeForPose), [anatomy, archetypeForPose]);
  const stanceDef = STANCES[movement.stance];
  useEffect(() => {
    if (mode !== "model") return; // komponent 3D i tak jest odmontowany
    const pair = movement;
    const base = STANCES[pair.stance].base;
    if (!playing || reduced) {
      // odroczone o klatkę — bez synchronicznego setState w efekcie
      const id = requestAnimationFrame(() => setPose3d(mergePose(base, pair.start)));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    const loop = () => {
      const el = (performance.now() - t0) / 1000;
      // 0→1→0 z wygładzeniem (faza koncentryczna i ekscentryczna)
      const raw = (el % pair.dur) / pair.dur;
      const tri = raw < 0.5 ? raw * 2 : (1 - raw) * 2;
      const eased = tri * tri * (3 - 2 * tri);
      setPose3d(lerpPose(mergePose(base, pair.start), mergePose(base, pair.end), eased));
      poseRaf.current = requestAnimationFrame(loop);
    };
    poseRaf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(poseRaf.current);
  }, [mode, playing, reduced, movement]);

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

  /**
   * Koloruje jeden mięsień na planszy. Podkład jest odbarwiony do szarości,
   * a maska nakładana trybem „color" przejmuje barwę zachowując CAŁE cieniowanie
   * i prążkowanie włókien z oryginalnej ilustracji.
   */
  const mirrorT = `translate(${plate.axis * 2},0) scale(-1,1)`;

  /** Warstwa BARWY — rozmyta i przycięta do sylwetki, żeby maski nie wyglądały
   *  jak naklejone prostokąty tylko jak ciepło rozlane po mięśniu. */
  const renderPaint = (r: PlateRegion, idx: number, mirrored: boolean) => {
    const act = actByMuscle.get(r.muscle);
    const lvl = levelOf(contributionOf(act, r.head));
    if (lvl < 0) return null; // nie pracuje → zostaje szary podkład
    const hot = lvl >= 3;
    const strength = [0.45, 0.62, 0.78, 0.9, 1][lvl];
    return (
      <g key={`p${idx}${mirrored ? "m" : ""}`} transform={mirrored ? mirrorT : undefined}>
        <path d={r.d} fill={HEAT[lvl]} opacity={strength}
          style={{ mixBlendMode: "color", transition: "opacity .25s ease" }} />
        {hot && <path d={r.d} fill={HEAT[lvl]} opacity={lvl === 4 ? 0.34 : 0.2} style={{ mixBlendMode: "multiply" }} />}
        {animate && hot && (
          <path d={r.d} fill="#fff" opacity="0">
            <animate attributeName="opacity" values="0;0.20;0" dur={`${motion.dur}s`} repeatCount="indefinite" />
          </path>
        )}
      </g>
    );
  };

  /** Warstwa INTERAKCJI — ostra, nierozmyta: trafienia, podpowiedzi, zaznaczenie. */
  const renderHit = (r: PlateRegion, idx: number, mirrored: boolean) => {
    const act = actByMuscle.get(r.muscle);
    const contribution = contributionOf(act, r.head);
    const lvl = levelOf(contribution);
    if (lvl < 0) return null;
    const isActive = selected?.muscle === r.muscle || hover?.muscle === r.muscle;
    const head = r.head ? MUSCLES[r.muscle].heads.find((h) => h.id === r.head) : undefined;
    return (
      <g key={`h${idx}${mirrored ? "m" : ""}`} transform={mirrored ? mirrorT : undefined}
        onClick={() => setSelected({ muscle: r.muscle, head: r.head })}
        onMouseEnter={() => setHover({ muscle: r.muscle, head: r.head })}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: "pointer" }}
      >
        {isActive && (
          <path d={r.d} fill="none" stroke="#fff" strokeWidth={4} opacity={0.85}
            strokeLinejoin="round" style={{ pointerEvents: "none" }} />
        )}
        <path d={r.d} fill="transparent">
          <title>
            {MUSCLES[r.muscle].name}{head ? ` — ${head.name}` : ""}
            {` · ${contribution!.toFixed(1)}% pracy (${HEAT_LABEL[lvl]})`}
          </title>
        </path>
      </g>
    );
  };

  return (
    <div style={{ marginTop: 22 }}>
      {/* Nagłówek */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.64)" }}>
            Pracujące mięśnie
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.72)", marginTop: 3 }}>
            {anatomy.name} · <span style={{ color: ORANGE, fontWeight: 700 }}>{anatomy.pattern}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", flexShrink: 0 }}>
          {mode === "plate" && (["front", "back"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} data-testid={`muscle-view-${v}`}
              style={{
                padding: "5px 11px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800,
                background: view === v ? ORANGE : "transparent",
                color: view === v ? "#fff" : "rgba(var(--fg-rgb, 255,255,255),0.6)",
              }}>
              {v === "front" ? "Przód" : "Tył"}
            </button>
          ))}
          <button onClick={() => setMode((m) => (m === "plate" ? "model" : "plate"))} data-testid="muscle-mode-toggle"
            style={{
              padding: "5px 11px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800,
              background: mode === "model" ? ORANGE : "transparent",
              color: mode === "model" ? "#fff" : "rgba(var(--fg-rgb, 255,255,255),0.6)",
            }}>
            {mode === "model" ? "◧ 2D" : "◈ 3D"}
          </button>
        </div>
      </div>

      {/* Sylwetka */}
      <div style={{ borderRadius: 18, padding: "8px 8px 6px", background: "radial-gradient(120% 90% at 50% 8%, rgba(var(--fg-rgb, 255,255,255),0.07), rgba(var(--fg-rgb, 255,255,255),0.02))", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
        {mode === "model" ? (
          <MuscleModel3D
            activation={anatomy.activation}
            selected={selected}
            pose={pose3d}
            stance={stanceDef}
            equipment={movement.equipment}
            onPick={(p) => setSelected(p)}
          />
        ) : (
        <svg viewBox={`0 0 ${plate.width} ${plate.height}`} width="100%"
          style={{ display: "block", maxHeight: 520, margin: "0 auto" }}
          role="img" data-testid="muscle-map-svg"
          aria-label={`Mapa mięśni — ${anatomy.name}, widok ${view === "front" ? "z przodu" : "z tyłu"}`}>
          <defs>
            {/* Sylwetka wycięta z kanału alfa samej planszy — kolor nigdy nie wyjdzie poza ciało */}
            <mask id={`bodyMask-${view}`} maskUnits="userSpaceOnUse" x={0} y={0} width={plate.width} height={plate.height} style={{ maskType: "alpha" }}>
              <image href={plate.src} x={0} y={0} width={plate.width} height={plate.height} preserveAspectRatio="xMidYMid meet" />
            </mask>
          </defs>

          {/* plansza anatomiczna — odbarwiona, żeby pracujące partie wybijały się kolorem */}
          <image href={plate.src} x={0} y={0} width={plate.width} height={plate.height}
            preserveAspectRatio="xMidYMid meet"
            style={{ filter: "grayscale(1) contrast(1.06) brightness(1.04)" }} />

          {/* WARSTWA BARWY: przycięta do sylwetki + rozmyta (miękkie przejścia) */}
          <g mask={`url(#bodyMask-${view})`} style={{ filter: "blur(5px)", pointerEvents: "none" }}>
            {plate.regions.map((r, i) => (
              <g key={`paint${i}`}>
                {renderPaint(r, i, false)}
                {!r.center && renderPaint(r, i, true)}
              </g>
            ))}
          </g>

          {/* zasłona okolicy krocza (tylko przód) */}
          {view === "front" && (
            <path d={FRONT_MODESTY} fill={MODESTY_FILL} opacity={0.99} style={{ pointerEvents: "none", filter: "blur(1.5px)" }} />
          )}

          {/* WARSTWA INTERAKCJI: ostra, na wierzchu */}
          {plate.regions.map((r, i) => (
            <g key={`hit${i}`}>
              {renderHit(r, i, false)}
              {!r.center && renderHit(r, i, true)}
            </g>
          ))}
        </svg>
        )}

        {/* Sterowanie pulsem pracy */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 0" }}>
          <button onClick={() => setPlaying((p) => !p)} disabled={reduced} data-testid="muscle-anim-toggle"
            style={{
              padding: "5px 10px", borderRadius: 9, cursor: reduced ? "default" : "pointer", flexShrink: 0,
              background: animate ? `rgba(${ORANGE_RGB},0.16)` : "rgba(var(--fg-rgb, 255,255,255),0.06)",
              border: `1px solid ${animate ? `rgba(${ORANGE_RGB},0.32)` : "rgba(var(--fg-rgb, 255,255,255),0.1)"}`,
              color: animate ? ORANGE : "rgba(var(--fg-rgb, 255,255,255),0.55)", fontSize: 11, fontWeight: 800,
            }}>
            {animate ? (mode === "model" ? "⏸ Zatrzymaj ruch" : "⏸ Zatrzymaj puls") : (mode === "model" ? "▶ Pokaż technikę" : "▶ Pokaż pracę")}
          </button>
          <span style={{ fontSize: 10.5, color: "rgba(var(--fg-rgb, 255,255,255),0.68)", flex: 1, minWidth: 0 }}>
            {reduced ? "Animacje wyłączone w ustawieniach systemu"
              : mode === "model" ? `${movement.label} · ${stanceDef.name} · przeciągnij, by obrócić` : motion.label}
          </span>
        </div>

        {/* Legenda cieplna */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center", padding: "8px 4px 2px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.64)" }}>słabiej</span>
          {HEAT.map((c, i) => (
            <span key={i} title={HEAT_LABEL[i]} style={{ width: 24, height: 9, borderRadius: 3, background: c, border: "1px solid rgba(0,0,0,0.3)" }} />
          ))}
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.64)" }}>mocniej</span>
          <span style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.56)", marginLeft: 4 }}>· dotknij partii</span>
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
              <div style={{ fontSize: 11, fontStyle: "italic", color: "rgba(var(--fg-rgb, 255,255,255),0.68)", marginTop: 2 }}>{activeMuscle.latin}</div>
            </div>
            {activeAct ? (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: HEAT[levelOf(activeAct.share)], lineHeight: 1 }}>{activeAct.share}%</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "rgba(var(--fg-rgb, 255,255,255),0.68)", marginTop: 3 }}>
                  {ROLE_LABEL[activeAct.role]}
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 99, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", color: "rgba(var(--fg-rgb, 255,255,255),0.72)" }}>nie pracuje</span>
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
                            {contrib != null && <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(var(--fg-rgb, 255,255,255),0.66)" }}> · {contrib.toFixed(1)}% pracy</span>}
                          </span>
                        )}
                      </div>
                      {pct != null && (
                        <div style={{ height: 5, borderRadius: 3, marginTop: 4, background: "rgba(var(--fg-rgb, 255,255,255),0.07)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", borderRadius: 3, background: lvl >= 0 ? HEAT[lvl] : "#5b6472" }} />
                        </div>
                      )}
                      {expanded && (
                        <div style={{ fontSize: 10.5, lineHeight: 1.45, color: "rgba(var(--fg-rgb, 255,255,255),0.72)", marginTop: 3 }}>{h.role}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeAct?.note && (
            <div style={{ marginTop: 13, padding: "10px 12px", borderRadius: 12, background: `rgba(${ORANGE_RGB},0.1)`, border: `1px solid rgba(${ORANGE_RGB},0.2)` }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", color: ORANGE, marginBottom: 4 }}>W tym ćwiczeniu</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.93)" }}>{activeAct.note}</div>
            </div>
          )}

          {/* Encyklopedia — zwinięta domyślnie */}
          <button
            onClick={() => setExpanded((e) => !e)}
            data-testid="muscle-detail-expand"
            className="w-full active:scale-[0.99] transition-transform"
            style={{
              marginTop: 13, padding: "10px 12px", borderRadius: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, textAlign: "left",
              background: `rgba(${ORANGE_RGB},0.1)`, border: `1px solid rgba(${ORANGE_RGB},0.24)`,
              color: ORANGE, fontSize: 12.5, fontWeight: 800,
            }}
          >
            <span style={{ fontSize: 14 }}>📖</span>
            <span style={{ flex: 1 }}>{expanded ? "Ukryj pełny opis" : "Pokaż pełny opis mięśnia"}</span>
            <span style={{ fontSize: 13, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>⌄</span>
          </button>

          {expanded && (
            <div style={{ animation: "fadeInUp 0.22s ease both" }}>
              <Block label="Co robi" text={activeMuscle.action} />
              <Block label="Przyczepy" text={activeMuscle.attach} />
              <Block label="Jak trenować" text={activeMuscle.training} />
              {activeMuscle.fact && <Block label="Warto wiedzieć" text={activeMuscle.fact} accent />}
            </div>
          )}

          <button onClick={() => { setSelected(null); setHover(null); }}
            style={{ marginTop: 12, width: "100%", padding: "9px", borderRadius: 11, cursor: "pointer", background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "rgba(var(--fg-rgb, 255,255,255),0.78)", fontSize: 12, fontWeight: 700 }}>
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
                  <div style={{ fontSize: 9, color: "rgba(var(--fg-rgb, 255,255,255),0.64)" }}>{ROLE_LABEL[a.role]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {anatomy.tip && (
        <div style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
          <button
            onClick={() => setTipOpen((t) => !t)}
            data-testid="technique-toggle"
            className="w-full active:scale-[0.995] transition-transform"
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.4px", textTransform: "uppercase", color: ORANGE, flex: 1 }}>
              💡 Technika — co zmienia akcenty
            </span>
            <span style={{ fontSize: 13, color: ORANGE, transform: tipOpen ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>⌄</span>
          </button>
          {tipOpen && (
            <div style={{ padding: "0 14px 13px", fontSize: 12.5, lineHeight: 1.6, color: "rgba(var(--fg-rgb, 255,255,255),0.92)", animation: "fadeInUp 0.22s ease both" }}>
              {anatomy.tip}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 10, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.58)", textAlign: "center" }}>
        Wartości procentowe są szacunkowe — analiza biomechaniczna (dźwignie, zakres ruchu, pozycja stawów)
        skorelowana z danymi EMG z literatury.
      </div>
      {/* Atrybucja wymagana licencją CC BY-SA */}
      <div style={{ marginTop: 6, fontSize: 9.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.52)", textAlign: "center" }}>
        Plansza anatomiczna: {ANATOMY_ATTRIBUTION.author} ·{" "}
        <a href={ANATOMY_ATTRIBUTION.source} target="_blank" rel="noreferrer noopener" style={{ color: "inherit", textDecoration: "underline" }}>
          Wikimedia Commons
        </a>{" "}·{" "}
        <a href={ANATOMY_ATTRIBUTION.licenseUrl} target="_blank" rel="noreferrer noopener" style={{ color: "inherit", textDecoration: "underline" }}>
          {ANATOMY_ATTRIBUTION.license}
        </a>{" "}· zmodyfikowana (symetryzacja, kadr, kompresja)
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase",
  color: "rgba(var(--fg-rgb, 255,255,255),0.66)",
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
