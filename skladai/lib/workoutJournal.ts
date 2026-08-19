"use client";

/**
 * FORMA — Dziennik treningowy (Workout Notebook). Warstwa danych (Faza 1/4).
 *
 * Wszystkie tabele mają prefiks wn_ i RLS (user widzi tylko swoje wiersze) —
 * patrz supabase/migrations/20260625_workout_journal.sql.
 *
 * Wskaźnik progresu = NAJCIĘŻSZA SERIA (kg) — dla ćwiczeń `bodyweight` liczony
 * po powtórzeniach (top_reps). Offline: aktywna sesja trzymana w
 * @capacitor/preferences (wn_active_session), niezsynchronizowane serie w
 * kolejce (wn_pending_sets).
 *
 * UI (Fazy 2-4) korzysta WYŁĄCZNIE z tych funkcji — bez własnej logiki danych.
 */

import { createClient } from "@/lib/supabase";
import { nsGet, nsSet, nsRemove } from "@/lib/native-storage";

// ──────────────────────────────────────────────────────────────────
// Typy (zgodne ze schematem SQL)
// ──────────────────────────────────────────────────────────────────
export type WnKind = "weighted" | "bodyweight" | "weighted_bw" | "duration";

export interface WnExercise {
  id: string;
  user_id: string;
  name: string;
  kind: WnKind;
  unit: string;
  created_at: string;
}
export interface WnWorkout {
  id: string;
  user_id: string;
  name: string;
  position: number;
  archived: boolean;
  created_at: string;
}
export interface WnWorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
}
export interface WnSession {
  id: string;
  user_id: string;
  workout_id: string | null;
  started_at: string;
  finished_at: string | null;
  note: string | null;
  created_at: string;
}
export interface WnSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  created_at: string;
}

// Typy pochodne
export interface WnWorkoutExerciseFull extends WnWorkoutExercise {
  exercise: WnExercise;
}
export interface WnWorkoutWithExercises extends WnWorkout {
  exercises: WnWorkoutExerciseFull[];
}
export interface WnSessionWithSets extends WnSession {
  sets: WnSet[];
}
/** Punkt historii: jedna ukończona sesja z najcięższą serią danego ćwiczenia. */
export interface WnHistoryPoint {
  sessionId: string;
  finishedAt: string;
  /** Trening, w ramach którego wykonano sesję (do rozdzielania progresu A vs B). */
  workoutId?: string | null;
  topWeight: number | null;
  topReps: number | null;
  /** Najlepszy indeks siły sesji — porównywalny między różnymi zakresami powtórzeń. */
  topIndex?: number | null;
  sets: WnSet[];
}
export interface WnExerciseProgress {
  /** metryka bazowa: 'weight' (kg) lub 'reps' (bodyweight) */
  metric: "weight" | "reps";
  /** rekord = max po wszystkich ukończonych sesjach */
  record: number | null;
  /** ostatnia sesja − poprzednia sesja */
  weekDelta: number | null;
  /** ostatnia sesja − pierwsza sesja */
  sinceStartDelta: number | null;
}

// ──────────────────────────────────────────────────────────────────
// Pomocnicze
// ──────────────────────────────────────────────────────────────────
async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Publiczny helper: czy user jest zalogowany (zapis do chmury wymaga auth).
 *  Zwraca id usera lub null (gość). Używane przez ekrany, by pokazać „zaloguj się"
 *  zamiast cicho nie zapisać. */
export async function getCurrentUserId(): Promise<string | null> {
  return getUserId();
}

/** Najcięższa seria w grupie serii — po kg (weighted) lub powt. (bodyweight). */
function topOfSets(sets: WnSet[], byReps: boolean): number | null {
  let top: number | null = null;
  for (const s of sets) {
    const v = byReps ? s.reps : s.weight_kg;
    if (v == null) continue;
    if (top == null || v > top) top = v;
  }
  return top;
}

// ──────────────────────────────────────────────────────────────────
// Treningi (workouts)
// ──────────────────────────────────────────────────────────────────
export async function listWorkouts(): Promise<WnWorkout[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wn_workouts")
    .select("*")
    .eq("archived", false)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) { console.warn("[wn] listWorkouts", error.message); return []; }
  return (data ?? []) as WnWorkout[];
}

/**
 * Trening o tej nazwie (bez względu na wielkość liter) albo null.
 *
 * Służy do ZAPYTANIA użytkownika, a nie do cichego podmieniania. Wcześniej
 * createWorkout sam zwracał bliźniaka — przez co wpisanie istniejącej nazwy
 * nie tworzyło nowego treningu, tylko otwierało stary. Z zewnątrz wyglądało
 * to jak nadpisanie poprzedniego treningu (dane były całe, ale ekran
 * pokazywał wyłącznie ostatnią sesję).
 */
export async function findWorkoutByName(name: string): Promise<WnWorkout | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const all = await listWorkouts();
  return all.find((w) => w.name.trim().toLowerCase() === wanted) ?? null;
}

/** Tworzy NOWY trening — zawsze osobny wpis, nawet przy powtórzonej nazwie. */
export async function createWorkout(name: string): Promise<WnWorkout | null> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return null;
  const position = (await listWorkouts()).length;
  const { data, error } = await supabase
    .from("wn_workouts")
    .insert({ user_id: userId, name: name.trim() || "Nowy trening", position })
    .select("*")
    .single();
  if (error) { console.warn("[wn] createWorkout", error.message); return null; }
  return data as WnWorkout;
}

/** Zmiana nazwy treningu — historia i sesje zostają nietknięte. */
export async function renameWorkout(workoutId: string, name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const supabase = createClient();
  const { error } = await supabase.from("wn_workouts").update({ name: trimmed }).eq("id", workoutId);
  if (error) { console.warn("[wn] renameWorkout", error.message); return false; }
  return true;
}

/**
 * Chowa trening z listy. Świadomie NIE usuwamy wiersza — sesje i serie zostają
 * w bazie, więc pomyłkowe schowanie da się cofnąć, a historia ćwiczeń nie
 * traci punktów.
 */
export async function archiveWorkout(workoutId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("wn_workouts").update({ archived: true }).eq("id", workoutId);
  if (error) { console.warn("[wn] archiveWorkout", error.message); return false; }
  return true;
}

