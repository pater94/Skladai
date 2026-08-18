/**
 * FORMA — jak pokazywać progres, żeby dało się go zrozumieć bez tłumacza.
 *
 * Wcześniej ekrany pokazywały „+3,4 pkt siły" — liczbę z wewnętrznego indeksu
 * Wathana, która nikomu nic nie mówi. Teraz wszędzie idą KONKRETY: ile
 * kilogramów i ile powtórzeń przybyło albo ubyło.
 *
 * Indeks siły został tam, gdzie jest przydatny — do WYBORU najmocniejszej serii
 * sesji (patrz bestSetOf) — ale nigdy nie trafia na ekran.
 */

import type { SetDelta } from "./workoutJournal";

export const PROGRESS_GREEN = "#5fd39a";
export const PROGRESS_RED = "#f87171";
export const PROGRESS_NEUTRAL = "rgba(var(--fg-rgb, 255,255,255),0.72)";

/** Liczba ze znakiem, bez zbędnych zer: 2.5 → „+2,5", −3 → „−3". */
function signed(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const txt = String(Math.abs(rounded)).replace(".", ",");
  return `${rounded > 0 ? "+" : "−"}${txt}`;
}

/**
 * Zamienia różnicę serii na tekst dla użytkownika.
 * Zwraca null, gdy nie ma czego porównać (np. pierwszy trening w historii).
 */
export function formatDelta(d: SetDelta | null | undefined): string | null {
  if (!d) return null;
  const parts: string[] = [];
  if (d.weight != null && d.weight !== 0) parts.push(`${signed(d.weight)} kg`);
  if (d.reps != null && d.reps !== 0) parts.push(`${signed(d.reps)} ${repsWord(Math.abs(d.reps))}`);
  if (parts.length) return parts.join(" · ");
  // oba zera to też informacja — „utrzymane" jest czymś innym niż brak danych
  if (d.weight == null && d.reps == null) return null;
  return "bez zmian";
}

/** Polska odmiana: 1 powtórzenie, 2-4 powtórzenia, 5+ powtórzeń. */
function repsWord(n: number): string {
  if (n === 1) return "powtórzenie";
  const last = n % 10, teen = n % 100;
  if (last >= 2 && last <= 4 && !(teen >= 12 && teen <= 14)) return "powtórzenia";
  return "powtórzeń";
}

/**
 * Kolor werdyktu. Świadomie NIE rozstrzygamy przypadku mieszanego
 * (mniej kilogramów, ale więcej powtórzeń) — to zależy od celu treningowego,
 * więc pokazujemy go neutralnie zamiast wmawiać użytkownikowi regres.
 */
export function deltaColor(d: SetDelta | null | undefined): string {
  if (!d) return PROGRESS_NEUTRAL;
  const w = d.weight ?? 0, r = d.reps ?? 0;
  if (w === 0 && r === 0) return PROGRESS_NEUTRAL;
  if (w >= 0 && r >= 0) return PROGRESS_GREEN;
  if (w <= 0 && r <= 0) return PROGRESS_RED;
  return PROGRESS_NEUTRAL;
}

/** Podpis serii odniesienia: „100 kg × 5" albo „12 powt." dla masy ciała. */
export function formatSet(s: { weight: number | null; reps: number | null } | null | undefined): string | null {
  if (!s) return null;
  if (s.weight != null && s.reps != null) return `${s.weight} kg × ${s.reps}`;
  if (s.weight != null) return `${s.weight} kg`;
  if (s.reps != null) return `${s.reps} ${repsWord(s.reps)}`;
  return null;
}

/** Data w formie, którą widać na pierwszy rzut oka: „8 sie 2026". */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}
