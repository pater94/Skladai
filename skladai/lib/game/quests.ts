/**
 * FORMA RPG — questy dzienne i tygodniowe. CZYSTE FUNKCJE.
 *
 * ── Po co w ogóle questy, skoro jest już XP ──────────────────────────────
 * Bo samo XP odpowiada na pytanie „ile zrobiłem", a nie „co mam zrobić
 * teraz". Badania nad porzucaniem zgrywalizowanych aplikacji wskazują dwie
 * powtarzające się przyczyny: NIEWIDOCZNY POSTĘP (wysiłek wydaje się bez
 * końca) i WOLNE SPRZĘŻENIE ZWROTNE (nie wiadomo, czy się poprawiam).
 * Quest rozwiązuje oba naraz: jest mały, ma pasek i kończy się dzisiaj.
 *
 * ── Autonomia ────────────────────────────────────────────────────────────
 * Teoria autodeterminacji mówi, że trwała motywacja potrzebuje autonomii,
 * poczucia kompetencji i więzi. Dlatego questy są DOBIERANE, nie narzucone:
 * dostajesz cztery cele dzienne, a do pełnej nagrody wystarczą trzy. Wybór,
 * który odpuścić, należy do Ciebie — i to jest różnica między „mam zadanie"
 * a „mam plan".
 *
 * ── Determinizm ──────────────────────────────────────────────────────────
 * Zestaw wynika z identyfikatora użytkownika i daty, więc jest ten sam po
 * odświeżeniu strony, na telefonie i na serwerze. Bez tego dałoby się
 * losować questy do skutku, aż wypadną najłatwiejsze.
 */

import { XP } from "./rules";

export type QuestMetric =
  | "trainingDays" | "sets" | "volumeKg" | "steps" | "records"
  | "scans" | "bodyPhotos" | "streakDays" | "exercises";

export interface Quest {
  id: string;
  text: string;
  metric: QuestMetric;
  target: number;
  xp: number;
  /** Punkty do ligi tygodniowej i ścieżki sezonu. */
  points: number;
  scope: "daily" | "weekly";
}

/** Postęp gracza w oknie questa. Klucze = {@link QuestMetric}. */
export type QuestProgress = Partial<Record<QuestMetric, number>>;

export interface QuestState extends Quest {
  have: number;
  done: boolean;
}

/** Ile dziennych celów dostajesz i ile trzeba domknąć do premii. */
export const DAILY_OFFERED = 4;
export const DAILY_REQUIRED = 3;
/** Premia za domknięcie wymaganej liczby celów dnia. */
export const DAILY_BONUS_XP = 30;
export const DAILY_BONUS_POINTS = 40;

/**
 * Sufit XP z celów na dzień.
 *
 * Znaleziony pomiarem, nie z głowy: bez niego ktoś, kto codziennie wpisuje
 * zmyślony trening, domykał komplet celów SIEDEM razy w tygodniu i wracał na
 * 1,50× dorobku uczciwie trenującego cztery razy — czyli odzyskiwał dokładnie
 * tę przewagę, którą zamknął limit „5 z 7". Sufit 55 XP zbił to do 1,40×,
 * dopiero 35 XP zeszło poniżej progu 1,35×. Dlatego questy płacą przede
 * wszystkim PUNKTAMI (liga i sezon, oba resetowane), a XP tylko symbolicznie:
 * cel dnia ma kierować uwagę, a nie powiększać przewagę częstotliwości,
 * którą limit „5 z 7" właśnie domknął.
 */
export const DAILY_QUEST_XP_CAP = 35;

// ── Pule ─────────────────────────────────────────────────────────────────
// Wartości XP celowo małe względem XP za sam trening (80). Quest ma
// kierować uwagę, a nie stać się głównym źródłem punktów — inaczej
// opłacałoby się „grać w questy" zamiast trenować.

const DAILY_POOL: Omit<Quest, "scope">[] = [
  { id: "d_train", text: "Zapisz dzisiejszy trening", metric: "trainingDays", target: 1, xp: 20, points: 60 },
  { id: "d_sets12", text: "Zrób 12 serii", metric: "sets", target: 12, xp: 15, points: 45 },
  { id: "d_sets20", text: "Zrób 20 serii", metric: "sets", target: 20, xp: 20, points: 60 },
  { id: "d_vol4t", text: "Podnieś łącznie 4 tony", metric: "volumeKg", target: 4000, xp: 18, points: 50 },
  { id: "d_vol8t", text: "Podnieś łącznie 8 ton", metric: "volumeKg", target: 8000, xp: 24, points: 70 },
  { id: "d_steps8", text: "Przejdź 8 000 kroków", metric: "steps", target: 8000, xp: 15, points: 45 },
  { id: "d_steps12", text: "Przejdź 12 000 kroków", metric: "steps", target: 12000, xp: 20, points: 60 },
  { id: "d_pr", text: "Pobij rekord życiowy", metric: "records", target: 1, xp: 25, points: 80 },
  { id: "d_scan", text: "Zeskanuj jeden produkt lub posiłek", metric: "scans", target: 1, xp: 10, points: 30 },
  { id: "d_ex4", text: "Wykonaj 4 różne ćwiczenia", metric: "exercises", target: 4, xp: 15, points: 45 },
];