export async function getWorkoutWithExercises(workoutId: string): Promise<WnWorkoutWithExercises | null> {
  const supabase = createClient();
  const { data: workout, error: wErr } = await supabase
    .from("wn_workouts").select("*").eq("id", workoutId).single();
  if (wErr || !workout) { console.warn("[wn] getWorkout", wErr?.message); return null; }
  const { data: we, error: weErr } = await supabase
    .from("wn_workout_exercises")
    .select("*, exercise:wn_exercises(*)")
    .eq("workout_id", workoutId)
    .order("position", { ascending: true });
  if (weErr) { console.warn("[wn] getWorkoutExercises", weErr.message); }
  return { ...(workout as WnWorkout), exercises: (we ?? []) as unknown as WnWorkoutExerciseFull[] };
}

// ──────────────────────────────────────────────────────────────────
// Ćwiczenia (exercises)
// ──────────────────────────────────────────────────────────────────
export async function getExercise(exerciseId: string): Promise<WnExercise | null> {
  const supabase = createClient();
  const { data } = await supabase.from("wn_exercises").select("*").eq("id", exerciseId).single();
  return (data as WnExercise) ?? null;
}

/** Znajdź ćwiczenie po nazwie (case-insensitive) lub utwórz nowe. */
export async function findOrCreateExercise(name: string, kind: WnKind = "weighted"): Promise<WnExercise | null> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from("wn_exercises").select("*").ilike("name", trimmed).limit(1);
  if (existing && existing.length) return existing[0] as WnExercise;
  const { data, error } = await supabase
    .from("wn_exercises")
    .insert({ user_id: userId, name: trimmed, kind, unit: kind === "duration" ? "s" : "kg" })
    .select("*").single();
  if (error) { console.warn("[wn] createExercise", error.message); return null; }
  return data as WnExercise;
}

/** Dopisz ćwiczenie do szablonu treningu (na końcu kolejności). */
export async function addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<WnWorkoutExercise | null> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("wn_workout_exercises").select("id").eq("workout_id", workoutId).eq("exercise_id", exerciseId).limit(1);
  if (existing && existing.length) return existing[0] as WnWorkoutExercise; // już jest
  const { count } = await supabase
    .from("wn_workout_exercises").select("id", { count: "exact", head: true }).eq("workout_id", workoutId);
  const { data, error } = await supabase
    .from("wn_workout_exercises")
    .insert({ workout_id: workoutId, exercise_id: exerciseId, position: count ?? 0 })
    .select("*").single();
  if (error) { console.warn("[wn] addExerciseToWorkout", error.message); return null; }
  return data as WnWorkoutExercise;
}

/** Nazwy ćwiczeń, których user używał w tym treningu (do podpowiedzi). */
export async function getWorkoutExerciseSuggestions(workoutId: string): Promise<WnExercise[]> {
  const w = await getWorkoutWithExercises(workoutId);
  return (w?.exercises ?? []).map((e) => e.exercise).filter(Boolean);
}

/** Wszystkie ćwiczenia usera (do dopasowania importu). */
export async function listExercises(): Promise<WnExercise[]> {
  const supabase = createClient();
  const { data } = await supabase.from("wn_exercises").select("*");
  return (data ?? []) as WnExercise[];
}

/** Normalizacja nazwy do dopasowania: lowercase, bez diakrytyki, bez znaków spec. */
function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // usuń diakrytykę (ł→l po niżej)
    .replace(/ł/g, "l")                              // ł nie rozkłada się w NFD
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Znajdź istniejące ćwiczenie o tej samej nazwie (po normalizacji). */
export async function findExerciseByName(name: string, cache?: WnExercise[]): Promise<WnExercise | null> {
  const list = cache ?? await listExercises();
  const target = normName(name);
  if (!target) return null;
  return list.find((e) => normName(e.name) === target) ?? null;
}

/** Baza progresu ćwiczenia: ostatnia / pierwsza sesja + rekord (do porównań w imporcie). */
export async function getExerciseBaseline(exerciseId: string, workoutId?: string | null): Promise<{ metric: "weight" | "reps"; lastTop: number | null; firstTop: number | null; record: number | null; sessions: number }> {
  // workoutId → odniesienie TYLKO z tego treningu (bez mieszania A z B)
  const [kind, hist] = await Promise.all([kindOfExercise(exerciseId), getExerciseHistory(exerciseId, workoutId)]);
  const byReps = repsMetric(kind, hist);
  const vals = hist.map((p) => (byReps ? p.topReps : p.topWeight)).filter((v): v is number => v != null);
  return {
    metric: byReps ? "reps" : "weight",
    lastTop: vals.length ? vals[vals.length - 1] : null,
    firstTop: vals.length ? vals[0] : null,
    record: vals.length ? Math.max(...vals) : null,
    sessions: vals.length,
  };
}

// ── Import treningu ze zdjęcia (AI Vision → dopasowanie → zapis sesji) ──
export interface ImportSet { weight?: number | null; reps?: number | null; duration?: number | null; }
export interface ImportExercise { name: string; kind?: WnKind; sets: ImportSet[]; }
export interface ImportResult {
  sessionId: string;
  exercises: { exerciseId: string; name: string; matched: boolean; setCount: number }[];
}

/**
 * Zapisz zaimportowaną sesję: dla każdego ćwiczenia dopasuj po nazwie (lub utwórz),
 * dopisz do szablonu treningu (jeśli podany), wstaw serie. Sesja od razu ukończona
 * (finished_at = data), żeby liczyła się do progresu/historii.
 */
