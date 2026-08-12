/**
 * FORMA — Geometria sylwetki anatomicznej (écorché).
 *
 * Kształty mięśni rysowane krzywymi Béziera, z kierunkiem włókien (do striacji)
 * oraz przypisaniem do SEGMENTU ciała — dzięki temu ramię i noga mogą się
 * obracać w stawie podczas animacji ruchu, a mięśnie jadą razem z nimi.
 *
 * Układ: viewBox 220 × 430, oś symetrii x = 110. Definiujemy TYLKO lewą stronę;
 * prawa powstaje przez odbicie lustrzane całej grupy.
 */

import type { MuscleId } from "@/lib/anatomy/muscles";

/** Segment, do którego przypięty jest mięsień (decyduje o animacji). */
export type Segment = "torso" | "armUpper" | "armFore" | "thigh" | "shin";

export interface Region {
  muscle: MuscleId;
  head?: string;
  d: string;
  segment: Segment;
  /** Kąt włókien w stopniach (0 = poziomo, 90 = pionowo) — do striacji. */
  fiber: number;
  /** Mięśnie parzyste odbijamy; centralne (brzuch) nie. */
  center?: boolean;
}

/** Punkty obrotu stawów (lewa strona). */
export const PIVOT = {
  shoulder: [70, 78] as const,
  elbow: [58, 138] as const,
  hip: [96, 200] as const,
  knee: [90, 296] as const,
};

/** Elipsa jako ścieżka. */
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

/**
 * Podkład NIERUCHOMY — głowa, szyja, tors. Kończyny są osobno (LIMB_UNDERLAY),
 * bo muszą obracać się w stawie RAZEM z leżącymi na nich mięśniami; inaczej
 * „skóra" zostaje w miejscu, a mięśnie odlatują.
 */
export const BODY: string[] = [
  ell(110, 28, 16, 19),
  "M 101 45 h 18 v 15 q -9 6 -18 0 z",
  "M 80 68 C 66 73 60 86 62 102 L 68 132 C 72 150 78 160 84 172 L 82 200 L 138 200 L 136 172 C 142 160 148 150 152 132 L 158 102 C 160 86 154 73 140 68 Z",
];

/** Podkład kończyn — TYLKO lewa strona, prawa przez odbicie. */
export const LIMB_UNDERLAY: Record<Segment, string[]> = {
  torso: [],
  armUpper: ["M 70 70 C 59 78 55 96 57 116 C 58 126 60 133 62 140 L 76 139 C 76 122 78 100 80 82 Z"],
  armFore: [
    "M 57 138 C 49 152 44 174 46 190 L 58 191 C 60 174 62 154 66 140 Z",
    ell(51, 200, 8, 11),
  ],
  thigh: ["M 84 198 C 74 212 72 252 77 282 L 97 293 C 101 263 100 226 98 198 Z"],
  shin: [
    ell(90, 297, 13, 11),
    "M 82 303 C 78 327 80 362 86 383 L 100 383 C 102 357 100 325 98 303 Z",
    "M 82 385 h 20 v 12 h -24 z",
  ],
};

/** Ścięgna — jasne pasma w miejscach przyczepów (realizm + orientacja). */
export const TENDONS: string[] = [
  "M 86 288 h 6 v 12 h -6 z",     // więzadło rzepki (lewe kolano)
  "M 128 288 h 6 v 12 h -6 z",    // prawe
  "M 86 366 h 5 v 18 h -5 z",     // ścięgno Achillesa (lewe)
  "M 129 366 h 5 v 18 h -5 z",    // prawe
  "M 58 132 h 4 v 10 h -4 z",     // dystalne ścięgno bicepsa (lewe)
  "M 158 132 h 4 v 10 h -4 z",    // prawe
];

