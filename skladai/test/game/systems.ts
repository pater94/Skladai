/**
 * FORMA RPG — sezony, ligi, questy, osiągnięcia i kompozycja ciała.
 *
 * Reguły XP sprawdza test/game/rules.ts, obronę bazy test/game/live.cjs.
 * Ten plik pilnuje rzeczy, które łatwo zepsuć niezauważenie: czy sezon się
 * nie rozjeżdża, czy spadek z ligi nie karze za urlop, czy questy da się
 * przelosować do skutku i czy pojedyncze zdjęcie może przestawić postać.
 *
 * Uruchomienie:  npx tsx test/game/systems.ts
 */
import {
  seasonFor, seasonKey, SEASON_WEEKS, LEAGUES, MAX_LEAGUE, COHORT_SIZE,
  leagueOutcome, nextLeague, isoWeek, rewardsUnlocked, nextReward, SEASON_TRACK,
} from "../../lib/game/season";
import {
  dailyQuests, weeklyQuests, withProgress, questReward,
  DAILY_OFFERED, DAILY_REQUIRED, maxDailyQuestXp, QUEST_XP_SANITY,
} from "../../lib/game/quests";
import { achievementsFor, newlyUnlocked, nextUp, ACHIEVEMENTS, type AchievementStats } from "../../lib/game/achievements";
import {
  bodyStateFrom, parseFatRange, leannessFromFat, buildName, isConfident,
  PHOTOS_PER_SESSION, type BodyReading,
} from "../../lib/game/body";

const fails: string[] = [];
const check = (c: boolean, ok: string, bad: string) => {
  if (c) { console.log("  OK  " + ok); return; }
  console.log("  BLAD " + bad);
  fails.push(bad);
};

// ── SEZONY ───────────────────────────────────────────────────────────────
console.log("\n── Sezony ──");
const s1 = seasonFor(new Date("2026-08-24T12:00:00Z"));
check(s1.index === 1 && s1.weekOfSeason === 1, `Pierwszy dzień epoki to sezon 1, tydzień 1 („${s1.name}")`, `Zły start sezonu: ${JSON.stringify(s1)}`);
const sMid = seasonFor(new Date("2026-09-21T12:00:00Z"));
check(sMid.index === 1 && sMid.weekOfSeason === 5, `Po czterech tygodniach nadal sezon 1, tydzień ${sMid.weekOfSeason}`, `Sezon rozjechał się w środku: ${JSON.stringify(sMid)}`);
const s2 = seasonFor(new Date("2026-10-19T12:00:00Z"));
check(s2.index === 2 && s2.weekOfSeason === 1, "Po ośmiu tygodniach zaczyna się sezon 2", `Zły przeskok sezonu: ${JSON.stringify(s2)}`);
check(seasonKey(s2) === "S2", "Klucz sezonu to S2", `Zły klucz: ${seasonKey(s2)}`);
check(s1.daysLeft === SEASON_WEEKS * 7 - 1, `Na starcie zostaje ${s1.daysLeft} dni sezonu`, `Zła liczba dni: ${s1.daysLeft}`);
// Data sprzed epoki nie może dać sezonu zerowego ani ujemnego
const sBefore = seasonFor(new Date("2026-01-01T12:00:00Z"));
check(sBefore.index >= 1, "Data sprzed epoki nadal daje sezon ≥ 1", `Sezon ${sBefore.index} sprzed epoki`);
// Nazwy nie mogą się skończyć
check(seasonFor(new Date("2030-01-01T12:00:00Z")).name.length > 0, "Po latach sezon nadal ma nazwę", "Nazwy sezonów się skończyły");

console.log("\n── Tydzień ISO ──");
check(isoWeek(new Date("2026-08-24T00:00:00Z")) === isoWeek(new Date("2026-08-30T23:00:00Z")),
  "Poniedziałek i niedziela to ten sam tydzień", "Tydzień ISO pęka w środku");
check(isoWeek(new Date("2026-08-30T23:00:00Z")) !== isoWeek(new Date("2026-08-31T01:00:00Z")),
  "Poniedziałek zaczyna nowy tydzień", "Tydzień nie zmienia się w poniedziałek");

// ── LIGI ─────────────────────────────────────────────────────────────────
console.log("\n── Ligi: awans i spadek ──");
check(LEAGUES.length === 7 && LEAGUES[0].name === "Brąz" && LEAGUES[MAX_LEAGUE].name === "Legenda",
  "Siedem lig, od Brązu do Legendy", "Zła drabinka lig");
