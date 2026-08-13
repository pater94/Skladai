/**
 * FORMA — Pozycje ciała i sprzęt dla ćwiczeń (model 3D).
 *
 * Trzy warstwy, żeby model NAPRAWDĘ wykonywał dane ćwiczenie:
 *   1. POSTAWA (stance) — czy leży na ławce, siedzi w maszynie, stoi, jest
 *      w opadzie tułowia, zwisa na drążku czy leży przodem. Ustawia obrót całej
 *      sylwetki i domyślne kąty (np. w siadzie uda poziomo).
 *   2. RUCH — kąty startowe i końcowe w stawach, dokładane na postawę.
 *   3. SPRZĘT — sztanga, hantle, wyciąg albo maszyna, trzymane w dłoniach.
 *
 * Kąty w radianach, na segment: [X, Y, Z].
 *   torso.x     > 0  → pochylenie tułowia w PRZÓD
 *   thigh.x     < 0  → zgięcie biodra (kolano w przód)
 *   shin.x      > 0  → zgięcie kolana (pięta w tył)
 *   upperArm.x  < 0  → uniesienie ramienia w PRZÓD
 *   upperArm.z  > 0  → odwodzenie ramienia na BOK (lustrzane dla lewej strony)
 *   foreArm.x   < 0  → zgięcie łokcia (dłoń do barku)
 */

import type { SegmentId } from "@/lib/anatomy/muscles3d";
import type { Archetype } from "./anatomyMotion";
import type { ExerciseAnatomy } from "@/lib/anatomy/exercises";

export type Pose = Partial<Record<SegmentId, [number, number, number]>>;

const D = Math.PI / 180;

// ─────────────────────────── POSTAWY ───────────────────────────
export type Stance =
  | "stand"        // stojąc
  | "supine"       // leżąc na plecach (ławka płaska)
  | "incline"      // ławka skośna dodatnia
  | "prone"        // leżąc przodem (pompki, deska, uginanie leżąc)
  | "seated"       // siad na maszynie / ławce
  | "bentOver"     // opad tułowia (wiosłowanie sztangą)
  | "hang"         // zwis na drążku
  | "legPress"     // półleżąc w suwnicy
  | "hipThrust";   // barki oparte o ławkę, biodra pracują

export interface StanceDef {
  /** Przesunięcie i obrót CAŁEJ sylwetki. */
  rootPos: [number, number, number];
  rootRot: [number, number, number];
  /**
   * Kotwica: punkt ciała, który ma zostać na stałej wysokości.
   * Bez tego przysiad „unosiłby się" w miejscu (stopy odjeżdżają od podłogi),
   * a przy podciąganiu ciało stałoby w miejscu zamiast jechać do drążka.
   *   ankle → stopy na podłodze (stanie, opad)
   *   wrist → dłonie na drążku (zwis)
   */
  anchor?: { joint: "ankle" | "wrist" | "shoulder"; y: number };
  /** Domyślne kąty segmentów dla tej postawy (ruch dokłada się na to). */
  base: Pose;
  /** Rekwizyt sceny: ławka / siedzisko / drążek / podłoga. */
  prop: "bench" | "inclineBench" | "seat" | "bar" | "floor" | "legPressSled" | null;
  /** Podpis postawy — pokazywany pod modelem. */
  name: string;
}

/**
 * UWAGA: `rootPos` to POZYCJA BIODER w świecie (model obraca się wokół bioder),
 * a nie przesunięcie od podłogi. Dzięki temu położenie na ławce, siad czy opad
 * wyglądają naturalnie, bez odjeżdżania sylwetki w bok.
 */
