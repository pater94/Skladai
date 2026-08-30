/**
 * FORMA — rytm treningowy i objętość liczona w SERIACH.
 *
 * CZYSTE FUNKCJE, zero zapytań do bazy.
 *
 * ── Po co to istnieje ────────────────────────────────────────────────────
 * „Ile trenuję" mierzy się tygodniami tylko dlatego, że tydzień ma siedem
 * dni — nie dlatego, że ciało tak działa. Kto ma trzy treningi w rotacji i
 * dużo pracy, ten mieści cykl raz w siedem dni, raz w jedenaście, a licznik
 * „w tym tygodniu" pokazuje raz 3, raz 1 i nie mówi nic o rzeczywistym
 * tempie. Dlatego liczymy w OKNIE KROCZĄCYM (domyślnie 10 dni) i podajemy
 * tempo znormalizowane na 7 dni — liczbę, którą da się porównać z celem.
 *
 * ── Dlaczego serie, a nie kilogramy ──────────────────────────────────────
 * Objętość w przerzuconych kilogramach premiuje ćwiczenia na duże ciężary i
 * nie mówi nic o tym, ile dostała konkretna partia. Literatura treningowa
 * operuje LICZBĄ SERII na grupę mięśniową na tydzień i to jest jednostka,
 * którą da się zaplanować. Seria liczy się w całości do mięśni pracujących
 * jako główne, i w połowie do wspomagających — bo wyciskanie to nie jest
 * pełnoprawna seria na triceps, ale nie jest też zerem.
 */

import type { MuscleId } from "@/lib/anatomy/muscles";
import { EXERCISE_ANATOMY } from "@/lib/anatomy/exercises";
import { matchExercise } from "@/lib/anatomy/matcher";

// ── Partie zbiorcze ──────────────────────────────────────────────────────

/**
 * Siedem partii, którymi realnie myśli się o planie.
 *
 * Model anatomiczny rozbija plecy na cztery osobne mięśnie, co jest
 * poprawne, ale bezużyteczne przy pytaniu „czy robię dość na plecy".
 */
export type BodyPart = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "legs" | "core";

export const PART_NAME: Record<BodyPart, string> = {
  chest: "Klatka",
  back: "Plecy",
  shoulders: "Barki",
  biceps: "Biceps",
  triceps: "Triceps",
  legs: "Nogi",
  core: "Brzuch",
};

export const PART_COLOR: Record<BodyPart, string> = {
  chest: "#f97316",
  back: "#38bdf8",
  shoulders: "#a78bfa",
  biceps: "#4ade80",
  triceps: "#fbbf24",
  legs: "#f472b6",
  core: "#94a3b8",
};

export const PART_ORDER: BodyPart[] = ["chest", "back", "shoulders", "biceps", "triceps", "legs", "core"];

const MUSCLE_TO_PART: Partial<Record<MuscleId, BodyPart>> = {
  chest: "chest", serratus: "chest",
  lats: "back", traps: "back", rhomboids: "back", teres_major: "back", erectors: "back",
  delts: "shoulders", rotator_cuff: "shoulders",
  biceps: "biceps", brachialis: "biceps", forearms: "biceps",
  triceps: "triceps",
  quads: "legs", hamstrings: "legs", glutes: "legs", calves: "legs",
  adductors: "legs", hip_flexors: "legs", tibialis: "legs",
  abs: "core", obliques: "core", core_deep: "core",
};

export const partOf = (m: MuscleId): BodyPart | null => MUSCLE_TO_PART[m] ?? null;

/**
 * Zalecana liczba serii tygodniowo na partię.
 *
 * Widełki, nie jedna liczba — bo optymalna objętość zależy od stażu,
 * regeneracji i tego, ile ktoś ma czasu. Dolna granica to próg, poniżej
 * którego trudno o postęp; górna to miejsce, w którym u większości ludzi
 * kończą się zyski, a zaczynają problemy z regeneracją.
 */
