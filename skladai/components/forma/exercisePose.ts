/**
 * FORMA — Pozycje ciała dla wzorców ruchu (model 3D).
 *
 * Każdy archetyp ma pozycję STARTOWĄ (rozciągnięcie / dół ruchu) i KOŃCOWĄ
 * (skurcz / góra ruchu). Model płynnie przechodzi między nimi, pokazując
 * technikę ćwiczenia razem z pracującymi mięśniami.
 *
 * Kąty w radianach, na segment: [rotacja X, Y, Z].
 *   torso.x     > 0  → pochylenie tułowia w PRZÓD
 *   thigh.x     < 0  → zgięcie biodra (kolano jedzie w przód)
 *   shin.x      > 0  → zgięcie kolana (pięta w tył)
 *   upperArm.x  < 0  → uniesienie ramienia w PRZÓD
 *   upperArm.z  > 0  → odwodzenie ramienia na BOK (lustrzane dla lewej strony)
 *   foreArm.x   < 0  → zgięcie łokcia (dłoń do barku)
 */

import type { SegmentId } from "@/lib/anatomy/muscles3d";
import type { Archetype } from "./anatomyMotion";

export type Pose = Partial<Record<SegmentId, [number, number, number]>>;

const D = Math.PI / 180;

export interface PosePair {
  start: Pose;
  end: Pose;
  /** Nazwa fazy końcowej — podpis pod modelem. */
  label: string;
  /** Czas przejścia w sekundach. */
  dur: number;
}

/** Postawa neutralna — stanie w pozycji anatomicznej. */
export const NEUTRAL: Pose = {};

