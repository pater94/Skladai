/**
 * FORMA RPG — sezony i ligi. CZYSTE FUNKCJE, zero zapytań do bazy.
 *
 * ── Skąd ten kształt ─────────────────────────────────────────────────────
 * Z tego, co realnie zadziałało u innych, nie z przeczucia:
 *
 * • Duolingo po wprowadzeniu lig zanotowało wzrost ukończonych lekcji o 25 %,
 *   a użytkownicy aktywni w rankingu robią ich o 40 % tygodniowo więcej.
 *   Kluczem NIE jest jeden wielki ranking świata, tylko mała kohorta i
 *   cotygodniowy awans/spadek: rywalizujesz z trzydziestką ludzi na Twoim
 *   poziomie, więc pierwsza dziesiątka zawsze jest w zasięgu.
 *
 * • Gry sieciowe utrzymujące graczy latami (Fortnite ~78 % retencji po 90
 *   dniach) dzielą czas na SEZONY: skończony rozdział z własną nagrodą,
 *   która przepada. Sezon daje dwie rzeczy naraz — powód, żeby wracać teraz,
 *   i czyste konto dla kogoś, kto wrócił po przerwie i inaczej zobaczyłby,
 *   że jest beznadziejnie w tyle.
 *
 * • Fitocracy, które miało świetne XP i questy, umarło m.in. dlatego, że
 *   system się nie zmieniał — brakowało długiej progresji i wydarzeń
 *   sezonowych. Dlatego poziom rośnie BEZ KOŃCA i nigdy się nie zeruje,
 *   a resetuje się tylko dorobek sezonowy.
 *
 * Zasada nadrzędna: liga mierzy OSTATNI TYDZIEŃ, poziom mierzy CAŁE ŻYCIE.
 * Kto odpuścił miesiąc, spadnie w lidze, ale nie straci ani jednego poziomu.
 */

// ── Sezon ────────────────────────────────────────────────────────────────

/** Pierwszy sezon startuje w poniedziałek 24.08.2026 (UTC). */
export const SEASON_EPOCH = Date.UTC(2026, 7, 24);
export const SEASON_WEEKS = 8;
const DAY = 86400000;
const WEEK = 7 * DAY;

export interface Season {
  index: number;        // 1, 2, 3…
  name: string;
  startISO: string;     // YYYY-MM-DD
  endISO: string;       // ostatni dzień sezonu włącznie
  weekOfSeason: number; // 1..SEASON_WEEKS
  daysLeft: number;
}

/**
 * Nazwy sezonów. Cykl dwunastu, potem numer — żeby po trzech latach nie
 * skończyły się nazwy i nie trzeba było wracać do kodu.
 */
const SEASON_NAMES = [
  "Fundament", "Przełom", "Ciężar", "Rytm", "Granica", "Wytrwałość",
  "Szczyt", "Hart", "Rozpęd", "Próba", "Stal", "Legenda",
];

const dayISO = (t: number) => new Date(t).toISOString().slice(0, 10);

export function seasonFor(now: Date = new Date()): Season {
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsed = Math.max(0, t - SEASON_EPOCH);
  const index = Math.floor(elapsed / (SEASON_WEEKS * WEEK)) + 1;
  const start = SEASON_EPOCH + (index - 1) * SEASON_WEEKS * WEEK;
  const end = start + SEASON_WEEKS * WEEK - DAY;
  return {
    index,
    name: SEASON_NAMES[(index - 1) % SEASON_NAMES.length],
    startISO: dayISO(start),
    endISO: dayISO(end),
    weekOfSeason: Math.floor((t - start) / WEEK) + 1,
    daysLeft: Math.max(0, Math.round((end - t) / DAY)),
  };
}

/** Klucz sezonu do bazy, np. „S3". */
export const seasonKey = (s: Season) => `S${s.index}`;

// ── Ligi ─────────────────────────────────────────────────────────────────

export interface League {
  id: number;
  name: string;
  color: string;
  /** Ilu z góry awansuje. */
  promote: number;
  /** Ilu z dołu spada. */
  relegate: number;
}

/**
 * Siedem lig. Progi awansu i spadku dobrane tak, żeby w kohorcie 30 osób
 * mniej więcej co czwarty awansował, a co szósty spadał — wystarczy, by
 * ranking żył, i za mało, żeby przypadek decydował o wszystkim.
 */
