/**
 * Rytm treningowy — okno kroczące, serie na partie, wykrywanie rotacji.
 *
 * Scenariusz wzięty wprost od Patryka: wcześniej 3 treningi na 7 dni, teraz
 * 2, a cel to zmieścić cykl trzech treningów w mniej więcej 10 dniach, czyli
 * ok. 2,5 na tydzień. Test pilnuje, żeby licznik mówił prawdę w każdym z
 * tych układów i żeby objętość liczyła się w SERIACH NA PARTIĘ, a nie w
 * przerzuconych kilogramach.
 *
 * Uruchomienie:  npx tsx test/training/rhythm.ts
 */
import {
  rhythmFrom, setsByPart, rhythmVerdict, nextDueInDays,
  PART_ORDER, WEEKLY_TARGET, DEFAULT_WINDOW, type RhythmSession, type BodyPart,
} from "../../lib/training/rhythm";

const fails: string[] = [];
const check = (c: boolean, ok: string, bad: string) => {
  if (c) { console.log("  OK  " + ok); return; }
  console.log("  BLAD " + bad);
  fails.push(bad);
};

const TODAY = new Date("2026-08-30T12:00:00Z");
const DAY = 86400000;
const ago = (n: number) => new Date(TODAY.getTime() - n * DAY).toISOString().slice(0, 10);

/** Trzy realne treningi Patryka, uproszczone do nazw ćwiczeń i liczby serii. */
const GORA_A: RhythmSession["entries"] = [
  { exerciseName: "Wyciskanie sztangi leżąc", sets: 4 },
  { exerciseName: "Wiosłowanie sztangą", sets: 4 },
  { exerciseName: "Wyciskanie żołnierskie", sets: 3 },
  { exerciseName: "Wznosy bokiem hantlami", sets: 3 },
  { exerciseName: "Uginanie ramion ze sztangą", sets: 3 },
];
const GORA_B: RhythmSession["entries"] = [
  { exerciseName: "Wyciskanie sztangi leżąc", sets: 4 },
  { exerciseName: "Podciąganie", sets: 4 },
  { exerciseName: "Wyciskanie żołnierskie", sets: 3 },
  { exerciseName: "Prostowanie ramion na wyciągu", sets: 3 },
];
const NOGI: RhythmSession["entries"] = [
  { exerciseName: "Przysiad ze sztangą", sets: 4 },
  { exerciseName: "Martwy ciąg", sets: 3 },
  { exerciseName: "Wypychanie nóg na suwnicy", sets: 4 },
  { exerciseName: "Wspięcia na palce", sets: 3 },
];
const CYKL: Array<[string, RhythmSession["entries"]]> = [["Góra A", GORA_A], ["Góra B", GORA_B], ["Nogi", NOGI]];

/** Buduje historię: trening co `gap` dni, w rotacji trzech. */
function historia(gap: number, ile: number): RhythmSession[] {
  const out: RhythmSession[] = [];
  for (let i = 0; i < ile; i++) {
    const [name, entries] = CYKL[(ile - 1 - i) % 3];
    out.push({ day: ago(i * gap), workoutName: name, entries });
  }
  return out;
}

console.log("\n── Serie liczone na partie, nie w kilogramach ──");
{
  const wyciskanie = setsByPart("Wyciskanie sztangi leżąc", 4);
  check((wyciskanie.chest ?? 0) === 4, `Wyciskanie 4 serie → klatka dostaje ${wyciskanie.chest}`, `Klatka dostała ${wyciskanie.chest}`);
  check((wyciskanie.triceps ?? 0) === 4, `Triceps też pracuje jako główny → ${wyciskanie.triceps}`, `Triceps: ${wyciskanie.triceps}`);
  check((wyciskanie.shoulders ?? 0) === 2, `Barki jako wspomagające → połowa serii (${wyciskanie.shoulders})`, `Barki: ${wyciskanie.shoulders}`);
  check(!("legs" in wyciskanie), "Nogi nie dostają nic z wyciskania", "Nogi doliczone do wyciskania");
  check(!("core" in wyciskanie), "Stabilizacja core'u NIE liczy się jako seria na brzuch", "Core doliczony ze stabilizacji");

  const przysiad = setsByPart("Przysiad ze sztangą", 4);
  check((przysiad.legs ?? 0) === 4, `Przysiad 4 serie → nogi ${przysiad.legs}`, `Nogi: ${przysiad.legs}`);
  check((przysiad.chest ?? 0) === 0, "Przysiad nie dokłada klatce", "Przysiad doliczony do klatki");

  const nieznane = setsByPart("Jakieś wymyślone ćwiczenie xyz", 5);
  check(Object.keys(nieznane).length === 0, "Nierozpoznane ćwiczenie nie zmyśla partii", "Nierozpoznane ćwiczenie coś doliczyło");
}