export const WEEKLY_TARGET: Record<BodyPart, { min: number; max: number }> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 22 },
  shoulders: { min: 8, max: 20 },
  biceps: { min: 6, max: 18 },
  triceps: { min: 6, max: 18 },
  legs: { min: 10, max: 22 },
  core: { min: 4, max: 16 },
};

// ── Wejście ──────────────────────────────────────────────────────────────

export interface RhythmSession {
  /** YYYY-MM-DD */
  day: string;
  workoutName: string | null;
  /** Nazwy ćwiczeń wraz z liczbą serii w tej sesji. */
  entries: Array<{ exerciseName: string; sets: number }>;
}

export interface RhythmInput {
  sessions: RhythmSession[];
  /** Długość okna kroczącego w dniach. */
  windowDays?: number;
  /** Cel: ile treningów na 7 dni. */
  targetPerWeek?: number;
  /** Dzień „dziś" — wstrzykiwany w testach. */
  today?: Date;
}

export const DEFAULT_WINDOW = 10;
export const DEFAULT_TARGET = 2.5;

// ── Przypisanie serii do partii ──────────────────────────────────────────

const ANATOMY_BY_ID = new Map(EXERCISE_ANATOMY.map((e) => [e.id, e]));

/**
 * Rozdziela serie ćwiczenia na partie.
 *
 * Główny mięsień dostaje pełną serię, wspomagający połowę. Stabilizatory i
 * wsparcie nie dostają nic — praca izometryczna core'u przy przysiadzie to
 * nie jest seria na brzuch i doliczanie jej zawyżałoby wszystko.
 */
export function setsByPart(exerciseName: string, sets: number): Partial<Record<BodyPart, number>> {
  const m = matchExercise(exerciseName);
  /*
     Tylko PEWNE dopasowanie. Dopasowywacz zawsze zwraca najlepszego
     kandydata, nawet gdy trafienie jest słabe — a wtedy potrafi wskazać
     zupełnie inną partię. Na realnych nazwach z bazy „Triceps uginanie ręki
     hantlem za głowę" lądowało jako „Uginanie hantlami", czyli objętość
     tricepsa doliczyłaby się do bicepsa. Lepiej nie policzyć niż policzyć
     źle — nierozpoznane ćwiczenia wracają osobną listą, żeby dało się je
     dopasować ręcznie.
  */
  const anatomy = m.confident && m.best ? ANATOMY_BY_ID.get(m.best.id) : null;
  const out: Partial<Record<BodyPart, number>> = {};
  if (!anatomy) return out;

  const seen = new Map<BodyPart, number>();
  for (const a of anatomy.activation) {
    const weight = a.role === "primary" ? 1 : a.role === "secondary" ? 0.5 : 0;
    if (weight === 0) continue;
    const part = partOf(a.muscle);
    if (!part) continue;
    // Gdy dwa mięśnie tej samej partii są główne (np. lats i traps przy
    // wiosłowaniu), partia i tak dostaje jedną serię, nie dwie.
    seen.set(part, Math.max(seen.get(part) ?? 0, weight));
  }
  for (const [part, w] of seen) out[part] = sets * w;
  return out;
}

// ── Wynik ────────────────────────────────────────────────────────────────

export interface DayCell {
  day: string;
  /** Ile sesji tego dnia (zwykle 0 lub 1). */
  sessions: number;
  workoutNames: string[];
  totalSets: number;
  /** Partie, które dostały tego dnia co najmniej jedną serię. */
  parts: BodyPart[];
  /** Czy dzień mieści się w bieżącym oknie kroczącym. */
  inWindow: boolean;
}

export interface PartVolume {
  part: BodyPart;
  /** Serie w oknie (mogą być połówkowe). */
  setsInWindow: number;
  /** To samo przeliczone na 7 dni — porównywalne z widełkami. */
  perWeek: number;
  status: "low" | "ok" | "high";
}