export const STANCES: Record<Stance, StanceDef> = {
  stand: {
    rootPos: [0, 0.92, 0], rootRot: [0, 0, 0], base: {},
    anchor: { joint: "ankle", y: 0.04 }, prop: "floor", name: "stojąc",
  },
  supine: {
    // obrót −90° wokół X kładzie sylwetkę na plecach, biodra lądują na ławce
    rootPos: [0, 0.55, 0.10], rootRot: [-90 * D, 0, 0],
    // biodra PRAWIE wyprostowane (leżysz płasko), kolana zgięte ~85° → stopy na podłodze
    base: { thigh: [-8 * D, 0, 0], shin: [86 * D, 0, 0] },
    prop: "bench", name: "leżąc na ławce",
  },
  incline: {
    rootPos: [0, 0.56, 0.10], rootRot: [-42 * D, 0, 0],
    base: { thigh: [-50 * D, 0, 0], shin: [46 * D, 0, 0] },
    prop: "inclineBench", name: "na ławce skośnej",
  },
  prone: {
    rootPos: [0, 0.34, 0], rootRot: [90 * D, 0, 0],
    base: {},
    prop: "floor", name: "podpór przodem",
  },
  seated: {
    // biodra na siedzisku, uda poziomo, podudzia w dół
    rootPos: [0, 0.56, 0], rootRot: [0, 0, 0],
    base: { thigh: [-88 * D, 0, 0], shin: [86 * D, 0, 0] },
    prop: "seat", name: "w siadzie",
  },
  bentOver: {
    rootPos: [0, 0.90, 0], rootRot: [0, 0, 0],
    base: { torso: [64 * D, 0, 0], thigh: [-24 * D, 0, 0], shin: [18 * D, 0, 0] },
    anchor: { joint: "ankle", y: 0.04 }, prop: "floor", name: "w opadzie tułowia",
  },
  hang: {
    rootPos: [0, 1.20, 0], rootRot: [0, 0, 0],
    base: { thigh: [-10 * D, 0, 0], shin: [26 * D, 0, 0] },
    anchor: { joint: "wrist", y: 2.14 }, prop: "bar", name: "w zwisie",
  },
  hipThrust: {
    // barki zostają na ławce — zmiana kąta tułowia unosi i opuszcza biodra
    rootPos: [0, 0.42, 0], rootRot: [0, 0, 0],
    base: { thigh: [-96 * D, 0, 0], shin: [92 * D, 0, 0] },
    anchor: { joint: "shoulder", y: 0.52 }, prop: "bench", name: "barki na ławce",
  },
  legPress: {
    rootPos: [0, 0.58, 0.12], rootRot: [-32 * D, 0, 0],
    base: {},
    prop: "legPressSled", name: "w suwnicy",
  },
};

// ─────────────────────────── SPRZĘT ───────────────────────────
export type Equipment = "barbell" | "dumbbells" | "cable" | "machine" | "bodyweight";

export interface PosePair {
  stance: Stance;
  equipment: Equipment;
  start: Pose;
  end: Pose;
  /** Opis fazy końcowej — podpis pod modelem. */
  label: string;
  /** Czas przejścia w sekundach. */
  dur: number;
}

