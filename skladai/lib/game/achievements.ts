/**
 * FORMA RPG — osiągnięcia. CZYSTE FUNKCJE.
 *
 * ── Czym się różnią od questów ───────────────────────────────────────────
 * Quest jest na dziś i znika. Osiągnięcie zostaje NA ZAWSZE. To jest jedyny
 * element gry, którego nie da się stracić — nie resetuje go sezon, nie
 * odbiera spadek z ligi, nie kasuje miesiąc przerwy. W języku Octalysis to
 * napęd „Posiadanie": kolekcja, która rośnie i jest wyłącznie Twoja.
 *
 * ── Dlaczego część jest ukryta ───────────────────────────────────────────
 * Ciekawość i nieprzewidywalność to osobny napęd motywacyjny. Kilka odznak
 * nie jest zapowiedzianych — wyskakują, gdy zrobisz coś nieoczywistego.
 * Reszta jest widoczna od początku, bo cel, którego nie znasz, nie kieruje
 * zachowaniem.
 *
 * Osiągnięcia dają XP, ale JEDNORAZOWO i poza dziennym sufitem nie stoją —
 * to pamiątka, nie kolejny sposób nabijania rankingu.
 */

export interface AchievementStats {
  /** Wszystkie ukończone dni treningowe w historii. */
  trainingDaysTotal: number;
  /** Największa passa dni pod rząd, kiedykolwiek. */
  bestStreak: number;
  /** Łączna objętość w kg, cała historia. */
  volumeTotalKg: number;
  /** Rekordy życiowe łącznie. */
  recordsTotal: number;
  /** Najwyższy osiągnięty poziom. */
  level: number;
  /** Najwyższa zdobyta liga (0-6). */
  bestLeague: number;
  /** Sesje zdjęć sylwetki z kompletem ujęć. */
  photoSessions: number;
  /** Punkty umięśnienia zdobyte od pierwszego pomiaru. */
  muscleGained: number;
  /** Punkty wysmuklenia zdobyte od pierwszego pomiaru. */
  leannessGained: number;
  /** Zeskanowane produkty i posiłki. */
  scansTotal: number;
  /** Dni z treningiem przed 7:00 lub po 22:00 — do odznak ukrytych. */
  oddHourSessions: number;
  /** Ukończone sezony z pełną ścieżką nagród. */
  seasonsCompleted: number;
}

export interface Achievement {
  id: string;
  name: string;
  /** Co trzeba zrobić. Dla ukrytych: opis pojawia się dopiero po zdobyciu. */
  how: string;
  xp: number;
  hidden?: boolean;
  /** Ile trzeba mieć — do paska postępu. */
  goal: (s: AchievementStats) => { have: number; need: number };
}

const at = (have: number, need: number) => ({ have, need });

