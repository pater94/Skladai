/**
 * Nieudany zapis nie może zniknąć bez śladu.
 *
 * 29.08.2026 trening zapisany szybkim zapisem NIE dotarł do bazy i nie
 * zostało po nim nic — ani wiersza w bazie, ani kopii na urządzeniu. Ten
 * test odgrywa awarię sieci w trakcie zapisu i sprawdza trzy rzeczy:
 *   1. treść zostaje na urządzeniu i da się ją dosłać,
 *   2. w bazie nie zostaje pusta sesja udająca trening,
 *   3. użytkownik widzi, że coś czeka na wysłanie.
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   node test/journal/pending.cjs
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
  const email = `pend_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const sess = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];

  // Trening z historią, żeby szybki zapis miał co podstawić
  const w = await post("wn_workouts", { user_id: u.id, name: "Góra A", position: 0 });
  const ex = await post("wn_exercises", { user_id: u.id, name: "Wyciskanie sztangi płaskie", kind: "weighted", unit: "kg" });
  await post("wn_workout_exercises", { workout_id: w.id, exercise_id: ex.id, position: 0 });
  const day = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
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

  await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=forma-open-journal]")?.click());
    await page.waitForTimeout(600);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=workout-card]"))) break;
  }
  await page.waitForTimeout(1400);

  console.log("\n── Awaria sieci w trakcie zapisu ──");
  // Blokujemy WYŁĄCZNIE zapis serii — sesja przejdzie, serie nie.
  await page.route("**/rest/v1/wn_sets*", (route) =>
    route.request().method() === "POST" ? route.abort("failed") : route.continue());

  const otworzSzybkiZapis = async () => {
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => document.querySelector("[data-testid=workout-quick-log]")?.click());
      await page.waitForTimeout(500);
      if (await page.evaluate(() => !!document.querySelector("[data-testid=ql-workout]") || !!document.querySelector("[data-testid=ql-pending]"))) break;
    }
  };
  await otworzSzybkiZapis();
  // Wybór treningu — dopiero wtedy pojawia się przycisk zapisu.
  await page.evaluate(() => document.querySelector("[data-testid=ql-workout]")?.click());
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector("[data-testid=ql-save]")?.click());
  await page.waitForTimeout(3500);

  const sesje = await (await fetch(SB + `/rest/v1/wn_sessions?user_id=eq.${u.id}&select=id`, { headers: H })).json();
  check(sesje.length === 1,
    "W bazie nie została pusta sesja udająca trening",
    `Została sesja-widmo: ${sesje.length} sesji zamiast 1`);

  const zapamietane = await page.evaluate(() => localStorage.getItem("wn_pending_log"));
  check(!!zapamietane && zapamietane.includes("exercises"),
    "Treść treningu zachowana na urządzeniu",
    "Nieudany zapis przepadł bez śladu");

  console.log("\n── Powrót do szybkiego zapisu ──");
  await page.unroute("**/rest/v1/wn_sets*");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=forma-open-journal]")?.click());
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=workout-card]"))) break;
  }
  await otworzSzybkiZapis();
  await page.waitForTimeout(1200);

  const widac = await page.evaluate(() => !!document.querySelector("[data-testid=ql-pending]"));
  check(widac, "Aplikacja mówi wprost: masz trening, który się nie zapisał", "Brak informacji o niezapisanym treningu");

  if (widac) {
    await page.evaluate(() => document.querySelector("[data-testid=ql-pending-retry]")?.click());
    await page.waitForTimeout(3500);
    const sesje2 = await (await fetch(SB + `/rest/v1/wn_sessions?user_id=eq.${u.id}&select=id`, { headers: H })).json();
    const sety = await (await fetch(SB + `/rest/v1/wn_sets?session_id=eq.${(sesje2.find((x) => x.id !== s0.id) || {}).id}&select=id`, { headers: H })).json();
    check(sesje2.length === 2 && sety.length > 0,
      `Ponowienie dosłało trening (${sety.length} serii)`,
      `Ponowienie nie zapisało: sesji=${sesje2.length}, serii=${sety.length}`);
    const po = await page.evaluate(() => localStorage.getItem("wn_pending_log"));
    check(!po, "Kopia lokalna skasowana po udanym zapisie", "Kopia lokalna została mimo zapisu");
  }

  check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));
  await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  await br.close();
  console.log(fails.length === 0 ? "\nZAPIS AWARYJNY OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
