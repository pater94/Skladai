/**
 * FORMA — Maski mięśni nałożone na realistyczną planszę anatomiczną.
 *
 * Podkładem są ilustracje écorché (public/anatomy/body-front.webp, body-back.webp),
 * pochodne planszy Bouglé'a z Wikimedia Commons (autor cyfrowej wersji: Jmarchn,
 * licencja CC BY-SA 3.0). Obie plansze zostały przez nas zsymetryzowane (odbicie
 * warstwy powierzchownej), wykadrowane i skompresowane — modyfikacje udostępniamy
 * na tej samej licencji, patrz ANATOMY_ATTRIBUTION.
 *
 * Poniższe kształty to WYŁĄCZNIE maski do kolorowania — leżą w układzie
 * współrzędnych obrazu i pokrywają odpowiednie mięśnie widoczne na ilustracji.
 * Definiujemy tylko LEWĄ połowę; prawa powstaje przez odbicie względem osi ciała.
 */

import type { MuscleId } from "@/lib/anatomy/muscles";

export interface PlateRegion {
  muscle: MuscleId;
  head?: string;
  d: string;
  /** Partie nieparzyste (brzuch, kręgosłup) — bez odbicia. */
  center?: boolean;
}

export interface Plate {
  src: string;
  width: number;
  height: number;
  /** Oś symetrii ciała w px obrazu. */
  axis: number;
  regions: PlateRegion[];
}

const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

// ───────────────────────────── PRZÓD ─────────────────────────────
export const FRONT_PLATE: Plate = {
  src: "/anatomy/body-front.webp",
  width: 620,
  height: 1590,
  axis: 310,
  regions: [
    { muscle: "traps", head: "upper", d: "M 268 18 L 138 100 L 202 130 L 278 62 Z" },
    { muscle: "delts", head: "front", d: ell(108, 138, 47, 60) },
    { muscle: "delts", head: "side", d: ell(78, 190, 32, 46) },
    // klatka — wachlarz zbiegający od barku do mostka (szeroka bocznie, wąska przy osi)
    { muscle: "chest", head: "clavicular", d: "M 168 104 C 216 88 268 86 304 92 L 304 148 C 258 142 210 148 172 162 C 166 142 164 120 168 104 Z" },
    { muscle: "chest", head: "sternal", d: "M 172 166 C 214 152 262 150 304 154 L 304 230 C 254 230 206 238 170 252 C 164 224 166 192 172 166 Z" },
    { muscle: "chest", head: "abdominal", d: "M 172 256 C 210 242 256 236 304 234 L 304 314 C 262 326 216 330 190 316 C 178 302 172 278 172 256 Z" },
    { muscle: "serratus", head: "main", d: ell(178, 306, 21, 44) },
    { muscle: "biceps", head: "long", d: ell(88, 300, 24, 84) },
    { muscle: "biceps", head: "short", d: ell(122, 306, 22, 78) },
    { muscle: "brachialis", head: "main", d: ell(92, 392, 24, 32) },
    { muscle: "forearms", head: "flexors", d: ell(68, 502, 40, 104) },
    { muscle: "abs", head: "upper", center: true, d: "M 248 330 h 124 v 148 h -124 z" },
    { muscle: "abs", head: "lower", center: true, d: "M 252 482 h 116 v 136 h -116 z" },
    { muscle: "obliques", head: "external", d: "M 196 350 Q 240 342 246 366 L 244 578 Q 200 594 186 554 Q 182 440 196 350 Z" },
    { muscle: "core_deep", head: "main", center: true, d: "M 236 596 h 148 v 40 h -148 z" },
    { muscle: "hip_flexors", head: "psoas", d: ell(266, 648, 28, 40) },
    { muscle: "quads", head: "vastus_lateralis", d: ell(180, 862, 38, 148) },
    { muscle: "quads", head: "rectus_femoris", d: ell(238, 852, 35, 152) },
    { muscle: "quads", head: "vastus_medialis", d: ell(272, 988, 29, 60) },
    { muscle: "adductors", head: "magnus", d: ell(288, 828, 25, 106) },
    { muscle: "tibialis", head: "main", d: ell(212, 1248, 27, 128) },
    { muscle: "calves", head: "gastro_lateral", d: ell(166, 1206, 23, 92) },
  ],
};

