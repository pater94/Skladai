/**
 * FORMA RPG — reguły postaci. CZYSTE FUNKCJE, zero zapytań do bazy.
 *
 * Dlaczego osobny, bezstanowy moduł: te reguły decydują o rankingu, więc muszą
 * dać się przetestować co do liczby i muszą być liczone PO STRONIE SERWERA na
 * podstawie tego, co realnie leży w bazie. Klient nie może przysłać „mam 900 XP" —
 * może tylko zapisać serie, a te przechodzą przez filtry poniżej.
 *
 * ── Filozofia punktacji ───────────────────────────────────────────────────
 * Największa część XP idzie za RYTM (był trening danego dnia), nie za wielkość
 * liczb. Powód jest prosty: objętość da się wpisać z palca w 5 sekund, a
 * czterech treningów w tygodniu przez rok — nie da się podrobić wstecz.
 * Dlatego:
 *   • sam fakt treningu    → 80 XP  (najwięcej, stała kwota)
 *   • objętość             → do 60 XP, pierwiastkiem (malejące zwroty)
 *   • rekordy życiowe      → 25 XP, maks. 2 dziennie, cooldown 7 dni na ćwiczenie
 *   • kroki z zegarka      → do 40 XP
 *   • seria dni pod rząd   → do 30 XP
 * Dzienny sufit 300 XP zamyka temat: nawet idealne oszustwo nie da więcej niż
 * bardzo dobry uczciwy dzień.
 *
 * ── Czego NIE da się ugrać liczbami ───────────────────────────────────────
 * Objętość nasyca się już przy zwykłym treningu (20 serii × 80 kg × 6 to 9,6 t,
 * czyli sufit 60 XP). Zawyżenie ciężarów dwu- czy czterokrotnie daje DOKŁADNIE
 * ZERO dodatkowych XP — sprawdza to test/game/rules.ts. Wpisywanie sobie
 * większych sztang jest więc bezcelowe z definicji, a nie z dobrej woli.
 *
 * Prawdziwa dziura była gdzie indziej: ktoś, kto nie trenuje wcale, ale
 * CODZIENNIE wpisuje zmyślony trening, zbierał przez rok dwa razy tyle co
 * uczciwy trenujący cztery razy w tygodniu. Nie ratował tego dzienny sufit,
 * bo oszust brał go 365 razy, a uczciwy 208. Stąd trzy dodatkowe zapory:
 *   • najwyżej 5 z 7 dni płaci za trening (regeneracja jest częścią treningu),
 *   • sufit TYGODNIOWY, nie tylko dzienny,
 *   • rekord życiowy musi być wiarygodny: skok o ponad 20 % nad poprzedni
 *     wynik to literówka albo ściema, więc nie płaci.
 */

// ── Granice zdrowego rozsądku ────────────────────────────────────────────
/**
 * Seria poza tymi widełkami NIE liczy się do XP (w dzienniku zostaje —
 * nie kasujemy nikomu danych, po prostu nie nabijają postaci).
 * Rekord świata w wyciskaniu to ~350 kg, w martwym ~500 kg.
 */
export const LIMITS = {
  maxWeightKg: 500,
  maxReps: 200,
  maxDurationSec: 7200,
  /** Sufit objętości POJEDYNCZEJ serii — 300 kg × 20 powt. to już absurd. */
  maxSetVolumeKg: 2000,
  /** Więcej serii dziennie niż to = ktoś klika, nie trenuje. */
  maxSetsPerDay: 60,
} as const;

/** Dzienny sufit XP — twardy, ponad wszystkimi źródłami razem. */
export const DAILY_XP_CAP = 300;

/**
 * Sufit TYGODNIOWY (tydzień ISO).
 *
 * Sam dzienny limit nie wystarczał: oszust bierze go siedem razy w tygodniu,
 * uczciwy trenujący cztery. Ten sufit ustawiono tuż nad tym, co realnie zbiera
 * bardzo zaangażowany człowiek (5-6 treningów + kroki ≈ 1300 XP), więc
 * uczciwego nie dotyka, a codziennemu zmyślaczowi ścina jedną trzecią wyniku.
 */
export const WEEKLY_XP_CAP = 1400;

/**
 * Ile dni wstecz trening jeszcze daje XP.
 *
 * Dziennik można uzupełniać dowolnie głęboko w przeszłość (i historia, rekordy
 * czy wykresy to uwzględnią), ale POSTAĆ rośnie za to, co robisz teraz.
 * Bez tego jedno popołudnie przepisywania starego zeszytu dawałoby 40 poziomów.
 */
export const XP_BACKDATE_DAYS = 7;

