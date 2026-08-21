/**
 * FORMA RPG — test na ŻYWEJ bazie (po migracji 20260819_game.sql).
 *
 * Reguły punktacji sprawdza test/game/rules.ts. Ten plik pilnuje czegoś
 * innego i ważniejszego: czy baza faktycznie broni rankingu przed
 * oszustwem. Ranking jest publiczny, więc ktoś spróbuje wpisać sobie XP
 * z konsoli przeglądarki — tu odgrywam dokładnie ten atak.
 *
 * Wymaga: uruchomionego serwera (PORT, domyślnie 3760) i .env.local.
 *   node test/game/live.cjs
 */
/* eslint-disable @typescript-eslint/no-require-imports -- skrypt CommonJS uruchamiany node-em */
const fs = require("fs");
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = process.env.PORT || "3760";
const H = { apikey: SVC, Authorization: "Bearer " + SVC, "content-type": "application/json" };
const fails = [];
const check = (c, ok, bad) => { if (c) console.log("  OK  " + ok); else { console.log("  BLAD " + bad); fails.push(bad); } };

const asUser = (tok) => ({ apikey: ANON, Authorization: "Bearer " + tok, "content-type": "application/json" });

async function makeUser(tag) {
  const email = `gm_${tag}_${Date.now()}@skladai-test.dev`, pass = `Test123!${Date.now()}`;
  const u = await (await fetch(SB + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pass, email_confirm: true }) })).json();
  const s = await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: pass }) })).json();
  return { id: u.id, token: s.access_token };
}
const post = async (t, b) => (await (await fetch(SB + "/rest/v1/" + t, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(b) })).json())[0];