export interface RhythmResult {
  windowDays: number;
  /** Treningi w oknie. */
  sessionsInWindow: number;
  /** Tempo: treningi na 7 dni. */
  perWeek: number;
  targetPerWeek: number;
  /** Ile dni minęło od ostatniego treningu. Null, gdy nigdy nie było. */
  daysSinceLast: number | null;
  /** Średni odstęp między treningami w oknie (dni). Null przy < 2 sesjach. */
  avgGap: number | null;
  /** Ile dni zajmuje pełne przejście rotacji. Null, gdy nie wykryto cyklu. */
  cycleDays: number | null;
  /** Nazwa treningu, który wypada następny wg rotacji. */
  nextWorkout: string | null;
  parts: PartVolume[];
  days: DayCell[];
  /** Ćwiczenia, których nie udało się pewnie rozpoznać — NIE weszły do objętości. */
  unmatched: string[];
}

const DAY_MS = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Pełen obraz rytmu: tempo, objętość na partie, kalendarz i przewidywany
 * następny trening.
 *
 * `calendarDays` steruje długością zwracanej siatki — okno kroczące liczy
 * się osobno i zawsze ma {@link RhythmInput.windowDays} dni.
 */
export function rhythmFrom(input: RhythmInput, calendarDays = 35): RhythmResult {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW;
  const targetPerWeek = input.targetPerWeek ?? DEFAULT_TARGET;
  const today = input.today ?? new Date();
  const todayKey = iso(today);
  const windowStart = iso(new Date(today.getTime() - (windowDays - 1) * DAY_MS));

  // ── kalendarz ──
  const byDay = new Map<string, RhythmSession[]>();
  for (const s of input.sessions) {
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day)!.push(s);
  }

  const unmatched = new Set<string>();
  const days: DayCell[] = [];
  for (let i = calendarDays - 1; i >= 0; i--) {
    const key = iso(new Date(today.getTime() - i * DAY_MS));
    const here = byDay.get(key) ?? [];
    const parts = new Set<BodyPart>();
    let totalSets = 0;
    for (const s of here) {
      for (const e of s.entries) {
        totalSets += e.sets;
        for (const p of Object.keys(setsByPart(e.exerciseName, e.sets)) as BodyPart[]) parts.add(p);
      }
    }
    days.push({
      day: key,
      sessions: here.length,
      workoutNames: here.map((s) => s.workoutName ?? "Trening"),
      totalSets,
      parts: PART_ORDER.filter((p) => parts.has(p)),
      inWindow: key >= windowStart && key <= todayKey,
    });
  }

  // ── objętość na partie w oknie ──
  const acc = new Map<BodyPart, number>();
  let sessionsInWindow = 0;
  for (const s of input.sessions) {
    if (s.day < windowStart || s.day > todayKey) continue;
    sessionsInWindow++;
    for (const e of s.entries) {
      const split = setsByPart(e.exerciseName, e.sets);
      if (Object.keys(split).length === 0) unmatched.add(e.exerciseName);
      for (const [part, v] of Object.entries(split) as Array<[BodyPart, number]>) {
        acc.set(part, (acc.get(part) ?? 0) + v);
      }
    }
  }

  const scale = 7 / windowDays;
  const parts: PartVolume[] = PART_ORDER.map((part) => {
    const setsInWindow = round1(acc.get(part) ?? 0);
    const perWeek = round1(setsInWindow * scale);
    const t = WEEKLY_TARGET[part];
    return {
      part, setsInWindow, perWeek,
      status: perWeek < t.min ? "low" : perWeek > t.max ? "high" : "ok",
    };
  });

  // ── tempo i rotacja ──
  const sorted = [...input.sessions].filter((s) => s.day <= todayKey).sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted[sorted.length - 1] ?? null;
  const daysSinceLast = last
    ? Math.round((Date.parse(todayKey) - Date.parse(last.day)) / DAY_MS)
    : null;

  const recent = sorted.filter((s) => s.day >= iso(new Date(today.getTime() - 40 * DAY_MS)));
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const g = Math.round((Date.parse(recent[i].day) - Date.parse(recent[i - 1].day)) / DAY_MS);
    if (g > 0) gaps.push(g);
  }
  const avgGap = gaps.length ? round1(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  const { cycleDays, nextWorkout } = detectCycle(recent);

  return {
    windowDays,
    sessionsInWindow,
    perWeek: round1(sessionsInWindow * scale),
    targetPerWeek,
    daysSinceLast,
    avgGap,
    cycleDays,
    nextWorkout,
    parts,
    days,
    unmatched: [...unmatched],
  };
}