check(LEAGUES[0].relegate === 0, "Z Brązu nie da się spaść — nie ma gdzie", "Brąz ma spadek");
check(LEAGUES[MAX_LEAGUE].promote === 0, "Z Legendy nie ma awansu", "Legenda ma awans");

check(leagueOutcome(2, 1, 900) === "promoted", "Pierwsze miejsce w Złocie = awans", "Lider nie awansuje");
check(leagueOutcome(2, 30, 100) === "relegated", "Ostatnie miejsce ze zdobyczą = spadek", "Ostatni nie spada");
check(leagueOutcome(2, 15, 400) === "stayed", "Środek stawki zostaje", "Środek stawki się rusza");

// Najważniejsze: kto NIC nie zrobił, nie zostaje ukarany.
check(leagueOutcome(4, 30, 0) === "stayed",
  "Zero punktów NIE powoduje spadku — urlop to nie porażka",
  "Nieobecność karana spadkiem");

check(nextLeague(6, "promoted") === 6, "Z Legendy awans nigdzie nie prowadzi", "Awans powyżej Legendy");
check(nextLeague(0, "relegated") === 0, "Z Brązu spadek nigdzie nie prowadzi", "Spadek poniżej Brązu");
check(nextLeague(3, "promoted") === 4 && nextLeague(3, "relegated") === 2, "Awans i spadek przesuwają o jedną ligę", "Zły przeskok ligi");

// Progi muszą się mieścić w kohorcie i nie nachodzić na siebie
for (const lg of LEAGUES) {
  const ok = lg.promote + lg.relegate < COHORT_SIZE;
  check(ok, `${lg.name}: ${lg.promote} awansuje, ${lg.relegate} spada — strefy się nie nakładają`,
    `${lg.name}: strefy awansu i spadku zachodzą na siebie`);
}

console.log("\n── Ścieżka nagród sezonu ──");
check(rewardsUnlocked(0).length === 0, "Bez punktów zero nagród", "Nagroda za nic");
check(rewardsUnlocked(6000).length === 2, `Przy 6000 pkt odblokowane 2 nagrody`, `Zła liczba nagród: ${rewardsUnlocked(6000).length}`);
check(nextReward(6000)?.atPoints === 10000, "Następna nagroda pokazana poprawnie", "Zła następna nagroda");
check(nextReward(99999) === null, "Po pełnej ścieżce nie ma już nic", "Ścieżka bez końca");
// Pełna ścieżka musi być realna, ale nie na trzy dni
const perWeek = 2200;   // XP tygodnia + punkty za questy
const weeksNeeded = SEASON_TRACK[SEASON_TRACK.length - 1].atPoints / perWeek;
check(weeksNeeded > 4 && weeksNeeded < SEASON_WEEKS,
  `Pełna ścieżka to ~${weeksNeeded.toFixed(1)} tygodnia z ${SEASON_WEEKS} przy porządnym tempie`,
  `Ścieżka sezonu źle wyceniona: ${weeksNeeded.toFixed(1)} tygodnia`);

// ── QUESTY ───────────────────────────────────────────────────────────────
console.log("\n── Questy: determinizm ──");
const u = "11111111-2222-3333-4444-555555555555";
const q1 = dailyQuests(u, "2026-08-21").map((q) => q.id).join(",");
const q2 = dailyQuests(u, "2026-08-21").map((q) => q.id).join(",");
check(q1 === q2, "Ten sam dzień → ten sam zestaw (nie da się przelosować)", "Questy losują się od nowa!");
check(dailyQuests(u, "2026-08-22").map((q) => q.id).join(",") !== q1, "Inny dzień → inny zestaw", "Codziennie te same cele");
check(dailyQuests("inny-user", "2026-08-21").map((q) => q.id).join(",") !== q1, "Inny gracz → inny zestaw", "Wszyscy mają identyczne questy");
check(dailyQuests(u, "2026-08-21").length === DAILY_OFFERED, `Dziennie ${DAILY_OFFERED} cele do wyboru`, "Zła liczba celów dnia");
check(new Set(dailyQuests(u, "2026-08-21").map((q) => q.id)).size === DAILY_OFFERED, "Cele się nie powtarzają", "Duplikaty w zestawie");
check(weeklyQuests(u, "2026-W34").length === 3, "Trzy cele tygodnia", "Zła liczba celów tygodnia");

