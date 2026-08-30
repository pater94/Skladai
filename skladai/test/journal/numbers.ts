/**
 * Pola liczbowe: przecinek, kropka i wartości dziesiętne.
 *
 * Zgłoszenie: „nie da się wpisać przecinka w liczbie w ciężarze podczas
 * zapisu, da się robić tylko połówki klikając +". Przyczyna: pole było
 * sterowane LICZBĄ, więc „82," dawało parseFloat = 82 i przecinek znikał w
 * tej samej klatce. Do 82,5 nie dało się dojść z klawiatury w ogóle.
 *
 * Ten test sprawdza brudnopis znak po znaku — tak, jak wpisuje człowiek.
 *
 * Uruchomienie:  npx tsx test/journal/numbers.ts
 */
import { parseDecimal, formatDecimal } from "../../lib/forma/numericDraft";

const fails: string[] = [];
const check = (c: boolean, ok: string, bad: string) => {
  if (c) { console.log("  OK  " + ok); return; }
  console.log("  BLAD " + bad);
  fails.push(bad);
};

console.log("\n── Wpisywanie znak po znaku: „82,5” ──");
{
  /* Odgrywamy dokładnie to, co robi palec: 8 → 82 → 82, → 82,5.
     Kluczowy jest trzeci krok — wcześniej to on się cofał. */
  const kroki: Array<[string, number | null]> = [
    ["8", 8],
    ["82", 82],
    ["82,", 82],     // stan przejściowy MUSI być dozwolony
    ["82,5", 82.5],
  ];
  for (const [tekst, oczekiwana] of kroki) {
    const n = parseDecimal(tekst);
    check(n === oczekiwana, `„${tekst}" → ${n}`, `„${tekst}" dało ${n}, a miało ${oczekiwana}`);
  }
}

console.log("\n── Kropka działa tak samo jak przecinek ──");
{
  check(parseDecimal("82.5") === 82.5, "„82.5” → 82,5", `„82.5" → ${parseDecimal("82.5")}`);
  check(parseDecimal("82.") === 82, "„82.” → 82", `„82." → ${parseDecimal("82.")}`);
}

console.log("\n── Realne ciężary z siłowni ──");
{
  const realne: Array<[string, number]> = [
    ["2,25", 2.25],    // najmniejszy talerzyk ułamkowy
    ["7,5", 7.5],
    ["17,5", 17.5],
    ["36,3", 36.3],    // stos na wyciągu w funtach przeliczony na kg
    ["127,5", 127.5],
    ["180", 180],
  ];
  for (const [t, v] of realne) {
    check(parseDecimal(t) === v, `„${t}" → ${v}`, `„${t}" dało ${parseDecimal(t)}`);
  }
}

console.log("\n── Śmieci i przypadki brzegowe ──");
{
  check(parseDecimal("") === null, "Puste pole → brak wartości, nie zero", "Puste pole dało liczbę");
  check(parseDecimal(",") === null, "Sam przecinek → brak wartości", "Sam przecinek dał liczbę");
  check(parseDecimal("-5") === null, "Ujemny ciężar odrzucony", "Ujemny ciężar przeszedł");
  check(parseDecimal("abc") === null, "Tekst odrzucony", "Tekst dał liczbę");
  check(parseDecimal("82,555") === 82.56, "Trzecie miejsce po przecinku zaokrąglone", `„82,555" → ${parseDecimal("82,555")}`);
}

console.log("\n── Wyświetlanie po polsku ──");
{
  check(formatDecimal(82.5) === "82,5", "82,5 pokazuje się z przecinkiem", `Pokazało: ${formatDecimal(82.5)}`);
  check(formatDecimal(80) === "80", "Liczba całkowita bez zbędnego „,0”", `Pokazało: ${formatDecimal(80)}`);
  check(formatDecimal(null) === "", "Brak wartości → puste pole", `Pokazało: „${formatDecimal(null)}"`);
  check(formatDecimal(2.25) === "2,25", "2,25 pokazuje się w całości", `Pokazało: ${formatDecimal(2.25)}`);
}

console.log("\n── Pełna pętla: wpisz → zapisz → pokaż ──");
{
  for (const wpisane of ["82,5", "2,25", "127,5"]) {
    const zapisane = parseDecimal(wpisane);
    const pokazane = formatDecimal(zapisane);
    check(pokazane === wpisane, `„${wpisane}" wraca jako „${pokazane}"`, `„${wpisane}" wróciło jako „${pokazane}"`);
  }
}

console.log(fails.length === 0 ? "\nLICZBY OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
process.exit(fails.length ? 1 : 0);
