"use client";

/**
 * FORMA RPG — postać gracza. Rysowana, nie wklejona.
 *
 * Sylwetka powstaje PROCEDURALNIE z dwóch liczb (umięśnienie i wysmuklenie
 * z lib/game/body.ts). Nie ma tu gotowych obrazków ani skoków typu
 * chudy/średni/muskularny — każdy punkt kontrolny krzywej jest wyliczany,
 * więc ciało zmienia się płynnie i widać różnicę o kilka punktów.
 *
 * ── Dlaczego to ma znaczenie ─────────────────────────────────────────────
 * Efekt Proteusza (Yee & Bailenson): ludzie zaczynają zachowywać się zgodnie
 * z tym, jak wygląda ich awatar. W badaniach nad ćwiczeniem w VR uczestnicy
 * z bardziej umięśnionym awatarem odczuwali TEN SAM wysiłek jako lżejszy, a
 * spersonalizowana postać podnosi motywację wewnętrzną i utożsamienie z celem.
 * Postać, która realnie odzwierciedla ciało i zmienia się razem z nim, jest
 * więc częścią mechaniki motywacji, a nie ozdobą.
 *
 * ── Zasady rysowania, wyciągnięte z pierwszej wersji ─────────────────────
 * 1. Poza A, nie na baczność. Ramiona opuszczone pionowo zlewają się z
 *    tułowiem i sylwetka przestaje cokolwiek mówić. Rozchylenie robi
 *    trójkątny prześwit, dzięki któremu widać i talię, i ramię.
 * 2. Każdy kształt ma kontur. Bez niego nachodzące na siebie elementy
 *    (ramię na tułowiu, udo na biodrze) tworzą jedną plamę.
 * 3. Brzuch wypycha się NIŻEJ niż talia. Rozszerzanie samej talii daje
 *    prostokąt; prawdziwa tkanka siada nad biodrem.
 * 4. Stylizacja zamiast realizmu — czysty wektor czyta się lepiej niż
 *    próba udawania zdjęcia.
 */

import { useId, useMemo } from "react";

export interface CharacterProps {
  /** Umięśnienie 0-100 — barki, ramiona, klatka, uda. */
  muscle: number;
  /** Wysmuklenie 0-100 — talia, brzuch, definicja. */
  leanness: number;
  gender: "male" | "female" | null;
  /** Poziom postaci — odblokowuje kolejne elementy wyposażenia. */
  level: number;
  /** Forma 0-100 — poniżej 50 postać garbi się i gaśnie. */
  condition: number;
  /** Kolor poświaty ligi. Brak = bez aury. */
  auraColor?: string | null;
  /** Wysokość renderu w px. Szerokość wynika z proporcji. */
  height?: number;
  /** Wyłącza animacje (np. przy zrzucie do udostępnienia). */
  still?: boolean;
  className?: string;
}

// ── Geometria ────────────────────────────────────────────────────────────
// Płótno 200 × 340, oś ciała na x = 100. Proporcje bohaterskie (~7,5 głowy).

const CX = 100;
const Y = {
  headCy: 32, neck: 52, shoulder: 70,
  chest: 96, waist: 134, belly: 148, hip: 164, crotch: 176,
  elbow: 146, wrist: 210, knee: 250, ankle: 324,
} as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const n = (v: number) => v.toFixed(1);

/**
 * Zwężająca się „kapsuła" między dwoma punktami — budulec każdej kończyny.
 *
 * Rysowana ręcznie zamiast grubą kreską, bo kończyna musi mieć INNĄ grubość
 * u góry i u dołu: ramię przy barku jest dużo grubsze niż przy łokciu i
 * właśnie ta różnica czyta się jako umięśnienie.
 */
