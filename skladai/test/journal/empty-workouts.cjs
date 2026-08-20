/**
 * Puste treningi nie mają zaśmiecać listy.
 *
 * „+ Nowy trening" zakłada wiersz od razu przy kliknięciu, więc wycofanie się
 * bez wpisania czegokolwiek zostawiało kartę „Nowy trening · 0 ćwiczeń", która
 * wyglądała jak zdublowany przycisk. Test pilnuje dwóch rzeczy:
 *   1. trening bez ćwiczeń i bez serii NIE pojawia się na liście,
 *   2. trening z realną treścią pojawia się zawsze.
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   node test/journal/empty-workouts.cjs
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
  const email = `ew_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const sess = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];

  // 1. trening kompletnie pusty (tak wygląda śmieć po „+ Nowy trening")
  await post("wn_workouts", { user_id: u.id, name: "Nowy trening", position: 0 });
  // 2. pusty, ale z osieroconą sesją bez serii — też śmieć
  const pusty2 = await post("wn_workouts", { user_id: u.id, name: "Pusty z sesją", position: 1 });
  await post("wn_sessions", { user_id: u.id, workout_id: pusty2.id, started_at: "2026-08-01T12:00:00Z", finished_at: "2026-08-01T13:00:00Z" });
  // 3. trening z realną treścią — MUSI zostać widoczny
  const realny = await post("wn_workouts", { user_id: u.id, name: "Góra A", position: 2 });
  const ex = await post("wn_exercises", { user_id: u.id, name: "Wyciskanie sztangi leżąc", kind: "weighted", unit: "kg" });
  await post("wn_workout_exercises", { workout_id: realny.id, exercise_id: ex.id, position: 0 });
  const s1 = await post("wn_sessions", { user_id: u.id, workout_id: realny.id, started_at: "2026-08-10T12:00:00Z", finished_at: "2026-08-10T13:00:00Z" });
  await post("wn_sets", { session_id: s1.id, exercise_id: ex.id, set_index: 0, weight_kg: 100, reps: 5 });
  // 4. trening z ćwiczeniami, ale jeszcze bez ani jednej serii — świeżo ułożony plan, ma być widoczny
  const plan = await post("wn_workouts", { user_id: u.id, name: "Plan na przyszły tydzień", position: 3 });
  await post("wn_workout_exercises", { workout_id: plan.id, exercise_id: ex.id, position: 0 });

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
  await page.waitForTimeout(2200);

  const names = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=workout-card]")].map((c) => (c.textContent || "").trim().slice(0, 24)));
  console.log("      na liście:", JSON.stringify(names));

  const has = (frag) => names.some((n) => n.includes(frag));
  check(!has("Nowy trening"), "Pusty „Nowy trening” zniknął z listy", "Pusty „Nowy trening” nadal na liście");
  check(!has("Pusty z sesją"), "Pusty trening z sesją bez serii też zniknął", "Pusty trening z sesją nadal widoczny");
  check(has("Góra A"), "Trening z seriami jest widoczny", "Zniknął trening z realną treścią!");
  check(has("Plan na przyszły"), "Ułożony plan (ćwiczenia, zero serii) jest widoczny", "Zniknął świeżo ułożony plan!");
  check(names.length === 2, `Na liście dokładnie 2 treningi`, `Na liście ${names.length} treningów`);

  // Dane zostają w bazie — ukrywamy widok, nie kasujemy dorobku
  const all = await (await fetch(SB + `/rest/v1/wn_workouts?user_id=eq.${u.id}&select=id`, { headers: H })).json();
  check(all.length === 4, "Wszystkie 4 wiersze nadal w bazie (nic nie skasowano)", `W bazie ${all.length} z 4 treningów`);

  check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));
  await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  await br.close();
  console.log(fails.length === 0 ? "\nPUSTE TRENINGI OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
