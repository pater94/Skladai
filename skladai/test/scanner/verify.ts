/**
 * Weryfikacja skanera ŻYWNOŚCI i DANIA — pełna ścieżka, prawdziwe zdjęcia.
 *
 * Nie testuje samego endpointu w oderwaniu: wrzuca zdjęcie do tego samego
 * inputa, którego używa aplikacja, i sprawdza, co użytkownik realnie zobaczy
 * na ekranie. Zdjęcia bierze z historii skanów (scan_logs), więc są to
 * dokładnie te same warunki co w praktyce — a nie wyidealizowany obrazek.
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   PORT=3760 npx tsx test/scanner/verify.ts
 *
 * UWAGA: każdy przebieg to prawdziwe (płatne) wywołania Claude Vision.
 */
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PORT = process.env.PORT || "3760";
const REF = SB.replace("https://", "").split(".")[0];
const STORAGE_KEY = `sb-${REF}-auth-token`;
const admin = () => ({ apikey: SVC, Authorization: `Bearer ${SVC}` });

const fails: string[] = [];
/** Zdjęcia rozpoznane w pełni i te, na których AI uczciwie powiedziało „nie widzę". */
const recognised: string[] = [];
const softFails: string[] = [];
const check = (cond: boolean, good: string, wrong: string) => {
  if (cond) { console.log("  OK  " + good); return; }
  console.log("  BLAD " + wrong);
  fails.push(wrong);
};

interface ScanRow { id: string; mode: string; product_name: string | null; image_url: string | null; created_at: string }

