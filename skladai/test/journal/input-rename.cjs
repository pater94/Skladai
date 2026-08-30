/**
 * Trzy zgłoszenia z jednego dnia, sprawdzone w prawdziwej przeglądarce:
 *   1. nie dało się wpisać przecinka w ciężarze (tylko „+" po 2,5 kg),
 *   2. przy polach nie było widać, co jest kilogramem, a co powtórzeniem,
 *   3. nie dało się zmienić nazwy ćwiczenia po jego utworzeniu.
 *
 * Test pisze znak po znaku — bo błąd objawiał się dopiero w trakcie
 * pisania, a nie przy ustawianiu wartości z kodu.
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   node test/journal/input-rename.cjs
 */
/* eslint-disable @typescript-eslint/no-require-imports -- skrypt CommonJS uruchamiany node-em */
const fs = require("fs");
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = SB.replace("https://", "").split(".")[0], KEY = `sb-${REF}-auth-token`;
const H = { apikey: SVC, Authorization: "Bearer " + SVC, "content-type": "application/json" };
const PORT = process.env.PORT || "3760";
const fails = [];
const check = (c, ok, bad) => { if (c) console.log("  OK  " + ok); else { console.log("  BLAD " + bad); fails.push(bad); } };

(async () => {
  const { chromium } = await import("playwright");
  const email = `inp_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const sess = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];

  const w = await post("wn_workouts", { user_id: u.id, name: "Góra A", position: 0 });
  const ex = await post("wn_exercises", { user_id: u.id, name: "Wyciskanie sztangi płaskie", kind: "weighted", unit: "kg" });
  await post("wn_workout_exercises", { workout_id: w.id, exercise_id: ex.id, position: 0 });
  const day = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const s0 = await post("wn_sessions", { user_id: u.id, workout_id: w.id, started_at: `${day}T12:00:00Z`, finished_at: `${day}T13:00:00Z` });
  for (let i = 0; i < 3; i++) await post("wn_sets", { session_id: s0.id, exercise_id: ex.id, set_index: i, weight_kg: 80, reps: 8 });

  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));
  await page.addInitScript(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.setItem("onboardingCompleted", "true");
    localStorage.setItem("agent_coachmark_seen", "true");
    localStorage.setItem("skladai_profile", JSON.stringify({ id: "u", mode: "fitness", mode_explicitly_chosen: true, gender: "male", weight_kg: 80, height_cm: 180, age: 30, health: { conditions: [], allergens: [] } }));
  }, [KEY, JSON.stringify(sess)]);

  const doDziennika = async () => {
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => document.querySelector("[data-testid=forma-open-journal]")?.click());
      await page.waitForTimeout(600);
      if (await page.evaluate(() => !!document.querySelector("[data-testid=workout-card]"))) return;
    }
  };

  await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await doDziennika();
  await page.waitForTimeout(1200);

  console.log("\n── Przecinek w ciężarze (szybki zapis) ──");
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=workout-quick-log]")?.click());
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=ql-workout]"))) break;
  }
  await page.evaluate(() => document.querySelector("[data-testid=ql-workout]")?.click());
  await page.waitForTimeout(2000);

  const pole = page.locator('input[aria-label="ciężar"]').first();
  await pole.click();
  await pole.fill("");
  // Znak po znaku — dokładnie tak, jak wpisuje człowiek.
  for (const znak of ["8", "2", ",", "5"]) {
    await pole.type(znak, { delay: 60 });
  }
  const wpisane = await pole.inputValue();
  check(wpisane === "82,5", `Po wpisaniu 8-2-,-5 w polu jest „${wpisane}"`, `W polu jest „${wpisane}" zamiast „82,5"`);

  await pole.blur();
  await page.waitForTimeout(400);
  const poWyjsciu = await pole.inputValue();
  check(poWyjsciu === "82,5", `Po wyjściu z pola wartość została: „${poWyjsciu}"`, `Po wyjściu z pola: „${poWyjsciu}"`);

  // Druga wartość, której nie da się osiągnąć przyciskiem „+" (krok 2,5 kg)
  await pole.fill("");
  for (const znak of ["2", ",", "2", "5"]) await pole.type(znak, { delay: 60 });
  check(await pole.inputValue() === "2,25", "Da się wpisać 2,25 — wartość nieosiągalna przyciskiem +", `Wyszło „${await pole.inputValue()}"`);

  console.log("\n── Jednostki przy polach ──");
  const jednostki = await page.evaluate(() => {
    const row = document.querySelector('input[aria-label="ciężar"]')?.closest("div")?.parentElement;
    return (row?.textContent || "").trim();
  });
  check(jednostki.includes("kg") && jednostki.includes("powt."),
    `Widać jednostki przy polach: „${jednostki.replace(/\s+/g, " ").slice(0, 60)}"`,
    `Brak jednostek w wierszu serii: „${jednostki.slice(0, 60)}"`);

  console.log("\n── Zapis wartości dziesiętnej do bazy ──");
  await pole.fill("");
  for (const znak of ["8", "2", ",", "5"]) await pole.type(znak, { delay: 50 });
  await pole.blur();
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector("[data-testid=ql-save]")?.click());
  await page.waitForTimeout(3500);

  const sesje = await (await fetch(SB + `/rest/v1/wn_sessions?user_id=eq.${u.id}&select=id&order=created_at.desc`, { headers: H })).json();
  const nowa = sesje.find((x) => x.id !== s0.id);
  const sety = nowa ? await (await fetch(SB + `/rest/v1/wn_sets?session_id=eq.${nowa.id}&select=weight_kg&order=set_index.asc`, { headers: H })).json() : [];
  check(sety.length > 0 && Number(sety[0].weight_kg) === 82.5,
    `W bazie zapisało się ${sety[0] && sety[0].weight_kg} kg`,
    `W bazie: ${JSON.stringify(sety.slice(0, 2))}`);

  console.log("\n── Zmiana nazwy ćwiczenia ──");
  await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await doDziennika();
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector("[data-testid=workout-card]")?.click());
  await page.waitForTimeout(2600);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll("button, [role=button]")]
        .find((b) => (b.textContent || "").includes("Wyciskanie sztangi płaskie"));
      el?.click();
    });
    await page.waitForTimeout(600);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=eh-rename-open]"))) break;
  }

  const maRename = await page.evaluate(() => !!document.querySelector("[data-testid=eh-rename-open]"));
  check(maRename, "Na ekranie ćwiczenia jest przycisk „Zmień nazwę”", "Brak przycisku zmiany nazwy");

  if (maRename) {
    await page.evaluate(() => document.querySelector("[data-testid=eh-rename-open]")?.click());
    await page.waitForTimeout(600);
    const input = page.locator("[data-testid=eh-rename-input]");
    await input.fill("Wyciskanie sztangi płaskie — Xtreme Kraków");
    await page.evaluate(() => document.querySelector("[data-testid=eh-rename-save]")?.click());
    await page.waitForTimeout(2500);

    const wBazie = await (await fetch(SB + `/rest/v1/wn_exercises?id=eq.${ex.id}&select=name`, { headers: H })).json();
    check(wBazie[0] && wBazie[0].name === "Wyciskanie sztangi płaskie — Xtreme Kraków",
      `Nazwa zmieniona na „${wBazie[0] && wBazie[0].name}"`,
      `Nazwa w bazie: „${wBazie[0] && wBazie[0].name}"`);

    const serie = await (await fetch(SB + `/rest/v1/wn_sets?exercise_id=eq.${ex.id}&select=id`, { headers: H })).json();
    check(serie.length >= 3, `Historia nietknięta — ${serie.length} serii nadal przypisanych`, `Po zmianie nazwy zostało ${serie.length} serii`);
  }

  check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));
  await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  await br.close();
  console.log(fails.length === 0 ? "\nPOLA I NAZWY OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