// ─────────────────────────────── PRZÓD ───────────────────────────────
export const FRONT_REGIONS: Region[] = [
  // czworoboczny — skos szyja→bark
  { muscle: "traps", head: "upper", segment: "torso", fiber: 35,
    d: "M 106 58 C 98 63 84 69 72 77 C 79 82 90 83 99 78 C 103 71 105 64 106 58 Z" },
  // naramienny
  { muscle: "delts", head: "front", segment: "torso", fiber: 80,
    d: "M 80 68 C 68 72 61 84 62 98 C 68 105 78 104 84 95 C 86 84 85 74 80 68 Z" },
  { muscle: "delts", head: "side", segment: "torso", fiber: 85,
    d: "M 62 96 C 56 103 55 116 59 126 C 66 128 73 122 74 112 C 73 103 69 97 62 96 Z" },
  // klatka piersiowa — trzy pasma
  { muscle: "chest", head: "clavicular", segment: "torso", fiber: 12,
    d: "M 86 72 C 95 67 104 67 109 70 L 109 86 C 99 84 90 87 83 92 C 80 84 82 76 86 72 Z" },
  { muscle: "chest", head: "sternal", segment: "torso", fiber: 3,
    d: "M 83 93 C 92 88 102 88 109 90 L 109 108 C 98 108 88 110 80 114 C 78 105 79 98 83 93 Z" },
  { muscle: "chest", head: "abdominal", segment: "torso", fiber: -14,
    d: "M 80 115 C 90 112 100 111 109 112 L 109 126 C 100 131 89 133 84 128 C 81 124 79 119 80 115 Z" },
  // zębaty przedni
  { muscle: "serratus", head: "main", segment: "torso", fiber: 20,
    d: "M 76 114 l 11 -3 l -1 7 l -10 3 z M 77 125 l 11 -3 l -1 7 l -10 3 z M 79 136 l 10 -3 l -1 7 l -9 3 z" },
  // biceps + ramienny (segment: ramię)
  { muscle: "biceps", head: "long", segment: "armUpper", fiber: 86,
    d: "M 62 96 C 57 104 56 118 59 130 C 63 133 67 131 68 124 C 69 112 67 100 62 96 Z" },
  { muscle: "biceps", head: "short", segment: "armUpper", fiber: 86,
    d: "M 70 98 C 66 106 65 120 68 130 C 72 132 75 129 75 122 C 75 111 74 101 70 98 Z" },
  { muscle: "brachialis", head: "main", segment: "armUpper", fiber: 88,
    d: "M 60 130 C 57 134 57 142 60 146 C 64 147 68 144 68 139 C 67 134 64 130 60 130 Z" },
  // przedramię (segment: przedramię)
  { muscle: "forearms", head: "flexors", segment: "armFore", fiber: 78,
    d: "M 54 144 C 47 154 44 172 46 186 C 50 189 55 187 56 179 C 58 165 58 152 54 144 Z" },
  // brzuch — centralnie
  { muscle: "abs", head: "upper", segment: "torso", center: true, fiber: 0,
    d: "M 97 128 h 26 v 34 h -26 z" },
  { muscle: "abs", head: "lower", segment: "torso", center: true, fiber: 0,
    d: "M 98 164 h 24 v 30 h -24 z" },
  { muscle: "obliques", head: "external", segment: "torso", fiber: 62,
    d: "M 88 130 C 94 128 96 133 96 139 L 95 180 C 89 184 84 178 84 169 C 84 152 86 138 88 130 Z" },
  { muscle: "core_deep", head: "main", segment: "torso", center: true, fiber: 0,
    d: "M 92 196 h 36 v 11 h -36 z" },
  // biodra + udo (segment: udo)
  { muscle: "hip_flexors", head: "psoas", segment: "torso", fiber: 75,
    d: "M 98 186 C 103 187 105 193 103 199 C 99 201 95 198 95 192 C 95 189 96 187 98 186 Z" },
  { muscle: "quads", head: "vastus_lateralis", segment: "thigh", fiber: 84,
    d: "M 84 206 C 76 220 74 248 78 274 C 83 278 88 274 88 264 C 89 240 89 216 84 206 Z" },
  { muscle: "quads", head: "rectus_femoris", segment: "thigh", fiber: 90,
    d: "M 96 202 C 90 216 88 246 90 272 C 95 276 99 272 100 262 C 101 236 100 212 96 202 Z" },
  { muscle: "quads", head: "vastus_medialis", segment: "thigh", fiber: 72,
    d: "M 100 264 C 96 270 95 282 98 289 C 103 291 107 287 106 279 C 105 271 103 266 100 264 Z" },
  { muscle: "adductors", head: "magnus", segment: "thigh", fiber: 80,
    d: "M 104 200 C 100 214 100 240 103 258 C 107 260 110 256 110 246 C 110 226 108 208 104 200 Z" },
  // podudzie (segment: podudzie)
  { muscle: "tibialis", head: "main", segment: "shin", fiber: 86,
    d: "M 88 306 C 83 322 82 348 85 366 C 89 368 92 364 92 356 C 93 336 92 316 88 306 Z" },
  { muscle: "calves", head: "gastro_lateral", segment: "shin", fiber: 82,
    d: "M 96 306 C 93 318 92 336 94 350 C 97 352 100 348 100 340 C 100 326 99 312 96 306 Z" },
];

