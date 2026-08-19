/**
 * Dociążenie przy ćwiczeniach z masą ciała — na WSZYSTKICH trzech ekranach zapisu.
 *
 * „Dipy" i „Podciąganie podchwytem" to u użytkownika ćwiczenia typu bodyweight.
 * Zapisać serię można na trzy sposoby i każdy ma własny kod pól, więc każdy
 * trzeba sprawdzić osobno:
 *   1. aktywny trening   (ActiveWorkout)
 *   2. szybki zapis      (QuickLog)
 *   3. edycja zapisanego (SessionEdit)
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   node test/bodyweight/all-screens.cjs
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
const NAMES = ["Dipy", "Podciąganie podchwytem"];
const fails = [];
const check = (c, ok, bad) => { if (c) console.log("  OK  " + ok); else { console.log("  BLAD " + bad); fails.push(bad); } };

(async () => {
  const { chromium } = await import("playwright");
  const email = `bw2_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const sess = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];
  const get = async (q) => (await (await fetch(SB + "/rest/v1/" + q, { headers: H })).json());

  // Trening z DWOMA ćwiczeniami z masą ciała + historia bez dociążenia,
  // czyli dokładnie sytuacja użytkownika.
  const wk = await post("wn_workouts", { user_id: u.id, name: "Plecy", position: 0 });
  const exs = {};
  for (let i = 0; i < NAMES.length; i++) {
    exs[NAMES[i]] = await post("wn_exercises", { user_id: u.id, name: NAMES[i], kind: "bodyweight", unit: "kg" });
    await post("wn_workout_exercises", { workout_id: wk.id, exercise_id: exs[NAMES[i]].id, position: i });
  }
  const past = await post("wn_sessions", { user_id: u.id, workout_id: wk.id, started_at: "2026-07-01T12:00:00Z", finished_at: "2026-07-01T13:00:00Z" });
  for (const n of NAMES) for (let i = 0; i < 3; i++)
    await post("wn_sets", { session_id: past.id, exercise_id: exs[n].id, set_index: i, weight_kg: null, reps: 10 - i });

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

  const tap = async (id, ms = 1600) => {
    for (let i = 0; i < 14; i++) {
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
  const goForma = async () => {
    await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);
    await tap("forma-open-journal", 2000);
  };
  /** Ile kart ćwiczeń ma pole dociążenia „+kg". */
  const plusKgCards = (sel) => page.evaluate((s) => {
    const cards = [...document.querySelectorAll(s)];
    return cards.map((c) => ({
      name: (c.textContent || "").trim().slice(0, 26),
      hasPlusKg: [...c.querySelectorAll("input")].some((i) => i.getAttribute("placeholder") === "+kg"),
      inputs: c.querySelectorAll("input").length,
    }));
  }, sel);

  // ── 1. AKTYWNY TRENING ──
  console.log("\n-- 1. Aktywny trening --");
  await goForma();
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=workout-card]")?.click());
    await page.waitForTimeout(700);
    if (await page.evaluate(() => (document.body.textContent || "").includes("Zakończ trening"))) break;
  }
  await page.waitForTimeout(1500);
  const aw = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("input").forEach((i) => out.push(i.getAttribute("placeholder")));
    return out.filter(Boolean);
  });
  await page.screenshot({ path: (process.argv[2] || ".") + "/bw-aktywny.png" });
  const awPlus = aw.filter((x) => x === "+kg").length;
  const awReps = aw.filter((x) => x === "powt.").length;
  check(awPlus >= 2 && awReps >= 2,
    `Oba ćwiczenia mają pole „+kg" i „powt." (kg: ${awPlus}, powt.: ${awReps})`,
    `Brakuje pól — kg: ${awPlus}, powt.: ${awReps}`);

  // zapisujemy dociążenie dla OBU ćwiczeń
  const rowsSel = 'input[placeholder="+kg"]';
  const repsSel = 'input[placeholder="powt."]';
  const nW = await page.locator(rowsSel).count();
  for (const idx of [0, Math.max(1, Math.floor(nW / 2))]) {
    await page.locator(rowsSel).nth(idx).click();
    await page.locator(rowsSel).nth(idx).fill("15");
    await page.locator(repsSel).nth(idx).click();
    await page.locator(repsSel).nth(idx).fill("6");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1400);
  }
  await page.waitForTimeout(2000);
  for (const n of NAMES) {
    const withW = await get(`wn_sets?exercise_id=eq.${exs[n].id}&weight_kg=gt.0&select=weight_kg,reps`);
    check(withW.length > 0, `„${n}" — dociążenie zapisane (${JSON.stringify(withW[0] || null)})`, `„${n}" — ciężar NIE trafił do bazy`);
  }

  // ── 2. SZYBKI ZAPIS ──
  console.log("\n-- 2. Szybki zapis --");
  await goForma();
  await tap("workout-quick-log", 1800);
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=ql-workout]")?.click());
    await page.waitForTimeout(700);
    if (await page.evaluate(() => document.querySelectorAll("[data-testid=ql-exercise]").length > 0)) break;
  }
  await page.waitForTimeout(1200);
  const ql = await plusKgCards("[data-testid=ql-exercise]");
  check(ql.length >= 2, `Widać ${ql.length} ćwiczeń w szybkim zapisie`, `Tylko ${ql.length} ćwiczeń`);
  for (const c of ql) {
    check(c.inputs >= 2, `„${c.name}" — pola ciężaru i powtórzeń obecne (${c.inputs} pola)`, `„${c.name}" — tylko ${c.inputs} pole`);
  }

  // ── 3. EDYCJA ZAPISANEGO TRENINGU ──
  console.log("\n-- 3. Edycja zapisanego treningu --");
  await goForma();
  await tap("workout-history-btn", 2000);
  await tap("wh-session", 2200);
  const onEdit = await page.evaluate(() => !!document.querySelector("[data-testid=session-edit]"));
  check(onEdit, "Otwarto edycję zapisanego treningu", "Nie otwarto edycji");
  if (onEdit) {
    const se = await plusKgCards("[data-testid=se-exercise]");
    check(se.length >= 2, `Widać ${se.length} ćwiczeń w edycji`, `Tylko ${se.length} ćwiczeń`);
    for (const c of se) {
      check(c.inputs >= 2, `„${c.name}" — pola ciężaru i powtórzeń obecne (${c.inputs} pola)`, `„${c.name}" — tylko ${c.inputs} pole`);
    }
  }

  check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));
  await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  await br.close();
  console.log(fails.length === 0 ? "\nWSZYSTKIE EKRANY OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