export async function importWorkoutSession(opts: { workoutId: string | null; date?: string | null; exercises: ImportExercise[] }): Promise<ImportResult | null> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return null;

  const existing = await listExercises();
  const when = opts.date ? new Date(opts.date + "T12:00:00").toISOString() : new Date().toISOString();

  const { data: sessionData, error: sErr } = await supabase
    .from("wn_sessions")
    .insert({ user_id: userId, workout_id: opts.workoutId, started_at: when, finished_at: when })
    .select("*").single();
  if (sErr || !sessionData) { console.warn("[wn] importSession", sErr?.message); return null; }
  const session = sessionData as WnSession;

  const out: ImportResult["exercises"] = [];
  for (const ie of opts.exercises) {
    if (!ie.name?.trim()) continue;
    let ex = await findExerciseByName(ie.name, existing);
    const matched = !!ex;
    if (!ex) {
      ex = await findOrCreateExercise(ie.name, ie.kind ?? "weighted");
      if (ex) existing.push(ex);
    }
    if (!ex) continue;
    if (opts.workoutId) await addExerciseToWorkout(opts.workoutId, ex.id);
    let idx = 0;
    for (const st of ie.sets ?? []) {
      await upsertSet({ sessionId: session.id, exerciseId: ex.id, setIndex: idx, weightKg: st.weight ?? null, reps: st.reps ?? null, durationSec: st.duration ?? null });
      idx++;
    }
    out.push({ exerciseId: ex.id, name: ex.name, matched, setCount: (ie.sets ?? []).length });
  }
  return { sessionId: session.id, exercises: out };
}

// ──────────────────────────────────────────────────────────────────
// Sesje (sessions) + serie (sets)
// ──────────────────────────────────────────────────────────────────
/**
 * Ostatnia ukończona sesja treningu, która MA ZAPISANE SERIE.
 *
 * Krytyczne: pusta sesja oznaczona jako ukończona (0 serii) nie może przesłaniać
 * realnych danych sprzed tygodnia — inaczej podpowiedzi ciężarów i ghost
 * „Ostatnio:" znikają, mimo że dane siedzą w bazie. Dlatego przeglądamy kilka
 * ostatnich sesji i bierzemy pierwszą z serią.
 */
export async function getLastFinishedSession(workoutId: string): Promise<WnSessionWithSets | null> {
  const supabase = createClient();
  const { data: sessions, error } = await supabase
    .from("wn_sessions")
    .select("*")
    .eq("workout_id", workoutId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(12);
  if (error || !sessions || !sessions.length) return null;

  const list = sessions as WnSession[];
  const { data: allSets } = await supabase
    .from("wn_sets")
    .select("*")
    .in("session_id", list.map((s) => s.id))
    .order("set_index", { ascending: true });
  const rows = (allSets ?? []) as WnSet[];

  for (const session of list) {
    const sets = rows.filter((r) => r.session_id === session.id);
    if (sets.length) return { ...session, sets };
  }
  return null; // wszystkie ostatnie sesje puste
}

/**
 * Wchodzi w trening: WZNAWIA trwającą (nieukończoną) sesję zamiast tworzyć nową.
 * Bez tego każde wejście w ekran generowało kolejną pustą sesję-śmiecia, a dane
 * wpisane wcześniej lądowały w osieroconej sesji, niewidocznej w historii.
 */
/**
 * Szablon treningu do SZYBKIEGO logowania: lista ćwiczeń w kolejności + serie
 * z ostatniej sesji TEGO treningu. Dzięki temu dopisanie kolejnego (albo
 * minionego) treningu to zmiana daty i ciężarów, bez przepisywania całości.
 */
export interface TemplateSet { weight: number | null; reps: number | null; duration: number | null }
export interface TemplateExercise {
  exerciseId: string;
  name: string;
  kind: WnKind;
  sets: TemplateSet[];
  /** Data sesji, z której wzięto wartości (null = brak historii). */
  from: string | null;
}

export async function getWorkoutTemplate(workoutId: string): Promise<TemplateExercise[]> {
  const full = await getWorkoutWithExercises(workoutId);
  if (!full) return [];
  const last = await getLastFinishedSession(workoutId);
  return full.exercises.map((we) => {
    const mine = (last?.sets ?? [])
      .filter((s) => s.exercise_id === we.exercise.id)
      .sort((a, b) => a.set_index - b.set_index);
    return {
      exerciseId: we.exercise.id,
      name: we.exercise.name,
      kind: we.exercise.kind,
      sets: mine.length
        ? mine.map((s) => ({ weight: s.weight_kg, reps: s.reps, duration: s.duration_sec }))
        : [{ weight: null, reps: null, duration: null }],
      from: mine.length ? (last?.finished_at ?? null) : null,
    };
  });
}

/** Zapisuje kompletną sesję jednym strzałem (szybkie logowanie / backdatowanie). */
export async function logSession(opts: {
  workoutId: string;
  /** Data treningu (YYYY-MM-DD). Domyślnie dziś. */
  date?: string | null;
  exercises: Array<{ exerciseId: string; sets: TemplateSet[] }>;
}): Promise<string | null> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return null;

  const when = opts.date ? new Date(opts.date + "T12:00:00").toISOString() : new Date().toISOString();
  const { data: sessionData, error: sErr } = await supabase
    .from("wn_sessions")
    .insert({ user_id: userId, workout_id: opts.workoutId, started_at: when, finished_at: when })
    .select("*").single();
  if (sErr || !sessionData) { console.warn("[wn] logSession", sErr?.message); return null; }
  const session = sessionData as WnSession;

  const rows: Array<Record<string, unknown>> = [];
  for (const ex of opts.exercises) {
    let idx = 0;
    for (const s of ex.sets) {
      if (s.weight == null && s.reps == null && s.duration == null) continue;
      rows.push({
        session_id: session.id, exercise_id: ex.exerciseId, set_index: idx++,
        weight_kg: s.weight, reps: s.reps, duration_sec: s.duration,
      });
    }
  }
  if (rows.length) {
    const { error } = await supabase.from("wn_sets").insert(rows);
    if (error) { console.warn("[wn] logSession sets", error.message); return null; }
  }
  return session.id;
}

// ──────────────────────────────────────────────────────────────────
// Edycja ZAPISANYCH treningów (nazwa / data / ćwiczenia / serie)
// ──────────────────────────────────────────────────────────────────
export interface SavedSession {
  id: string;
  /** Data w formacie YYYY-MM-DD (do inputa typu date). */
  date: string;
  startedAt: string;
  finished: boolean;
  setCount: number;
  exerciseCount: number;
  volume: number;
}