/** Domyślny ruch dla archetypu — używany, gdy ćwiczenie nie ma własnej definicji. */
export const POSES: Record<Archetype, PosePair> = {
  press_h: {
    stance: "supine", equipment: "barbell",
    // dół: łokcie na boki, sztanga NAD KLATKĄ (nie nad głową); góra: ramiona pionowo
    start: { upperArm: [-5 * D, 0, 55 * D], foreArm: [-80 * D, 0, 0] },
    end:   { upperArm: [-80 * D, 0, 5 * D], foreArm: [-2 * D, 0, 0] },
    label: "wypchnięcie sztangi znad klatki", dur: 2.4,
  },
  press_v: {
    stance: "stand", equipment: "barbell",
    start: { upperArm: [-8 * D, 0, 72 * D], foreArm: [-96 * D, 0, 0] },
    end:   { upperArm: [-6 * D, 0, 164 * D], foreArm: [-8 * D, 0, 0] },
    label: "wyciskanie nad głowę", dur: 2.6,
  },
  pull_v: {
    stance: "hang", equipment: "bodyweight",
    start: { upperArm: [-4 * D, 0, 158 * D], foreArm: [-10 * D, 0, 0] },
    end:   { upperArm: [-4 * D, 0, 96 * D], foreArm: [-112 * D, 0, 0] },
    label: "podciągnięcie — łokcie w dół", dur: 2.8,
  },
  pull_h: {
    stance: "bentOver", equipment: "barbell",
    start: { upperArm: [-52 * D, 0, 10 * D], foreArm: [-8 * D, 0, 0] },
    end:   { upperArm: [14 * D, 0, 10 * D], foreArm: [-76 * D, 0, 0] },
    label: "przyciągnięcie łokci do tułowia", dur: 2.6,
  },
  fly: {
    stance: "supine", equipment: "dumbbells",
    start: { upperArm: [-86 * D, 0, 78 * D], foreArm: [-20 * D, 0, 0] },
    end:   { upperArm: [-88 * D, 0, 10 * D], foreArm: [-20 * D, 0, 0] },
    label: "zbliżenie ramion nad klatką", dur: 2.8,
  },
  abduct: {
    stance: "stand", equipment: "dumbbells",
    start: { upperArm: [0, 0, 8 * D], foreArm: [-8 * D, 0, 0] },
    end:   { upperArm: [0, 0, 90 * D], foreArm: [-10 * D, 0, 0] },
    label: "odwiedzenie ramion do poziomu", dur: 2.4,
  },
  curl: {
    stance: "stand", equipment: "barbell",
    start: { upperArm: [-4 * D, 0, 6 * D], foreArm: [-8 * D, 0, 0] },
    end:   { upperArm: [-10 * D, 0, 6 * D], foreArm: [-128 * D, 0, 0] },
    label: "zgięcie łokci", dur: 2.2,
  },
  ext_elbow: {
    stance: "stand", equipment: "cable",
    start: { upperArm: [-10 * D, 0, 8 * D], foreArm: [-112 * D, 0, 0] },
    end:   { upperArm: [-10 * D, 0, 8 * D], foreArm: [-8 * D, 0, 0] },
    label: "wyprost łokci", dur: 2.2,
  },
  squat: {
    stance: "stand", equipment: "barbell",
    start: { torso: [8 * D, 0, 0], thigh: [-6 * D, 0, 0], shin: [4 * D, 0, 0], upperArm: [0, 0, 74 * D], foreArm: [-118 * D, 0, 0] },
    end:   { torso: [36 * D, 0, 0], thigh: [-98 * D, 0, 0], shin: [88 * D, 0, 0], upperArm: [0, 0, 74 * D], foreArm: [-118 * D, 0, 0] },
    label: "zejście do równoległości i wstanie", dur: 3.0,
  },
  hinge: {
    stance: "stand", equipment: "barbell",
    start: { torso: [6 * D, 0, 0], thigh: [-4 * D, 0, 0], shin: [2 * D, 0, 0], upperArm: [2 * D, 0, 8 * D] },
    end:   { torso: [74 * D, 0, 0], thigh: [-34 * D, 0, 0], shin: [16 * D, 0, 0], upperArm: [-16 * D, 0, 8 * D] },
    label: "zawias w biodrach, kręgosłup neutralny", dur: 3.0,
  },
  knee_ext: {
    stance: "seated", equipment: "machine",
    start: { shin: [86 * D, 0, 0] },
    end:   { shin: [4 * D, 0, 0] },
    label: "wyprost kolan", dur: 2.2,
  },
  knee_flex: {
    stance: "prone", equipment: "machine",
    start: { shin: [4 * D, 0, 0] },
    end:   { shin: [98 * D, 0, 0] },
    label: "zgięcie kolan", dur: 2.2,
  },
  calf: {
    stance: "stand", equipment: "machine",
    start: { thigh: [0, 0, 0], shin: [0, 0, 0] },
    end:   { thigh: [3 * D, 0, 0], shin: [-5 * D, 0, 0] },
    label: "wspięcie na palce", dur: 1.8,
  },
  core: {
    stance: "supine", equipment: "bodyweight",
    start: { torso: [0, 0, 0], upperArm: [-30 * D, 0, 22 * D], foreArm: [-100 * D, 0, 0] },
    end:   { torso: [34 * D, 0, 0], upperArm: [-30 * D, 0, 22 * D], foreArm: [-100 * D, 0, 0] },
    label: "spięcie brzucha", dur: 2.6,
  },
  hold: {
    stance: "prone", equipment: "bodyweight",
    start: { upperArm: [-84 * D, 0, 14 * D], foreArm: [-88 * D, 0, 0] },
    end:   { upperArm: [-86 * D, 0, 14 * D], foreArm: [-90 * D, 0, 0] },
    label: "napięcie izometryczne", dur: 3.2,
  },
};