export const XP = {
  /**
   * Dzień, w którym w ogóle był trening (min. 3 zaliczone serie).
   * NAJWIĘKSZA pojedyncza pozycja — i tak ma zostać. Rytmu nie da się
   * podrobić wstecz, a objętość owszem, więc rytm musi płacić najlepiej.
   */
  sessionDay: 80,
  /** Maksimum za objętość jednego dnia — celowo NIŻEJ niż sessionDay. */
  volumeCap: 60,
  /** Skala objętości: XP = volumeK · √(tony). 1 t → 20, 4 t → 40, 9 t → 60. */
  volumeK: 20,
  /** Za rekord życiowy w ćwiczeniu. */
  perRecord: 25,
  maxRecordsPerDay: 2,
  /** Ten sam ruch nie płaci za rekord częściej niż co tyle dni. */
  recordCooldownDays: 7,
  /** Kroki: XP = steps/1000 · stepsPer1k, do sufitu. */
  stepsPer1k: 4,
  stepsCap: 40,
  /** Seria dni z treningiem: 5 XP za każdy dzień serii, do sufitu. */
  streakPerDay: 5,
  streakCap: 30,
  /**
   * Ile dni z każdych siedmiu w ogóle płaci za trening.
   *
   * Regeneracja jest częścią treningu — nikt nie robi ciężkich sesji 7/7
   * tygodniami. Kto tak „trenuje", ten wpisuje, nie ćwiczy. Uczciwych to nie
   * dotyka: przy czterech treningach w tygodniu limit nigdy się nie odzywa.
   * Dni ponad limit dalej trafiają do dziennika i statystyk — po prostu nie
   * dają XP.
   */
  maxScoringDaysPer7: 5,
  /** Rekordy życiowe: najwyżej tyle w każdym oknie 7 dni. */
  maxRecordsPer7: 3,
  /**
   * Maksymalny wiarygodny skok nad poprzedni rekord. Siła rośnie o kilka
   * procent, nie o połowę — większy przeskok to albo literówka, albo ściema.
   * Wynik zostaje w dzienniku, ale za rekord nie płaci.
   */
  maxRecordJumpPct: 0.20,
} as const;

export type XpSource = "session" | "volume" | "record" | "steps" | "streak";

export interface RawSet {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
}

/** Czy seria mieści się w granicach zdrowego rozsądku. */
export function isPlausibleSet(s: RawSet): boolean {
  const w = s.weightKg ?? 0;
  const r = s.reps ?? 0;
  const d = s.durationSec ?? 0;
  if (w < 0 || r < 0 || d < 0) return false;
  if (w > LIMITS.maxWeightKg) return false;
  if (r > LIMITS.maxReps) return false;
  if (d > LIMITS.maxDurationSec) return false;
  if (w * r > LIMITS.maxSetVolumeKg) return false;
  // Seria musi cokolwiek zawierać
  return r > 0 || d > 0 || w > 0;
}

/** Objętość serii w kg (ciężar × powtórzenia). Bez ciężaru → 0. */
export function setVolume(s: RawSet): number {
  if (!isPlausibleSet(s)) return 0;
  const w = s.weightKg ?? 0;
  const r = s.reps ?? 0;
  return w > 0 && r > 0 ? w * r : 0;
}

// ── Krzywa poziomów ──────────────────────────────────────────────────────
/**
 * XP potrzebne, by wejść na poziom `level` (z poprzedniego).
 *
 * Dobrane tak, żeby początek dawał szybkie nagrody, a poziom ~50 wypadał po
 * mniej więcej dwóch latach regularnych treningów (przy ~1000 XP tygodniowo):
 *   poziom  2 →   133 XP        poziom 25 →  2 412 XP
 *   poziom 10 →   846 XP        poziom 50 →  5 376 XP
 * Suma do 50. poziomu ≈ 125 000 XP.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(60 * Math.pow(level, 1.15));
}

/** Ile łącznie XP trzeba uzbierać, żeby OSIĄGNĄĆ dany poziom. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let n = 2; n <= level; n++) sum += xpForLevel(n);
  return sum;
}

export interface LevelState {
  level: number;
  /** XP zdobyte w obrębie bieżącego poziomu. */
  xpInLevel: number;
  /** Ile XP potrzeba na następny poziom. */
  xpToNext: number;
  /** 0–1, do paska postępu. */
  progress: number;
}

/** Rozkłada łączne XP na poziom i postęp w jego obrębie. */
export function levelFromXp(totalXp: number): LevelState {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let consumed = 0;
  // Sufit 999 chroni przed pętlą bez końca przy absurdalnych wartościach
  while (level < 999) {
    const need = xpForLevel(level + 1);
    if (xp - consumed < need) break;
    consumed += need;
    level++;
  }
  const xpInLevel = xp - consumed;
  const xpToNext = xpForLevel(level + 1);
  return { level, xpInLevel, xpToNext, progress: xpToNext > 0 ? xpInLevel / xpToNext : 1 };
}

// ── XP za jeden dzień ────────────────────────────────────────────────────
export interface DayInput {
  /** Serie zapisane tego dnia (już z bazy, nie od klienta). */
  sets: RawSet[];
  /** Ile rekordów życiowych padło tego dnia (po cooldownie). */
  records: number;
  /** Kroki z zegarka tego dnia. */
  steps: number;
  /** Ile dni z rzędu (łącznie z dzisiejszym) był trening. */
  streakDays: number;
}

export interface DayBreakdown {
  total: number;
  bySource: Record<XpSource, number>;
  /** Ile serii odrzucono jako niewiarygodne — pokazujemy to uczciwie. */
  rejectedSets: number;
  volumeKg: number;
}