/**
 * Wykrywa rotację treningów i przewiduje, co wypada następne.
 *
 * Nie zgaduje z nazw ani nie wymaga konfiguracji — patrzy na to, co się
 * realnie powtarza. Rotację uznajemy za wykrytą, gdy w ostatnich sesjach
 * widać co najmniej dwa różne treningi i każdy pojawił się przynajmniej raz
 * w ostatnim pełnym obrocie.
 */
function detectCycle(sorted: RhythmSession[]): { cycleDays: number | null; nextWorkout: string | null } {
  const named = sorted.filter((s) => s.workoutName);
  if (named.length < 3) return { cycleDays: null, nextWorkout: null };

  const uniq: string[] = [];
  for (const s of named) if (!uniq.includes(s.workoutName!)) uniq.push(s.workoutName!);
  if (uniq.length < 2) return { cycleDays: null, nextWorkout: null };

  /* Długość cyklu = czas potrzebny na tyle treningów, ile jest w rotacji.
     Liczony ze średniej z ostatnich pełnych obrotów, żeby jeden zawalony
     tydzień nie przestawiał całej prognozy. */
  const n = uniq.length;
  const spans: number[] = [];
  for (let i = n; i < named.length; i++) {
    const span = Math.round((Date.parse(named[i].day) - Date.parse(named[i - n].day)) / DAY_MS);
    if (span > 0) spans.push(span);
  }
  const cycleDays = spans.length ? round1(spans.reduce((a, b) => a + b, 0) / spans.length) : null;

  // Następny = ten z rotacji, który najdawniej nie był robiony.
  const lastSeen = new Map<string, string>();
  for (const s of named) lastSeen.set(s.workoutName!, s.day);
  const nextWorkout = [...lastSeen.entries()].sort((a, b) => a[1].localeCompare(b[1]))[0]?.[0] ?? null;

  return { cycleDays, nextWorkout };
}

/** Liczba po polsku — z przecinkiem, nie kropką. */
const pl = (v: number) => v.toLocaleString("pl-PL", { maximumFractionDigits: 1 });

/** Krótki werdykt tekstowy — to, co użytkownik czyta najpierw. */
export function rhythmVerdict(r: RhythmResult): { text: string; tone: "good" | "warn" | "bad" } {
  if (r.sessionsInWindow === 0) {
    return { text: `Brak treningów w ostatnich ${r.windowDays} dniach.`, tone: "bad" };
  }
  const diff = r.perWeek - r.targetPerWeek;
  if (Math.abs(diff) < 0.25) return { text: "Trzymasz zaplanowane tempo.", tone: "good" };
  if (diff > 0) return { text: `Jesteś ${pl(round1(diff))} treningu na tydzień powyżej celu.`, tone: "good" };
  return { text: `Brakuje ${pl(round1(-diff))} treningu na tydzień do celu.`, tone: "warn" };
}

/** Kiedy zrobić następny trening, żeby wyrobić się z celem. */
export function nextDueInDays(r: RhythmResult): number | null {
  if (r.daysSinceLast == null) return 0;
  const idealGap = 7 / r.targetPerWeek;      // np. 2,5/tydz. → co 2,8 dnia
  return Math.max(0, Math.round((idealGap - r.daysSinceLast) * 10) / 10);
}
