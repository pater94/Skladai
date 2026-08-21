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
import {
  seasonFor, seasonKey, leagueOutcome, nextLeague, COHORT_SIZE,
} from "@/lib/game/season";
import { dailyQuests, weeklyQuests, withProgress, questReward, type QuestProgress } from "@/lib/game/quests";
import { newlyUnlocked, type AchievementStats } from "@/lib/game/achievements";
import { bodyStateFrom, parseFatRange, PHOTOS_PER_SESSION, type BodyReading, type MuscleMassLabel } from "@/lib/game/body";

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
  let streak = 0, bestStreak = 0;
  let volume28 = 0, steps28 = 0, trainingDays28 = 0, records28 = 0;
  /* Metryki celów — zbierane przy okazji tej samej pętli, żeby nie odpytywać
     bazy drugi raz o to samo. */
  const todayKey = dayKey(today);
  const thisWeekKey = weekKey(today);
  const dayMetrics: QuestProgress = {};
  const weekMetrics: QuestProgress = {};
  const bump = (bag: QuestProgress, k: keyof QuestProgress, v: number) => { bag[k] = (bag[k] ?? 0) + v; };
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
    bestStreak = Math.max(bestStreak, streak);

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

    const exCount = (bestByDayEx.get(day) ?? new Map()).size;
    for (const bag of [
      day === todayKey ? dayMetrics : null,
      weekKey(new Date(day + "T12:00:00Z")) === thisWeekKey ? weekMetrics : null,
    ]) {
      if (!bag) continue;
      bump(bag, "trainingDays", trained ? 1 : 0);
      bump(bag, "sets", sets.length);
      bump(bag, "volumeKg", br.volumeKg);
      bump(bag, "steps", daySteps);
      bump(bag, "records", records);
      bump(bag, "exercises", exCount);
      bag.streakDays = Math.max(bag.streakDays ?? 0, streak);
    }

    // XP zapisujemy TYLKO za świeże dni — starsze wpisy w dzienniku są
    // pełnoprawną historią, ale postaci już nie podbijają.
    if (day >= oldestScoring) {
      for (const [source, amount] of Object.entries(br.bySource) as Array<[XpSource, number]>) {
        if (amount > 0) rows.push({ user_id: userId, day, source, amount, meta: { volumeKg: br.volumeKg, rejected: br.rejectedSets } });
      }
    }
  }

  // Cele liczymy tu, bo ich XP ma trafić do dziennika w tym samym przebiegu.
  const dq = withProgress(dailyQuests(userId, todayKey), dayMetrics);
  const wq = withProgress(weeklyQuests(userId, thisWeekKey), weekMetrics);
  const questPay = questReward(dq, wq);
  if (questPay.xp > 0) {
    rows.push({ user_id: userId, day: todayKey, source: "quest" as XpSource, amount: questPay.xp,
      meta: { daily: dq.filter((q) => q.done).map((q) => q.id), weekly: wq.filter((q) => q.done).map((q) => q.id) } });
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

  // ── CIAŁO ─────────────────────────────────────────────────────────────
  /*
     Sesja zdjęć = wszystkie skany CheckForm z jednego dnia. Liczy się tylko
     taka, która ma komplet ujęć — jedno zdjęcie potrafi skłamać o kilka
     punktów procentowych przez samo światło i porę dnia.
  */
  const { data: formaScans } = await admin
    .from("scan_logs")
    .select("created_at, ai_result")
    .eq("user_id", userId)
    .eq("mode", "forma")
    .order("created_at", { ascending: true });

  const byDayPhotos = new Map<string, { fats: number[]; labels: MuscleMassLabel[]; photos: number }>();
  for (const row of (formaScans ?? []) as Array<{ created_at: string; ai_result: unknown }>) {
    const day = String(row.created_at).slice(0, 10);
    const res = (row.ai_result ?? {}) as Record<string, unknown>;
    const entry = byDayPhotos.get(day) ?? { fats: [], labels: [], photos: 0 };
    entry.photos += 1;
    const fat = parseFatRange(res.body_fat_range as string | undefined);
    if (fat != null) entry.fats.push(fat);
    const label = res.muscle_mass as MuscleMassLabel | undefined;
    if (label) entry.labels.push(label);
    byDayPhotos.set(day, entry);
  }
  const readings: BodyReading[] = [...byDayPhotos.entries()].map(([day, e]) => ({
    day,
    bodyFatPct: e.fats.length ? e.fats.reduce((a, b) => a + b, 0) / e.fats.length : null,
    muscleMass: e.labels[0] ?? null,
    photos: e.photos,
  }));
  const photoSessions = readings.filter((r) => r.photos >= PHOTOS_PER_SESSION).length;

  const { data: prof } = await admin
    .from("profiles").select("gender, weight_kg").eq("id", userId).maybeSingle();
  const gender = ((prof?.gender === "female" || prof?.gender === "male") ? prof.gender : null) as "male" | "female" | null;

  const body = bodyStateFrom({
    gender,
    readings,
    weightsKg: prof?.weight_kg ? [Number(prof.weight_kg)] : [],
    volume28Kg: volume28,
    trainingDays28,
  });

  // ── SEZON I LIGA ──────────────────────────────────────────────────────
  const season = seasonFor(today);
  const sKey = seasonKey(season);

  /* Punkty okresowe = dzienne XP po sufitach + punkty za domknięte cele.
     Liczone od nowa z dziennika, więc odporne na wielokrotne przeliczanie. */
  let seasonPoints = questPay.points;
  for (const [day, amount] of perDay) {
    if (day >= season.startISO && day <= season.endISO) seasonPoints += Math.min(DAILY_XP_CAP, amount);
  }
  const weekPoints = weekXp + questPay.points;

  const { data: current } = await admin
    .from("gm_profiles")
    .select("league, best_league, league_week, cohort, season_key, season_points, best_streak")
    .eq("user_id", userId).maybeSingle();

  let league = current?.league ?? 0;
  let cohort = current?.cohort ?? 0;
  let settled: { rank: number; outcome: string; league: number } | null = null;

  /*
     Rozliczenie tygodnia następuje RAZ — przy pierwszym przeliczeniu po
     zmianie tygodnia ISO. `league_week` jest zapadką: dopóki się zgadza,
     nic się nie dzieje, choćby ktoś wołał sync co sekundę.
  */
  if (current && current.league_week && current.league_week !== thisWeekKey) {
    const prevPoints = Math.max(0, (current as { week_points?: number }).week_points ?? 0);
    const { count: above } = await admin
      .from("gm_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("league", league).eq("cohort", cohort)
      .gt("week_points", prevPoints);
    const rank = (above ?? 0) + 1;
    const outcome = leagueOutcome(league, rank, prevPoints);
    const after = nextLeague(league, outcome);
    await admin.from("gm_league_history").upsert({
      user_id: userId, week_key: current.league_week,
      league, cohort, rank, points: prevPoints, outcome,
    }, { onConflict: "user_id,week_key" });
    settled = { rank, outcome, league: after };
    league = after;
  }

  // Kohorta przydzielana na każdy nowy tydzień — dobiera ~30 osób z ligi.
  if (!current || current.league_week !== thisWeekKey) {
    const { count: inLeague } = await admin
      .from("gm_profiles").select("user_id", { count: "exact", head: true }).eq("league", league);
    const groups = Math.max(1, Math.ceil((inLeague ?? 1) / COHORT_SIZE));
    let h = 0;
    for (const ch of `${userId}|${thisWeekKey}`) h = (Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0);
    cohort = h % groups;
  }

  const bestLeague = Math.max(current?.best_league ?? 0, league);
  // Sezon się zmienił → dorobek sezonowy startuje od zera (poziom nigdy).
  if (current?.season_key && current.season_key !== sKey) seasonPoints = questPay.points;

  // ── OSIĄGNIĘCIA ───────────────────────────────────────────────────────
  const { data: ownedRows, error: achErr } = await admin
    .from("gm_achievements").select("achievement_id, xp").eq("user_id", userId);
  const owned = ((ownedRows ?? []) as Array<{ achievement_id: string }>).map((r) => r.achievement_id);

  const { count: scansTotal } = await admin
    .from("scan_logs").select("id", { count: "exact", head: true }).eq("user_id", userId);

  const achStats: AchievementStats = {
    trainingDaysTotal: trainingDays28,
    bestStreak: Math.max(bestStreak, current?.best_streak ?? 0),
    volumeTotalKg: volume28,
    recordsTotal: records28,
    level: lvl.level,
    bestLeague,
    photoSessions,
    muscleGained: Math.max(0, body.muscleDelta ?? 0),
    leannessGained: Math.max(0, body.leannessDelta ?? 0),
    scansTotal: scansTotal ?? 0,
    oddHourSessions: 0,
    seasonsCompleted: 0,
  };
  /* Bez migracji tabela odznak nie istnieje. Wtedy NIE przyznajemy nic —
     inaczej co przeliczenie doliczałoby te same XP od nowa, bo nie miałoby
     gdzie zapisać, że odznaka już padła. */
  const fresh = achErr ? [] : newlyUnlocked(achStats, owned);
  if (fresh.length) {
    await admin.from("gm_achievements").upsert(
      fresh.map((a) => ({ user_id: userId, achievement_id: a.id, xp: a.xp })),
      { onConflict: "user_id,achievement_id" },
    );
  }
  const achXp = ((ownedRows ?? []) as Array<{ xp: number }>).reduce((a, r) => a + (r.xp ?? 0), 0)
    + fresh.reduce((a, r) => a + r.xp, 0);
  const finalXp = totalXp + achXp;
  const finalLvl = levelFromXp(finalXp);


  /*
     Migracja 20260821_game_seasons.sql jest uruchamiana ręcznie w panelu
     Supabase. Dopóki jej nie ma, nowych kolumn nie ma też w bazie — zapis
     całości poleciałby błędem i gra przestałaby działać w ogóle. Dlatego
     najpierw próba pełna, a przy błędzie o brakującej kolumnie cofamy się
     do zestawu sprzed etapu drugiego. Gra działa dalej, tylko bez sezonów.
  */
  const fullRow = {
      user_id: userId,
      level: finalLvl.level,
      xp: finalXp,
      condition,
      stat_sila: stats.sila,
      stat_wytrz: stats.wytrzymalosc,
      stat_dyscyp: stats.dyscyplina,
      week_xp: weekXp,
      week_key: thisWeek,
      last_training: lastTraining,
      league,
      best_league: bestLeague,
      league_week: thisWeekKey,
      cohort,
      season_key: sKey,
      season_points: seasonPoints,
      week_points: weekPoints,
      streak_days: streak,
      best_streak: achStats.bestStreak,
      muscle: body.muscle,
      leanness: body.leanness,
      body_samples: body.samples,
      gender,
      synced_at: new Date().toISOString(),
  };
  const LEGACY_COLS = "nick, level, xp, condition, stat_sila, stat_wytrz, stat_dyscyp, week_xp, last_training";
  const FULL_COLS = LEGACY_COLS + ", league, best_league, cohort, season_key, season_points, week_points, streak_days, best_streak, muscle, leanness, body_samples, gender";

  let { data: saved, error } = await admin
    .from("gm_profiles").upsert(fullRow, { onConflict: "user_id" }).select(FULL_COLS).single();

  let legacyMode = false;
  if (error && /column|schema cache/i.test(error.message)) {
    legacyMode = true;
    const legacyRow = {
      user_id: fullRow.user_id, level: fullRow.level, xp: fullRow.xp, condition: fullRow.condition,
      stat_sila: fullRow.stat_sila, stat_wytrz: fullRow.stat_wytrz, stat_dyscyp: fullRow.stat_dyscyp,
      week_xp: fullRow.week_xp, week_key: fullRow.week_key, last_training: fullRow.last_training,
      synced_at: fullRow.synced_at,
    };
    ({ data: saved, error } = await admin
      .from("gm_profiles").upsert(legacyRow, { onConflict: "user_id" }).select(LEGACY_COLS).single());
  }

  if (error) {
    console.warn("[game] sync", error.message);
    return NextResponse.json({ error: "Nie udało się przeliczyć postaci." }, { status: 500 });
  }

  return NextResponse.json({
    profile: saved,
    level: finalLvl,
    stats,
    condition,
    trainingDays28,
    volume28: Math.round(volume28),
    body: { ...body, photoSessions },
    season: { ...season, key: sKey, points: seasonPoints },
    league: { id: league, cohort, weekPoints, settled },
    quests: { daily: dq, weekly: wq, reward: questPay },
    achievements: { unlockedNow: fresh.map((a) => ({ id: a.id, name: a.name, xp: a.xp })), ownedCount: owned.length + fresh.length },
    // true = migracja etapu 2 jeszcze nieuruchomiona; UI ukrywa sezony i ligi
    legacyMode,
  });
}
