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
  topWeight: number | null;
  topReps: number | null;
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

export async function createWorkout(name: string): Promise<WnWorkout | null> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return null;
  // kolejna pozycja na końcu listy
  const existing = await listWorkouts();
  const position = existing.length;
  const { data, error } = await supabase
    .from("wn_workouts")
    .insert({ user_id: userId, name: name.trim() || "Nowy trening", position })
    .select("*")
    .single();
  if (error) { console.warn("[wn] createWorkout", error.message); return null; }
  return data as WnWorkout;
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
export async function getExerciseBaseline(exerciseId: string): Promise<{ metric: "weight" | "reps"; lastTop: number | null; firstTop: number | null; record: number | null; sessions: number }> {
  const byReps = await isBodyweight(exerciseId);
  const hist = await getExerciseHistory(exerciseId);
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
export async function getLastFinishedSession(workoutId: string): Promise<WnSessionWithSets | null> {
  const supabase = createClient();
  const { data: sessions, error } = await supabase
    .from("wn_sessions")
    .select("*")
    .eq("workout_id", workoutId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1);
  if (error || !sessions || !sessions.length) return null;
  const session = sessions[0] as WnSession;
  const { data: sets } = await supabase
    .from("wn_sets").select("*").eq("session_id", session.id).order("set_index", { ascending: true });
  return { ...session, sets: (sets ?? []) as WnSet[] };
}

export async function startSession(workoutId: string): Promise<WnSession | null> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("wn_sessions")
    .insert({ user_id: userId, workout_id: workoutId })
    .select("*").single();
  if (error) { console.warn("[wn] startSession", error.message); return null; }
  return data as WnSession;
}

export async function finishSession(sessionId: string): Promise<boolean> {
  const supabase = createClient();
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

export async function getSessionSets(sessionId: string): Promise<WnSet[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("wn_sets").select("*").eq("session_id", sessionId).order("set_index", { ascending: true });
  return (data ?? []) as WnSet[];
}

// ──────────────────────────────────────────────────────────────────
// Historia + progres (na bazie wn_exercise_top_sets / wn_sets)
// ──────────────────────────────────────────────────────────────────
export async function getExerciseHistory(exerciseId: string): Promise<WnHistoryPoint[]> {
  const supabase = createClient();
  // Wszystkie serie tego ćwiczenia z UKOŃCZONYCH sesji + data sesji.
  const { data, error } = await supabase
    .from("wn_sets")
    .select("*, session:wn_sessions!inner(id, finished_at)")
    .eq("exercise_id", exerciseId)
    .not("session.finished_at", "is", null);
  if (error || !data) { if (error) console.warn("[wn] getExerciseHistory", error.message); return []; }

  const byReps = await isBodyweight(exerciseId);
  const bySession = new Map<string, { finishedAt: string; sets: WnSet[] }>();
  for (const row of data as unknown as Array<WnSet & { session: { id: string; finished_at: string } }>) {
    const sid = row.session.id;
    if (!bySession.has(sid)) bySession.set(sid, { finishedAt: row.session.finished_at, sets: [] });
    const { session: _omit, ...setRow } = row;
    void _omit;
    bySession.get(sid)!.sets.push(setRow as WnSet);
  }
  const points: WnHistoryPoint[] = [...bySession.entries()].map(([sessionId, v]) => ({
    sessionId,
    finishedAt: v.finishedAt,
    topWeight: topOfSets(v.sets, false),
    topReps: topOfSets(v.sets, true),
    sets: v.sets.sort((a, b) => a.set_index - b.set_index),
  }));
  // chronologicznie (najstarsze → najnowsze) — wykres oczekuje rosnącej osi czasu
  points.sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime());
  void byReps;
  return points;
}

async function isBodyweight(exerciseId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.from("wn_exercises").select("kind").eq("id", exerciseId).single();
  return (data as { kind?: WnKind } | null)?.kind === "bodyweight";
}

export async function getExerciseProgress(exerciseId: string): Promise<WnExerciseProgress> {
  const byReps = await isBodyweight(exerciseId);
  const history = await getExerciseHistory(exerciseId);
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