// ─────────────────────────────── TYŁ ───────────────────────────────
export const BACK_REGIONS: Region[] = [
  // czworoboczny — trzy części
  { muscle: "traps", head: "upper", segment: "torso", fiber: 40,
    d: "M 108 58 C 99 63 84 70 71 78 C 79 84 92 85 101 79 C 105 72 107 64 108 58 Z" },
  { muscle: "traps", head: "middle", segment: "torso", fiber: 5,
    d: "M 95 84 L 109 84 L 109 114 L 90 108 C 90 98 92 89 95 84 Z" },
  { muscle: "traps", head: "lower", segment: "torso", fiber: 72,
    d: "M 101 116 L 109 116 L 109 156 L 104 150 C 101 140 100 127 101 116 Z" },
  // naramienny tylny
  { muscle: "delts", head: "rear", segment: "torso", fiber: 80,
    d: "M 80 68 C 68 72 61 85 62 99 C 68 106 78 105 84 96 C 86 84 85 74 80 68 Z" },
  // łopatka: stożek rotatorów + obły większy
  { muscle: "rotator_cuff", head: "infraspinatus", segment: "torso", fiber: 20,
    d: "M 82 84 C 89 83 93 87 92 92 C 88 96 82 95 79 91 C 78 87 79 85 82 84 Z" },
  { muscle: "teres_major", head: "main", segment: "torso", fiber: 25,
    d: "M 79 98 C 86 97 90 100 89 104 C 85 108 79 107 76 103 C 75 100 76 99 79 98 Z" },
  // równoległoboczne (leżą pod czworobocznym — pokazane obok dla czytelności)
  { muscle: "rhomboids", head: "major_minor", segment: "torso", fiber: 30,
    d: "M 90 86 L 99 84 L 99 106 L 87 101 C 87 95 88 90 90 86 Z" },
  // najszerszy grzbietu — skrzydła
  { muscle: "lats", head: "upper", segment: "torso", fiber: 18,
    d: "M 98 96 C 88 98 76 102 70 110 C 66 118 66 126 69 132 L 98 130 Z" },
  { muscle: "lats", head: "lower", segment: "torso", fiber: 62,
    d: "M 98 132 L 69 134 C 71 150 80 164 92 174 C 97 164 99 148 98 132 Z" },
  // triceps (segment: ramię)
  { muscle: "triceps", head: "long", segment: "armUpper", fiber: 86,
    d: "M 70 96 C 66 104 65 118 68 130 C 72 133 76 130 76 123 C 76 111 74 100 70 96 Z" },
  { muscle: "triceps", head: "lateral", segment: "armUpper", fiber: 84,
    d: "M 61 95 C 56 103 55 116 58 127 C 62 130 66 127 66 120 C 66 109 65 99 61 95 Z" },
  { muscle: "triceps", head: "medial", segment: "armUpper", fiber: 88,
    d: "M 62 128 C 59 132 59 140 62 145 C 66 146 70 143 70 138 C 69 133 66 129 62 128 Z" },
  { muscle: "forearms", head: "extensors", segment: "armFore", fiber: 78,
    d: "M 54 144 C 47 154 44 172 46 186 C 50 189 55 187 56 179 C 58 165 58 152 54 144 Z" },
  // prostownik grzbietu — kolumny wzdłuż kręgosłupa
  { muscle: "erectors", head: "longissimus", segment: "torso", fiber: 90,
    d: "M 102 118 h 7 v 62 h -7 z" },
  { muscle: "erectors", head: "iliocostalis", segment: "torso", fiber: 88,
    d: "M 93 128 h 7 v 50 h -7 z" },
  // pośladki
  { muscle: "glutes", head: "maximus", segment: "torso", fiber: 40,
    d: "M 96 186 C 84 188 76 198 77 212 C 79 224 90 230 99 224 C 103 212 102 196 96 186 Z" },
  { muscle: "glutes", head: "medius", segment: "torso", fiber: 60,
    d: "M 82 180 C 74 182 70 190 72 197 C 78 200 84 196 85 189 C 85 184 84 181 82 180 Z" },
  // dwugłowe uda (segment: udo)
  { muscle: "hamstrings", head: "bf_long", segment: "thigh", fiber: 86,
    d: "M 86 226 C 79 240 78 264 82 284 C 87 287 91 283 91 274 C 92 254 91 236 86 226 Z" },
  { muscle: "hamstrings", head: "semitendinosus", segment: "thigh", fiber: 88,
    d: "M 100 226 C 95 240 94 264 97 284 C 102 287 105 283 105 274 C 106 254 104 236 100 226 Z" },
  // łydki (segment: podudzie)
  { muscle: "calves", head: "gastro_lateral", segment: "shin", fiber: 80,
    d: "M 86 304 C 81 316 80 336 83 350 C 87 352 90 348 90 340 C 91 324 90 310 86 304 Z" },
  { muscle: "calves", head: "gastro_medial", segment: "shin", fiber: 80,
    d: "M 98 304 C 94 316 93 338 96 352 C 100 354 103 350 103 341 C 104 324 102 310 98 304 Z" },
  { muscle: "calves", head: "soleus", segment: "shin", fiber: 88,
    d: "M 92 352 C 87 358 86 370 89 378 C 94 380 98 376 98 368 C 97 360 95 354 92 352 Z" },
];