console.log("\n── Questy: postęp i nagroda ──");
const daily = withProgress(dailyQuests(u, "2026-08-21"), { trainingDays: 1, sets: 25, volumeKg: 9000, steps: 13000, records: 1, scans: 2, exercises: 6 });
check(daily.every((q) => q.done), "Bardzo dobry dzień domyka wszystkie cele", `Niedomknięte: ${daily.filter((q) => !q.done).map((q) => q.id)}`);
const nic = withProgress(dailyQuests(u, "2026-08-21"), {});
check(nic.every((q) => !q.done && q.have === 0), "Pusty dzień nie domyka nic", "Cel domknięty bez postępu");

const rewardFull = questReward(daily, []);
check(rewardFull.dailyBonus, `Premia za ${DAILY_REQUIRED} cele przyznana`, "Brak premii mimo kompletu");
const rewardTwo = questReward(daily.slice(0, 2).concat(nic.slice(2)), []);
check(!rewardTwo.dailyBonus, "Dwa cele to za mało na premię", "Premia za dwa cele");

check(maxDailyQuestXp() < QUEST_XP_SANITY.maxSingleDaily * 2,
  `Maksimum z questów (${maxDailyQuestXp()} XP) nie przebija dwóch treningów`,
  `Questy zbyt opłacalne: ${maxDailyQuestXp()} XP`);
for (const q of dailyQuests(u, "2026-08-21")) {
  check(q.xp < QUEST_XP_SANITY.maxSingleDaily,
    `„${q.text}" (${q.xp} XP) nie przebija samego treningu`,
    `Quest „${q.text}" daje ${q.xp} XP — za dużo`);
}

// ── OSIĄGNIĘCIA ──────────────────────────────────────────────────────────
console.log("\n── Osiągnięcia ──");
const zero: AchievementStats = {
  trainingDaysTotal: 0, bestStreak: 0, volumeTotalKg: 0, recordsTotal: 0, level: 1,
  bestLeague: 0, photoSessions: 0, muscleGained: 0, leannessGained: 0, scansTotal: 0,
  oddHourSessions: 0, seasonsCompleted: 0,
};
const nowe = achievementsFor(zero).filter((a) => a.unlocked);
check(nowe.length === 0 || nowe.every((a) => a.need === 0),
  "Świeże konto nie dostaje odznak z powietrza", `Odznaki bez zasług: ${nowe.map((a) => a.id)}`);

const wet: AchievementStats = { ...zero, trainingDaysTotal: 55, bestStreak: 8, volumeTotalKg: 150000, recordsTotal: 12, level: 11, bestLeague: 3, photoSessions: 2, scansTotal: 60 };
const got = achievementsFor(wet).filter((a) => a.unlocked).map((a) => a.id);
check(got.includes("fifty_days") && got.includes("ton_100") && got.includes("lvl_10") && got.includes("gold"),
  `Weteran ma odznaki: ${got.length}`, `Brakuje oczywistych odznak: ${got}`);
check(!got.includes("lvl_50") && !got.includes("legend"), "Nie dostaje odznak, na które nie zapracował", "Odznaka przyznana przedwcześnie");

const drugie = newlyUnlocked(wet, got);
check(drugie.length === 0, "Już przyznana odznaka nie przyznaje się drugi raz (XP nie kapie dwa razy)", `Powtórki: ${drugie.map((a) => a.id)}`);
check(newlyUnlocked(wet, []).length === got.length, "Bez historii wszystkie zdobyte są nowe", "Zła detekcja nowych odznak");

const dalej = nextUp(wet, got);
check(dalej.length > 0 && dalej.every((a) => !a.hidden), "Podpowiedź „co dalej” pomija ukryte", "Ukryte odznaki zdradzone w podpowiedzi");
check(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, "Identyfikatory odznak są unikalne", "Zduplikowany identyfikator odznaki");

// ── CIAŁO ────────────────────────────────────────────────────────────────
console.log("\n── Kompozycja ciała ──");
check(parseFatRange("10-14%") === 12, "„10-14%” → 12", `Zły środek zakresu: ${parseFatRange("10-14%")}`);
check(parseFatRange("~15%") === 15, "„~15%” → 15", `Zły odczyt: ${parseFatRange("~15%")}`);
check(parseFatRange("15,5%") === 15.5, "Przecinek dziesiętny czytany poprawnie", "Przecinek psuje odczyt");
check(parseFatRange(null) === null && parseFatRange("brak") === null, "Brak danych zwraca null, nie zero", "Brak danych udaje pomiar");

