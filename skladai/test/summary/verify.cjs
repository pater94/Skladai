/**
 * Podsumowanie treningu — udostępnianie jako OBRAZ, nie suchy tekst.
 *
 * Ta ścieżka psuje się po cichu: gdy zrzut karty zawiedzie, kod spada do
 * wersji tekstowej, a użytkownik dowiaduje się o tym dopiero od odbiorcy.
 * Dlatego test podstawia navigator.share i sprawdza, CO naprawdę zostało
 * przekazane — plik PNG czy string. Zapisuje też wygenerowany obraz na dysk,
 * żeby dało się go obejrzeć.
 *
 * Uruchomienie (serwer produkcyjny musi działać):
 *   node test/summary/verify.cjs [katalog-na-zrzuty]
 */
/* eslint-disable @typescript-eslint/no-require-imports -- skrypt CommonJS uruchamiany node-em, nie część bundla */
const fs = require("fs");
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = SB.replace("https://", "").split(".")[0], KEY = `sb-${REF}-auth-token`;
const H = { apikey: SVC, Authorization: "Bearer " + SVC, "content-type": "application/json" };
const S = process.argv[2] || require("node:os").tmpdir();
const PORT = process.env.PORT || "3760";
const fails = [];
const check = (c, ok, bad) => { if (c) console.log("  OK  " + ok); else { console.log("  BLAD " + bad); fails.push(bad); } };

// 9 ćwiczeń — więcej niż mieści się w karcie, żeby sprawdzić czy obraz nie ucina
const PLAN = [
  ["Wyciskanie na ławce", [[127.5, 5], [127.5, 5], [125, 5]]],
  ["Wiosłowanie na maszynie", [[90, 12], [90, 11], [90, 10]]],
  ["Wyciskanie żołnierskie", [[62.5, 6], [62.5, 8], [62.5, 7]]],
  ["Wznosy bokiem hantlami", [[16, 14], [16, 13], [16, 12]]],
  ["Triceps — wyciąg zza głowy", [[36.3, 5], [34, 7], [34, 8]]],
  ["Facepull", [[13.5, 14], [13.5, 13], [13.5, 12]]],
  ["Uginanie młotkowe", [[18, 28], [18, 26], [18, 26]]],
  ["Przysiad ze sztangą", [[140, 5], [140, 5], [140, 4]]],
  ["Martwy ciąg", [[180, 3], [180, 3], [170, 5]]],
  ["Podciąganie na drążku", [[0, 10], [0, 9], [0, 8]]],
  ["Uginanie nóg", [[55, 12], [55, 11], [55, 10]]],
  ["Prostowanie nóg", [[70, 15], [70, 14], [70, 12]]],
  ["Wypychanie nogami", [[220, 12], [220, 10], [200, 12]]],
  ["Brzuch — allahy", [[0, 20], [0, 18], [0, 16]]],
];

