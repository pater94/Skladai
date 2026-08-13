/**
 * FORMA — Model 3D mięśni.
 *
 * Każda GŁOWA mięśnia to osobna bryła (elipsoida) przypięta do segmentu szkieletu.
 * Dzięki hierarchii stawów (miednica → tors → ramię → przedramię, biodro → udo →
 * podudzie) model da się animować: obrót w stawie zabiera ze sobą wszystkie
 * leżące na nim mięśnie.
 *
 * Układ: Y w górę, Z do przodu, X w prawo (patrząc na model od przodu).
 * Jednostki ≈ metry, sylwetka ~1,80 m. Origin każdego segmentu = jego staw.
 */

import type { MuscleId } from "./muscles";

export type SegmentId =
  | "torso" | "head"
  | "upperArm" | "foreArm"
  | "thigh" | "shin";

/** Szkielet: gdzie leży staw danego segmentu względem rodzica. */
export interface SegmentDef {
  id: SegmentId;
  parent: SegmentId | null;
  /** Pozycja stawu względem rodzica (dla parzystych: X dodatni = strona prawa). */
  origin: [number, number, number];
  /** Długość segmentu (do rysowania „kości"/sylwetki). */
  length: number;
  /** Promień poglądowej bryły ciała. */
  radius: number;
  /** Czy segment występuje parzyście (lewa + prawa). */
  paired: boolean;
}

export const SKELETON: SegmentDef[] = [
  { id: "torso",    parent: null,      origin: [0, 0.92, 0],        length: 0.56, radius: 0.135, paired: false },
  { id: "head",     parent: "torso",   origin: [0, 0.60, 0],        length: 0.24, radius: 0.095, paired: false },
  { id: "upperArm", parent: "torso",   origin: [0.20, 0.54, 0],     length: 0.29, radius: 0.052, paired: true },
  { id: "foreArm",  parent: "upperArm",origin: [0, -0.29, 0],       length: 0.26, radius: 0.044, paired: true },
  { id: "thigh",    parent: null,      origin: [0.10, 0.92, 0],     length: 0.44, radius: 0.085, paired: true },
  { id: "shin",     parent: "thigh",   origin: [0, -0.44, 0],       length: 0.42, radius: 0.058, paired: true },
];

export interface Muscle3D {
  muscle: MuscleId;
  head?: string;
  segment: SegmentId;
  /** Środek bryły w układzie LOKALNYM segmentu. */
  pos: [number, number, number];
  /** Półosie elipsoidy (x, y, z). */
  scale: [number, number, number];
  /** Obrót bryły w radianach (opcjonalny — dla skośnych brzuśców). */
  rot?: [number, number, number];
  /** "C" = pojedynczy, na osi ciała. Inaczej bryła powstaje po obu stronach. */
  center?: boolean;
}

/**
 * Bryły mięśni. Dla parzystych podajemy stronę PRAWĄ (X > 0);
 * lewa powstaje automatycznie przez odbicie.
 */