/** Zapisane sesje treningu — od najnowszej. Puste sesje pomijamy. */
export async function listSessions(workoutId: string): Promise<SavedSession[]> {
  const supabase = createClient();
  const { data: sessions, error } = await supabase
    .from("wn_sessions").select("*").eq("workout_id", workoutId)
    .order("started_at", { ascending: false }).limit(60);
  if (error || !sessions?.length) return [];
  const list = sessions as WnSession[];
  const { data: setRows } = await supabase
    .from("wn_sets").select("*").in("session_id", list.map((s) => s.id));
  const rows = (setRows ?? []) as WnSet[];
  return list
    .map((s) => {
      const mine = rows.filter((r) => r.session_id === s.id);
      return {
        id: s.id,
        date: (s.started_at ?? "").slice(0, 10),
        startedAt: s.started_at,
        finished: !!s.finished_at,
        setCount: mine.length,
        exerciseCount: new Set(mine.map((r) => r.exercise_id)).size,
        volume: Math.round(mine.reduce((sum, r) => sum + (r.weight_kg ?? 0) * (r.reps ?? 0), 0)),
      };
    })
    .filter((s) => s.setCount > 0);
}

export interface EditableSession {
  sessionId: string;
  workoutId: string | null;
  workoutName: string;
  date: string;
  exercises: Array<{ exerciseId: string; name: string; kind: WnKind; sets: TemplateSet[] }>;
}

/** Wczytuje zapisaną sesję do edycji: nazwa treningu, data, ćwiczenia z seriami. */
export async function getSessionForEdit(sessionId: string): Promise<EditableSession | null> {
  const supabase = createClient();
  const { data: s } = await supabase.from("wn_sessions").select("*").eq("id", sessionId).single();
  if (!s) return null;
  const session = s as WnSession;

  let workoutName = "Trening";
  if (session.workout_id) {
    const { data: w } = await supabase.from("wn_workouts").select("name").eq("id", session.workout_id).single();
    if (w?.name) workoutName = w.name as string;
  }

  const { data: setRows } = await supabase
    .from("wn_sets").select("*").eq("session_id", sessionId).order("set_index", { ascending: true });
  const rows = (setRows ?? []) as WnSet[];
  const ids = [...new Set(rows.map((r) => r.exercise_id))];
  const { data: exRows } = ids.length
    ? await supabase.from("wn_exercises").select("*").in("id", ids)
    : { data: [] };
  const byId = new Map((exRows ?? []).map((e) => [(e as WnExercise).id, e as WnExercise]));

  return {
    sessionId,
    workoutId: session.workout_id,
    workoutName,
    date: (session.started_at ?? "").slice(0, 10),
    exercises: ids.map((id) => ({
      exerciseId: id,
      name: byId.get(id)?.name ?? "Ćwiczenie",
      kind: byId.get(id)?.kind ?? "weighted",
      sets: rows.filter((r) => r.exercise_id === id)
        .map((r) => ({ weight: r.weight_kg, reps: r.reps, duration: r.duration_sec })),
    })),
  };
}

/** Przesuwa zapisany trening na inną datę (start i koniec razem). */
export async function updateSessionDate(sessionId: string, date: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const supabase = createClient();
  const when = new Date(date + "T12:00:00").toISOString();
  const { data: cur } = await supabase.from("wn_sessions").select("finished_at").eq("id", sessionId).single();
  const patch: Record<string, string> = { started_at: when };
  if (cur?.finished_at) patch.finished_at = when;
  const { error } = await supabase.from("wn_sessions").update(patch).eq("id", sessionId);
  if (error) { console.warn("[wn] updateSessionDate", error.message); return false; }
  return true;
}

/**
 * Nadpisuje serie zapisanej sesji.
 *
 * Kasujemy i wstawiamy od nowa, bo edycja zmienia też LICZBĘ serii i skład
 * ćwiczeń — update po kluczu zostawiałby sieroty po usuniętych wierszach.
 * Nowe serie wstawiamy PRZED skasowaniem starych tylko wtedy, gdy jest co
 * wstawiać: pusta lista oznaczałaby wykasowanie całego treningu, więc taką
 * prośbę odrzucamy (od usuwania jest deleteSession).
 */
export async function replaceSessionSets(
  sessionId: string,
  exercises: Array<{ exerciseId: string; sets: TemplateSet[] }>,
): Promise<boolean> {
  const supabase = createClient();
  const rows: Array<Record<string, unknown>> = [];
  for (const ex of exercises) {
    let idx = 0;
    for (const s of ex.sets) {
      if (s.weight == null && s.reps == null && s.duration == null) continue;
      rows.push({
        session_id: sessionId, exercise_id: ex.exerciseId, set_index: idx++,
        weight_kg: s.weight, reps: s.reps, duration_sec: s.duration,
      });
    }
  }
  if (!rows.length) return false; // nie kasujemy treningu „przez pomyłkę"

  const { error: delErr } = await supabase.from("wn_sets").delete().eq("session_id", sessionId);
  if (delErr) { console.warn("[wn] replaceSessionSets delete", delErr.message); return false; }
  const { error } = await supabase.from("wn_sets").insert(rows);
  if (error) { console.warn("[wn] replaceSessionSets insert", error.message); return false; }
  return true;
}

/** Usuwa zapisany trening razem z seriami. */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const supabase = createClient();
  await supabase.from("wn_sets").delete().eq("session_id", sessionId);
  const { error } = await supabase.from("wn_sessions").delete().eq("id", sessionId);
  if (error) { console.warn("[wn] deleteSession", error.message); return false; }
  return true;
}

/** Wypisuje ćwiczenie z szablonu treningu (serie z historii zostają). */
export async function removeExerciseFromWorkout(workoutId: string, exerciseId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("wn_workout_exercises").delete().eq("workout_id", workoutId).eq("exercise_id", exerciseId);
  if (error) { console.warn("[wn] removeExerciseFromWorkout", error.message); return false; }
  return true;
}

export async function startSession(workoutId: string): Promise<WnSession | null> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return null;

  const { data: open } = await supabase
    .from("wn_sessions")
    .select("*")
    .eq("workout_id", workoutId)
    .eq("user_id", userId)
    .is("finished_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (open && open.length) return open[0] as WnSession;

  const { data, error } = await supabase
    .from("wn_sessions")
    .insert({ user_id: userId, workout_id: workoutId })
    .select("*").single();
  if (error) { console.warn("[wn] startSession", error.message); return null; }
  return data as WnSession;
}

/**
 * Kończy trening. Sesja BEZ ANI JEDNEJ SERII jest usuwana zamiast oznaczana jako
 * ukończona — pusty „ukończony" trening zaśmieca historię i (co gorsza) przesłania
 * podpowiedzi z poprzedniego, realnego treningu.
 */