console.log("\n── Dawniej: 3 treningi na 7 dni ──");
{
  const r = rhythmFrom({ sessions: historia(2, 9), today: TODAY, targetPerWeek: 2.5 });
  check(r.perWeek >= 3 && r.perWeek <= 3.6, `Tempo ${r.perWeek}/tydz. przy treningu co 2 dni`, `Złe tempo: ${r.perWeek}`);
  check(r.sessionsInWindow >= 5, `W oknie ${r.windowDays} dni: ${r.sessionsInWindow} treningów`, `Za mało w oknie: ${r.sessionsInWindow}`);
  check(rhythmVerdict(r).tone === "good", "Werdykt: powyżej celu", `Zły werdykt: ${rhythmVerdict(r).text}`);
}

console.log("\n── Teraz: 2 treningi na 7 dni ──");
{
  const r = rhythmFrom({ sessions: historia(3.5, 8), today: TODAY, targetPerWeek: 2.5 });
  check(r.perWeek >= 1.8 && r.perWeek <= 2.2, `Tempo ${r.perWeek}/tydz. przy treningu co 3,5 dnia`, `Złe tempo: ${r.perWeek}`);
  const v = rhythmVerdict(r);
  check(v.tone === "warn" && v.text.includes("Brakuje"), `Werdykt mówi wprost: „${v.text}"`, `Zły werdykt: ${v.text}`);
}

console.log("\n── Cel: cykl 3 treningów w 10 dni (2,5/tydz.) ──");
{
  // trening co ~2,8 dnia = 3 treningi na 8,4 dnia
  const r = rhythmFrom({ sessions: historia(2.8, 10), today: TODAY, targetPerWeek: 2.5 });
  check(Math.abs(r.perWeek - 2.5) <= 0.4, `Tempo ${r.perWeek}/tydz. — cel trafiony`, `Tempo ${r.perWeek} zamiast ~2,5`);
  check(rhythmVerdict(r).tone === "good", `Werdykt: „${rhythmVerdict(r).text}"`, `Zły werdykt: ${rhythmVerdict(r).text}`);
}

console.log("\n── Okno kroczące nie gubi się na granicy tygodnia ──");
{
  /* Ten sam rytm, ale sesje ułożone tak, że kalendarzowy „ten tydzień" ma
     tylko jeden trening. Licznik tygodniowy pokazałby 1, okno kroczące
     pokazuje prawdę. */
  const sesje: RhythmSession[] = [
    { day: ago(0), workoutName: "Nogi", entries: NOGI },
    { day: ago(4), workoutName: "Góra B", entries: GORA_B },
    { day: ago(7), workoutName: "Góra A", entries: GORA_A },
    { day: ago(10), workoutName: "Nogi", entries: NOGI },
  ];
  const r = rhythmFrom({ sessions: sesje, today: TODAY, targetPerWeek: 2.5 });
  check(r.sessionsInWindow === 3, `W oknie 10 dni widać 3 treningi (kalendarzowy tydzień pokazałby 2)`, `W oknie ${r.sessionsInWindow}`);
  check(r.perWeek === 2.1, `Tempo ${r.perWeek}/tydz.`, `Tempo ${r.perWeek}`);
}