function limb(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const bulge = Math.max(w1, w2) * 0.3;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return [
    `M ${n(x1 + nx * w1)} ${n(y1 + ny * w1)}`,
    `Q ${n(mx + nx * (w1 * 0.5 + w2 * 0.5 + bulge))} ${n(my + ny * (w1 * 0.5 + w2 * 0.5 + bulge))} ${n(x2 + nx * w2)} ${n(y2 + ny * w2)}`,
    `Q ${n(x2 + ux * w2 * 1.25)} ${n(y2 + uy * w2 * 1.25)} ${n(x2 - nx * w2)} ${n(y2 - ny * w2)}`,
    `Q ${n(mx - nx * (w1 * 0.5 + w2 * 0.5 + bulge))} ${n(my - ny * (w1 * 0.5 + w2 * 0.5 + bulge))} ${n(x1 - nx * w1)} ${n(y1 - ny * w1)}`,
    `Q ${n(x1 - ux * w1 * 1.25)} ${n(y1 - uy * w1 * 1.25)} ${n(x1 + nx * w1)} ${n(y1 + ny * w1)}`,
    "Z",
  ].join(" ");
}

interface Metrics {
  shoulderW: number; chestW: number; waistW: number; bellyW: number; hipW: number;
  upperArm: number; foreArm: number; thigh: number; calf: number;
  neckW: number; trapRise: number; armOut: number;
  defs: number; softness: number;
}

/**
 * Wymiary ciała z dwóch osi.
 *
 * Wariant kobiecy to nie „ten sam ludzik, tylko węższy": inny jest stosunek
 * barków do bioder, inaczej rozkłada się tkanka i inaczej rośnie góra ciała.
 */
function metricsFor(muscle: number, leanness: number, gender: CharacterProps["gender"]): Metrics {
  const m = clamp01(muscle / 100);
  const l = clamp01(leanness / 100);
  const fat = 1 - l;
  const f = gender === "female";

  const waistW = (f ? 15.5 : 17.5) + fat * (f ? 12.5 : 14) + m * (f ? 2.8 : 3.5);
  return {
    shoulderW: (f ? 26 : 30) + m * (f ? 19 : 26) + fat * 2,
    chestW: (f ? 24 : 25) + m * (f ? 14 : 20) + fat * 4,
    waistW,
    // Tkanka siada NAD biodrem, nie w talii — stąd osobny, niższy punkt.
    bellyW: waistW + fat * fat * (f ? 7 : 9),
    hipW: (f ? 27.5 : 21.5) + fat * (f ? 11.5 : 9) + m * 3,
    upperArm: (f ? 5.2 : 6.0) + m * (f ? 5.2 : 7.4) + fat * 1.5,
    foreArm: (f ? 4.2 : 4.8) + m * (f ? 3.2 : 4.5) + fat * 1.0,
    thigh: (f ? 12.5 : 12) + m * 6.5 + fat * 5,
    calf: (f ? 7.4 : 7.8) + m * 4 + fat * 2,
    neckW: (f ? 7.0 : 8.0) + m * (f ? 2.2 : 4.0),
    trapRise: m * (f ? 4.5 : 8.5),
    // Rozchylenie ramion: im więcej masy, tym szerzej „nie schodzą się" ręce.
    armOut: 9 + m * 9,
    // Definicja wymaga MASY i SUCHOŚCI naraz. Iloczyn, nie średnia.
    defs: clamp01(m * 1.15 * (Math.max(0, l - 0.42) / 0.58)),
    softness: fat,
  };
}