export async function finishSession(sessionId: string): Promise<boolean> {
  const supabase = createClient();
  const { count } = await supabase
    .from("wn_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (!count) {
    const { error: delErr } = await supabase.from("wn_sessions").delete().eq("id", sessionId);
    if (delErr) console.warn("[wn] finishSession (usuwanie pustej)", delErr.message);
    await clearActiveDraft();
    return true;
  }

  const { error } = await supabase
    .from("wn_sessions").update({ finished_at: new Date().toISOString() }).eq("id", sessionId);
  if (error) { console.warn("[wn] finishSession", error.message); return false; }
  await clearActiveDraft();
  return true;
}

export interface UpsertSetInput {
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
}

export async function upsertSet(input: UpsertSetInput): Promise<WnSet | null> {
  const supabase = createClient();
  const row = {
    session_id: input.sessionId,
    exercise_id: input.exerciseId,
    set_index: input.setIndex,
    weight_kg: input.weightKg ?? null,
    reps: input.reps ?? null,
    duration_sec: input.durationSec ?? null,
  };
  const { data, error } = await supabase
    .from("wn_sets")
    .upsert(row, { onConflict: "session_id,exercise_id,set_index" })
    .select("*").single();
  if (error) {
    // Offline / błąd sieci → kolejkuj do późniejszej synchronizacji.
    console.warn("[wn] upsertSet (kolejkuję)", error.message);
    await queuePendingSet(row);
    return null;
  }
  return data as WnSet;
}

export async function deleteSet(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("wn_sets").delete().eq("id", id);
  if (error) { console.warn("[wn] deleteSet", error.message); return false; }
  return true;
}

/** Usuwa serię po kluczu logicznym (session+exercise+index) — ActiveWorkout nie
 *  trzyma id serii, tylko indeks. Bezpieczne, gdy seria nie była jeszcze zapisana
 *  (match nic nie znajdzie → brak błędu). */
export async function deleteSetByKey(input: { sessionId: string; exerciseId: string; setIndex: number }): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("wn_sets").delete()
    .match({ session_id: input.sessionId, exercise_id: input.exerciseId, set_index: input.setIndex });
  if (error) { console.warn("[wn] deleteSetByKey", error.message); return false; }
  return true;
}

export async function getSessionSets(sessionId: string): Promise<WnSet[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("wn_sets").select("*").eq("session_id", sessionId).order("set_index", { ascending: true });
  return (data ?? []) as WnSet[];
}

// ──────────────────────────────────────────────────────────────────
// Historia + progres (na bazie wn_exercise_top_sets / wn_sets)
// ──────────────────────────────────────────────────────────────────
/**
 * Historia ćwiczenia. `workoutId` ZAWĘŻA wynik do jednego treningu — to kluczowe,
 * bo to samo ćwiczenie robione w treningu A (np. 15×100) i B (5×120) to dwie
 * niezależne linie progresu i nie wolno ich mieszać.
 *
 * Gdy w danym treningu są mniej niż 2 sesje z tym ćwiczeniem, wracamy do
 * historii globalnej — inaczej ktoś trenujący raz w tygodniu nie zobaczyłby nic.
 */
export async function getExerciseHistory(exerciseId: string, workoutId?: string | null): Promise<WnHistoryPoint[]> {
  const supabase = createClient();
  // Wszystkie serie tego ćwiczenia z UKOŃCZONYCH sesji + data i trening sesji.
  const { data, error } = await supabase
    .from("wn_sets")
    .select("*, session:wn_sessions!inner(id, finished_at, workout_id)")
    .eq("exercise_id", exerciseId)
    .not("session.finished_at", "is", null);
  if (error || !data) { if (error) console.warn("[wn] getExerciseHistory", error.message); return []; }

  const bySession = new Map<string, { finishedAt: string; workoutId: string | null; sets: WnSet[] }>();
  for (const row of data as unknown as Array<WnSet & { session: { id: string; finished_at: string; workout_id: string | null } }>) {
    const sid = row.session.id;
    if (!bySession.has(sid)) bySession.set(sid, { finishedAt: row.session.finished_at, workoutId: row.session.workout_id, sets: [] });
    const { session: _omit, ...setRow } = row;
    void _omit;
    bySession.get(sid)!.sets.push(setRow as WnSet);
  }

  const toPoints = (entries: Array<[string, { finishedAt: string; workoutId: string | null; sets: WnSet[] }]>): WnHistoryPoint[] => {
    const pts = entries.map(([sessionId, v]) => ({
      sessionId,
      finishedAt: v.finishedAt,
      workoutId: v.workoutId,
      topWeight: topOfSets(v.sets, false),
      topReps: topOfSets(v.sets, true),
      topIndex: topIndex(v.sets),
      sets: v.sets.sort((a, b) => a.set_index - b.set_index),
    }));
    // chronologicznie (najstarsze → najnowsze) — wykres oczekuje rosnącej osi czasu
    pts.sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime());
    return pts;
  };

  const all = [...bySession.entries()];
  if (workoutId) {
    // ŻADNEGO mieszania: historia zawężona do tego treningu, nawet jeśli jest
    // w nim tylko jedna sesja. Wcześniejszy fallback do historii globalnej
    // pokazywał „progres" złożony z innych treningów — czyli bzdurę.
    return toPoints(all.filter(([, v]) => v.workoutId === workoutId));
  }
  return toPoints(all);
}

/** Surowy typ ćwiczenia. */
async function kindOfExercise(exerciseId: string): Promise<WnKind | null> {
  const supabase = createClient();
  const { data } = await supabase.from("wn_exercises").select("kind").eq("id", exerciseId).single();
  return (data as { kind?: WnKind } | null)?.kind ?? null;
}

/**
 * Czy progres tego ćwiczenia liczymy POWTÓRZENIAMI, a nie kilogramami.
 *
 * Sam typ „bodyweight" nie wystarcza: dipy czy podciąganie robi się najpierw
 * z masą ciała, a potem z pasem i dociążeniem. Od chwili, gdy w historii
 * pojawi się seria z ciężarem, ćwiczenie mierzymy kilogramami — inaczej
 * dołożone 20 kg nie miałoby żadnego odzwierciedlenia w progresie.
 *
 * Liczone z historii, którą i tak pobieramy — bez dodatkowego zapytania.
 */
