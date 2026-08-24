/**
 * Nazwy ćwiczeń — odporność na przestawienie słów.
 *
 * W bazie Patryka leżały obok siebie „Podciąganie chwytem neutralnym"
 * (10 serii) i „Podciąganie neutralnym chwytem" (4 serie) jako DWA osobne
 * ćwiczenia. Skutki były dwa i oba dotkliwe: ten sam trening pojawił się na
 * liście dwa razy, a progres i rekordy życiowe liczyły się osobno dla każdej
 * wersji nazwy. Ten test pilnuje, żeby katalog nie przyjmował już bliźniaków.
 *
 * Uruchomienie:  npx tsx test/journal/names.ts
 */
import { exerciseKey } from "../../lib/workoutJournal";

const fails: string[] = [];
const check = (c: boolean, ok: string, bad: string) => {
  if (c) { console.log("  OK  " + ok); return; }
  console.log("  BLAD " + bad);
  fails.push(bad);
};

const pary: Array<[string, string, boolean]> = [
  // to samo ćwiczenie
  ["Podciąganie chwytem neutralnym", "Podciąganie neutralnym chwytem", true],
  ["Wyciskanie sztangi płaskie", "wyciskanie  SZTANGI  płaskie", true],
  ["Wyciskanie żołnierskie (OHP)", "OHP wyciskanie żołnierskie", true],
  ["Uginanie rąk na biceps", "uginanie na biceps rąk", true],
  ["Facepull", "facepull", true],
  // ĆWICZENIA RÓŻNE — tych nie wolno skleić
  ["Wznosy boczne", "Wznosy bokiem hantlami", false],
  ["Uginanie rąk ze sztangą", "Uginanie rąk z hantlami", false],
  ["Wyciskanie sztangi płaskie", "Wyciskanie sztangi skośne", false],
  ["Podciąganie podchwytem", "Podciąganie nachwytem", false],
  ["Uginanie nóg leżąc", "Uginanie nóg siedząc", false],
];

console.log("\n── Sklejanie bliźniaczych nazw ──");
for (const [a, b, same] of pary) {
  const eq = exerciseKey(a) === exerciseKey(b);
  check(eq === same,
    `„${a}" ${same ? "=" : "≠"} „${b}"`,
    `Złe dopasowanie: „${a}" vs „${b}" (${eq ? "sklejone" : "rozdzielone"}, a miało być ${same ? "sklejone" : "rozdzielone"})`);
}

console.log("\n── Klucz jest stabilny ──");
check(exerciseKey("Dipy") === exerciseKey("  dipy  "), "Spacje na brzegach nie mają znaczenia", "Spacje psują klucz");
check(exerciseKey("") === "", "Pusta nazwa daje pusty klucz", "Pusta nazwa daje śmieć");
check(exerciseKey("Łydki — stojąc") === exerciseKey("stojąc łydki"), "Myślniki i ogonki nie mają znaczenia", "Znaki przestankowe psują klucz");

console.log(fails.length === 0 ? "\nNAZWY OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
process.exit(fails.length ? 1 : 0);