export default function Character({
  muscle, leanness, gender, level, condition,
  auraColor = null, height = 260, still = false, className,
}: CharacterProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const M = useMemo(() => metricsFor(muscle, leanness, gender), [muscle, leanness, gender]);
  const weak = clamp01((50 - condition) / 50);
  const female = gender === "female";
  const accent = auraColor || "#f97316";

  const torso = useMemo(() => {
    const { shoulderW: sw, chestW: cw, waistW: ww, bellyW: bw, hipW: hw, neckW: nw, trapRise: tr } = M;
    return [
      `M ${n(CX - sw)} ${n(Y.shoulder)}`,
      `C ${n(CX - sw - 1)} ${n(Y.shoulder + 11)} ${n(CX - cw - 3)} ${n(Y.chest - 15)} ${n(CX - cw)} ${n(Y.chest)}`,
      `C ${n(CX - cw + 2)} ${n(Y.chest + 15)} ${n(CX - ww - 2)} ${n(Y.waist - 13)} ${n(CX - ww)} ${n(Y.waist)}`,
      `C ${n(CX - ww - 0.5)} ${n(Y.waist + 6)} ${n(CX - bw)} ${n(Y.belly - 6)} ${n(CX - bw)} ${n(Y.belly)}`,
      `C ${n(CX - bw)} ${n(Y.belly + 7)} ${n(CX - hw - 1)} ${n(Y.hip - 8)} ${n(CX - hw)} ${n(Y.hip)}`,
      `Q ${n(CX - hw * 0.55)} ${n(Y.crotch + 5)} ${n(CX)} ${n(Y.crotch)}`,
      `Q ${n(CX + hw * 0.55)} ${n(Y.crotch + 5)} ${n(CX + hw)} ${n(Y.hip)}`,
      `C ${n(CX + hw + 1)} ${n(Y.hip - 8)} ${n(CX + bw)} ${n(Y.belly + 7)} ${n(CX + bw)} ${n(Y.belly)}`,
      `C ${n(CX + bw)} ${n(Y.belly - 6)} ${n(CX + ww + 0.5)} ${n(Y.waist + 6)} ${n(CX + ww)} ${n(Y.waist)}`,
      `C ${n(CX + ww + 2)} ${n(Y.waist - 13)} ${n(CX + cw - 2)} ${n(Y.chest + 15)} ${n(CX + cw)} ${n(Y.chest)}`,
      `C ${n(CX + cw + 3)} ${n(Y.chest - 15)} ${n(CX + sw + 1)} ${n(Y.shoulder + 11)} ${n(CX + sw)} ${n(Y.shoulder)}`,
      // Czapy karku: łagodny łuk od barku do szyi. Pojedyncze Q z mocnym
      // punktem kontrolnym robiło ostry szpic przy dużej masie.
      `C ${n(CX + sw * 0.72)} ${n(Y.shoulder - 2)} ${n(CX + nw + (sw - nw) * 0.4)} ${n(Y.neck + 7 - tr)} ${n(CX + nw)} ${n(Y.neck)}`,
      `L ${n(CX - nw)} ${n(Y.neck)}`,
      `C ${n(CX - nw - (sw - nw) * 0.4)} ${n(Y.neck + 7 - tr)} ${n(CX - sw * 0.72)} ${n(Y.shoulder - 2)} ${n(CX - sw)} ${n(Y.shoulder)}`,
      "Z",
    ].join(" ");
  }, [M]);

  // Poza A — ramiona schodzą skosem, zostawiając prześwit przy talii.
  const shX = M.shoulderW * 0.84, elX = M.shoulderW + M.armOut, wrX = M.shoulderW + M.armOut + 7;
  const arms = useMemo(() => ({
    upL: limb(CX - shX, Y.shoulder + 7, CX - elX, Y.elbow, M.upperArm, M.foreArm * 1.02),
    upR: limb(CX + shX, Y.shoulder + 7, CX + elX, Y.elbow, M.upperArm, M.foreArm * 1.02),
    loL: limb(CX - elX, Y.elbow, CX - wrX, Y.wrist, M.foreArm * 1.02, M.foreArm * 0.6),
    loR: limb(CX + elX, Y.elbow, CX + wrX, Y.wrist, M.foreArm * 1.02, M.foreArm * 0.6),
  }), [M, shX, elX, wrX]);

  const legLx = CX - M.hipW * 0.44, legRx = CX + M.hipW * 0.44;
  const legs = useMemo(() => ({
    thL: limb(legLx, Y.hip - 4, legLx - 2, Y.knee, M.thigh, M.calf * 0.86),
    thR: limb(legRx, Y.hip - 4, legRx + 2, Y.knee, M.thigh, M.calf * 0.86),
    caL: limb(legLx - 2, Y.knee, legLx - 1, Y.ankle, M.calf, M.calf * 0.46),
    caR: limb(legRx + 2, Y.knee, legRx + 1, Y.ankle, M.calf, M.calf * 0.46),
  }), [M, legLx, legRx]);

  const W = 200, H = 348;
  const width = Math.round((height * W) / H);
  const anim = !still;
  const line = "#8a5030";       // kontur — ciemniejszy odcień skóry
  const shade = "#7a4426";      // linie definicji

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} width={width} height={height} className={className}
      role="img" aria-label={`Postać gracza, poziom ${level}`}
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <linearGradient id={`sk${uid}`} x1="0.1" y1="0" x2="0.95" y2="0.4">
          <stop offset="0%" stopColor={female ? "#f5bd96" : "#efb083"} />
          <stop offset="48%" stopColor={female ? "#e3a077" : "#d89062"} />
          <stop offset="100%" stopColor={female ? "#c07f5c" : "#ac6f49"} />
        </linearGradient>
        <linearGradient id={`rim${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="30%" stopColor="#fff" stopOpacity="0" />
          <stop offset="80%" stopColor={accent} stopOpacity="0" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.42" />
        </linearGradient>
        <radialGradient id={`au${uid}`} cx="50%" cy="46%" r="50%">
          <stop offset="62%" stopColor={accent} stopOpacity="0" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.17" />
        </radialGradient>
        <filter id={`bl${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <style>{`
          @keyframes br${uid}{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.02)}}
          @keyframes sw${uid}{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.4px)}}
          @keyframes pu${uid}{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:.95;transform:scale(1.035)}}
          .f${uid}{animation:sw${uid} 4.6s ease-in-out infinite;transform-origin:100px 316px}
          .t${uid}{animation:br${uid} 3.8s ease-in-out infinite;transform-origin:100px 150px}
          .a${uid}{animation:pu${uid} 5.2s ease-in-out infinite;transform-origin:100px 165px}
          @media (prefers-reduced-motion:reduce){.f${uid},.t${uid},.a${uid}{animation:none!important}}
        `}</style>
      </defs>

      {auraColor && (
        <ellipse className={anim ? `a${uid}` : undefined} cx={CX} cy={170}
          rx={M.shoulderW + 30} ry={122} fill={`url(#au${uid})`} filter={`url(#bl${uid})`} />
      )}

      <ellipse cx={CX} cy={Y.ankle + 16} rx={M.hipW + 14} ry={6.5}
        fill="#000" opacity={0.26} filter={`url(#bl${uid})`} />

      <g className={anim ? `f${uid}` : undefined}
         style={{ opacity: 0.58 + (1 - weak) * 0.42 }}
         transform={weak > 0 ? `rotate(${-weak * 2.4} 100 184)` : undefined}>

        {/* Wszystko z konturem — inaczej nachodzące kształty tworzą jedną plamę */}
        <g fill={`url(#sk${uid})`} stroke={line} strokeWidth={1.1} strokeLinejoin="round">
          {/* nogi */}
          <path d={legs.thL} /><path d={legs.thR} />
          <ellipse cx={legLx - 2} cy={Y.knee} rx={M.calf * 0.95} ry={M.calf * 0.8} />
          <ellipse cx={legRx + 2} cy={Y.knee} rx={M.calf * 0.95} ry={M.calf * 0.8} />
          <path d={legs.caL} /><path d={legs.caR} />
          {/* stopy — lekko na zewnątrz, inaczej postać stoi jak na szpilkach */}
          <path d={`M ${n(legLx - 1 - M.calf * 0.5)} ${n(Y.ankle + 2)} L ${n(legLx - 3 - M.calf * 1.1)} ${n(Y.ankle + 12)} Q ${n(legLx - 1)} ${n(Y.ankle + 16)} ${n(legLx - 1 + M.calf * 0.55)} ${n(Y.ankle + 11)} Z`} />
          <path d={`M ${n(legRx + 1 + M.calf * 0.5)} ${n(Y.ankle + 2)} L ${n(legRx + 3 + M.calf * 1.1)} ${n(Y.ankle + 12)} Q ${n(legRx + 1)} ${n(Y.ankle + 16)} ${n(legRx + 1 - M.calf * 0.55)} ${n(Y.ankle + 11)} Z`} />
          {/* ramiona */}
          <path d={arms.upL} /><path d={arms.upR} />
          <ellipse cx={CX - elX} cy={Y.elbow} rx={M.foreArm * 1.06} ry={M.foreArm * 0.94} />
          <ellipse cx={CX + elX} cy={Y.elbow} rx={M.foreArm * 1.06} ry={M.foreArm * 0.94} />
          <path d={arms.loL} /><path d={arms.loR} />
          {/* dłonie */}
          <ellipse cx={CX - wrX - 1} cy={Y.wrist + 6} rx={M.foreArm * 0.66} ry={M.foreArm * 0.95} />
          <ellipse cx={CX + wrX + 1} cy={Y.wrist + 6} rx={M.foreArm * 0.66} ry={M.foreArm * 0.95} />
          {/* szyja */}
          <path d={`M ${n(CX - M.neckW * 0.78)} ${n(Y.neck + 3)} L ${n(CX - M.neckW * 0.66)} ${n(Y.headCy + 14)} L ${n(CX + M.neckW * 0.66)} ${n(Y.headCy + 14)} L ${n(CX + M.neckW * 0.78)} ${n(Y.neck + 3)} Z`} />
        </g>

        {/* Tułów — oddycha */}
        <g className={anim ? `t${uid}` : undefined}>
          <path d={torso} fill={`url(#sk${uid})`} stroke={line} strokeWidth={1.2} strokeLinejoin="round" />
          <path d={torso} fill={`url(#rim${uid})`} />

          <g stroke={shade} strokeLinecap="round" fill="none" opacity={M.defs}>
            <path d={`M ${n(CX - M.chestW * 0.64)} ${n(Y.chest + 7)} Q ${n(CX)} ${n(Y.chest + 19)} ${n(CX + M.chestW * 0.64)} ${n(Y.chest + 7)}`}
              strokeWidth={1.6} opacity={0.55} />
            <path d={`M ${n(CX)} ${n(Y.chest - 8)} L ${n(CX)} ${n(Y.chest + 16)}`} strokeWidth={1.2} opacity={0.38} />
            {!female && [0, 1, 2].map((i) => {
              const yy = Y.chest + 28 + i * 12;
              const w = M.waistW * (0.5 - i * 0.05);
              return (
                <g key={i} opacity={0.48 - i * 0.07}>
                  <path d={`M ${n(CX - w)} ${n(yy)} L ${n(CX - 2.5)} ${n(yy)}`} strokeWidth={1.3} />
                  <path d={`M ${n(CX + 2.5)} ${n(yy)} L ${n(CX + w)} ${n(yy)}`} strokeWidth={1.3} />
                </g>
              );
            })}
            <path d={`M ${n(CX)} ${n(Y.chest + 22)} L ${n(CX)} ${n(Y.waist - 2)}`} strokeWidth={1.2} opacity={0.4} />
            {M.defs > 0.55 && (
              <>
                <path d={`M ${n(CX - M.waistW * 0.92)} ${n(Y.waist - 8)} L ${n(CX - M.waistW * 0.3)} ${n(Y.hip - 6)}`} strokeWidth={1.4} opacity={0.38} />
                <path d={`M ${n(CX + M.waistW * 0.92)} ${n(Y.waist - 8)} L ${n(CX + M.waistW * 0.3)} ${n(Y.hip - 6)}`} strokeWidth={1.4} opacity={0.38} />
              </>
            )}
          </g>

          {/* czapy barków */}
          <g fill="none" stroke={shade} opacity={M.defs * 0.5} strokeWidth={1.5} strokeLinecap="round">
            <path d={`M ${n(CX - M.shoulderW * 0.94)} ${n(Y.shoulder + 13)} Q ${n(CX - M.shoulderW * 0.58)} ${n(Y.shoulder + 2)} ${n(CX - M.shoulderW * 0.34)} ${n(Y.shoulder + 10)}`} />
            <path d={`M ${n(CX + M.shoulderW * 0.94)} ${n(Y.shoulder + 13)} Q ${n(CX + M.shoulderW * 0.58)} ${n(Y.shoulder + 2)} ${n(CX + M.shoulderW * 0.34)} ${n(Y.shoulder + 10)}`} />
          </g>

          {level >= 20 && (
            <path d={`M ${n(CX - M.waistW - 1)} ${n(Y.waist + 1)} Q ${n(CX)} ${n(Y.waist + 12)} ${n(CX + M.waistW + 1)} ${n(Y.waist + 1)} L ${n(CX + M.waistW + 1)} ${n(Y.waist - 8)} Q ${n(CX)} ${n(Y.waist + 3)} ${n(CX - M.waistW - 1)} ${n(Y.waist - 8)} Z`}
              fill="#3f2a1c" stroke={accent} strokeWidth={1.2} />
          )}
        </g>

        {/* Głowa */}
        <ellipse cx={CX} cy={Y.headCy} rx={15.5} ry={18.5} fill={`url(#sk${uid})`} stroke={line} strokeWidth={1.1} />
        <path d={female
          ? `M ${CX - 16.5} ${Y.headCy - 1} Q ${CX - 18} ${Y.headCy - 25} ${CX} ${Y.headCy - 20} Q ${CX + 18} ${Y.headCy - 25} ${CX + 16.5} ${Y.headCy - 1} Q ${CX + 19} ${Y.headCy + 19} ${CX + 12.5} ${Y.headCy + 11} Q ${CX + 14} ${Y.headCy - 9} ${CX} ${Y.headCy - 11} Q ${CX - 14} ${Y.headCy - 9} ${CX - 12.5} ${Y.headCy + 11} Q ${CX - 19} ${Y.headCy + 19} ${CX - 16.5} ${Y.headCy - 1} Z`
          : `M ${CX - 15.5} ${Y.headCy - 5} Q ${CX - 14} ${Y.headCy - 23} ${CX} ${Y.headCy - 20} Q ${CX + 14} ${Y.headCy - 23} ${CX + 15.5} ${Y.headCy - 5} Q ${CX + 9} ${Y.headCy - 13} ${CX} ${Y.headCy - 12} Q ${CX - 9} ${Y.headCy - 13} ${CX - 15.5} ${Y.headCy - 5} Z`}
          fill="#3a2517" />
        <g fill="#3a2517" opacity={0.82}>
          <ellipse cx={CX - 5.5} cy={Y.headCy + 1} rx={1.6} ry={weak > 0.5 ? 0.8 : 1.9} />
          <ellipse cx={CX + 5.5} cy={Y.headCy + 1} rx={1.6} ry={weak > 0.5 ? 0.8 : 1.9} />
        </g>
        <path d={weak > 0.5
          ? `M ${CX - 4} ${Y.headCy + 9.5} L ${CX + 4} ${Y.headCy + 9.5}`
          : `M ${CX - 4.5} ${Y.headCy + 8.5} Q ${CX} ${Y.headCy + 12} ${CX + 4.5} ${Y.headCy + 8.5}`}
          stroke={shade} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.7} />

        {level >= 10 && (
          <path d={`M ${CX - 16} ${Y.headCy - 8} Q ${CX} ${Y.headCy - 15} ${CX + 16} ${Y.headCy - 8} L ${CX + 16} ${Y.headCy - 3} Q ${CX} ${Y.headCy - 10} ${CX - 16} ${Y.headCy - 3} Z`}
            fill={accent} />
        )}
        {level >= 5 && (
          <g fill={accent}>
            <rect x={CX - wrX - M.foreArm * 0.8} y={Y.wrist - 7} width={M.foreArm * 1.6} height={5} rx={2} />
            <rect x={CX + wrX - M.foreArm * 0.8} y={Y.wrist - 7} width={M.foreArm * 1.6} height={5} rx={2} />
          </g>
        )}
      </g>
    </svg>
  );
}