export const MUSCLES_3D: Muscle3D[] = [
  // ───── TORS: przód ─────
  { muscle: "chest", head: "clavicular", segment: "torso", pos: [0.075, 0.46, 0.105], scale: [0.082, 0.040, 0.052] },
  { muscle: "chest", head: "sternal",    segment: "torso", pos: [0.082, 0.385, 0.108], scale: [0.088, 0.048, 0.058] },
  { muscle: "chest", head: "abdominal",  segment: "torso", pos: [0.078, 0.315, 0.100], scale: [0.078, 0.038, 0.052] },
  { muscle: "abs", head: "upper", segment: "torso", center: true, pos: [0, 0.235, 0.098], scale: [0.062, 0.085, 0.042] },
  { muscle: "abs", head: "lower", segment: "torso", center: true, pos: [0, 0.095, 0.092], scale: [0.056, 0.070, 0.038] },
  { muscle: "obliques", head: "external", segment: "torso", pos: [0.105, 0.16, 0.055], scale: [0.034, 0.095, 0.058] },
  { muscle: "serratus", head: "main", segment: "torso", pos: [0.118, 0.30, 0.050], scale: [0.028, 0.052, 0.048] },
  { muscle: "core_deep", head: "main", segment: "torso", center: true, pos: [0, 0.17, 0.0], scale: [0.112, 0.085, 0.095] },
  { muscle: "hip_flexors", head: "psoas", segment: "torso", pos: [0.062, 0.055, 0.062], scale: [0.033, 0.058, 0.033] },

  // ───── TORS: tył ─────
  { muscle: "traps", head: "upper",  segment: "torso", pos: [0.070, 0.545, -0.030], scale: [0.078, 0.048, 0.055] },
  { muscle: "traps", head: "middle", segment: "torso", pos: [0.052, 0.440, -0.082], scale: [0.058, 0.062, 0.034] },
  { muscle: "traps", head: "lower",  segment: "torso", pos: [0.036, 0.335, -0.078], scale: [0.040, 0.072, 0.030] },
  { muscle: "rhomboids", head: "major_minor", segment: "torso", pos: [0.048, 0.425, -0.070], scale: [0.038, 0.058, 0.028] },
  { muscle: "rotator_cuff", head: "infraspinatus", segment: "torso", pos: [0.112, 0.470, -0.052], scale: [0.045, 0.040, 0.035] },
  { muscle: "teres_major", head: "main", segment: "torso", pos: [0.115, 0.405, -0.050], scale: [0.036, 0.034, 0.038] },
  { muscle: "lats", head: "upper", segment: "torso", pos: [0.112, 0.350, -0.055], scale: [0.048, 0.095, 0.072] },
  { muscle: "lats", head: "lower", segment: "torso", pos: [0.085, 0.215, -0.062], scale: [0.044, 0.100, 0.058] },
  { muscle: "erectors", head: "longissimus",  segment: "torso", pos: [0.030, 0.230, -0.080], scale: [0.028, 0.155, 0.032] },
  { muscle: "erectors", head: "iliocostalis", segment: "torso", pos: [0.062, 0.245, -0.072], scale: [0.026, 0.130, 0.030] },
  { muscle: "glutes", head: "maximus", segment: "torso", pos: [0.090, 0.010, -0.088], scale: [0.085, 0.072, 0.070] },
  { muscle: "glutes", head: "medius",  segment: "torso", pos: [0.125, 0.070, -0.030], scale: [0.045, 0.055, 0.050] },

  // ───── RAMIĘ ─────
  { muscle: "delts", head: "front", segment: "upperArm", pos: [0, 0.005, 0.048], scale: [0.052, 0.058, 0.042] },
  { muscle: "delts", head: "side",  segment: "upperArm", pos: [0.030, -0.005, 0], scale: [0.042, 0.068, 0.055] },
  { muscle: "delts", head: "rear",  segment: "upperArm", pos: [0, 0.005, -0.048], scale: [0.050, 0.056, 0.042] },
  { muscle: "biceps", head: "long",  segment: "upperArm", pos: [0.016, -0.135, 0.030], scale: [0.025, 0.072, 0.026] },
  { muscle: "biceps", head: "short", segment: "upperArm", pos: [-0.014, -0.135, 0.030], scale: [0.024, 0.068, 0.025] },
  { muscle: "brachialis", head: "main", segment: "upperArm", pos: [0, -0.215, 0.030], scale: [0.026, 0.040, 0.024] },
  { muscle: "triceps", head: "long",    segment: "upperArm", pos: [-0.014, -0.130, -0.034], scale: [0.026, 0.080, 0.028] },
  { muscle: "triceps", head: "lateral", segment: "upperArm", pos: [0.028, -0.120, -0.026], scale: [0.024, 0.070, 0.026] },
  { muscle: "triceps", head: "medial",  segment: "upperArm", pos: [0, -0.215, -0.030], scale: [0.024, 0.040, 0.024] },

  // ───── PRZEDRAMIĘ ─────
  { muscle: "forearms", head: "flexors",   segment: "foreArm", pos: [0, -0.095, 0.022], scale: [0.030, 0.088, 0.028] },
  { muscle: "forearms", head: "extensors", segment: "foreArm", pos: [0, -0.095, -0.022], scale: [0.030, 0.088, 0.028] },
  { muscle: "forearms", head: "brachioradialis", segment: "foreArm", pos: [0.030, -0.060, 0.012], scale: [0.020, 0.060, 0.022] },

  // ───── UDO ─────
  { muscle: "quads", head: "rectus_femoris",    segment: "thigh", pos: [0, -0.185, 0.058], scale: [0.038, 0.165, 0.034] },
  { muscle: "quads", head: "vastus_lateralis",  segment: "thigh", pos: [0.052, -0.180, 0.030], scale: [0.034, 0.155, 0.045] },
  { muscle: "quads", head: "vastus_medialis",   segment: "thigh", pos: [-0.046, -0.300, 0.038], scale: [0.030, 0.075, 0.036] },
  { muscle: "quads", head: "vastus_intermedius", segment: "thigh", pos: [0, -0.200, 0.020], scale: [0.030, 0.140, 0.028] },
  { muscle: "adductors", head: "magnus", segment: "thigh", pos: [-0.052, -0.155, 0.0], scale: [0.034, 0.135, 0.048] },
  { muscle: "hamstrings", head: "bf_long",         segment: "thigh", pos: [0.042, -0.205, -0.052], scale: [0.033, 0.145, 0.038] },
  { muscle: "hamstrings", head: "bf_short",        segment: "thigh", pos: [0.040, -0.320, -0.048], scale: [0.026, 0.070, 0.030] },
  { muscle: "hamstrings", head: "semitendinosus",  segment: "thigh", pos: [-0.040, -0.205, -0.052], scale: [0.030, 0.145, 0.036] },
  { muscle: "hamstrings", head: "semimembranosus", segment: "thigh", pos: [-0.044, -0.290, -0.045], scale: [0.028, 0.090, 0.034] },

  // ───── PODUDZIE ─────
  { muscle: "calves", head: "gastro_medial",  segment: "shin", pos: [-0.026, -0.115, -0.045], scale: [0.030, 0.098, 0.034] },
  { muscle: "calves", head: "gastro_lateral", segment: "shin", pos: [0.026, -0.115, -0.045], scale: [0.028, 0.092, 0.032] },
  { muscle: "calves", head: "soleus",         segment: "shin", pos: [0, -0.215, -0.040], scale: [0.034, 0.085, 0.032] },
  { muscle: "tibialis", head: "main", segment: "shin", pos: [0.014, -0.145, 0.042], scale: [0.022, 0.105, 0.024] },
];
