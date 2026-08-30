/**
 * Ćwiczenia z masą ciała + DOCIĄŻENIE (dipy, podciąganie z pasem).
 *
 * Do tej pory ćwiczenie oznaczone jako „bodyweight" w ogóle nie miało pola
 * ciężaru — nie dało się zapisać 20 kg na pasie. Test sprawdza całą ścieżkę:
 * czy pole jest, czy zapis trafia do bazy i czy progres przestaje być liczony
 * powtórzeniami, gdy pojawi się ciężar.
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   node test/bodyweight/verify.cjs
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
  const email = `bw_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const sess = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];
  const get = async (q) => (await (await fetch(SB + "/rest/v1/" + q, { headers: H })).json());

  // Dipy jako ćwiczenie z masą ciała + historia BEZ dociążenia
  const wk = await post("wn_workouts", { user_id: u.id, name: "Klata", position: 0 });
  const dipy = await post("wn_exercises", { user_id: u.id, name: "Dipy", kind: "bodyweight", unit: "kg" });
  await post("wn_workout_exercises", { workout_id: wk.id, exercise_id: dipy.id, position: 0 });
  const old = await post("wn_sessions", { user_id: u.id, workout_id: wk.id, started_at: "2026-07-01T12:00:00Z", finished_at: "2026-07-01T13:00:00Z" });
  for (let i = 0; i < 3; i++) await post("wn_sets", { session_id: old.id, exercise_id: dipy.id, set_index: i, weight_kg: null, reps: 12 - i });

  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await page.addInitScript(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.setItem("onboardingCompleted", "true");
    localStorage.setItem("agent_coachmark_seen", "true");
    localStorage.setItem("skladai_profile", JSON.stringify({ id: "u", mode: "fitness", mode_explicitly_chosen: true, gender: "male", weight_kg: 80, height_cm: 180, age: 30, health: { conditions: [], allergens: [] } }));
  }, [KEY, JSON.stringify(sess)]);

  const tap = async (id, ms = 1800) => {
    for (let i = 0; i < 12; i++) {
      const gone = await page.evaluate((x) => {
        const el = document.querySelector(`[data-testid=${x}]`);
        if (!el) return true;
        el.click(); return false;
      }, id);
      await page.waitForTimeout(i === 0 ? ms : 450);
      if (gone) return;
      if (!(await page.evaluate((x) => !!document.querySelector(`[data-testid=${x}]`), id))) return;
    }
  };

  await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await tap("forma-open-journal", 2200);
  await page.evaluate(() => document.querySelector("[data-testid=workout-card]")?.click());
  await page.waitForTimeout(3200);

  // ── pole ciężaru MUSI być, mimo że ćwiczenie jest „z masą ciała" ──
  /* Po dodaniu stałych jednostek obok pól podpowiedź „powt." zniknęła —
     etykieta dostępności jest teraz jedynym trwałym opisem pola. */
  const f = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("input")].map((i) => i.getAttribute("aria-label")).filter(Boolean);
    const units = [...document.querySelectorAll("label span")].map((s) => (s.textContent || "").trim());
    return { labels: labels.slice(0, 8), units: [...new Set(units)].slice(0, 6) };
  });
  check(f.labels.some((l) => /ciężar/i.test(l)), `Jest pole dociążenia (${f.labels.join(", ")})`, `Brak pola ciężaru: ${f.labels.join(", ")}`);
  check(f.labels.some((l) => /powtórze/i.test(l)), "Jest pole powtórzeń", `Brak pola powtórzeń: ${f.labels.join(", ")}`);
  check(f.units.includes("kg") && f.units.includes("powt."),
    `Jednostki widoczne przy polach (${f.units.join(", ")})`,
    `Brak jednostek przy polach: ${f.units.join(", ")}`);

  // ── wpisujemy 20 kg × 8 i zapisujemy ──
  // PRAWDZIWE wpisywanie: commit leci na onBlur, a React słucha focusout —
  // sztucznie wysłany event "blur" nie bąbelkuje i nigdy by go nie wywołał.
  const wSel = 'input[aria-label="dodatkowy ciężar w kg"], input[aria-label="dodatkowy ciężar"]';
  const rSel = 'input[aria-label="liczba powtórzeń"], input[aria-label="powtórzenia"]';
  await page.locator(wSel).first().click();
  await page.locator(wSel).first().fill("20");
  await page.locator(rSel).first().click();     // blur na polu ciężaru
  await page.locator(rSel).first().fill("8");
  await page.keyboard.press("Tab");             // blur na polu powtórzeń
  await page.waitForTimeout(3200);

  const rows = await get(`wn_sets?exercise_id=eq.${dipy.id}&weight_kg=gt.0&select=weight_kg,reps`);
  check(rows.length > 0, `Dociążenie zapisane w bazie: ${JSON.stringify(rows[0] || null)}`, "Ciężar NIE trafił do bazy");
  if (rows.length) {
    check(Number(rows[0].weight_kg) === 20, "Zapisano dociążenie 20 kg", `Zapisano: ${JSON.stringify(rows[0])}`);
  }

  // ── progres przestaje być liczony powtórzeniami, gdy pojawi się ciężar ──
  // Historia liczy tylko UKOŃCZONE sesje, więc domykamy bieżącą (to element
  // przygotowania, nie przedmiot testu) i wchodzimy w historię ćwiczenia.
  const open = await get(`wn_sessions?workout_id=eq.${wk.id}&finished_at=is.null&select=id`);
  for (const o of open) {
    await fetch(SB + `/rest/v1/wn_sessions?id=eq.${o.id}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ finished_at: new Date().toISOString() }),
    });
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await tap("forma-open-journal", 2200);
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=workout-card]")?.click());
    await page.waitForTimeout(800);
    if (await page.evaluate(() => (document.body.textContent || "").includes("Zakończ trening"))) break;
  }
  await page.waitForTimeout(1500);
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "Dipy");
      b?.click();
    });
    await page.waitForTimeout(900);
    if (await page.evaluate(() => /Rekord/.test(document.body.textContent || ""))) break;
  }
  await page.waitForTimeout(2500);
  const dbg = await page.evaluate(() => ({
    ids: [...document.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid")).slice(0, 14),
    btns: [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 12),
  }));
  console.log("      widok:", JSON.stringify(dbg));
  const hist = await page.evaluate(() => (document.body.textContent || "").replace(/\s+/g, " "));
  check(/Rekord\s*20\s*kg|20\s*kg/.test(hist),
    "Historia ćwiczenia liczy rekord w KILOGRAMACH po dociążeniu",
    `Brak „20 kg" w historii. Fragment: ${hist.slice(0, 220)}`);
  check(/Szac\. 1RM|1RM/.test(hist),
    "Pojawia się szacowany 1RM (ma sens dopiero z ciężarem)",
    "Brak 1RM mimo dociążenia");

  check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));
  await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  await br.close();
  console.log(fails.length === 0 ? "\nDOCIAZENIE OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