export const LEAGUES: League[] = [
  { id: 0, name: "Brąz",     color: "#b06a3b", promote: 10, relegate: 0 },
  { id: 1, name: "Srebro",   color: "#9ca3af", promote: 8,  relegate: 4 },
  { id: 2, name: "Złoto",    color: "#eab308", promote: 7,  relegate: 5 },
  { id: 3, name: "Platyna",  color: "#5eead4", promote: 6,  relegate: 5 },
  { id: 4, name: "Diament",  color: "#60a5fa", promote: 5,  relegate: 6 },
  { id: 5, name: "Mistrz",   color: "#c084fc", promote: 4,  relegate: 6 },
  { id: 6, name: "Legenda",  color: "#f97316", promote: 0,  relegate: 6 },
];

export const MAX_LEAGUE = LEAGUES.length - 1;
export const leagueById = (id: number) => LEAGUES[Math.max(0, Math.min(MAX_LEAGUE, Math.round(id)))];

/** Ilu graczy w jednej kohorcie. Trzydziestka to rozmiar, w którym da się „znać" rywali. */
export const COHORT_SIZE = 30;

export type LeagueOutcome = "promoted" | "stayed" | "relegated";

/**
 * Wynik tygodnia w lidze.
 *
 * `rank` liczony od 1. Zero punktów NIGDY nie spada — kto nie zagrał w ogóle,
 * ten nie przegrał; spadek to sygnał „inni byli lepsi", a nie kara za urlop.
 * To świadoma decyzja: badania nad grywalizacją pokazują, że systemy oparte na
 * karze dają krótkotrwałe posłuszeństwo i zwiększają porzucanie aplikacji.
 */
export function leagueOutcome(leagueId: number, rank: number, points: number): LeagueOutcome {
  const lg = leagueById(leagueId);
  if (points <= 0) return "stayed";
  if (lg.promote > 0 && rank <= lg.promote) return "promoted";
  if (lg.relegate > 0 && rank > COHORT_SIZE - lg.relegate) return "relegated";
  return "stayed";
}

/** Liga po rozliczeniu tygodnia. */
export function nextLeague(leagueId: number, outcome: LeagueOutcome): number {
  if (outcome === "promoted") return Math.min(MAX_LEAGUE, leagueId + 1);
  if (outcome === "relegated") return Math.max(0, leagueId - 1);
  return leagueId;
}

/** Tydzień ISO jako „2026-W34" — klucz cyklu ligowego. */
export function isoWeek(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Ile godzin zostało do rozliczenia ligi (poniedziałek 00:00 UTC). */
export function hoursToWeekEnd(now: Date = new Date()): number {
  const dayNum = now.getUTCDay() || 7;
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + (8 - dayNum) * DAY;
  return Math.max(0, Math.round((end - now.getTime()) / 3600000));
}

// ── Nagrody sezonowe ─────────────────────────────────────────────────────

export interface SeasonReward {
  atPoints: number;
  label: string;
  kind: "title" | "aura" | "gear";
}

/**
 * Ścieżka nagród sezonu — to, co przepada po ośmiu tygodniach.
 *
 * Punkt = jednostka dorobku okresowego: dzienne XP (po sufitach) plus punkty
 * za domknięte cele. Porządny tydzień to ok. 2200 punktów, więc pełna ścieżka
 * wymaga mniej więcej siedmiu solidnych tygodni z ośmiu. Ma być osiągalna dla
 * wytrwałych i nieosiągalna dla kogoś, kto wpadnie na trzy dni pod koniec.
 */
export const SEASON_TRACK: SeasonReward[] = [
  { atPoints: 1500, label: "Odznaka sezonu", kind: "gear" },
  { atPoints: 5000, label: "Tytuł sezonowy", kind: "title" },
  { atPoints: 10000, label: "Aura sezonu", kind: "aura" },
  { atPoints: 16000, label: "Złota aura sezonu", kind: "aura" },
];

export function rewardsUnlocked(points: number): SeasonReward[] {
  return SEASON_TRACK.filter((r) => points >= r.atPoints);
}

export function nextReward(points: number): SeasonReward | null {
  return SEASON_TRACK.find((r) => points < r.atPoints) ?? null;
}