(async () => {
  const { chromium } = await import("playwright");
  const email = `s2_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const sess = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];

  const wk = await post("wn_workouts", { user_id: u.id, name: "Góra A", position: 0 });
  const ses = await post("wn_sessions", { user_id: u.id, workout_id: wk.id, started_at: "2026-08-16T12:00:00Z", finished_at: "2026-08-16T13:30:00Z" });
  for (let i = 0; i < PLAN.length; i++) {
    const [name, sets] = PLAN[i];
    const ex = await post("wn_exercises", { user_id: u.id, name, kind: "weighted", unit: "kg" });
    await post("wn_workout_exercises", { workout_id: wk.id, exercise_id: ex.id, position: i });
    for (let k = 0; k < sets.length; k++)
      await post("wn_sets", { session_id: ses.id, exercise_id: ex.id, set_index: k, weight_kg: sets[k][0], reps: sets[k][1] });
  }

  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await page.addInitScript(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.setItem("onboardingCompleted", "true");
    localStorage.setItem("agent_coachmark_seen", "true");
    localStorage.setItem("skladai_profile", JSON.stringify({ id: "u", mode: "fitness", mode_explicitly_chosen: true, gender: "male", weight_kg: 80, height_cm: 180, age: 30, health: { conditions: [], allergens: [] } }));
  }, [KEY, JSON.stringify(sess)]);

  await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=forma-open-journal]")?.click());
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=workout-card]"))) break;
  }
  /*
     Ścieżka do podsumowania zmieniła się: nie ma już gołej ikony obok karty
     treningu (nikt nie wiedział, co robi). Teraz idzie się przez podpisany
     pasek „Wszystkie zapisy i podsumowania", a potem klika konkretny dzień.
  */
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=workout-history-btn]")?.click());
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=wh-summary]"))) break;
  }
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => document.querySelector("[data-testid=wh-summary]")?.click());
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.querySelector("[data-testid=workout-summary]"))) break;
  }
  await page.waitForTimeout(2200);

  const on = await page.evaluate(() => !!document.querySelector("[data-testid=workout-summary]"));
  check(on, "Podsumowanie otwarte", "Nie otwarto podsumowania");
  if (!on) { await br.close(); process.exit(1); }

  // ── kolumna TOP ──
  const t = await page.evaluate(() => {
    const card = document.querySelector("[data-testid=summary-card]");
    const head = card.querySelectorAll("span");
    return {
      headTxt: [...head].map((x) => (x.textContent || "").trim()).filter(Boolean).slice(0, 6),
      hasTop: /\bTOP\b/i.test(card.textContent || ""),
      rows: card.querySelectorAll("[data-testid=summary-list] > div").length,
    };
  });
  check(!t.hasTop, "Kolumna TOP zniknęła z podsumowania", `Nadal jest TOP: ${t.headTxt.join(" | ")}`);
  check(t.rows === PLAN.length, `Wszystkie ${PLAN.length} ćwiczeń w liście`, `W liście ${t.rows} z ${PLAN.length} ćwiczeń`);

  // ── udostępnianie obrazem: przechwytujemy plik przekazany do navigator.share ──
  await page.evaluate(() => {
    window.__shared = null;
    navigator.share = async (data) => {
      const f = data.files && data.files[0];
      if (f) {
        const buf = await f.arrayBuffer();
        let bin = ""; const b = new Uint8Array(buf);
        for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
        window.__sharedB64 = btoa(bin);
        window.__shared = { name: f.name, type: f.type, size: f.size };
      } else {
        window.__shared = { text: data.text || "" };
      }
    };
    navigator.canShare = () => true;
  });
  await page.evaluate(() => document.querySelector("[data-testid=summary-share]").click());
  await page.waitForFunction(() => window.__shared !== null, undefined, { timeout: 60000 }).catch(() => {});
  const shared = await page.evaluate(() => window.__shared);
  check(!!shared && !!shared.type, "Udostępnianie przekazuje PLIK, nie tekst", `Przekazano: ${JSON.stringify(shared)}`);
  if (shared && shared.type) {
    check(shared.type === "image/png", `Typ pliku: ${shared.type}`, `Zły typ: ${shared.type}`);
    check(shared.size > 20000, `Obraz ma sensowny rozmiar (${Math.round(shared.size / 1024)} KB)`, `Obraz podejrzanie mały: ${shared.size} B`);
    check(/gora-a/.test(shared.name) && /2026-08-16/.test(shared.name), `Nazwa pliku z treningu i daty: ${shared.name}`, `Nazwa: ${shared.name}`);
  }

  // ── czy obraz zawiera KOMPLET ćwiczeń (karta rozwinięta na czas zrzutu) ──
  const capt = await page.evaluate(async () => {
    const node = document.querySelector("[data-testid=summary-card]");
    const listBefore = node.querySelector("[data-testid=summary-list]");
    const clipped = listBefore.scrollHeight - listBefore.clientHeight;
    return { clippedNormally: clipped };
  });
  check(capt.clippedNormally > 0, `Na ekranie lista jest przycięta o ${capt.clippedNormally}px — obraz musi to obejść`, "Lista i tak się mieści, test nie sprawdza obejścia");

  // po udostępnieniu karta wraca do normalnego trybu
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const list = document.querySelector("[data-testid=summary-list]");
    return { overflow: getComputedStyle(list).overflowY, pageScroll: (() => { const sc = document.querySelector("#scroll-container"); return sc.scrollHeight - sc.clientHeight; })() };
  });
  check(after.overflow === "auto", "Po udostępnieniu karta wraca do normalnego widoku", `overflowY = ${after.overflow}`);
  check(after.pageScroll <= 1, "Strona nadal się nie przewija", `Strona przewija się o ${after.pageScroll}px`);

  // zapisujemy OBRAZ, który realnie poszedł do udostępnienia
  const b64 = await page.evaluate(() => window.__sharedB64 || null);
  if (b64) { require("fs").writeFileSync(S + "/udostepniony.png", Buffer.from(b64, "base64")); console.log("      obraz zapisany: udostepniony.png"); }
  await page.screenshot({ path: S + "/sum-notop.png" });
  check(errs.length === 0, "Zero błędów JS", "Błędy JS: " + errs.join(" | "));

  await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  await br.close();
  console.log(fails.length === 0 ? "\nOK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