// ───────────────────────────── TYŁ ─────────────────────────────
export const BACK_PLATE: Plate = {
  src: "/anatomy/body-back.webp",
  width: 620,
  height: 1635,
  axis: 310,
  regions: [
    { muscle: "traps", head: "upper", d: "M 268 14 L 138 104 L 204 134 L 280 60 Z" },
    // czworoboczny środkowy: pas od kręgosłupa do łopatki (węższy, żeby nie zlewał się w belkę)
    { muscle: "traps", head: "middle", d: "M 214 196 C 254 188 282 186 302 188 L 302 292 C 268 292 236 288 210 280 C 206 250 208 220 214 196 Z" },
    // czworoboczny dolny: klin zbiegający do kręgosłupa
    { muscle: "traps", head: "lower", d: "M 252 318 L 304 314 L 304 466 C 288 448 268 412 256 372 C 252 352 250 332 252 318 Z" },
    { muscle: "delts", head: "rear", d: ell(110, 143, 47, 60) },
    { muscle: "rotator_cuff", head: "infraspinatus", d: ell(198, 154, 39, 33) },
    { muscle: "teres_major", head: "main", d: ell(180, 214, 30, 19) },
    { muscle: "rhomboids", head: "major_minor", d: "M 250 192 L 300 186 L 300 292 L 246 280 Z" },
    // najszerszy grzbietu — kształt SKRZYDŁA: szeroko pod pachą, zwężony do krzyża
    { muscle: "lats", head: "upper", d: "M 182 236 C 150 256 130 296 132 344 C 168 356 236 362 296 362 L 300 296 C 264 264 224 244 182 236 Z" },
    { muscle: "lats", head: "lower", d: "M 132 350 C 138 418 152 466 180 508 C 214 546 254 564 292 568 L 296 368 C 234 368 168 362 132 350 Z" },
    { muscle: "triceps", head: "long", d: ell(112, 298, 29, 86) },
    { muscle: "triceps", head: "lateral", d: ell(76, 290, 25, 76) },
    { muscle: "triceps", head: "medial", d: ell(96, 390, 23, 31) },
    { muscle: "forearms", head: "extensors", d: ell(66, 504, 40, 104) },
    { muscle: "erectors", head: "longissimus", d: "M 268 386 h 40 v 236 h -40 z" },
    { muscle: "erectors", head: "iliocostalis", d: "M 232 400 h 33 v 202 h -33 z" },
    { muscle: "glutes", head: "maximus", d: ell(228, 704, 77, 87) },
    { muscle: "glutes", head: "medius", d: ell(160, 628, 37, 41) },
    { muscle: "hamstrings", head: "bf_long", d: ell(196, 914, 41, 123) },
    { muscle: "hamstrings", head: "semitendinosus", d: ell(262, 914, 37, 123) },
    { muscle: "calves", head: "gastro_lateral", d: ell(196, 1194, 31, 108) },
    { muscle: "calves", head: "gastro_medial", d: ell(258, 1198, 31, 113) },
    { muscle: "calves", head: "soleus", d: ell(228, 1352, 33, 68) },
  ],
};

/**
 * Zasłona okolicy krocza — plansza anatomiczna pokazuje genitalia, co jest
 * zbędne w aplikacji fitness i bywa problemem przy recenzji w App Store.
 * Rysowana wyłącznie na widoku przednim, w neutralnej barwie.
 */
export const FRONT_MODESTY = "M 224 632 Q 310 620 396 632 L 388 706 Q 352 764 310 758 Q 268 764 232 706 Z";
/** Odcień zasłony — zbliżony do odbarwionej planszy, żeby nie tworzyć czarnej plamy. */
export const MODESTY_FILL = "#9a9791";

/** Wymagana informacja licencyjna (CC BY-SA 3.0). */
export const ANATOMY_ATTRIBUTION = {
  title: "Human muscular system (anterior / posterior)",
  author: "Jmarchn",
  source: "https://commons.wikimedia.org/wiki/File:Bougle,_Human_muscular_system,_anterior-ca.svg",
  license: "CC BY-SA 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  note: "Plansze zsymetryzowane, wykadrowane i skompresowane na potrzeby aplikacji; modyfikacje na tej samej licencji.",
};