console.log("\n── Rotacja i podpowiedź, co następne ──");
{
  const sesje: RhythmSession[] = [
    { day: ago(1), workoutName: "Góra B", entries: GORA_B },
    { day: ago(4), workoutName: "Góra A", entries: GORA_A },
    { day: ago(7), workoutName: "Nogi", entries: NOGI },
    { day: ago(10), workoutName: "Góra B", entries: GORA_B },
    { day: ago(13), workoutName: "Góra A", entries: GORA_A },
    { day: ago(16), workoutName: "Nogi", entries: NOGI },
  ];
  const r = rhythmFrom({ sessions: sesje, today: TODAY, targetPerWeek: 2.5 });
  check(r.nextWorkout === "Nogi", `Następny w rotacji: ${r.nextWorkout}`, `Zła podpowiedź: ${r.nextWorkout}`);
  check(r.cycleDays !== null && Math.abs(r.cycleDays - 9) <= 1.5, `Pełny cykl zajmuje ${r.cycleDays} dni`, `Zła długość cyklu: ${r.cycleDays}`);
  check(r.avgGap !== null && Math.abs(r.avgGap - 3) <= 0.6, `Średni odstęp ${r.avgGap} dnia`, `Zły odstęp: ${r.avgGap}`);
  check(r.daysSinceLast === 1, "Od ostatniego treningu minął 1 dzień", `daysSinceLast=${r.daysSinceLast}`);
}

console.log("\n── Objętość na partie ──");
{
  const r = rhythmFrom({ sessions: historia(2.8, 10), today: TODAY, targetPerWeek: 2.5 });
  for (const p of r.parts) {
    const t = WEEKLY_TARGET[p.part];
    console.log(`      ${p.part.padEnd(10)} ${String(p.perWeek).padStart(5)} serii/tydz.  (cel ${t.min}-${t.max})  → ${p.status}`);
  }
  const chest = r.parts.find((p) => p.part === "chest")!;
  check(chest.perWeek > 0, `Klatka dostaje ${chest.perWeek} serii/tydz.`, "Klatka bez serii mimo wyciskań");
  check(r.parts.length === PART_ORDER.length, "Wszystkie 7 partii na liście, także te z zerem", "Brakuje partii na liście");
  const core = r.parts.find((p) => p.part === "core")!;
  check(core.status === "low", "Brzuch oznaczony jako niedorobiony — bo w tym planie go nie ma", `Brzuch: ${core.status}`);
}

console.log("\n── Kalendarz ──");
{
  const r = rhythmFrom({ sessions: historia(2.8, 10), today: TODAY, targetPerWeek: 2.5 }, 35);
  check(r.days.length === 35, "Siatka ma 35 dni", `Siatka: ${r.days.length}`);
  check(r.days[r.days.length - 1].day === ago(0), "Ostatnia komórka to dziś", "Zła kolejność dni");
  check(r.days.filter((d) => d.inWindow).length === DEFAULT_WINDOW, `Dokładnie ${DEFAULT_WINDOW} dni oznaczonych jako okno`, "Złe oznaczenie okna");
  const zTreningiem = r.days.filter((d) => d.sessions > 0);
  check(zTreningiem.length > 0 && zTreningiem.every((d) => d.parts.length > 0), "Każdy dzień z treningiem ma przypisane partie", "Dzień z treningiem bez partii");
}

console.log("\n── Kiedy następny ──");
{
  const swiezy = rhythmFrom({ sessions: [{ day: ago(0), workoutName: "Nogi", entries: NOGI }], today: TODAY, targetPerWeek: 2.5 });
  check(nextDueInDays(swiezy)! > 2, `Po dzisiejszym treningu następny za ${nextDueInDays(swiezy)} dnia`, `Zła prognoza: ${nextDueInDays(swiezy)}`);
  const zalegly = rhythmFrom({ sessions: [{ day: ago(6), workoutName: "Nogi", entries: NOGI }], today: TODAY, targetPerWeek: 2.5 });
  check(nextDueInDays(zalegly) === 0, "Po 6 dniach przerwy: trening należy się już dziś", `Zła prognoza: ${nextDueInDays(zalegly)}`);
}

console.log("\n── Brak danych ──");
{
  const r = rhythmFrom({ sessions: [], today: TODAY });
  check(r.perWeek === 0 && r.daysSinceLast === null, "Puste konto nie zmyśla liczb", "Puste konto coś policzyło");
  check(rhythmVerdict(r).tone === "bad", "Werdykt mówi wprost, że nic nie ma", "Zły werdykt dla pustego konta");
  check(r.parts.every((p: { setsInWindow: number }) => p.setsInWindow === 0), "Wszystkie partie na zerze", "Partie z serii znikąd");
}

console.log(fails.length === 0 ? "\nRYTM OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
process.exit(fails.length ? 1 : 0);
