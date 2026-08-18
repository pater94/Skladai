/**
 * Prostowanie etykiety sfotografowanej bokiem — test MECHANIKI, bez AI.
 *
 * Odpowiedzi /api/analyze są podstawiane, więc test nie kosztuje ani grosza
 * i nie zależy od tego, czy model akurat odczyta tabelę. Sprawdza dokładnie
 * to, co jest w naszym kodzie:
 *   1. gdy pierwsza odpowiedź mówi „nie odczytałem etykiety" — apka ponawia,
 *   2. ponawia z OBRÓCONYM zdjęciem (inne wymiary, nie ten sam bajt w bajt),
 *   3. gdy obrócone się uda — użytkownik widzi wynik, nie komunikat o porażce,
 *   4. gdy etykieta czytelna od razu — NIE ma żadnego dodatkowego wywołania.
 *
 * Uruchomienie: PORT=3760 npx tsx test/scanner/rotate.ts
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const PORT = process.env.PORT || "3760";

const fails: string[] = [];
const check = (cond: boolean, good: string, wrong: string) => {
  if (cond) { console.log("  OK  " + good); return; }
  console.log("  BLAD " + wrong);
  fails.push(wrong);
};

/** Odpowiedź „nie widzę etykiety" — dokładnie taka, jaką zwraca tryb makro. */
const UNREADABLE = {
  type: "food", name: "Gotowe danie", brand: null, weight: "300 g",
  label_unreadable: true, verdict_short: "Brak etykiety",
  verdict: "Nie udało się odczytać tabeli wartości odżywczych z tego zdjęcia.",
  score: null, ingredients: [], allergens: [], pros: [], cons: [], fun_comparisons: [],
  nutrition: [
    { label: "Energia", value: "brak danych", icon: "⚡" },
    { label: "Tłuszcz", value: "brak danych", icon: "🫧" },
    { label: "Węglowodany", value: "brak danych", icon: "🍞" },
    { label: "Białko", value: "brak danych", icon: "💪" },
    { label: "Sól", value: "brak danych", icon: "🧂" },
  ],
  sugar_teaspoons: 0,
};

const READABLE = {
  type: "food", name: "Gotowe danie à la Gyros", brand: "Hortex", weight: "450 g",
  label_unreadable: false, verdict_short: "Przyzwoity skład", verdict: "Wartości odczytane z etykiety.",
  score: 7, ingredients: [], allergens: [], pros: [], cons: [], fun_comparisons: [],
  nutrition: [
    { label: "Energia", value: "76 kcal", icon: "⚡" },
    { label: "Tłuszcz", value: "0,2 g", icon: "🫧" },
    { label: "Węglowodany", value: "11,6 g", icon: "🍞" },
    { label: "Białko", value: "1,8 g", icon: "💪" },
    { label: "Sól", value: "0,4 g", icon: "🧂" },
  ],
  sugar_teaspoons: 1,
};

/** Zdjęcie testowe: prostokąt 1200×1600, żeby obrót zmienił wymiary. */
async function makePhoto(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: { width: 1200, height: 1600, channels: 3, background: { r: 240, g: 238, b: 232 } },
  }).jpeg({ quality: 80 }).toBuffer();
}

async function main() {
  const { chromium } = await import("playwright");
  const sharp = (await import("sharp")).default;
  const browser = await chromium.launch();

  try {
    const photo = await makePhoto();
    const file = "/tmp/rot-test.jpg";
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, photo);

    /** Jeden przebieg: zwraca wymiary zdjęć wysłanych w kolejnych wywołaniach. */
    const run = async (replies: object[]) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      const sent: Array<{ w: number; h: number }> = [];
      await page.addInitScript(() => {
        localStorage.setItem("onboardingCompleted", "true");
        localStorage.setItem("agent_coachmark_seen", "true");
        localStorage.setItem("micTooltipShown", "1");
      });
      await page.route("**/api/analyze", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}");
        const buf = Buffer.from(String(body.image).split(",")[1], "base64");
        const meta = await sharp(buf).metadata();
        sent.push({ w: meta.width ?? 0, h: meta.height ?? 0 });
        const reply = replies[Math.min(sent.length - 1, replies.length - 1)];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
      });
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2600);
      const inputs = await page.$$('input[type="file"]:not([capture])');
      if (!inputs.length) throw new Error("brak inputa zdjęcia");
      await inputs[0].setInputFiles(file);
      await page.waitForTimeout(9000);
      const url = page.url();
      const txt = await page.evaluate(() => document.body.textContent ?? "");
      await ctx.close();
      return { sent, url, txt };
    };

    console.log("\n-- Etykieta bokiem: pierwsze podejście nie czyta, obrócone czyta --");
    const a = await run([UNREADABLE, READABLE]);
    check(a.sent.length >= 2,
      `Apka ponowiła skan (wywołań: ${a.sent.length})`,
      `Brak ponowienia — wywołań: ${a.sent.length}`);
    if (a.sent.length >= 2) {
      const [first, second] = a.sent;
      check(second.w === first.h && second.h === first.w,
        `Ponowienie poszło z WYPROSTOWANYM zdjęciem (${first.w}×${first.h} → ${second.w}×${second.h})`,
        `Ponowienie nie obróciło zdjęcia (${first.w}×${first.h} → ${second.w}×${second.h})`);
    }
    check(/wyniki/.test(a.url) || /76 kcal|Gyros/.test(a.txt),
      "Użytkownik dostał wynik, a nie komunikat o porażce",
      "Mimo udanego ponowienia user nie zobaczył wyniku");

    console.log("\n-- Etykieta czytelna od razu: ZERO dodatkowych wywołań --");
    const b = await run([READABLE]);
    check(b.sent.length === 1,
      "Jedno wywołanie — nie marnujemy pieniędzy na zbędne ponowienia",
      `Niepotrzebne ponowienia: ${b.sent.length} wywołań`);

    console.log("\n-- Etykieta nieczytelna w KAŻDEJ orientacji: uczciwy komunikat --");
    const c = await run([UNREADABLE]);
    check(c.sent.length <= 3,
      `Ponawianie ma twardy limit (wywołań: ${c.sent.length})`,
      `Ponawianie bez limitu: ${c.sent.length} wywołań`);
    check(/Brak etykiety|Nie udało się odczytać|Zrób ostrzejsze/i.test(c.txt) || /wyniki/.test(c.url),
      "Po wyczerpaniu prób user widzi jasny komunikat",
      "Brak czytelnego komunikatu po nieudanych próbach");
  } catch (e) {
    check(false, "", "WYJATEK: " + (e as Error).message);
  } finally {
    await browser.close();
    console.log(fails.length === 0 ? "\nPROSTOWANIE OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
    process.exit(fails.length === 0 ? 0 : 1);
  }
}

void main();
