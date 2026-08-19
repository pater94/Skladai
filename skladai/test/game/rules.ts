/**
 * FORMA RPG — reguły punktacji pod ostrzałem.
 *
 * Ranking jest publiczny, więc ktoś PRÓBUJE go oszukać — to nie jest pytanie
 * „czy", tylko „kiedy". Ten test odgrywa konkretne scenariusze oszustwa i
 * sprawdza, że żaden nie daje przewagi nad uczciwym trenowaniem.
 *
 * Uruchomienie:  npx tsx test/game/rules.ts
 */
import {
  xpForDay, levelFromXp, xpForLevel, totalXpForLevel, statsFrom,
  conditionFromLastTraining, isPlausibleSet, titleForLevel,
  DAILY_XP_CAP, LIMITS, type RawSet,
} from "../../lib/game/rules";

const fails: string[] = [];
const check = (cond: boolean, good: string, wrong: string) => {
  if (cond) { console.log("  OK  " + good); return; }
  console.log("  BLAD " + wrong);
  fails.push(wrong);
};

/** Zwykła seria robocza. */
const set = (w: number, r: number): RawSet => ({ weightKg: w, reps: r, durationSec: null });
/** Uczciwy, dobry dzień: 5 ćwiczeń × 4 serie, ~5 ton objętości. */
const honestDay = (): RawSet[] => Array.from({ length: 20 }, () => set(80, 8));

console.log("\n── Granice zdrowego rozsądku ──");
check(!isPlausibleSet(set(999, 10)), "999 kg odrzucone", "999 kg przeszło");
check(!isPlausibleSet(set(100, 500)), "500 powtórzeń odrzucone", "500 powtórzeń przeszło");
check(!isPlausibleSet(set(300, 50)), "300 kg × 50 (15 t w serii) odrzucone", "absurdalna objętość serii przeszła");
check(isPlausibleSet(set(180, 3)), "martwy ciąg 180 × 3 zaliczony", "realna ciężka seria odrzucona");
check(isPlausibleSet({ weightKg: null, reps: 12, durationSec: null }), "seria z masą ciała zaliczona", "masa ciała odrzucona");

console.log("\n── Scenariusze oszustwa ──");
const honest = xpForDay({ sets: honestDay(), records: 1, steps: 9000, streakDays: 3 });

// 1. Wpisanie kosmicznych liczb
const absurd = xpForDay({ sets: Array.from({ length: 20 }, () => set(999, 99)), records: 2, steps: 0, streakDays: 1 });
check(absurd.total < honest.total,
  `Kosmiczne ciężary dają MNIEJ niż uczciwy dzień (${absurd.total} < ${honest.total})`,
  `Oszust wygrywa: ${absurd.total} vs uczciwe ${honest.total}`);
check(absurd.rejectedSets === 20, "Wszystkie absurdalne serie odrzucone", `Odrzucono tylko ${absurd.rejectedSets}/20`);

// 2. Zasypanie dnia setkami serii
const spam = xpForDay({ sets: Array.from({ length: 500 }, () => set(100, 10)), records: 2, steps: 60000, streakDays: 30 });
check(spam.total <= DAILY_XP_CAP, `500 serii nie przebija dziennego sufitu (${spam.total} ≤ ${DAILY_XP_CAP})`, `Sufit przebity: ${spam.total}`);
check(spam.total / Math.max(1, honest.total) < 2.2,
  `Spam daje mniej niż 2,2× uczciwego dnia (${(spam.total / honest.total).toFixed(2)}×)`,
  `Spam zbyt opłacalny: ${(spam.total / honest.total).toFixed(2)}×`);

// 3. Malejące zwroty — podwojenie objętości nie podwaja XP
const vol1 = xpForDay({ sets: Array.from({ length: 10 }, () => set(50, 2)), records: 0, steps: 0, streakDays: 1 });   // 1 t
const vol4 = xpForDay({ sets: Array.from({ length: 40 }, () => set(50, 2)), records: 0, steps: 0, streakDays: 1 });   // 4 t
check(vol4.bySource.volume < vol1.bySource.volume * 3,
  `Czterokrotna objętość daje mniej niż 3× XP (${vol1.bySource.volume} → ${vol4.bySource.volume})`,
  `Objętość skaluje się zbyt liniowo: ${vol1.bySource.volume} → ${vol4.bySource.volume}`);

// 4. Rekordy — nie da się nabić dziesięciu dziennie
const manyPr = xpForDay({ sets: honestDay(), records: 10, steps: 0, streakDays: 1 });
const twoPr = xpForDay({ sets: honestDay(), records: 2, steps: 0, streakDays: 1 });
check(manyPr.bySource.record === twoPr.bySource.record,
  "Dziesięć rekordów płaci tyle co dwa", `Rekordy bez limitu: ${manyPr.bySource.record}`);

// 5. Kroki podrobione — udział w wyniku pozostaje mały
const fakeSteps = xpForDay({ sets: [], records: 0, steps: 999999, streakDays: 0 });
check(fakeSteps.total <= 40, `Milion kroków to najwyżej 40 XP (${fakeSteps.total})`, `Kroki dają za dużo: ${fakeSteps.total}`);
check(fakeSteps.total < honest.total / 2,
  "Same kroki nie zastąpią treningu", `Kroki zbyt opłacalne: ${fakeSteps.total} vs ${honest.total}`);

