/**
 * Regresja dziennika treningowego — na PRAWDZIWEJ bazie, przez PRAWDZIWY UI.
 *
 * Powstało po błędzie, w którym zapisanie treningu o istniejącej nazwie
 * wyglądało jak nadpisanie poprzedniego (dane były całe, ale apka po cichu
 * otwierała stary trening i pokazywała wyłącznie ostatnią sesję).
 *
 * Sprawdza dwie rzeczy, których nie złapią typy ani lint:
 *   1. powtórzona nazwa NIGDY nie kasuje ani nie podmienia starych sesji,
 *   2. zapisany trening da się poprawić — nazwa, data, ciężary, ćwiczenia.
 *
 * Uruchomienie (serwer produkcyjny musi już działać):
 *   PORT=3760 npx tsx test/journal/verify.ts
 */
import { readFileSync } from "node:fs";

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

const admin = () => ({ apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json" });

const fails: string[] = [];
const check = (cond: boolean, good: string, wrong: string) => {
  if (cond) { console.log("  OK  " + good); return; }
  console.log("  BLAD " + wrong);
  fails.push(wrong);
};

async function main() {
  const { chromium } = await import("playwright");
  const email = `wn_${Date.now()}@skladai-test.dev`;
  const pass = `Test123!${Date.now()}`;
  let uid: string | null = null;

  try {
    const u = await (await fetch(`${SB}/auth/v1/admin/users`, {
      method: "POST", headers: admin(),
      body: JSON.stringify({ email, password: pass, email_confirm: true }),
    })).json();
    uid = u.id;
    if (!uid) throw new Error("nie utworzono usera testowego");

    const sess = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    })).json();
    if (!sess.access_token) throw new Error("brak tokenu");

    /** Odczyt bazy service_rolem — niezależny od tego, co pokazuje UI. */
    const db = async (path: string) =>
      (await (await fetch(`${SB}/rest/v1/${path}`, { headers: admin() })).json()) as Record<string, unknown>[];
    const myWorkouts = () => db(`wn_workouts?user_id=eq.${uid}&select=id,name,archived&order=created_at.asc`);
    const setsOf = (sessionId: string) => db(`wn_sets?session_id=eq.${sessionId}&select=id`);
    const sessionsOf = (workoutId: string) =>
      db(`wn_sessions?workout_id=eq.${workoutId}&select=id,started_at&order=started_at.asc`);

    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push("PAGEERR: " + e.message.slice(0, 140)));

    await page.addInitScript(([key, val]: string[]) => {
      localStorage.setItem(key, val);
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem("agent_coachmark_seen", "true");
      localStorage.setItem("skladai_profile", JSON.stringify({
        id: "u", mode: "fitness", mode_explicitly_chosen: true,
        gender: "male", weight_kg: 80, height_cm: 180, age: 30,
        health: { conditions: [], allergens: [] },
      }));
    }, [STORAGE_KEY, JSON.stringify(sess)]);

    const tap = async (testid: string, waitMs = 1800) => {
      await page.evaluate((id: string) => {
        (document.querySelector(`[data-testid=${id}]`) as HTMLElement | null)?.click();
      }, testid);
      await page.waitForTimeout(waitMs);
    };

    /** Wpisuje wartość tak, żeby React zobaczył zdarzenie (nie samo .value). */
    const type = async (selector: string, value: string) => {
      await page.evaluate(([sel, v]: string[]) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) return;
        const proto = Object.getPrototypeOf(el) as object;
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, [selector, value]);
      await page.waitForTimeout(280);
    };

    const gotoQuickLog = async () => {
      await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2600);
      await tap("forma-open-journal");
      await tap("workout-quick-log", 1600);
    };

    // ── 1. pierwszy trening ──
    console.log("\n-- 1. Pierwszy zapis treningu 'Test A' --");
    await gotoQuickLog();
    await type("[data-testid=ql-new-name]", "Test A");
    await tap("ql-create", 2000);

    const ws1 = await myWorkouts();
    check(ws1.length === 1, "Utworzono 1 trening", `Oczekiwano 1 treningu, jest ${ws1.length}`);

    await tap("add-exercise-open", 700);
    await type("[data-testid=add-exercise-name]", "Wyciskanie testowe");
    await tap("add-exercise-save");
    const hasCard = await page.evaluate(() => !!document.querySelector("[data-testid=ql-exercise]"));
    check(hasCard, "Dodano cwiczenie w szybkim zapisie", "Nie udalo sie dodac cwiczenia w szybkim zapisie");

    await page.evaluate(([w, r]: string[]) => {
      const card = document.querySelector("[data-testid=ql-exercise]");
      const inputs = [...(card?.querySelectorAll("input") ?? [])] as HTMLInputElement[];
      for (const pair of [[0, w], [1, r]] as Array<[number, string]>) {
        const el = inputs[pair[0]];
        if (!el) continue;
        const proto = Object.getPrototypeOf(el) as object;
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, pair[1]);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, ["100", "5"]);
    await page.waitForTimeout(400);
    await tap("ql-save", 2200);

    const firstWorkoutId = String(ws1[0].id);
    const sess1 = await sessionsOf(firstWorkoutId);
    const withSets: string[] = [];
    for (const s of sess1) {
      const n = (await setsOf(String(s.id))).length;
      if (n) withSets.push(String(s.id));
    }
    check(withSets.length === 1, "Zapisano 1 sesje z seriami", `Oczekiwano 1 sesji z seriami, jest ${withSets.length}`);
    const originalSessionId = withSets[0];
    const originalSets = (await setsOf(originalSessionId)).length;

    // ── 2. druga próba tej samej nazwy ──
    console.log("\n-- 2. Druga proba tej samej nazwy: apka MUSI zapytac --");
    await gotoQuickLog();
    await type("[data-testid=ql-new-name]", "Test A");
    await tap("ql-create", 1600);

    const askedTwin = await page.evaluate(() => !!document.querySelector("[data-testid=ql-twin]"));
    check(askedTwin, "Apka zapytala, co zrobic z powtorzona nazwa", "Brak pytania - apka zdecydowala za uzytkownika");

    await tap("ql-twin-new", 2400);
    const ws2 = await myWorkouts();
    check(ws2.length === 2, "Powstal DRUGI, osobny trening o tej samej nazwie", `Oczekiwano 2 treningow, jest ${ws2.length}`);

    // ── 3. stary trening nietknięty ──
    console.log("\n-- 3. Poprzedni trening musi byc nietkniety --");
    const sessAfter = await sessionsOf(firstWorkoutId);
    check(sessAfter.some((s) => String(s.id) === originalSessionId),
      "Pierwsza sesja nadal istnieje", "PIERWSZA SESJA ZNIKNELA - utrata danych!");
    const setsNow = (await setsOf(originalSessionId)).length;
    check(setsNow === originalSets,
      `Serie pierwszej sesji nietkniete (${setsNow})`,
      `Serie pierwszej sesji zmienione: bylo ${originalSets}, jest ${setsNow}`);

    // ── 4. edycja zapisanego treningu ──
    console.log("\n-- 4. Edycja zapisanego treningu (nazwa, data, ciezar) --");
    await page.goto(`http://localhost:${PORT}/forma`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);
    await tap("forma-open-journal", 2200);
    await tap("workout-history-btn", 2000);

    const rows = await page.evaluate(() => document.querySelectorAll("[data-testid=wh-session]").length);
    check(rows >= 1, `Historia treningu pokazuje ${rows} zapisanych treningow`, "Historia treningu pusta");

    await tap("wh-session", 2000);
    const onEdit = await page.evaluate(() => !!document.querySelector("[data-testid=session-edit]"));
    check(onEdit, "Otwarto ekran edycji zapisanego treningu", "Nie otwarto edycji");

    await type("[data-testid=se-name]", "Test A po zmianie");
    await type("[data-testid=se-date]", "2026-05-04");
    await page.evaluate(() => {
      const card = document.querySelector("[data-testid=se-exercise]");
      const el = card?.querySelector("input") as HTMLInputElement | null;
      if (!el) return;
      const proto = Object.getPrototypeOf(el) as object;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, "137.5");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(400);
    await tap("se-save", 2600);

    const edited = await db(`wn_sessions?id=eq.${originalSessionId}&select=started_at`);
    check(String(edited[0]?.started_at ?? "").startsWith("2026-05-04"),
      "Data zapisanego treningu zmieniona",
      `Data niezmieniona (${String(edited[0]?.started_at).slice(0, 10)})`);

    const renamed = await db(`wn_workouts?id=eq.${firstWorkoutId}&select=name`);
    check(renamed[0]?.name === "Test A po zmianie",
      "Nazwa treningu zmieniona", `Nazwa niezmieniona (${String(renamed[0]?.name)})`);

    const editedSets = await db(`wn_sets?session_id=eq.${originalSessionId}&select=weight_kg&order=set_index.asc`);
    check(Number(editedSets[0]?.weight_kg) === 137.5,
      "Ciezar w zapisanym treningu poprawiony (137.5 kg)",
      `Ciezar niezmieniony (${String(editedSets[0]?.weight_kg)})`);
    check(editedSets.length === originalSets,
      `Liczba serii zachowana po edycji (${editedSets.length})`,
      `Liczba serii zmieniona: bylo ${originalSets}, jest ${editedSets.length}`);

    check(errs.length === 0, "Zero bledow JS", "Bledy JS: " + errs.join(" | "));
    await browser.close();
  } catch (e) {
    check(false, "", "WYJATEK: " + (e as Error).message);
  } finally {
    if (uid) await fetch(`${SB}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: admin() }).catch(() => {});
    console.log(fails.length === 0 ? "\nDZIENNIK OK - 0 bledow" : `\nBLEDOW: ${fails.length}`);
    process.exit(fails.length === 0 ? 0 : 1);
  }
}

void main();
