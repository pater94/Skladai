/**
 * Kolejność ćwiczeń w zapisanym treningu.
 *
 * Odtwarza dokładnie sytuację z bazy Patryka: serie zostały wpisane w INNEJ
 * kolejności niż plan (bo tak się wpisuje — najpierw to, co się pamięta, potem
 * dopisuje resztę). Wcześniej podsumowanie sortowało ćwiczenia po czasie
 * wpisania, a ekran edycji po `set_index`, który numeruje serie WEWNĄTRZ
 * ćwiczenia — przez co po otwarciu daty kolejność była praktycznie losowa.
 *
 * Test pilnuje jednej zasady: wszędzie obowiązuje kolejność Z PLANU.
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   node test/journal/order.cjs
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

/** Plan treningu — dokładnie w tej kolejności ma się wszędzie wyświetlać. */
const PLAN = [
  "Wyciskanie sztangi płaskie",
  "Podciąganie chwytem neutralnym",
  "Wyciskanie żołnierskie",
  "Wznosy bokiem hantlami",
  "Facepull",
];
/** Kolejność WPISYWANIA serii — celowo pomieszana względem planu. */
const WPISYWANIE = [2, 0, 4, 1, 3];

(async () => {
  const { chromium } = await import("playwright");
  const email = `ord_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const sess = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];

  const w = await post("wn_workouts", { user_id: u.id, name: "Góra B", position: 0 });
  const exIds = [];
  for (let i = 0; i < PLAN.length; i++) {
    const e = await post("wn_exercises", { user_id: u.id, name: PLAN[i], kind: "weighted", unit: "kg" });
    exIds.push(e.id);
    await post("wn_workout_exercises", { workout_id: w.id, exercise_id: e.id, position: i });
  }

  const day = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const s = await post("wn_sessions", { user_id: u.id, workout_id: w.id, started_at: `${day}T12:00:00Z`, finished_at: `${day}T13:20:00Z` });
  // Serie wpisywane w pomieszanej kolejności, z rosnącym created_at.
  let t = Date.parse(`${day}T12:00:00Z`);
  for (const planIdx of WPISYWANIE) {
    for (let si = 0; si < 3; si++) {
      t += 60000;
      await post("wn_sets", {
        session_id: s.id, exercise_id: exIds[planIdx], set_index: si,
        weight_kg: 60 + planIdx * 5, reps: 8, created_at: new Date(t).toISOString(),
      });
    }
  }
  console.log(`      plan:       ${PLAN.join(" → ")}`);
  console.log(`      wpisywanie: ${WPISYWANIE.map((i) => PLAN[i]).join(" → ")}`);

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

  await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=forma-open-journal]")?.click());
    await page.waitForTimeout(600);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=workout-card]"))) break;
  }
  await page.waitForTimeout(1800);

  console.log("\n── Data na karcie treningu ──");
  const cardText = await page.evaluate(() => (document.querySelector("[data-testid=workout-card]")?.textContent || "").trim());
  const expectDay = new Date(day + "T12:00:00Z").toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  check(cardText.includes(expectDay), `Karta pokazuje datę „${expectDay}"`, `Brak daty na karcie: „${cardText.slice(0, 70)}"`);

  console.log("\n── Kolejność w historii i edycji ──");
  await page.evaluate(() => document.querySelector("[data-testid=workout-history-btn]")?.click());
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.querySelector("[data-testid=wh-session]")?.click());
  await page.waitForTimeout(2200);

  // Nazwa ćwiczenia to pierwszy div w karcie — nie input (tam siedzi ciężar).
  const editOrder = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=se-exercise]")]
      .map((el) => (el.querySelector("div > div")?.textContent || "").trim().replace(/×$/, "")));
  console.log("      edycja:", JSON.stringify(editOrder));
  const editMatches = PLAN.every((name, i) => editOrder[i] === name);
  check(editOrder.length === PLAN.length && editMatches,
    "Ekran edycji układa ćwiczenia dokładnie jak plan",
    `Edycja pomieszana: ${JSON.stringify(editOrder)}`);

  /* Drugi, niezależny dowód: ciężar był ustawiony jako 60 + pozycja w planie,
     więc poprawna kolejność musi dać ciąg rosnący co 5 kg. */
  const weights = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=se-exercise]")]
      .map((el) => Number(el.querySelector("input")?.value || 0)));
  console.log("      ciężary:", JSON.stringify(weights));
  check(weights.every((w, i) => w === 60 + i * 5),
    "Ciężary układają się 60→65→70→75→80, czyli dokładnie wg planu",
    `Ciężary poza kolejnością planu: ${JSON.stringify(weights)}`);

  check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));
  await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  await br.close();
  console.log(fails.length === 0 ? "\nKOLEJNOSC OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