(async () => {
  console.log("\n── Przygotowanie: dwóch użytkowników, jeden trenuje ──");
  const ofiara = await makeUser("a"), napastnik = await makeUser("b");
  const ex = await post("wn_exercises", { user_id: ofiara.id, name: "Przysiad ze sztangą", kind: "weighted", unit: "kg" });
  const w = await post("wn_workouts", { user_id: ofiara.id, name: "Dół A", position: 0 });
  await post("wn_workout_exercises", { workout_id: w.id, exercise_id: ex.id, position: 0 });
  // trzy dni treningowe w ostatnim tygodniu
  for (let d = 1; d <= 3; d++) {
    const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const s = await post("wn_sessions", { user_id: ofiara.id, workout_id: w.id, started_at: `${day}T12:00:00Z`, finished_at: `${day}T13:10:00Z` });
    for (let i = 0; i < 5; i++) await post("wn_sets", { session_id: s.id, exercise_id: ex.id, set_index: i, weight_kg: 100, reps: 6 });
  }
  console.log("      3 dni × 5 serii × 100 kg × 6 powt.");

  console.log("\n── Serwer liczy XP ──");
  const syncRes = await fetch(`http://localhost:${PORT}/api/game/sync`, { method: "POST", headers: { Authorization: "Bearer " + ofiara.token } });
  const syncBody = await syncRes.json().catch(() => ({}));
  // API oddaje pełny profil pod kluczem `profile` — XP i poziom czytamy stamtąd.
  const sync = syncBody.profile ?? {};
  check(syncRes.status === 200, `/api/game/sync odpowiada 200`, `/api/game/sync -> ${syncRes.status} ${JSON.stringify(syncBody).slice(0, 160)}`);
  check((sync.xp ?? 0) > 0, `Naliczone XP: ${sync.xp} (poziom ${sync.level})`, `Zero XP mimo trzech treningów: ${JSON.stringify(syncBody).slice(0, 160)}`);

  console.log("\n── Idempotencja: ponowne przeliczenie nie dopisuje XP ──");
  await fetch(`http://localhost:${PORT}/api/game/sync`, { method: "POST", headers: { Authorization: "Bearer " + ofiara.token } });
  const drugi = (await (await fetch(`http://localhost:${PORT}/api/game/sync`, { method: "POST", headers: { Authorization: "Bearer " + ofiara.token } })).json()).profile ?? {};
  check(drugi.xp === sync.xp, `Trzy synchronizacje = to samo XP (${sync.xp})`, `XP rośnie przy samym odświeżaniu: ${sync.xp} → ${drugi.xp}`);

  console.log("\n── Atak: wpisanie sobie XP z przeglądarki ──");
  const podnies = await fetch(SB + `/rest/v1/gm_profiles?user_id=eq.${ofiara.id}`, {
    method: "PATCH", headers: asUser(ofiara.token), body: JSON.stringify({ xp: 999999, level: 99 }),
  });
  const poAtaku = await (await fetch(SB + `/rest/v1/gm_profiles?user_id=eq.${ofiara.id}&select=xp,level`, { headers: H })).json();
  check(poAtaku[0].xp === sync.xp && poAtaku[0].level === sync.level,
    `Podbicie XP odrzucone (HTTP ${podnies.status}); w bazie nadal ${poAtaku[0].xp} XP, poziom ${poAtaku[0].level}`,
    `OSZUSTWO PRZESZŁO: w bazie ${poAtaku[0].xp} XP, poziom ${poAtaku[0].level}`);

  console.log("\n── Zmiana nicku (jedyne, co wolno klientowi) ──");
  const nick = "Bezimienny" + Date.now().toString().slice(-5);
  const nr = await fetch(SB + `/rest/v1/gm_profiles?user_id=eq.${ofiara.id}`, { method: "PATCH", headers: asUser(ofiara.token), body: JSON.stringify({ nick }) });
  const poNicku = await (await fetch(SB + `/rest/v1/gm_profiles?user_id=eq.${ofiara.id}&select=nick,xp`, { headers: H })).json();
  check(poNicku[0].nick === nick, `Nick ustawiony na „${nick}"`, `Nick się nie zapisał (HTTP ${nr.status})`);
  check(poNicku[0].xp === sync.xp, "Zmiana nicku nie ruszyła XP", "Zmiana nicku zepsuła XP");

  console.log("\n── Prywatność: cudzy profil ──");
  const podglad = await (await fetch(SB + `/rest/v1/gm_profiles?user_id=eq.${ofiara.id}&select=*`, { headers: asUser(napastnik.token) })).json();
  check(Array.isArray(podglad) && podglad.length === 0, "Obcy nie widzi cudzego profilu", `Wyciek profilu: ${JSON.stringify(podglad).slice(0, 120)}`);
  const podmiana = await fetch(SB + `/rest/v1/gm_profiles?user_id=eq.${ofiara.id}`, { method: "PATCH", headers: asUser(napastnik.token), body: JSON.stringify({ nick: "przejete" }) });
  const poPodmianie = await (await fetch(SB + `/rest/v1/gm_profiles?user_id=eq.${ofiara.id}&select=nick`, { headers: H })).json();
  check(poPodmianie[0].nick === nick, `Obcy nie podmienił cudzego nicku (HTTP ${podmiana.status})`, "Obcy podmienił cudzy nick!");

  console.log("\n── Ranking: co jest publiczne ──");
  const rank = await (await fetch(SB + "/rest/v1/gm_ranking?select=*&order=xp.desc&limit=20", { headers: { apikey: ANON, Authorization: "Bearer " + ANON } })).json();
  const ja = rank.find((r) => r.nick === nick);
  check(!!ja, "Po ustawieniu nicku jestem w rankingu", "Nick ustawiony, a w rankingu mnie nie ma");
  check(!!ja && !("user_id" in ja) && !("last_training" in ja) && !("synced_at" in ja),
    "Ranking nie zdradza user_id ani dat treningów", `Ranking wystawia za dużo: ${Object.keys(ja || {}).join(",")}`);
  const bezNicku = rank.some((r) => r.nick === null);
  check(!bezNicku, "Profile bez nicku nie trafiają do rankingu", "Profil bez nicku widoczny w rankingu");
  const zapisRank = await fetch(SB + "/rest/v1/gm_ranking", { method: "POST", headers: asUser(ofiara.token), body: JSON.stringify({ nick: "hack", level: 99, xp: 99999 }) });
  check(zapisRank.status >= 400, `Zapis do rankingu zablokowany (HTTP ${zapisRank.status})`, "Da się pisać do widoku rankingu!");

  console.log("\n── Dziennik XP ──");
  const log = await (await fetch(SB + `/rest/v1/gm_xp_log?user_id=eq.${ofiara.id}&select=day,source,amount&order=day.desc`, { headers: asUser(ofiara.token) })).json();
  check(Array.isArray(log) && log.length > 0, `Widzę własny dziennik XP (${log.length} wpisów) — pełna przejrzystość`, "Dziennik XP niedostępny dla właściciela");
  const suma = log.reduce((a, r) => a + r.amount, 0);
  check(suma === sync.xp, `Suma wpisów w dzienniku = XP profilu (${suma})`, `Rozjazd: dziennik ${suma}, profil ${sync.xp}`);
  const dopisz = await fetch(SB + "/rest/v1/gm_xp_log", { method: "POST", headers: asUser(ofiara.token), body: JSON.stringify({ user_id: ofiara.id, day: "2026-08-20", source: "session", amount: 99999 }) });
  check(dopisz.status >= 400, `Dopisanie sobie XP do dziennika zablokowane (HTTP ${dopisz.status})`, "Da się dopisać XP do dziennika!");

  console.log("\n── Kto wpisuje codziennie, nie wygrywa z trenującym ──");
  /*
    Najgroźniejsze oszustwo nie polega na zawyżaniu ciężarów (objętość i tak
    się nasyca), tylko na wpisywaniu zmyślonego treningu KAŻDEGO dnia.
    Tu siedzą obok siebie: uczciwy z czterema treningami w tygodniu i ktoś,
    kto „trenował" siedem dni z siedmiu.
  */
  const uczciwy = await makeUser("u"), codzienny = await makeUser("c");
  async function zasiej(user, dni) {
    const e = await post("wn_exercises", { user_id: user.id, name: "Wyciskanie sztangi leżąc", kind: "weighted", unit: "kg" });
    const wo = await post("wn_workouts", { user_id: user.id, name: "Trening", position: 0 });
    await post("wn_workout_exercises", { workout_id: wo.id, exercise_id: e.id, position: 0 });
    for (const d of dni) {
      const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const se = await post("wn_sessions", { user_id: user.id, workout_id: wo.id, started_at: `${day}T12:00:00Z`, finished_at: `${day}T13:00:00Z` });
      for (let i = 0; i < 20; i++) await post("wn_sets", { session_id: se.id, exercise_id: e.id, set_index: i, weight_kg: 80, reps: 6 });
    }
  }
  const zawziety = await makeUser("z");
  await zasiej(uczciwy, [1, 2, 4, 6]);                 // 4 dni w tygodniu
  await zasiej(zawziety, [0, 1, 2, 3, 4, 6]);          // 6 dni — uczciwy zapaleniec
  await zasiej(codzienny, [0, 1, 2, 3, 4, 5, 6]);      // 7 dni z 7 — wpisywacz
  const xpOf = async (u) => ((await (await fetch(`http://localhost:${PORT}/api/game/sync`, { method: "POST", headers: { Authorization: "Bearer " + u.token } })).json()).profile ?? {}).xp ?? 0;
  const xpU = await xpOf(uczciwy), xpZ = await xpOf(zawziety), xpC = await xpOf(codzienny);
  const dniPlatne = await (await fetch(SB + `/rest/v1/gm_xp_log?user_id=eq.${codzienny.id}&source=eq.session&select=day`, { headers: H })).json();
  check(dniPlatne.length === 5, `Z siedmiu „treningów" zapłaciło ${dniPlatne.length} (limit 5 z 7)`, `Zapłaciło ${dniPlatne.length} dni zamiast 5`);

  /*
     To jest gwarancja, która naprawdę coś znaczy. Wpisywacza NIE DA SIĘ
     odróżnić od kogoś, kto uczciwie trenuje sześć razy w tygodniu — żadne
     dane, jakie mamy, tego nie rozstrzygną. Wymagamy więc, żeby najlepsze,
     co osiągnie codziennym zmyślaniem, było na poziomie takiego zapaleńca.
  */
  check(xpC / Math.max(1, xpZ) <= 1.10,
    `Wpisywacz nie przebija uczciwego zapaleńca 6×/tydz. (${(xpC / xpZ).toFixed(2)}×, ${xpC} vs ${xpZ})`,
    `Wpisywacz bije zapaleńca: ${(xpC / xpZ).toFixed(2)}×`);

  /*
     Wobec trenującego cztery razy zostaje przewaga rzędu 1,4× i ona jest
     UPRAWNIONA: to różnica między pięcioma a czterema płatnymi dniami, czyli
     dokładnie to, co ranking ma mierzyć. Próg pilnuje, żeby nie urosła.
  */
  check(xpC / Math.max(1, xpU) < 1.45,
    `Wobec trenującego 4×/tydz. przewaga to ${(xpC / xpU).toFixed(2)}× — tyle, ile daje jeden dzień więcej`,
    `Przewaga nad trenującym 4×/tydz. urosła do ${(xpC / xpU).toFixed(2)}×`);

  console.log("\n── Nieprawdopodobny rekord nie płaci ──");
  // Skok ze 100 na 300 kg z tygodnia na tydzień to literówka albo ściema.
  const skoczek = await makeUser("s");
  const sex = await post("wn_exercises", { user_id: skoczek.id, name: "Przysiad ze sztangą", kind: "weighted", unit: "kg" });
  const sw = await post("wn_workouts", { user_id: skoczek.id, name: "Nogi", position: 0 });
  await post("wn_workout_exercises", { workout_id: sw.id, exercise_id: sex.id, position: 0 });
  const dzienSkoku = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  for (const [d, kg] of [[5, 100], [2, 300]]) {
    const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const ss = await post("wn_sessions", { user_id: skoczek.id, workout_id: sw.id, started_at: `${day}T12:00:00Z`, finished_at: `${day}T13:00:00Z` });
    for (let i = 0; i < 5; i++) await post("wn_sets", { session_id: ss.id, exercise_id: sex.id, set_index: i, weight_kg: kg, reps: 3 });
  }
  await xpOf(skoczek);
  const rek = await (await fetch(SB + `/rest/v1/gm_xp_log?user_id=eq.${skoczek.id}&source=eq.record&select=day,amount`, { headers: H })).json();
  const zaSkok = rek.find((r) => r.day === dzienSkoku);
  check(!zaSkok, "Skok 100 → 300 kg nie dostał XP za rekord", `Absurdalny rekord zapłacił ${zaSkok && zaSkok.amount} XP`);

  console.log("\n── Sync bez tokenu ──");
  const goscia = await fetch(`http://localhost:${PORT}/api/game/sync`, { method: "POST" });
  check(goscia.status === 401, `Sync bez logowania odrzucony (HTTP ${goscia.status})`, `Sync bez tokenu -> ${goscia.status}`);

  for (const u of [ofiara, napastnik, uczciwy, zawziety, codzienny, skoczek]) await fetch(SB + "/auth/v1/admin/users/" + u.id, { method: "DELETE", headers: H });
  console.log(fails.length === 0 ? "\nGRA NA ZYWO OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