// 6. Rytm ma płacić najlepiej
check(honest.bySource.session >= honest.bySource.volume,
  `Sam fakt treningu (${honest.bySource.session}) płaci nie mniej niż objętość (${honest.bySource.volume})`,
  `Objętość przebija rytm: ${honest.bySource.volume} > ${honest.bySource.session}`);

// 7. Dwie serie to nie trening
const twoSets = xpForDay({ sets: [set(100, 10), set(100, 10)], records: 0, steps: 0, streakDays: 1 });
check(twoSets.bySource.session === 0, "Dwie serie nie liczą się jako dzień treningowy", "Dwie serie dały pełne XP za dzień");

console.log("\n── Krzywa poziomów ──");
check(levelFromXp(0).level === 1, "Zero XP = poziom 1", "Zły poziom startowy");
const l2 = xpForLevel(2), l50 = xpForLevel(50);
check(l2 < 200 && l2 > 80, `Drugi poziom szybko (${l2} XP)`, `Drugi poziom źle wyceniony: ${l2}`);
check(l50 > l2 * 20, `Pięćdziesiąty poziom kosztuje ${Math.round(l50 / l2)}× więcej niż drugi`, "Krzywa zbyt płaska");
const t50 = totalXpForLevel(50);
const weeklyRealistic = 4 * 190 + 40 * 3;          // 4 treningi + kroki ≈ 880 XP/tydzień
const weeks = Math.round(t50 / weeklyRealistic);
check(weeks > 90 && weeks < 220,
  `Poziom 50 to ${weeks} tygodni realnych treningów (~${(weeks / 52).toFixed(1)} roku)`,
  `Tempo do 50. poziomu nierealne: ${weeks} tygodni`);
const t10 = totalXpForLevel(10);
check(t10 / weeklyRealistic < 8, `Poziom 10 w ${Math.round(t10 / weeklyRealistic)} tygodni — start wynagradza`, "Początek zbyt wolny");

// Nawet ktoś, kto codziennie wyciąga MAKSIMUM, nie przeskoczy roku pracy w miesiąc
const maxWeeks = Math.round(t50 / (DAILY_XP_CAP * 7));
check(maxWeeks > 55, `Nawet 300 XP KAŻDEGO dnia to ${maxWeeks} tygodni do 50. poziomu`, `Da się dobić za szybko: ${maxWeeks} tygodni`);

console.log("\n── Forma (kondycja) ──");
check(conditionFromLastTraining(0) === 100, "Dzień treningu = pełna forma", "Zła forma po treningu");
check(conditionFromLastTraining(2) === 100, "Dwa dni przerwy bez kary", "Kara za normalną regenerację");
check(conditionFromLastTraining(7) < 70 && conditionFromLastTraining(7) > 30, `Tydzień przerwy → forma ${conditionFromLastTraining(7)}`, "Zły spadek formy");
check(conditionFromLastTraining(30) === 0, "Miesiąc przerwy → forma 0", "Forma nie schodzi do zera");
check(conditionFromLastTraining(null) === 0, "Brak treningów → forma 0", "Zły stan bez historii");

console.log("\n── Statystyki ──");
const beginner = statsFrom({ volume28: 8000, steps28: 100000, trainingDays28: 6, records28: 1 });
const advanced = statsFrom({ volume28: 40000, steps28: 280000, trainingDays28: 16, records28: 4 });
check(advanced.sila > beginner.sila && advanced.dyscyplina > beginner.dyscyplina, "Zaawansowany ma wyższe statystyki", "Statystyki nie różnicują");
check(advanced.dyscyplina === 100, "4 treningi/tydzień = 100 dyscypliny", `Dyscyplina zaawansowanego: ${advanced.dyscyplina}`);
const insane = statsFrom({ volume28: 999999, steps28: 9999999, trainingDays28: 99, records28: 99 });
check(insane.sila <= 100 && insane.wytrzymalosc <= 100 && insane.dyscyplina <= 100, "Statystyki nie przekraczają 100", "Statystyka wyszła poza skalę");

console.log("\n── Tytuły ──");
check(titleForLevel(1) === "Nowicjusz" && titleForLevel(50) !== titleForLevel(1), `Poziom 1: ${titleForLevel(1)}, poziom 50: ${titleForLevel(50)}`, "Tytuły się nie zmieniają");

console.log("\n── Determinizm ──");
const a = xpForDay({ sets: honestDay(), records: 1, steps: 9000, streakDays: 3 });
const b = xpForDay({ sets: honestDay(), records: 1, steps: 9000, streakDays: 3 });
check(a.total === b.total, "Te same dane → ten sam wynik (można przeliczać wielokrotnie)", "Wynik niedeterministyczny");
check(LIMITS.maxSetsPerDay > 0 && DAILY_XP_CAP > 0, "Limity zdefiniowane", "Brak limitów");

console.log(`\nUczciwy dobry dzień: ${honest.total} XP  (${JSON.stringify(honest.bySource)})`);
console.log(fails.length === 0 ? "\nREGULY OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
process.exit(fails.length ? 1 : 0);