const WEEKLY_POOL: Omit<Quest, "scope">[] = [
  { id: "w_days3", text: "Trenuj 3 dni w tym tygodniu", metric: "trainingDays", target: 3, xp: 60, points: 200 },
  { id: "w_days4", text: "Trenuj 4 dni w tym tygodniu", metric: "trainingDays", target: 4, xp: 80, points: 260 },
  { id: "w_vol30", text: "Podnieś 30 ton w tygodniu", metric: "volumeKg", target: 30000, xp: 70, points: 230 },
  { id: "w_steps50", text: "Przejdź 50 000 kroków", metric: "steps", target: 50000, xp: 60, points: 200 },
  { id: "w_pr2", text: "Pobij 2 rekordy życiowe", metric: "records", target: 2, xp: 90, points: 280 },
  { id: "w_photos", text: "Zrób sesję zdjęć sylwetki (3 ujęcia)", metric: "bodyPhotos", target: 3, xp: 70, points: 220 },
  { id: "w_streak5", text: "Utrzymaj passę 5 dni", metric: "streakDays", target: 5, xp: 75, points: 240 },
  { id: "w_ex10", text: "Wykonaj 10 różnych ćwiczeń", metric: "exercises", target: 10, xp: 60, points: 200 },
];

// ── Losowanie deterministyczne ───────────────────────────────────────────

/** FNV-1a — mały, szybki i identyczny wszędzie. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32 — deterministyczny generator z jednego ziarna. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(pool: T[], count: number, seed: number): T[] {
  const r = rng(seed);
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

// ── Wybór zestawu ────────────────────────────────────────────────────────

/**
 * Cele na dany dzień. Ten sam zestaw dla tego samego użytkownika i daty —
 * niezależnie od urządzenia i liczby odświeżeń.
 */
export function dailyQuests(userId: string, dayISO: string): Quest[] {
  return pick(DAILY_POOL, DAILY_OFFERED, hash(`${userId}|${dayISO}`))
    .map((q) => ({ ...q, scope: "daily" as const }));
}

/** Cele tygodnia. Klucz tygodnia ISO, np. „2026-W34". */
export function weeklyQuests(userId: string, weekKey: string): Quest[] {
  return pick(WEEKLY_POOL, 3, hash(`${userId}|${weekKey}`))
    .map((q) => ({ ...q, scope: "weekly" as const }));
}

/** Nakłada realny postęp na listę celów. */
export function withProgress(quests: Quest[], progress: QuestProgress): QuestState[] {
  return quests.map((q) => {
    const have = Math.max(0, Math.round(progress[q.metric] ?? 0));
    return { ...q, have, done: have >= q.target };
  });
}

export interface QuestReward {
  xp: number;
  points: number;
  /** Czy zebrała się premia za wymaganą liczbę celów dnia. */
  dailyBonus: boolean;
}

/**
 * Nagroda za domknięte cele.
 *
 * Sufit dzienny z {@link XP} obowiązuje tak samo jak wszędzie indziej —
 * questy nie są obejściem limitów, tylko innym sposobem ich zdobycia.
 */
export function questReward(daily: QuestState[], weekly: QuestState[]): QuestReward {
  const doneDaily = daily.filter((q) => q.done);
  const doneWeekly = weekly.filter((q) => q.done);
  const bonus = doneDaily.length >= DAILY_REQUIRED;
  const rawXp = doneDaily.reduce((a, q) => a + q.xp, 0)
    + doneWeekly.reduce((a, q) => a + q.xp, 0)
    + (bonus ? DAILY_BONUS_XP : 0);
  return {
    xp: Math.min(DAILY_QUEST_XP_CAP, rawXp),
    points: doneDaily.reduce((a, q) => a + q.points, 0)
      + doneWeekly.reduce((a, q) => a + q.points, 0)
      + (bonus ? DAILY_BONUS_POINTS : 0),
    dailyBonus: bonus,
  };
}

/** Ile XP może maksymalnie dać jeden dzień questów — do testów i opisu w UI. */
export function maxDailyQuestXp(): number {
  const best = [...DAILY_POOL].sort((a, b) => b.xp - a.xp).slice(0, DAILY_OFFERED);
  return Math.min(DAILY_QUEST_XP_CAP, best.reduce((a, q) => a + q.xp, 0) + DAILY_BONUS_XP);
}

/** Strażnik proporcji: questy nie mogą przebić XP za sam fakt treningu. */
export const QUEST_XP_SANITY = { maxSingleDaily: XP.sessionDay } as const;
