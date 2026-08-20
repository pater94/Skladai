/**
 * FORMA RPG — przeliczenie postaci.
 *
 * TU rozstrzyga się odporność na oszustwa. Klient nie przysyła XP ani poziomu;
 * przysyła co najwyżej liczbę kroków. Wszystko inne serwer liczy SAM, czytając
 * tabelę wn_sets przez service_role i przepuszczając ją przez lib/game/rules.
 *
 * Operacja jest idempotentna: gm_xp_log ma klucz (user_id, day, source), więc
 * ponowne wywołanie nadpisuje ten sam dzień zamiast dokładać. Można wołać przy
 * każdym wejściu w aplikację i wynik się nie rozjedzie.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import {
  xpForDay, levelFromXp, statsFrom, conditionFromLastTraining,
  XP, XP_BACKDATE_DAYS, DAILY_XP_CAP, WEEKLY_XP_CAP, type RawSet, type XpSource,
} from "@/lib/game/rules";

export const maxDuration = 30;

const DAY = 86400000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Klucz tygodnia ISO — liga tygodniowa zeruje się w poniedziałek. */
function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface SetRow {
  exercise_id: string;
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  session_id: string;
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Brak konfiguracji serwera." }, { status: 500 });

  // ── kim jesteś ────────────────────────────────────────────────────────
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  const { data: userData } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });

  let steps: Record<string, number> = {};
  try {
    const body = await request.json();
    // Kroki to JEDYNE dane od klienta. Dlatego ich udział w punktacji jest
    // z założenia mały (maks. 40 XP dziennie przy 300 XP sufitu) — nawet
    // podrobione nie przestawiają rankingu.
    if (body?.steps && typeof body.steps === "object") steps = body.steps as Record<string, number>;
  } catch { /* brak ciała żądania — kroki opcjonalne */ }

  const today = new Date();
  const since = new Date(today.getTime() - 27 * DAY);      // 28 dni na statystyki
  const sinceKey = dayKey(since);

  // ── dane wejściowe prosto z bazy ──────────────────────────────────────
  const { data: sessions } = await admin
    .from("wn_sessions")
    .select("id, started_at, finished_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .gte("started_at", `${sinceKey}T00:00:00Z`)
    .order("started_at", { ascending: true });

  const sessionDay = new Map<string, string>();
  for (const s of sessions ?? []) sessionDay.set(s.id as string, String(s.started_at).slice(0, 10));

  const ids = [...sessionDay.keys()];
  const { data: setRows } = ids.length
    ? await admin.from("wn_sets").select("exercise_id, weight_kg, reps, duration_sec, session_id").in("session_id", ids)
    : { data: [] as SetRow[] };

  /** Serie pogrupowane po dniu. */
  const setsByDay = new Map<string, RawSet[]>();
  /** Najlepszy wynik ćwiczenia w danym dniu — do wykrywania rekordów. */
  const bestByDayEx = new Map<string, Map<string, number>>();
  for (const r of (setRows ?? []) as SetRow[]) {
    const day = sessionDay.get(r.session_id);
    if (!day) continue;
    const set: RawSet = { weightKg: r.weight_kg, reps: r.reps, durationSec: r.duration_sec };
    if (!setsByDay.has(day)) setsByDay.set(day, []);
    setsByDay.get(day)!.push(set);

    const score = (r.weight_kg ?? 0) > 0 ? (r.weight_kg as number) : (r.reps ?? 0);
    if (!bestByDayEx.has(day)) bestByDayEx.set(day, new Map());
    const m = bestByDayEx.get(day)!;
    if (score > (m.get(r.exercise_id) ?? 0)) m.set(r.exercise_id, score);
  }

  // Rekordy życiowe — potrzebny stan SPRZED okna, żeby nie uznać za rekord
  // czegoś, co użytkownik dawno pobił.
  const exerciseIds = [...new Set(((setRows ?? []) as SetRow[]).map((r) => r.exercise_id))];
  /** Najlepszy wynik ćwiczenia PRZED danym dniem (cała historia użytkownika). */
  const priorBest = new Map<string, number>();
  if (exerciseIds.length) {
    const { data: hist } = await admin
      .from("wn_sets")
      .select("exercise_id, weight_kg, reps, wn_sessions!inner(user_id, started_at, finished_at)")
      .in("exercise_id", exerciseIds)
      .lt("wn_sessions.started_at", `${sinceKey}T00:00:00Z`)
      .not("wn_sessions.finished_at", "is", null);
    for (const r of (hist ?? []) as Array<{ exercise_id: string; weight_kg: number | null; reps: number | null }>) {
      const score = (r.weight_kg ?? 0) > 0 ? (r.weight_kg as number) : (r.reps ?? 0);
      if (score > (priorBest.get(r.exercise_id) ?? 0)) priorBest.set(r.exercise_id, score);
    }
  }

  // ── dzień po dniu ─────────────────────────────────────────────────────
  const days: string[] = [];
  for (let i = 27; i >= 0; i--) days.push(dayKey(new Date(today.getTime() - i * DAY)));

  const lastRecordDay = new Map<string, string>();   // cooldown na rekordy
  const rows: Array<{ user_id: string; day: string; source: XpSource; amount: number; meta: unknown }> = [];
  /** Dni, które zapłaciły za trening — do okna „najwyżej 5 z 7". */
  const scoringDays: number[] = [];
  /** Dni z przyznanym rekordem — do okna „najwyżej 3 z 7". */
  const paidRecordDays: number[] = [];
  const within7 = (list: number[], t: number) => list.filter((d) => (t - d) / DAY < 7).length;
  let streak = 0;
  let volume28 = 0, steps28 = 0, trainingDays28 = 0, records28 = 0;
  let lastTraining: string | null = null;
  const oldestScoring = dayKey(new Date(today.getTime() - (XP_BACKDATE_DAYS - 1) * DAY));

  for (const day of days) {
    const dayT = new Date(day + "T12:00:00Z").getTime();
    const sets = setsByDay.get(day) ?? [];
    const trained = sets.length >= 3;
    streak = trained ? streak + 1 : 0;
    if (trained) { trainingDays28++; lastTraining = day; }

    /*
      Najwyżej 5 z 7 dni płaci za trening. Szósty i siódmy dzień pod rząd
      trafia do dziennika i do statystyk, ale postaci nie rusza — regeneracja
      jest częścią treningu, a codzienne „ciężkie sesje" to znak, że ktoś
      wpisuje zamiast ćwiczyć.
    */
    const scoring = trained && within7(scoringDays, dayT) < XP.maxScoringDaysPer7;
    if (scoring) scoringDays.push(dayT);

    // rekordy tego dnia: cooldown na ćwiczenie + limit tygodniowy + wiarygodność skoku
    let records = 0;
    for (const [exId, score] of bestByDayEx.get(day) ?? []) {
      const prev = priorBest.get(exId) ?? 0;
      if (score > prev) {
        const last = lastRecordDay.get(exId);
        const okCooldown = !last ||
          (dayT - new Date(last + "T12:00:00Z").getTime()) / DAY >= XP.recordCooldownDays;
        // Skok o ponad 20 % nad poprzedni wynik = literówka albo ściema.
        const okJump = prev === 0 || score <= prev * (1 + XP.maxRecordJumpPct);
        const okWeek = within7(paidRecordDays, dayT) + records < XP.maxRecordsPer7;
        if (scoring && okCooldown && okJump && okWeek) {
          records++;
          lastRecordDay.set(exId, day);
          paidRecordDays.push(dayT);
        }
        priorBest.set(exId, score);
      }
    }

    const daySteps = Math.max(0, Number(steps[day] ?? 0));
    // Kroki liczą się nawet w dniu bez punktowanego treningu — chodzenie to
    // chodzenie. Reszta źródeł milczy, jeśli dzień nie punktuje.
    const br = scoring
      ? xpForDay({ sets, records, steps: daySteps, streakDays: streak })
      : xpForDay({ sets: [], records: 0, steps: daySteps, streakDays: 0 });

    volume28 += br.volumeKg;
    steps28 += daySteps;
    records28 += records;

    // XP zapisujemy TYLKO za świeże dni — starsze wpisy w dzienniku są
    // pełnoprawną historią, ale postaci już nie podbijają.
    if (day >= oldestScoring) {
      for (const [source, amount] of Object.entries(br.bySource) as Array<[XpSource, number]>) {
        if (amount > 0) rows.push({ user_id: userId, day, source, amount, meta: { volumeKg: br.volumeKg, rejected: br.rejectedSets } });
      }
    }
  }

  if (rows.length) {
    await admin.from("gm_xp_log").upsert(rows, { onConflict: "user_id,day,source" });
  }

  // ── suma wszystkich kiedykolwiek przyznanych XP ───────────────────────
  const { data: logAll } = await admin
    .from("gm_xp_log").select("day, amount").eq("user_id", userId);
  const perDay = new Map<string, number>();
  for (const r of (logAll ?? []) as Array<{ day: string; amount: number }>) {
    perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.amount);
  }
  /*
    Sufity egzekwowane jeszcze raz na sumie — gdyby reguły kiedyś się zmieniły,
    stare wpisy w dzienniku nadal ich nie przebiją. Najpierw dzienny, potem
    tygodniowy, bo to ten drugi zamyka drogę „wpisuję sobie trening 7 dni w
    tygodniu".
  */
  const perWeek = new Map<string, number>();
  for (const [day, amount] of perDay) {
    const wk = weekKey(new Date(day + "T12:00:00Z"));
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + Math.min(DAILY_XP_CAP, amount));
  }
  const thisWeek = weekKey(today);
  let totalXp = 0;
  for (const sum of perWeek.values()) totalXp += Math.min(WEEKLY_XP_CAP, sum);
  const weekXp = Math.min(WEEKLY_XP_CAP, perWeek.get(thisWeek) ?? 0);

  const lvl = levelFromXp(totalXp);
  const stats = statsFrom({ volume28, steps28, trainingDays28, records28 });
  const daysSince = lastTraining
    ? Math.round((new Date(dayKey(today)).getTime() - new Date(lastTraining).getTime()) / DAY)
    : null;
  const condition = conditionFromLastTraining(daysSince);

  const { data: saved, error } = await admin
    .from("gm_profiles")
    .upsert({
      user_id: userId,
      level: lvl.level,
      xp: totalXp,
      condition,
      stat_sila: stats.sila,
      stat_wytrz: stats.wytrzymalosc,
      stat_dyscyp: stats.dyscyplina,
      week_xp: weekXp,
      week_key: thisWeek,
      last_training: lastTraining,
      synced_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("nick, level, xp, condition, stat_sila, stat_wytrz, stat_dyscyp, week_xp, last_training")
    .single();

  if (error) {
    console.warn("[game] sync", error.message);
    return NextResponse.json({ error: "Nie udało się przeliczyć postaci." }, { status: 500 });
  }

  return NextResponse.json({
    profile: saved,
    level: lvl,
    stats,
    condition,
    trainingDays28,
    volume28: Math.round(volume28),
  });
}
