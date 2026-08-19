"use client";

/**
 * FORMA RPG — warstwa kliencka.
 *
 * Klient NIE liczy XP ani poziomu. Jedyne, co robi, to prosi serwer
 * o przeliczenie (/api/game/sync) i czyta wynik. Do zapisu ma dostęp wyłącznie
 * do nicku — pilnuje tego RLS, więc nawet request z konsoli nic nie zmieni.
 */

import { createClient } from "@/lib/supabase";
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
    .select("nick, level, xp, condition, stat_sila, stat_wytrz, stat_dyscyp, week_xp, last_training")
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