/**
 * Nadpisania dla konkretnych ćwiczeń — tam gdzie archetyp trafiałby w złą
 * postawę albo zły sprzęt (np. pompki to nie ławka, ściąganie drążka to siad,
 * a wyciskanie nogami to suwnica, nie przysiad).
 */
export const EXERCISE_POSES: Record<string, Partial<PosePair>> = {
  // ── klatka ──
  bench_incline: { stance: "incline", label: "wyciskanie na skosie dodatnim" },
  db_incline:    { stance: "incline", equipment: "dumbbells", label: "wyciskanie hantli na skosie" },
  db_bench:      { equipment: "dumbbells", label: "wyciskanie hantli znad klatki" },
  bench_decline: { label: "wyciskanie na skosie ujemnym" },
  machine_press: { stance: "seated", equipment: "machine", label: "wypchnięcie uchwytów maszyny" },
  cable_fly:     { stance: "stand", equipment: "cable",
                   start: { upperArm: [-72 * D, 0, 74 * D], foreArm: [-24 * D, 0, 0] },
                   end:   { upperArm: [-80 * D, 0, 12 * D], foreArm: [-24 * D, 0, 0] },
                   label: "krzyżowanie linek przed klatką" },
  pushup: { stance: "prone", equipment: "bodyweight",
            start: { upperArm: [-70 * D, 0, 48 * D], foreArm: [-92 * D, 0, 0] },
            end:   { upperArm: [-84 * D, 0, 24 * D], foreArm: [-8 * D, 0, 0] },
            label: "wypchnięcie ciała od podłoża" },
  diamond_pushup: { stance: "prone", equipment: "bodyweight",
            start: { upperArm: [-74 * D, 0, 16 * D], foreArm: [-96 * D, 0, 0] },
            end:   { upperArm: [-86 * D, 0, 8 * D], foreArm: [-8 * D, 0, 0] },
            label: "wypchnięcie na wąskim podparciu" },
  dips: { stance: "hang", equipment: "bodyweight",
          start: { upperArm: [-6 * D, 0, 16 * D], foreArm: [-96 * D, 0, 0], torso: [16 * D, 0, 0] },
          end:   { upperArm: [-4 * D, 0, 8 * D], foreArm: [-6 * D, 0, 0], torso: [10 * D, 0, 0] },
          label: "wypchnięcie ciała na poręczach" },
  close_grip_bench: { equipment: "barbell",
          start: { upperArm: [-10 * D, 0, 32 * D], foreArm: [-84 * D, 0, 0] },
          end:   { upperArm: [-80 * D, 0, 6 * D], foreArm: [-2 * D, 0, 0] },
          label: "wyciskanie wąskim chwytem" },
  pullover: { stance: "supine", equipment: "dumbbells",
          start: { upperArm: [-168 * D, 0, 18 * D], foreArm: [-16 * D, 0, 0] },
          end:   { upperArm: [-92 * D, 0, 14 * D], foreArm: [-16 * D, 0, 0] },
          label: "przeniesienie ciężaru zza głowy" },

  // ── plecy ──
  lat_pulldown: { stance: "seated", equipment: "cable", label: "ściągnięcie drążka do klatki" },
  cable_row:    { stance: "seated", equipment: "cable",
                  start: { torso: [14 * D, 0, 0], upperArm: [-46 * D, 0, 10 * D], foreArm: [-10 * D, 0, 0] },
                  end:   { torso: [-4 * D, 0, 0], upperArm: [6 * D, 0, 10 * D], foreArm: [-82 * D, 0, 0] },
                  label: "przyciągnięcie uchwytu do brzucha" },
  tbar_row:  { stance: "bentOver", equipment: "machine", label: "przyciągnięcie do klatki" },
  db_row:    { stance: "bentOver", equipment: "dumbbells", label: "przyciągnięcie hantla do biodra" },
  deadlift:  { label: "oderwanie sztangi i wyprost bioder" },
  rdl:       { label: "opuszczenie po udach i powrót" },
  sldl:      { label: "opuszczenie na prostych nogach" },
  shrugs:    { stance: "stand", equipment: "barbell",
               start: { upperArm: [0, 0, 4 * D], foreArm: [-4 * D, 0, 0] },
               end:   { upperArm: [0, 0, 4 * D], foreArm: [-4 * D, 0, 0], torso: [-3 * D, 0, 0] },
               label: "unoszenie barków do uszu", dur: 1.9 },
  face_pull: { stance: "stand", equipment: "cable",
               start: { upperArm: [-78 * D, 0, 20 * D], foreArm: [-16 * D, 0, 0] },
               end:   { upperArm: [-30 * D, 0, 84 * D], foreArm: [-104 * D, 0, 0] },
               label: "przyciągnięcie liny do twarzy" },
  chinup:        { label: "podciągnięcie podchwytem" },
  pullup_neutral:{ label: "podciągnięcie chwytem neutralnym" },

  // ── barki / ramiona ──
  db_ohp:      { stance: "seated", equipment: "dumbbells", label: "wyciskanie hantli nad głowę" },
  arnold:      { stance: "seated", equipment: "dumbbells", label: "wyciskanie z rotacją" },
  front_raise: { stance: "stand", equipment: "dumbbells",
                 start: { upperArm: [-6 * D, 0, 8 * D], foreArm: [-8 * D, 0, 0] },
                 end:   { upperArm: [-92 * D, 0, 8 * D], foreArm: [-8 * D, 0, 0] },
                 label: "wznos ramion w przód" },
  rear_fly:    { stance: "bentOver", equipment: "dumbbells",
                 start: { upperArm: [-64 * D, 0, 10 * D], foreArm: [-22 * D, 0, 0] },
                 end:   { upperArm: [-64 * D, 0, 82 * D], foreArm: [-22 * D, 0, 0] },
                 label: "rozwiedzenie ramion w opadzie" },
  upright_row: { stance: "stand", equipment: "barbell",
                 start: { upperArm: [-4 * D, 0, 6 * D], foreArm: [-8 * D, 0, 0] },
                 end:   { upperArm: [-14 * D, 0, 76 * D], foreArm: [-96 * D, 0, 0] },
                 label: "podciągnięcie wzdłuż tułowia" },
  db_curl:       { equipment: "dumbbells", label: "uginanie hantli" },
  hammer_curl:   { equipment: "dumbbells", label: "uginanie młotkowe" },
  cable_curl:    { equipment: "cable", label: "uginanie na wyciągu" },
  preacher_curl: { stance: "seated", equipment: "barbell",
                   start: { upperArm: [-48 * D, 0, 10 * D], foreArm: [-10 * D, 0, 0] },
                   end:   { upperArm: [-48 * D, 0, 10 * D], foreArm: [-118 * D, 0, 0] },
                   label: "uginanie na modlitewniku" },
  incline_curl:  { stance: "incline", equipment: "dumbbells",
                   start: { upperArm: [24 * D, 0, 10 * D], foreArm: [-6 * D, 0, 0] },
                   end:   { upperArm: [16 * D, 0, 10 * D], foreArm: [-124 * D, 0, 0] },
                   label: "uginanie z ramionami cofniętymi" },
  skullcrusher:  { stance: "supine", equipment: "barbell",
                   start: { upperArm: [-104 * D, 0, 14 * D], foreArm: [-118 * D, 0, 0] },
                   end:   { upperArm: [-92 * D, 0, 12 * D], foreArm: [-6 * D, 0, 0] },
                   label: "wyprost łokci znad głowy" },
  overhead_ext:  { stance: "stand", equipment: "cable",
                   start: { upperArm: [-160 * D, 0, 16 * D], foreArm: [-124 * D, 0, 0] },
                   end:   { upperArm: [-162 * D, 0, 14 * D], foreArm: [-8 * D, 0, 0] },
                   label: "wyprost łokci zza głowy" },
  pushdown:      { equipment: "cable", label: "wyprost ramion w dół" },

  // ── nogi ──
  front_squat:  { label: "przysiad przedni" },
  goblet_squat: { equipment: "dumbbells", label: "przysiad goblet" },
  hack_squat:   { equipment: "machine", label: "przysiad w maszynie" },
  leg_press:    { stance: "legPress", equipment: "machine",
                  start: { thigh: [-104 * D, 0, 0], shin: [94 * D, 0, 0] },
                  end:   { thigh: [-24 * D, 0, 0], shin: [16 * D, 0, 0] },
                  label: "wypchnięcie platformy nogami" },
  lunges:       { stance: "stand", equipment: "dumbbells",
                  start: { torso: [8 * D, 0, 0], thigh: [-14 * D, 0, 0], shin: [10 * D, 0, 0] },
                  end:   { torso: [14 * D, 0, 0], thigh: [-84 * D, 0, 0], shin: [76 * D, 0, 0] },
                  label: "wykrok i powrót" },
  bulgarian:    { stance: "stand", equipment: "dumbbells",
                  start: { torso: [10 * D, 0, 0], thigh: [-16 * D, 0, 0], shin: [12 * D, 0, 0] },
                  end:   { torso: [18 * D, 0, 0], thigh: [-92 * D, 0, 0], shin: [84 * D, 0, 0] },
                  label: "zejście na nodze zakrocznej" },
  hip_thrust:   { stance: "hipThrust", equipment: "barbell",
                  start: { torso: [66 * D, 0, 0], thigh: [-104 * D, 0, 0], shin: [96 * D, 0, 0] },
                  end:   { torso: [14 * D, 0, 0], thigh: [-56 * D, 0, 0], shin: [88 * D, 0, 0] },
                  label: "wypchnięcie bioder w górę" },
  calf_seated:  { stance: "seated", equipment: "machine", label: "wspięcia w siadzie" },
  calf_standing:{ stance: "stand", equipment: "machine", label: "wspięcia stojąc" },
  leg_curl:     { stance: "prone", equipment: "machine", label: "uginanie nóg leżąc" },
  leg_extension:{ stance: "seated", equipment: "machine", label: "prostowanie nóg w siadzie" },
  good_morning:  { stance: "stand", equipment: "barbell", label: "skłon z zawiasem w biodrach" },
  sumo_deadlift: { stance: "stand", equipment: "barbell",
                   // sumo: tułów bardziej pionowy, biodra niżej, kolana mocniej zgięte
                   start: { torso: [8 * D, 0, 0], thigh: [-6 * D, 0, 0], shin: [4 * D, 0, 0], upperArm: [2 * D, 0, 14 * D] },
                   end:   { torso: [42 * D, 0, 0], thigh: [-78 * D, 0, 0], shin: [62 * D, 0, 0], upperArm: [-10 * D, 0, 18 * D] },
                   label: "oderwanie sztangi w postawie sumo" },
  smith_squat:   { stance: "stand", equipment: "machine", label: "przysiad w prowadnicy" },
  step_up:       { stance: "stand", equipment: "dumbbells",
                   start: { torso: [10 * D, 0, 0], thigh: [-16 * D, 0, 0], shin: [12 * D, 0, 0] },
                   end:   { torso: [16 * D, 0, 0], thigh: [-88 * D, 0, 0], shin: [80 * D, 0, 0] },
                   label: "wejście na skrzynię" },
  seated_leg_curl: { stance: "seated", equipment: "machine",
                   start: { shin: [86 * D, 0, 0] },
                   end:   { shin: [150 * D, 0, 0] },
                   label: "zgięcie kolan w siadzie" },
  hip_abduction: { stance: "seated", equipment: "machine",
                   start: { thigh: [-88 * D, 0, 2 * D], shin: [86 * D, 0, 0] },
                   end:   { thigh: [-88 * D, 0, 34 * D], shin: [86 * D, 0, 0] },
                   label: "odwiedzenie ud na boki" },
  hip_adduction: { stance: "seated", equipment: "machine",
                   start: { thigh: [-88 * D, 0, 34 * D], shin: [86 * D, 0, 0] },
                   end:   { thigh: [-88 * D, 0, 2 * D], shin: [86 * D, 0, 0] },
                   label: "ściągnięcie ud do siebie" },
  glute_kickback:{ stance: "bentOver", equipment: "cable",
                   start: { thigh: [-30 * D, 0, 0], shin: [40 * D, 0, 0] },
                   end:   { thigh: [26 * D, 0, 0], shin: [16 * D, 0, 0] },
                   label: "wyprost nogi w tył" },
  nordic_curl:  { stance: "prone", equipment: "bodyweight",
                  start: { thigh: [-4 * D, 0, 0], shin: [92 * D, 0, 0], torso: [0, 0, 0] },
                  end:   { thigh: [-4 * D, 0, 0], shin: [92 * D, 0, 0], torso: [-46 * D, 0, 0] },
                  label: "opuszczanie ekscentryczne" },

  // ── core ──
  plank:         { stance: "prone", equipment: "bodyweight", label: "utrzymanie deski" },
  crunch:        { stance: "supine", equipment: "bodyweight", label: "spięcie brzucha" },
  leg_raise:     { stance: "hang", equipment: "bodyweight",
                   start: { upperArm: [0, 0, 168 * D], foreArm: [-6 * D, 0, 0], thigh: [-6 * D, 0, 0], shin: [8 * D, 0, 0] },
                   end:   { upperArm: [0, 0, 168 * D], foreArm: [-6 * D, 0, 0], thigh: [-96 * D, 0, 0], shin: [12 * D, 0, 0] },
                   label: "unoszenie nóg w zwisie" },
  russian_twist: { stance: "seated", equipment: "bodyweight",
                   start: { torso: [22 * D, -34 * D, 0], upperArm: [-72 * D, 0, 14 * D], foreArm: [-52 * D, 0, 0] },
                   end:   { torso: [22 * D, 34 * D, 0], upperArm: [-72 * D, 0, 14 * D], foreArm: [-52 * D, 0, 0] },
                   label: "skręt tułowia" },
  ab_wheel:      { stance: "prone", equipment: "bodyweight",
                   start: { upperArm: [-88 * D, 0, 12 * D], foreArm: [-10 * D, 0, 0], torso: [10 * D, 0, 0] },
                   end:   { upperArm: [-166 * D, 0, 12 * D], foreArm: [-8 * D, 0, 0], torso: [-6 * D, 0, 0] },
                   label: "wyjazd kółkiem w przód" },
};

/** Pełna definicja ruchu dla ćwiczenia: archetyp + ewentualne nadpisanie. */
export function poseFor(ex: ExerciseAnatomy, archetype: Archetype): PosePair {
  const base = POSES[archetype];
  const over = EXERCISE_POSES[ex.id];
  if (!over) return base;
  return {
    stance: over.stance ?? base.stance,
    equipment: over.equipment ?? base.equipment,
    start: over.start ?? base.start,
    end: over.end ?? base.end,
    label: over.label ?? base.label,
    dur: over.dur ?? base.dur,
  };
}

/** Łączy kąty postawy z kątami ruchu (ruch nadpisuje postawę). */
export function mergePose(stanceBase: Pose, motion: Pose): Pose {
  return { ...stanceBase, ...motion };
}

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
