/**
 * FORMA — Animacja ruchu sylwetki.
 *
 * Każde ćwiczenie mapujemy na ARCHETYP RUCHU, a ten na kąty w stawach
 * (bark, łokieć, biodro, kolano) + ewentualne przesunięcie całej sylwetki.
 * Wartości to pełny cykl powtórzenia: pozycja startowa → końcowa → powrót.
 *
 * Konwencja SVG: rotate(kąt, cx, cy) obraca ZGODNIE z ruchem wskazówek zegara.
 * Dla lewej kończyny (ekranowo po lewej) dodatni kąt = odwodzenie na zewnątrz.
 */

import type { ExerciseAnatomy } from "@/lib/anatomy/exercises";

export type Archetype =
  | "press_h" | "press_v" | "pull_v" | "pull_h" | "fly" | "abduct"
  | "curl" | "ext_elbow" | "squat" | "hinge" | "knee_ext" | "knee_flex"
  | "calf" | "core" | "hold";

export interface Motion {
  /** Kąty [start, koniec] w stopniach. Pominięte = staw nieruchomy. */
  shoulder?: [number, number];
  elbow?: [number, number];
  hip?: [number, number];
  knee?: [number, number];
  /** Przesunięcie całej sylwetki w pionie [start, koniec] (px viewBoxa). */
  bodyY?: [number, number];
  /** Czas jednego powtórzenia w sekundach. */
  dur: number;
  /** Opis fazy — pokazywany pod sylwetką. */
  label: string;
}

/**
 * Konwencja znaków dla LEWEJ kończyny (prawa powstaje przez odbicie):
 *   bark  dodatni → ramię odwodzi się na zewnątrz, potem w górę (0° = wzdłuż ciała)
 *   łokieć UJEMNY → zgięcie, dłoń wędruje do barku (dodatni prostowałby na zewnątrz)
 */
export const MOTIONS: Record<Archetype, Motion> = {
  press_h:   { shoulder: [30, 12],  elbow: [-92, -12], dur: 2.6, label: "wypychanie ciężaru od klatki" },
  press_v:   { shoulder: [100, 152], elbow: [-80, -10], dur: 2.8, label: "wyciskanie nad głowę" },
  pull_v:    { shoulder: [152, 46],  elbow: [-6, -96],  dur: 2.8, label: "ciągnięcie w dół / podciąganie" },
  pull_h:    { shoulder: [24, 6],    elbow: [-14, -88], dur: 2.6, label: "przyciąganie łokci do tułowia" },
  fly:       { shoulder: [68, 16],   elbow: [-22, -20], dur: 3.0, label: "przywodzenie ramion" },
  abduct:    { shoulder: [5, 78],    elbow: [-8, -10],  dur: 2.6, label: "odwodzenie ramion na boki" },
  curl:      { shoulder: [4, 6],     elbow: [-6, -112], dur: 2.4, label: "zginanie łokcia" },
  ext_elbow: { shoulder: [8, 8],     elbow: [-96, -6],  dur: 2.2, label: "prostowanie łokcia" },
  squat:     { hip: [4, 16],  knee: [-4, -38], bodyY: [0, 16], dur: 3.2, label: "schodzenie w dół i wstawanie" },
  hinge:     { hip: [3, 15],  knee: [0, -9],   bodyY: [0, 9],  dur: 3.0, label: "zawias biodrowy" },
  knee_ext:  { knee: [-48, 0], dur: 2.4, label: "prostowanie kolana" },
  knee_flex: { knee: [0, 52],  dur: 2.4, label: "zginanie kolana" },
  calf:      { bodyY: [0, -9], dur: 1.9, label: "wspięcie na palce" },
  core:      { hip: [0, 9], bodyY: [0, 4], dur: 2.8, label: "spinanie brzucha" },
  hold:      { bodyY: [0, 2], dur: 3.4, label: "napięcie izometryczne" },
};

/** Wykrywa archetyp ruchu ze wzorca ćwiczenia (bez zmian w katalogu danych). */
export function archetypeOf(ex: ExerciseAnatomy): Archetype {
  const p = ex.pattern.toLowerCase();
  const id = ex.id;

  if (id.startsWith("calf")) return "calf";
  if (id === "leg_extension") return "knee_ext";
  if (id === "leg_curl" || id === "nordic_curl") return "knee_flex";
  if (id === "hip_thrust") return "hinge";

  if (/pchanie pionowe/.test(p)) return "press_v";
  if (/pchanie/.test(p)) return "press_h";
  if (/ciągnięcie pionowe/.test(p)) return "pull_v";
  if (/ciągnięcie poziome|ciągnięcie z podłoża/.test(p)) return /z podłoża/.test(p) ? "hinge" : "pull_h";
  if (/przywodzenie poziome/.test(p)) return "fly";
  if (/odwodzenie/.test(p)) return "abduct";
  if (/zginanie łokcia/.test(p)) return "curl";
  if (/prostowanie łokcia/.test(p)) return "ext_elbow";
  if (/przysiad|pchanie nogami|wypad/.test(p)) return "squat";
  if (/zawias|wyprost biodra/.test(p)) return "hinge";
  if (/wyprost kolana/.test(p)) return "knee_ext";
  if (/zgięcie kolana/.test(p)) return "knee_flex";
  if (/zgięcie podeszwowe/.test(p)) return "calf";
  if (/zgięcie tułowia|rotacja tułowia|antywyprost dynamiczny/.test(p)) return "core";
  if (/izometri|antywyprost/.test(p)) return "hold";
  return "hold";
}

/** Zamienia parę kątów na listę wartości SMIL (start → koniec → start). */
export function smilValues(range: [number, number], cx: number, cy: number): string {
  const [a, b] = range;
  return `${a} ${cx} ${cy}; ${b} ${cx} ${cy}; ${a} ${cx} ${cy}`;
}