check(leannessFromFat(8, "male") === 100 && leannessFromFat(32, "male") === 0, "Skala wysmuklenia mężczyzn rozpięta poprawnie", "Zła skala męska");
check(leannessFromFat(20, "female") > leannessFromFat(20, "male"), "20 % tkanki to co innego u kobiety niż u mężczyzny", "Skala nie rozróżnia płci");

const r = (day: string, fat: number, photos = PHOTOS_PER_SESSION): BodyReading =>
  ({ day, bodyFatPct: fat, muscleMass: "above_average", photos });

console.log("\n── Jedno zdjęcie nie przestawia postaci ──");
const base = { gender: "male" as const, weightsKg: [], volume28Kg: 20000, trainingDays28: 12 };
const stabilne = bodyStateFrom({ ...base, readings: [r("2026-08-01", 15), r("2026-08-08", 15), r("2026-08-15", 15)] });
// Jedno wyjątkowo korzystne zdjęcie (świetne światło, po treningu)
const zJednym = bodyStateFrom({ ...base, readings: [r("2026-08-01", 15), r("2026-08-08", 15), r("2026-08-15", 15), r("2026-08-16", 8)] });
const skok = Math.abs(zJednym.leanness - stabilne.leanness);
check(skok <= 12, `Jeden korzystny pomiar przesuwa wysmuklenie o ${skok} pkt (mediana tłumi szum)`, `Jedno zdjęcie przestawiło postać o ${skok} pkt`);

const jednoUjecie = bodyStateFrom({ ...base, readings: [{ day: "2026-08-15", bodyFatPct: 8, muscleMass: "high", photos: 1 }] });
check(jednoUjecie.samples === 0 && jednoUjecie.source === "training",
  "Sesja z jednym ujęciem NIE liczy się jako pomiar", `Pojedyncze zdjęcie potraktowane jako pomiar: ${JSON.stringify(jednoUjecie)}`);

console.log("\n── Ciało: sensowność ──");
const brak = bodyStateFrom({ gender: null, readings: [], weightsKg: [], volume28Kg: 0, trainingDays28: 0 });
check(brak.source === "none" && !isConfident(brak), "Bez danych postać nie udaje, że coś wie", "Zgadywanie podane jako pewnik");
const tylkoTrening = bodyStateFrom({ ...base, readings: [] });
check(tylkoTrening.source === "training" && tylkoTrening.muscle > 0, "Sam trening daje umięśnienie, nawet bez zdjęć", "Trening bez zdjęć nic nie daje");
check(tylkoTrening.muscle <= 80, `Bez zdjęcia umięśnienie nie przekracza ${tylkoTrening.muscle}/100 — nie wiemy, jak ciało wygląda`, "Sam trening daje maksymalną sylwetkę");

const chudy = bodyStateFrom({ ...base, readings: [r("2026-07-01", 25), r("2026-07-15", 22), r("2026-08-01", 18), r("2026-08-15", 14), r("2026-08-20", 13), r("2026-08-21", 12)] });
check(chudy.leannessDelta !== null && chudy.leannessDelta > 0, `Redukcja widoczna jako +${chudy.leannessDelta} pkt wysmuklenia`, "Postęp w redukcji niewidoczny");
check(isConfident(chudy), `Sześć sesji to solidna podstawa (${chudy.samples})`, "Sześć sesji uznane za niepewne");

check(buildName({ muscle: 85, leanness: 85, samples: 3, source: "photos", muscleDelta: null, leannessDelta: null }) === "Wyrzeźbiona",
  "Duża masa + niski tłuszcz = „Wyrzeźbiona”", "Zła nazwa budowy");
check(buildName(brak) === "Nieznana budowa", "Bez danych budowa jest nieznana", "Nazwa budowy zmyślona");

// Skrajne wartości nie mogą wyjść poza skalę — postać rysuje się z tych liczb
for (const fat of [0, 3, 50, 80]) {
  const st = bodyStateFrom({ ...base, readings: [r("a", fat), r("b", fat), r("c", fat)] });
  check(st.leanness >= 0 && st.leanness <= 100 && st.muscle >= 0 && st.muscle <= 100,
    `Tkanka ${fat}% → osie w skali (${st.muscle}/${st.leanness})`,
    `Osie poza skalą przy ${fat}%: ${st.muscle}/${st.leanness}`);
}

console.log(fails.length === 0 ? "\nSYSTEMY OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
process.exit(fails.length ? 1 : 0);