export const POSES: Record<Archetype, PosePair> = {
  // Wyciskanie poziome — ramiona przed klatką, łokcie zginają się i prostują
  press_h: {
    start: { upperArm: [-70 * D, 0, 35 * D], foreArm: [-85 * D, 0, 0], torso: [0, 0, 0] },
    end:   { upperArm: [-85 * D, 0, 12 * D], foreArm: [-4 * D, 0, 0], torso: [0, 0, 0] },
    label: "wypchnięcie ciężaru od klatki", dur: 2.4,
  },
  // Wyciskanie nad głowę
  press_v: {
    start: { upperArm: [-10 * D, 0, 70 * D], foreArm: [-95 * D, 0, 0] },
    end:   { upperArm: [-8 * D, 0, 165 * D], foreArm: [-6 * D, 0, 0] },
    label: "wyciskanie nad głowę", dur: 2.6,
  },
  // Podciąganie / ściąganie drążka
  pull_v: {
    start: { upperArm: [-6 * D, 0, 160 * D], foreArm: [-8 * D, 0, 0] },
    end:   { upperArm: [-6 * D, 0, 82 * D], foreArm: [-105 * D, 0, 0] },
    label: "ciągnięcie łokci w dół", dur: 2.6,
  },
  // Wiosłowanie — tułów pochylony, łokcie do tułowia
  pull_h: {
    start: { torso: [62 * D, 0, 0], thigh: [-22 * D, 0, 0], shin: [16 * D, 0, 0], upperArm: [-58 * D, 0, 8 * D], foreArm: [-10 * D, 0, 0] },
    end:   { torso: [62 * D, 0, 0], thigh: [-22 * D, 0, 0], shin: [16 * D, 0, 0], upperArm: [10 * D, 0, 8 * D], foreArm: [-72 * D, 0, 0] },
    label: "przyciągnięcie łokci do tułowia", dur: 2.6,
  },
  // Rozpiętki — ramiona rozłożone i zbierane przed sobą
  fly: {
    start: { upperArm: [-80 * D, 0, 72 * D], foreArm: [-18 * D, 0, 0] },
    end:   { upperArm: [-88 * D, 0, 8 * D], foreArm: [-18 * D, 0, 0] },
    label: "zbliżenie ramion przed klatką", dur: 2.8,
  },
  // Wznosy bokiem
  abduct: {
    start: { upperArm: [0, 0, 6 * D], foreArm: [-8 * D, 0, 0] },
    end:   { upperArm: [0, 0, 88 * D], foreArm: [-10 * D, 0, 0] },
    label: "odwiedzenie ramion do poziomu", dur: 2.4,
  },
  // Uginanie ramion
  curl: {
    start: { upperArm: [-4 * D, 0, 5 * D], foreArm: [-6 * D, 0, 0] },
    end:   { upperArm: [-8 * D, 0, 5 * D], foreArm: [-125 * D, 0, 0] },
    label: "zgięcie łokci", dur: 2.2,
  },
  // Prostowanie ramion (triceps)
  ext_elbow: {
    start: { upperArm: [-12 * D, 0, 6 * D], foreArm: [-115 * D, 0, 0] },
    end:   { upperArm: [-12 * D, 0, 6 * D], foreArm: [-6 * D, 0, 0] },
    label: "wyprost łokci", dur: 2.2,
  },
  // Przysiad — pełna technika: tułów lekko w przód, biodra w tył i dół
  squat: {
    start: { torso: [8 * D, 0, 0], thigh: [-6 * D, 0, 0], shin: [4 * D, 0, 0], upperArm: [0, 0, 68 * D], foreArm: [-115 * D, 0, 0] },
    end:   { torso: [34 * D, 0, 0], thigh: [-96 * D, 0, 0], shin: [86 * D, 0, 0], upperArm: [0, 0, 68 * D], foreArm: [-115 * D, 0, 0] },
    label: "zejście do równoległości i wstanie", dur: 3.0,
  },
  // Zawias biodrowy — martwy ciąg / RDL
  hinge: {
    start: { torso: [6 * D, 0, 0], thigh: [-4 * D, 0, 0], shin: [2 * D, 0, 0], upperArm: [4 * D, 0, 6 * D] },
    end:   { torso: [72 * D, 0, 0], thigh: [-32 * D, 0, 0], shin: [14 * D, 0, 0], upperArm: [-14 * D, 0, 6 * D] },
    label: "zawias w biodrach z neutralnym kręgosłupem", dur: 3.0,
  },
  // Prostowanie nóg
  knee_ext: {
    start: { thigh: [-88 * D, 0, 0], shin: [82 * D, 0, 0], torso: [-6 * D, 0, 0] },
    end:   { thigh: [-88 * D, 0, 0], shin: [2 * D, 0, 0], torso: [-6 * D, 0, 0] },
    label: "wyprost kolana", dur: 2.2,
  },
  // Uginanie nóg
  knee_flex: {
    start: { thigh: [-4 * D, 0, 0], shin: [4 * D, 0, 0], torso: [6 * D, 0, 0] },
    end:   { thigh: [-4 * D, 0, 0], shin: [95 * D, 0, 0], torso: [6 * D, 0, 0] },
    label: "zgięcie kolana", dur: 2.2,
  },
  // Wspięcia na palce — praca w kostce, sylwetka unosi się
  calf: {
    start: { thigh: [0, 0, 0], shin: [0, 0, 0] },
    end:   { thigh: [4 * D, 0, 0], shin: [-6 * D, 0, 0] },
    label: "wspięcie na palce", dur: 1.8,
  },
  // Praca brzucha
  core: {
    start: { torso: [4 * D, 0, 0], thigh: [-8 * D, 0, 0], upperArm: [-18 * D, 0, 10 * D], foreArm: [-95 * D, 0, 0] },
    end:   { torso: [34 * D, 0, 0], thigh: [-26 * D, 0, 0], upperArm: [-24 * D, 0, 10 * D], foreArm: [-95 * D, 0, 0] },
    label: "spięcie brzucha", dur: 2.6,
  },
  // Izometria (deska, plank)
  hold: {
    start: { torso: [4 * D, 0, 0] },
    end:   { torso: [8 * D, 0, 0] },
    label: "napięcie izometryczne", dur: 3.2,
  },
};

/** Liniowa interpolacja dwóch pozycji (t 0→1). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  const keys = new Set<SegmentId>([...Object.keys(a), ...Object.keys(b)] as SegmentId[]);
  for (const k of keys) {
    const va = a[k] ?? [0, 0, 0];
    const vb = b[k] ?? [0, 0, 0];
    out[k] = [
      va[0] + (vb[0] - va[0]) * t,
      va[1] + (vb[1] - va[1]) * t,
      va[2] + (vb[2] - va[2]) * t,
    ];
  }
  return out;
}