async function main() {
  const { chromium } = await import("playwright");
  let uid: string | null = null;

  try {
    // ── zdjęcia z prawdziwej historii skanów ──
    // Odcinamy dzisiejsze wpisy: ten test sam loguje skany do scan_logs,
    // więc bez tego kolejny przebieg testowałby własne wyniki.
    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const rows = (await (await fetch(
      `${SB}/rest/v1/scan_logs?select=id,mode,product_name,image_url,created_at&image_url=not.is.null&created_at=lt.${cutoff}&order=created_at.desc&limit=400`,
      { headers: admin() },
    )).json()) as ScanRow[];

    const pick = (mode: string, n: number) => rows.filter((r) => r.mode === mode).slice(0, n);
    const cases = [...pick("food", 3), ...pick("meal", 2)];
    check(cases.length >= 2, `Znaleziono ${cases.length} zdjęć testowych w historii`, "Brak zdjęć w historii skanów");
    if (!cases.length) throw new Error("brak zdjęć do testu");

    // ── user testowy (skan loguje się do chmury) ──
    const email = `scan_${Date.now()}@skladai-test.dev`;
    const pass = `Test123!${Date.now()}`;
    const u = await (await fetch(`${SB}/auth/v1/admin/users`, {
      method: "POST", headers: { ...admin(), "content-type": "application/json" },
      body: JSON.stringify({ email, password: pass, email_confirm: true }),
    })).json();
    uid = u.id;
    const sess = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    })).json();

    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push("PAGEERR: " + e.message.slice(0, 160)));
    const apiCalls: Array<{ status: number; url: string }> = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/analyze")) apiCalls.push({ status: r.status(), url: r.url() });
    });

    await page.addInitScript(([key, val]: string[]) => {
      localStorage.setItem(key, val);
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem("agent_coachmark_seen", "true");
      localStorage.setItem("micTooltipShown", "1");
      localStorage.setItem("skladai_profile", JSON.stringify({
        id: "u", mode: "fitness", mode_explicitly_chosen: true,
        gender: "male", weight_kg: 80, height_cm: 180, age: 30,
        health: { conditions: [], allergens: [] },
      }));
    }, [STORAGE_KEY, JSON.stringify(sess)]);

    for (const c of cases) {
      const label = `${c.mode.toUpperCase()} — ${c.product_name ?? "bez nazwy"}`;
      console.log(`\n-- ${label} --`);

      const img = Buffer.from(await (await fetch(c.image_url!)).arrayBuffer());
      const file = join(tmpdir(), `scan_${c.id}.jpg`);
      writeFileSync(file, img);

      const before = apiCalls.length;
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // tryb DANIE wymaga przełączenia zakładki na ekranie skanera
      if (c.mode === "meal") {
        const switched = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")]
            .find((x) => /^\s*(🍽️)?\s*Danie\s*$/i.test((x.textContent ?? "").trim()));
          if (!b) return false;
          (b as HTMLElement).click();
          return true;
        });
        check(switched, "Przełączono tryb na „Danie”", "Nie znaleziono przełącznika trybu „Danie”");
        await page.waitForTimeout(900);
      }

      // wrzucamy zdjęcie do tego samego inputa, którego używa galeria w apce
      const inputs = await page.$$('input[type="file"]:not([capture])');
      check(inputs.length > 0, `Input zdjęcia dostępny (${inputs.length})`, "Brak inputa zdjęcia na ekranie skanera");
      if (!inputs.length) continue;
      // Odpowiedź AI potrafi iść długo — nasłuchujemy JEJ, a nie zgadujemy po tekście.
      const waitApi = page.waitForResponse(
        (r) => r.url().includes("/api/analyze"),
        { timeout: 180_000 },
      ).catch(() => null);

      await inputs[0].setInputFiles(file);
      await page.waitForTimeout(1800);

      // Jeśli ekran poprosi o potwierdzenie (podgląd zdjęcia) — klikamy.
      // Na stronie głównej podgląd jest wyłączony (showPhotoPreview = false),
      // więc skan zwykle startuje od razu.
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")]
          .find((x) => /^\s*🔬?\s*Analizuj/i.test((x.textContent ?? "").trim()));
        (b as HTMLElement | undefined)?.click();
      });

      const resp = await waitApi;
      check(!!resp, "Poszło wywołanie /api/analyze", "Brak wywołania /api/analyze — skan się nie odpalił");
      if (resp) check(resp.status() === 200, "API odpowiedziało 200", `API zwróciło ${resp.status()}`);
      void before;

      // po odpowiedzi UI musi jeszcze wyrenderować wynik
      await page.waitForFunction(
        () => !/Rozpoznaję|Analizuję|Skanuję|Sprawdzam|Czytam etykietę/i.test(document.body.textContent ?? ""),
        undefined,
        { timeout: 60_000 },
      ).catch(() => {});
      await page.waitForTimeout(2500);

      const txt = await page.evaluate(() => document.body.textContent ?? "");

      // AWARIA to co innego niż „na tym zdjęciu nie widać etykiety".
      // Pierwsze jest błędem aplikacji, drugie — uczciwą odpowiedzią dla
      // użytkownika, o ile prowadzi go za rękę, co zrobić dalej.
      // Wąsko i konkretnie: markery AWARII, nie zwykłe słowa z opisu produktu.
      // (Wcześniejsze /undefined|NaN/ łapało m.in. „baNANa" — czyli nic.)
      const crash = txt.match(/Brak klucza API|Wystąpił błąd|Coś poszło nie tak|Application error|Server Error|Internal Server Error|TypeError|is not a function/i);
      check(!crash, "Brak awarii aplikacji", `Ekran pokazuje awarię: „${crash?.[0]}”`);

      const softFail = /Brak etykiety|Nie udało się odczytać|Nie rozpoznano/i.test(txt);
      if (softFail) {
        softFails.push(label);
        check(/Zrób ostrzejsze zdjęcie|Spróbuj|CO TERAZ/i.test(txt),
          "Nie rozpoznano — ale ekran mówi WPROST, co zrobić dalej",
          "Nie rozpoznano i brak podpowiedzi, co dalej");
      } else if (c.mode === "meal") {
        recognised.push(label);
        check(/kcal/i.test(txt), "Widać kalorie dania", "Brak kalorii w wyniku dania");
        check(/Białko|Bialko/i.test(txt) && /Węglowodany|Weglowodany/i.test(txt),
          "Widać makroskładniki (białko, węglowodany)", "Brak makroskładników w wyniku dania");
      } else {
        recognised.push(label);
        check(/Skład|Składniki|Ocena|\/10/i.test(txt),
          "Widać skład / ocenę produktu", "Brak składu ani oceny w wyniku produktu");
      }

      const shot = join(tmpdir(), `scan_result_${c.mode}_${c.id}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      console.log("      zrzut: " + shot);
    }

    check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));
    await browser.close();
  } catch (e) {
    check(false, "", "WYJATEK: " + (e as Error).message);
  } finally {
    if (uid) await fetch(`${SB}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: admin() }).catch(() => {});
    console.log(fails.length === 0 ? "\nSKANER OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
    process.exit(fails.length === 0 ? 0 : 1);
  }
}

void main();