/**
 * Liczy XP za jeden dzień. Wynik jest DETERMINISTYCZNY — te same dane zawsze
 * dają ten sam wynik, dzięki czemu przeliczenie można powtarzać bez ryzyka
 * podwójnego naliczenia.
 */
export function xpForDay(input: DayInput): DayBreakdown {
  const bySource: Record<XpSource, number> = { session: 0, volume: 0, record: 0, steps: 0, streak: 0 };

  // Serie: odsiewamy niewiarygodne i ucinamy nadmiar
  const plausible = input.sets.filter(isPlausibleSet);
  const rejectedSets = input.sets.length - plausible.length;
  const counted = plausible.slice(0, LIMITS.maxSetsPerDay);

  const volumeKg = counted.reduce((sum, s) => sum + setVolume(s), 0);
  const trained = counted.length >= 3;

  if (trained) {
    bySource.session = XP.sessionDay;

    // Objętość pierwiastkiem: 1 t → 20 XP, 4 t → 40, 9 t → 60 (sufit). Podwojenie
    // wysiłku NIE podwaja nagrody, więc pompowanie liczb szybko przestaje się opłacać.
    const tons = volumeKg / 1000;
    bySource.volume = Math.min(XP.volumeCap, Math.round(XP.volumeK * Math.sqrt(tons)));

    const rec = Math.max(0, Math.min(input.records, XP.maxRecordsPerDay));
    bySource.record = rec * XP.perRecord;

    const streak = Math.max(0, input.streakDays);
    bySource.streak = Math.min(XP.streakCap, streak * XP.streakPerDay);
  }

  // Kroki liczą się nawet bez treningu — ruch to ruch.
  const steps = Math.max(0, Math.min(input.steps, 60000));
  bySource.steps = Math.min(XP.stepsCap, Math.round((steps / 1000) * XP.stepsPer1k));

  const raw = bySource.session + bySource.volume + bySource.record + bySource.steps + bySource.streak;
  const total = Math.min(DAILY_XP_CAP, raw);

  return { total, bySource, rejectedSets, volumeKg: Math.round(volumeKg) };
}

// ── Kondycja („życie" postaci) ───────────────────────────────────────────
/**
 * Forma spada, gdy przestajesz trenować — ale NIGDY nie odbiera poziomu ani XP.
 * Zdobyte poziomy zostają na zawsze; kondycja mówi tylko, w jakim jesteś rytmie.
 * Karanie utratą dorobku zniechęca; utrata „formy" motywuje do powrotu.
 */
export function conditionFromLastTraining(daysSinceLastTraining: number | null): number {
  if (daysSinceLastTraining == null) return 0;
  const grace = 2; // dwa dni przerwy to normalna regeneracja, nie zaniedbanie
  if (daysSinceLastTraining <= grace) return 100;
  return Math.max(0, 100 - (daysSinceLastTraining - grace) * 8);
}

// ── Statystyki postaci (0–100) ───────────────────────────────────────────
/**
 * Statystyki opisują AKTUALNĄ formę z ostatnich 28 dni, więc mogą spadać —
 * inaczej niż poziom, który jest dorobkiem na zawsze. Nie da się ich rozdzielać
 * ręcznie, bo wtedy powstawałyby „buildy" oderwane od tego, co ktoś naprawdę robi.
 */
export interface StatsInput {
  /** Objętość (kg) z ostatnich 28 dni. */
  volume28: number;
  /** Kroki z ostatnich 28 dni. */
  steps28: number;
  /** Dni z treningiem w ostatnich 28 dniach. */
  trainingDays28: number;
  /** Rekordy życiowe z ostatnich 28 dni. */
  records28: number;
}

export interface CharacterStats {
  /** Ciężary i rekordy. */
  sila: number;
  /** Kroki i objętość wytrzymałościowa. */
  wytrzymalosc: number;
  /** Regularność — najtrudniejsza do podrobienia. */
  dyscyplina: number;
}

const scale = (value: number, full: number) =>
  Math.max(0, Math.min(100, Math.round((value / full) * 100)));

export function statsFrom(input: StatsInput): CharacterStats {
  return {
    // 40 ton w 4 tygodnie = 100 pkt (ok. 10 t/tydzień, poziom zaawansowany)
    sila: scale(input.volume28 / 1000 + input.records28 * 2, 40),
    // 280 tys. kroków w 4 tygodnie = 100 pkt (10 tys. dziennie)
    wytrzymalosc: scale(input.steps28, 280000),
    // 16 treningów w 4 tygodnie = 100 pkt (4 razy w tygodniu)
    dyscyplina: scale(input.trainingDays28, 16),
  };
}

/** Tytuł postaci — zmienia się co 5 poziomów, żeby zawsze był następny cel. */
export function titleForLevel(level: number): string {
  const titles = [
    "Nowicjusz", "Adept", "Bywalec siłowni", "Zaprawiony", "Weteran",
    "Twardziel", "Mistrz formy", "Legenda siłowni", "Półbóg", "Tytan",
  ];
  const idx = Math.min(titles.length - 1, Math.floor((level - 1) / 5));
  return titles[idx];
}