export const ACHIEVEMENTS: Achievement[] = [
  // ── Rytm: najważniejsza rzecz w treningu, więc najwięcej odznak ──
  { id: "first_step", name: "Pierwszy krok", how: "Zapisz pierwszy trening", xp: 40,
    goal: (s) => at(s.trainingDaysTotal, 1) },
  { id: "ten_days", name: "Wchodzi w nawyk", how: "10 dni treningowych", xp: 80,
    goal: (s) => at(s.trainingDaysTotal, 10) },
  { id: "fifty_days", name: "To już styl życia", how: "50 dni treningowych", xp: 200,
    goal: (s) => at(s.trainingDaysTotal, 50) },
  { id: "two_hundred", name: "Dwieście dni pod sztangą", how: "200 dni treningowych", xp: 500,
    goal: (s) => at(s.trainingDaysTotal, 200) },
  { id: "streak_7", name: "Tydzień bez wymówek", how: "Passa 7 dni", xp: 90,
    goal: (s) => at(s.bestStreak, 7) },
  { id: "streak_30", name: "Miesiąc bez wymówek", how: "Passa 30 dni", xp: 260,
    goal: (s) => at(s.bestStreak, 30) },

  // ── Ciężar ──
  { id: "ton_100", name: "Sto ton", how: "100 ton łącznej objętości", xp: 100,
    goal: (s) => at(Math.floor(s.volumeTotalKg / 1000), 100) },
  { id: "ton_1000", name: "Tysiąc ton", how: "1 000 ton łącznej objętości", xp: 320,
    goal: (s) => at(Math.floor(s.volumeTotalKg / 1000), 1000) },
  { id: "pr_10", name: "Dziesięć rekordów", how: "Pobij 10 rekordów życiowych", xp: 150,
    goal: (s) => at(s.recordsTotal, 10) },
  { id: "pr_50", name: "Kolekcjoner rekordów", how: "Pobij 50 rekordów życiowych", xp: 400,
    goal: (s) => at(s.recordsTotal, 50) },

  // ── Postać ──
  { id: "lvl_10", name: "Dziesiąty poziom", how: "Osiągnij 10. poziom", xp: 100,
    goal: (s) => at(s.level, 10) },
  { id: "lvl_25", name: "Ćwierć setki", how: "Osiągnij 25. poziom", xp: 250,
    goal: (s) => at(s.level, 25) },
  { id: "lvl_50", name: "Pięćdziesiątka", how: "Osiągnij 50. poziom", xp: 700,
    goal: (s) => at(s.level, 50) },

  // ── Rywalizacja ──
  { id: "gold", name: "Złoto", how: "Wejdź do Złotej ligi", xp: 120,
    goal: (s) => at(s.bestLeague, 2) },
  { id: "diamond", name: "Diament", how: "Wejdź do Diamentowej ligi", xp: 300,
    goal: (s) => at(s.bestLeague, 4) },
  { id: "legend", name: "Legenda", how: "Wejdź do ligi Legend", xp: 600,
    goal: (s) => at(s.bestLeague, 6) },
  { id: "season_done", name: "Sezon domknięty", how: "Przejdź pełną ścieżkę sezonu", xp: 350,
    goal: (s) => at(s.seasonsCompleted, 1) },

  // ── Ciało ──
  { id: "first_photos", name: "Punkt odniesienia", how: "Zrób pierwszą sesję zdjęć sylwetki", xp: 60,
    goal: (s) => at(s.photoSessions, 1) },
  { id: "photo_6", name: "Widać różnicę", how: "6 sesji zdjęć sylwetki", xp: 180,
    goal: (s) => at(s.photoSessions, 6) },
  { id: "recomp", name: "Rekompozycja", how: "Zyskaj 10 pkt umięśnienia i 10 pkt wysmuklenia", xp: 400,
    goal: (s) => at(Math.min(s.muscleGained, s.leannessGained), 10) },

  // ── Aplikacja ──
  { id: "scan_50", name: "Czytasz etykiety", how: "Zeskanuj 50 produktów", xp: 80,
    goal: (s) => at(s.scansTotal, 50) },

  // ── Ukryte ──
  { id: "night_owl", name: "Nocna zmiana", how: "10 treningów przed 7:00 lub po 22:00", xp: 140, hidden: true,
    goal: (s) => at(s.oddHourSessions, 10) },
  { id: "comeback", name: "Powrót", how: "Wróć do treningów po miesiącu przerwy", xp: 120, hidden: true,
    goal: (s) => at(s.trainingDaysTotal > 0 && s.bestStreak >= 1 ? 0 : 0, 1) },
];

export interface AchievementState extends Achievement {
  have: number;
  need: number;
  unlocked: boolean;
}

/** Stan wszystkich osiągnięć dla danych statystyk. */
export function achievementsFor(s: AchievementStats): AchievementState[] {
  return ACHIEVEMENTS.map((a) => {
    const { have, need } = a.goal(s);
    return { ...a, have, need, unlocked: have >= need };
  });
}

/**
 * Które osiągnięcia są NOWE względem już przyznanych.
 * Serwer zapisuje tylko te — dzięki temu XP za odznakę nie może kapnąć dwa razy.
 */
export function newlyUnlocked(s: AchievementStats, already: string[]): AchievementState[] {
  const have = new Set(already);
  return achievementsFor(s).filter((a) => a.unlocked && !have.has(a.id));
}

/** Trzy najbliższe do zdobycia — do pokazania „co dalej". */
export function nextUp(s: AchievementStats, already: string[]): AchievementState[] {
  const have = new Set(already);
  return achievementsFor(s)
    .filter((a) => !a.unlocked && !have.has(a.id) && !a.hidden && a.need > 0)
    .sort((x, y) => y.have / y.need - x.have / x.need)
    .slice(0, 3);
}