function repsMetric(kind: WnKind | null, history: WnHistoryPoint[]): boolean {
  if (kind !== "bodyweight") return false;
  return !history.some((p) => p.sets.some((s) => (s.weight_kg ?? 0) > 0));
}

export async function getExerciseProgress(exerciseId: string): Promise<WnExerciseProgress> {
  const [kind, history] = await Promise.all([kindOfExercise(exerciseId), getExerciseHistory(exerciseId)]);
  const byReps = repsMetric(kind, history);
  const metric: "weight" | "reps" = byReps ? "reps" : "weight";
  const valOf = (p: WnHistoryPoint) => (byReps ? p.topReps : p.topWeight);
  const vals = history.map(valOf).filter((v): v is number => v != null);
  if (!vals.length) return { metric, record: null, weekDelta: null, sinceStartDelta: null };
  const record = Math.max(...vals);
  const last = valOf(history[history.length - 1]);
  const prev = history.length >= 2 ? valOf(history[history.length - 2]) : null;
  const first = valOf(history[0]);
  return {
    metric,
    record,
    weekDelta: last != null && prev != null ? round2(last - prev) : null,
    sinceStartDelta: last != null && first != null ? round2(last - first) : null,
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
/** Zaokrąglenie do 0,5 kg — realne talerze/hantle (nikt nie liczy 1RM co do grama). */
function round05(n: number): number { return Math.round(n * 2) / 2; }

// ──────────────────────────────────────────────────────────────────
// 1RM (jedno powtórzenie maksymalne) + statystyki zaawansowane
// ──────────────────────────────────────────────────────────────────

/**
 * Szacowany 1RM na podstawie serii (ciężar × powtórzenia).
 * Uśredniamy dwa najlepiej zwalidowane wzory:
 *   • Epley:   1RM = w · (1 + reps/30)
 *   • Brzycki: 1RM = w · 36/(37 − reps)
 * Najdokładniejsze dla ≤ ~12 powt. (powyżej wzory zawyżają — dlatego clamp do 12).
 * reps = 1 → to już jest 1RM (zwracamy sam ciężar). Bez ciężaru/powt. → null.
 */
/**
 * INDEKS SIŁY — wspólna miara do porównywania serii o RÓŻNYCH zakresach powtórzeń.
 *
 * Wzór Wathana. W przeciwieństwie do Epleya/Brzyckiego zachowuje się sensownie
 * także przy 15-25 powtórzeniach, więc pozwala uczciwie odpowiedzieć na pytanie
 * „czy 15×100 kg to progres względem 5×120 kg?" (indeks 151 vs 140 → tak, 15×100
 * jest mocniejsze). Używany WYŁĄCZNIE do wykrywania progresu/regresu — do
 * wyświetlania szacowanego 1RM zostaje estimate1RM.
 */
export function strengthIndex(weight: number | null | undefined, reps: number | null | undefined): number | null {
  if (weight == null || reps == null || weight <= 0 || reps < 1) return null;
  const r = Math.min(reps, 30);
  return round05((100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * r)));
}

/** Najlepszy indeks siły w zestawie serii. */
function topIndex(sets: WnSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const v = strengthIndex(s.weight_kg, s.reps);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}

/** Najmocniejsza seria sesji — konkretny ciężar i konkretne powtórzenia. */
export interface BestSet { weight: number | null; reps: number | null; date: string }

/**
 * Wybiera NAJMOCNIEJSZĄ serię sesji.
 *
 * Indeks siły służy tu wyłącznie do WYBORU serii (żeby 5×120 kg wygrało
 * z 12×60 kg), a nie do pokazywania użytkownikowi. Na ekran idą zawsze
 * prawdziwe kilogramy i powtórzenia — „+3,4 pkt siły" nikomu nic nie mówi.
 * Bez ciężaru (ćwiczenia z masą ciała) decydują same powtórzenia.
 */
export function bestSetOf(sets: WnSet[], date: string): BestSet | null {
  let best: WnSet | null = null;
  let bestScore = -Infinity;
  for (const s of sets) {
    if (s.weight_kg == null && s.reps == null) continue;
    const score = strengthIndex(s.weight_kg, s.reps)
      ?? (s.weight_kg != null ? s.weight_kg * 1000 : (s.reps ?? 0));
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best ? { weight: best.weight_kg, reps: best.reps, date } : null;
}

/** Różnica dwóch serii: ile kilogramów i ile powtórzeń w górę/w dół. */
export interface SetDelta { weight: number | null; reps: number | null }
function deltaOf(now: BestSet | null, before: BestSet | null): SetDelta {
  if (!now || !before) return { weight: null, reps: null };
  return {
    weight: now.weight != null && before.weight != null ? round2(now.weight - before.weight) : null,
    reps: now.reps != null && before.reps != null ? now.reps - before.reps : null,
  };
}

export function estimate1RM(weight: number | null | undefined, reps: number | null | undefined): number | null {
  if (weight == null || reps == null || weight <= 0 || reps < 1) return null;
  if (reps === 1) return round05(weight);
  const r = Math.min(reps, 12);
  const epley = weight * (1 + r / 30);
  const brzycki = weight * 36 / (37 - r);
  return round05((epley + brzycki) / 2);
}

export interface WnExerciseStats {
  metric: "weight" | "reps";
  sessions: number;
  firstTop: number | null;      // najcięższa seria w PIERWSZEJ (najstarszej) sesji
  firstDate: string | null;
  lastTop: number | null;       // najcięższa seria w OSTATNIEJ sesji
  lastDate: string | null;
  record: number | null;        // rekord po wszystkich sesjach
  recordDate: string | null;
  weekDelta: number | null;     // ostatnia − poprzednia sesja
  addedAbs: number | null;      // rekord − pierwsza (ile kg/powt. dodane od startu)
  addedPct: number | null;      // addedAbs / firstTop · 100
  best1RM: number | null;       // najlepszy szacowany 1RM po całej historii (weighted)
  best1RMWeight: number | null; // ciężar serii dającej best1RM
  best1RMReps: number | null;   // powt. serii dającej best1RM
  current1RM: number | null;    // najlepszy szac. 1RM z OSTATNIEJ sesji

  // ── porównanie odporne na różne zakresy powtórzeń (indeks siły) ──
  /** Indeks siły ostatniej sesji. */
  indexNow: number | null;
  /** Indeks siły poprzedniej sesji (tego samego treningu). */
  indexPrev: number | null;
  /** Indeks pierwszej sesji. */
  indexFirst: number | null;
  /** Zmiana indeksu vs poprzednia sesja — DODATNIA = realny progres, nawet gdy ciężar spadł. */
  indexDelta: number | null;
  /** Kierunek: progres / regres / bez zmian. */
  trend: "up" | "down" | "flat" | null;
  /** true → statystyki policzone w obrębie JEDNEGO treningu (nie mieszane z innymi). */
  scopedToWorkout: boolean;
  /** Ile dni minęło od pierwszej sesji (liczone przy pobraniu, nie w renderze). */
  sinceDays: number | null;

  // ── progres w KONKRETNYCH liczbach: kilogramy i powtórzenia ──
  /** Najmocniejsza seria PIERWSZEGO wpisanego treningu — punkt odniesienia. */
  firstBest: BestSet | null;
  /** Najmocniejsza seria poprzedniej sesji. */
  prevBest: BestSet | null;
  /** Najmocniejsza seria ostatniej sesji. */
  lastBest: BestSet | null;
  /** Ile kg i powtórzeń przybyło (lub ubyło) OD PIERWSZEGO treningu. */
  sinceStart: SetDelta;
  /** To samo względem poprzedniej sesji. */
  sinceLast: SetDelta;
}

/** Pełne statystyki ćwiczenia: rekord, przyrost od startu (kg + %), 1RM, tydzień. */
export async function getExerciseStats(exerciseId: string, workoutId?: string | null): Promise<WnExerciseStats> {
  const [kind, history] = await Promise.all([kindOfExercise(exerciseId), getExerciseHistory(exerciseId, workoutId)]);
  const byReps = repsMetric(kind, history);
  const metric: "weight" | "reps" = byReps ? "reps" : "weight";
  const topOf = (p: WnHistoryPoint) => (byReps ? p.topReps : p.topWeight);
  const scopedToWorkout = !!workoutId && history.length > 0 && history.every((p) => p.workoutId === workoutId);
  const empty: WnExerciseStats = {
    metric, sessions: 0, firstTop: null, firstDate: null, lastTop: null, lastDate: null,
    record: null, recordDate: null, weekDelta: null, addedAbs: null, addedPct: null,
    best1RM: null, best1RMWeight: null, best1RMReps: null, current1RM: null,
    indexNow: null, indexPrev: null, indexFirst: null, indexDelta: null, trend: null, scopedToWorkout, sinceDays: null,
    firstBest: null, prevBest: null, lastBest: null,
    sinceStart: { weight: null, reps: null }, sinceLast: { weight: null, reps: null },
  };

  const withVal = history.filter((p) => topOf(p) != null);
  if (!withVal.length) return empty;

  const first = withVal[0], last = withVal[withVal.length - 1];
  const firstTop = topOf(first)!, lastTop = topOf(last)!;
  let record = -Infinity, recordDate: string | null = null;
  for (const p of withVal) { const v = topOf(p)!; if (v > record) { record = v; recordDate = p.finishedAt; } }
  const prev = withVal.length >= 2 ? topOf(withVal[withVal.length - 2]) : null;
  const addedAbs = round2(record - firstTop);
  const addedPct = firstTop > 0 ? Math.round((addedAbs / firstTop) * 1000) / 10 : null;

  // 1RM tylko dla ćwiczeń z ciężarem (bodyweight nie ma sensownego 1RM).
  let best1RM: number | null = null, best1RMWeight: number | null = null, best1RMReps: number | null = null, current1RM: number | null = null;
  if (!byReps) {
    for (const p of history) for (const s of p.sets) {
      const e = estimate1RM(s.weight_kg, s.reps);
      if (e != null && (best1RM == null || e > best1RM)) { best1RM = e; best1RMWeight = s.weight_kg; best1RMReps = s.reps; }
    }
    for (const s of last.sets) {
      const e = estimate1RM(s.weight_kg, s.reps);
      if (e != null && (current1RM == null || e > current1RM)) current1RM = e;
    }
  }

  // ── indeks siły: uczciwe porównanie sesji o różnych zakresach powtórzeń ──
  const idxOf = (p: WnHistoryPoint) => p.topIndex ?? topIndex(p.sets);
  const indexNow = idxOf(last);
  const indexPrev = withVal.length >= 2 ? idxOf(withVal[withVal.length - 2]) : null;
  const indexFirst = idxOf(first);
  const indexDelta = indexNow != null && indexPrev != null ? round2(indexNow - indexPrev) : null;
  // próg 1 kg — drobne wahania to nie progres ani regres
  const trend: "up" | "down" | "flat" | null =
    indexDelta == null ? null : indexDelta > 1 ? "up" : indexDelta < -1 ? "down" : "flat";

  // ── progres w liczbach, które coś znaczą: kilogramy i powtórzenia ──
  const prevPoint = withVal.length >= 2 ? withVal[withVal.length - 2] : null;
  const firstBest = bestSetOf(first.sets, first.finishedAt);
  const lastBest = bestSetOf(last.sets, last.finishedAt);
  const prevBest = prevPoint ? bestSetOf(prevPoint.sets, prevPoint.finishedAt) : null;

  return {
    metric, sessions: withVal.length,
    firstTop, firstDate: first.finishedAt, lastTop, lastDate: last.finishedAt,
    record: record === -Infinity ? null : record, recordDate,
    weekDelta: prev != null ? round2(lastTop - prev) : null,
    addedAbs, addedPct, best1RM, best1RMWeight, best1RMReps, current1RM,
    indexNow, indexPrev, indexFirst, indexDelta, trend, scopedToWorkout,
    sinceDays: Math.max(0, Math.floor((Date.now() - new Date(first.finishedAt).getTime()) / 86400000)),
    firstBest, prevBest, lastBest,
    sinceStart: deltaOf(lastBest, firstBest),
    sinceLast: deltaOf(lastBest, prevBest),
  };
}

// ──────────────────────────────────────────────────────────────────
// Podsumowanie sesji — skondensowany widok całego treningu (do zrzutu/wysłania)
// ──────────────────────────────────────────────────────────────────
export interface WnSummarySet { weight: number | null; reps: number | null; duration: number | null; }
export interface WnSummaryExercise {
  exerciseId: string; name: string; kind: WnKind;
  sets: WnSummarySet[];
  topWeight: number | null; topReps: number | null;
  volume: number; est1RM: number | null; isPR: boolean;
}
export interface WnSessionSummary {
  sessionId: string; workoutName: string | null; date: string;
  exercises: WnSummaryExercise[];
  totalVolume: number; totalSets: number; prCount: number;
}

/** Skondensowane podsumowanie jednej sesji treningowej. */
export async function getSessionSummary(sessionId: string): Promise<WnSessionSummary | null> {
  const supabase = createClient();
  const { data: sess } = await supabase
    .from("wn_sessions").select("*, workout:wn_workouts(name)").eq("id", sessionId).single();
  if (!sess) return null;
  const s = sess as WnSession & { workout: { name: string } | null };

  const { data: setsData } = await supabase
    .from("wn_sets")
    .select("*, exercise:wn_exercises!inner(id, name, kind)")
    .eq("session_id", sessionId)
    // Kolejność ĆWICZEŃ bierze się z kolejności wierszy, więc musi być
    // deterministyczna — inaczej podsumowanie tego samego treningu układa się
    // za każdym otwarciem inaczej. created_at = kolejność logowania serii,
    // czyli ta, w jakiej trening był naprawdę wykonywany.
    .order("created_at", { ascending: true })
    .order("set_index", { ascending: true });
  const rows = (setsData ?? []) as unknown as Array<WnSet & { exercise: { id: string; name: string; kind: WnKind } }>;

  const order: string[] = [];
  const byEx = new Map<string, { name: string; kind: WnKind; sets: WnSet[] }>();
  for (const r of rows) {
    const id = r.exercise.id;
    if (!byEx.has(id)) { byEx.set(id, { name: r.exercise.name, kind: r.exercise.kind, sets: [] }); order.push(id); }
    byEx.get(id)!.sets.push(r);
  }

  const exercises: WnSummaryExercise[] = [];
  let totalVolume = 0, totalSets = 0, prCount = 0;
  for (const id of order) {
    const g = byEx.get(id)!;
    const byReps = g.kind === "bodyweight";
    const topWeight = topOfSets(g.sets, false);
    const topReps = topOfSets(g.sets, true);
    let volume = 0, est1RM: number | null = null;
    for (const st of g.sets) {
      if (st.weight_kg != null && st.reps != null) volume += st.weight_kg * st.reps;
      const e = estimate1RM(st.weight_kg, st.reps);
      if (e != null && (est1RM == null || e > est1RM)) est1RM = e;
    }
    // PR = najcięższa seria tej sesji ≥ rekord z pozostałych ukończonych sesji.
    const hist = await getExerciseHistory(id);
    const allTops = hist.map((p) => (byReps ? p.topReps : p.topWeight)).filter((v): v is number => v != null);
    const allTime = allTops.length ? Math.max(...allTops) : null;
    const myTop = byReps ? topReps : topWeight;
    const isPR = allTime != null && myTop != null && myTop >= allTime;
    if (isPR) prCount++;
    totalVolume += volume; totalSets += g.sets.length;
    exercises.push({
      exerciseId: id, name: g.name, kind: g.kind,
      sets: g.sets.map((st) => ({ weight: st.weight_kg, reps: st.reps, duration: st.duration_sec })),
      topWeight, topReps, volume: Math.round(volume), est1RM, isPR,
    });
  }

  return {
    sessionId, workoutName: s.workout?.name ?? null, date: s.finished_at ?? s.started_at,
    exercises, totalVolume: Math.round(totalVolume), totalSets, prCount,
  };
}

// ──────────────────────────────────────────────────────────────────
// Cache lokalny (offline safety) — @capacitor/preferences via native-storage
// ──────────────────────────────────────────────────────────────────
const ACTIVE_KEY = "wn_active_session";
const PENDING_KEY = "wn_pending_sets";

export interface DraftSet {
  exerciseId: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
}
export interface ActiveDraft {
  sessionId: string;
  workoutId: string;
  sets: DraftSet[];
  updatedAt: string;
}

export async function saveActiveDraft(draft: ActiveDraft): Promise<void> {
  await nsSet(ACTIVE_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
}
export async function getActiveDraft(): Promise<ActiveDraft | null> {
  const raw = await nsGet(ACTIVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as ActiveDraft; } catch { return null; }
}
export async function clearActiveDraft(): Promise<void> {
  await nsRemove(ACTIVE_KEY);
}

type PendingRow = {
  session_id: string; exercise_id: string; set_index: number;
  weight_kg: number | null; reps: number | null; duration_sec: number | null;
};
async function queuePendingSet(row: PendingRow): Promise<void> {
  const raw = await nsGet(PENDING_KEY);
  let queue: PendingRow[] = [];
  if (raw) { try { queue = JSON.parse(raw); } catch {} }
  // zastąp istniejący wpis dla tej samej (sesja, ćwiczenie, seria)
  queue = queue.filter((q) => !(q.session_id === row.session_id && q.exercise_id === row.exercise_id && q.set_index === row.set_index));
  queue.push(row);
  await nsSet(PENDING_KEY, JSON.stringify(queue));
}

/** Wyślij zakolejkowane serie do Supabase. Wołaj po odzyskaniu sieci / na starcie. */
export async function flushPendingSets(): Promise<number> {
  const raw = await nsGet(PENDING_KEY);
  if (!raw) return 0;
  let queue: PendingRow[] = [];
  try { queue = JSON.parse(raw); } catch { return 0; }
  if (!queue.length) return 0;
  const supabase = createClient();
  const failed: PendingRow[] = [];
  let synced = 0;
  for (const row of queue) {
    const { error } = await supabase.from("wn_sets").upsert(row, { onConflict: "session_id,exercise_id,set_index" });
    if (error) failed.push(row); else synced++;
  }
  if (failed.length) await nsSet(PENDING_KEY, JSON.stringify(failed));
  else await nsRemove(PENDING_KEY);
  return synced;
}
