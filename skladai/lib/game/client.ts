"use client";

/**
 * FORMA RPG — warstwa kliencka.
 *
 * Klient NIE liczy XP ani poziomu. Jedyne, co robi, to prosi serwer
 * o przeliczenie (/api/game/sync) i czyta wynik. Do zapisu ma dostęp wyłącznie
 * do nicku — pilnuje tego RLS, więc nawet request z konsoli nic nie zmieni.
 */

import { createClient } from "@/lib/supabase";
import type { BodyState } from "@/lib/game/body";
import { getWeekSteps } from "@/lib/health-steps";

export interface GameProfile {
  nick: string | null;
  level: number;
  xp: number;
  condition: number;
  stat_sila: number;
  stat_wytrz: number;
  stat_dyscyp: number;
  week_xp: number;
  last_training: string | null;
  // Etap 2 — obecne dopiero po migracji 20260821_game_seasons.sql.
  league?: number;
  best_league?: number;
  cohort?: number;
  season_key?: string | null;
  season_points?: number;
  week_points?: number;
  streak_days?: number;
  best_streak?: number;
  muscle?: number;
  leanness?: number;
  body_samples?: number;
  gender?: "male" | "female" | null;
}

/** Pełna odpowiedź /api/game/sync — profil plus wszystko, co policzył serwer. */
export interface SyncResult {
  profile: GameProfile;
  body: BodyState & { photoSessions: number };
  season: { index: number; name: string; weekOfSeason: number; daysLeft: number; key: string; points: number };
  league: { id: number; cohort: number; weekPoints: number; settled: { rank: number; outcome: string; league: number } | null };
  quests: {
    daily: Array<{ id: string; text: string; target: number; have: number; done: boolean; xp: number; points: number }>;
    weekly: Array<{ id: string; text: string; target: number; have: number; done: boolean; xp: number; points: number }>;
    reward: { xp: number; points: number; dailyBonus: boolean };
  };
  achievements: { unlockedNow: Array<{ id: string; name: string; xp: number }>; ownedCount: number };
  legacyMode?: boolean;
}

export interface BoardRow {
  nick: string;
  league: number;
  cohort: number;
  week_points: number;
  season_points: number;
  level: number;
  muscle: number;
  leanness: number;
  gender: "male" | "female" | null;
  condition: number;
}

export interface RankRow {
  nick: string;
  level: number;
  xp: number;
  week_xp: number;
  stat_sila: number;
  stat_wytrz: number;
  stat_dyscyp: number;
  condition: number;
}

/** Profil postaci zalogowanego użytkownika (bez przeliczania). */
export async function getMyProfile(): Promise<GameProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("gm_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as GameProfile) ?? null;
}

/**
 * Prosi serwer o przeliczenie postaci. Idempotentne — można wołać przy każdym
 * wejściu na ekran. Kroki dołączamy z HealthKit, jeśli są dostępne.
 */
export async function syncCharacter(): Promise<GameProfile | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  let steps: Record<string, number> = {};
  try {
    const week = await getWeekSteps();
    steps = Object.fromEntries(week.map((d) => [d.date, d.steps]));
  } catch { /* brak zgody na dane zdrowotne albo przeglądarka — trudno */ }

  try {
    const res = await fetch("/api/game/sync", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ steps }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.profile as GameProfile) ?? null;
  } catch {
    return null;
  }
}

/** To samo przeliczenie, ale z pełnym wynikiem (sezon, liga, cele, odznaki). */
export async function syncFull(): Promise<SyncResult | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  let steps: Record<string, number> = {};
  try {
    const week = await getWeekSteps();
    steps = Object.fromEntries(week.map((d) => [d.date, d.steps]));
  } catch { /* brak zgody na dane zdrowotne albo przeglądarka */ }

  try {
    const res = await fetch("/api/game/sync", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ steps }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SyncResult;
  } catch {
    return null;
  }
}

/**
 * Tablica ligowa własnej kohorty — te ~30 osób, z którymi realnie się ścigasz.
 * Zwraca pustą listę, gdy migracja etapu 2 jeszcze nie poszła.
 */
export async function getLeagueBoard(league: number, cohort: number): Promise<BoardRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gm_league_board")
    .select("nick, league, cohort, week_points, season_points, level, muscle, leanness, gender, condition")
    .eq("league", league).eq("cohort", cohort)
    .order("week_points", { ascending: false })
    .limit(40);
  if (error) return [];
  return (data as BoardRow[]) ?? [];
}

/** Zdobyte odznaki. Pusta lista również wtedy, gdy tabeli jeszcze nie ma. */
export async function getMyAchievements(): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("gm_achievements").select("achievement_id").eq("user_id", user.id);
  if (error) return [];
  return ((data ?? []) as Array<{ achievement_id: string }>).map((r) => r.achievement_id);
}

/** Zasady dla nicku — krótko i bez pola do podszywania się. */
export function validateNick(nick: string): string | null {
  const n = nick.trim();
  if (n.length < 3) return "Nick musi mieć co najmniej 3 znaki.";
  if (n.length > 16) return "Nick może mieć najwyżej 16 znaków.";
  if (!/^[\p{L}\p{N}_-]+$/u.test(n)) return "Dozwolone są litery, cyfry, myślnik i podkreślnik.";
  return null;
}

/** Ustawia nick. Zwraca komunikat błędu albo null przy powodzeniu. */
export async function setNick(nick: string): Promise<string | null> {
  const err = validateNick(nick);
  if (err) return err;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Zaloguj się, żeby dołączyć do rankingu.";

  const { error } = await supabase
    .from("gm_profiles")
    .upsert({ user_id: user.id, nick: nick.trim() }, { onConflict: "user_id" });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return "Ten nick jest już zajęty.";
    return "Nie udało się zapisać nicku.";
  }
  return null;
}

export type RankMode = "level" | "week";

/** Ranking publiczny. `week` = liga bieżącego tygodnia, zeruje się w poniedziałek. */
export async function getRanking(mode: RankMode, limit = 50): Promise<RankRow[]> {
  const supabase = createClient();
  const col = mode === "week" ? "week_xp" : "xp";
  const { data } = await supabase
    .from("gm_ranking")
    .select("nick, level, xp, week_xp, stat_sila, stat_wytrz, stat_dyscyp, condition")
    .order(col, { ascending: false })
    .limit(limit);
  return (data as RankRow[]) ?? [];
}
