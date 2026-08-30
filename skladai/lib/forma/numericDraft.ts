"use client";

/**
 * FORMA — pola liczbowe, w które da się WPISAĆ liczbę dziesiętną.
 *
 * ── Błąd, który to naprawia ──────────────────────────────────────────────
 * Pola ciężaru były sterowane LICZBĄ: `value={s.weight ?? ""}`. Wpisanie
 * „82," dawało `parseFloat("82.")` = 82, stan wracał do 82, a pole
 * przerysowywało się jako „82" — przecinek znikał w tej samej klatce, w
 * której go wpisałeś. Do części dziesiętnej nie dało się dojść w ogóle;
 * jedyną drogą do połówek był przycisk „+", a 82,5 czy 2,25 były
 * nieosiągalne.
 *
 * ── Jak to działa teraz ──────────────────────────────────────────────────
 * W trakcie pisania pole pokazuje DOKŁADNIE to, co wpisałeś (brudnopis), a
 * do modelu leci liczba wyciągnięta z tego tekstu. Po wyjściu z pola
 * brudnopis znika i zostaje sformatowana wartość. Dzięki temu „82," jest
 * poprawnym stanem przejściowym, a nie zdarzeniem, które się samo cofa.
 */

import { useCallback, useState } from "react";

/** Liczba z tekstu. Przyjmuje przecinek i kropkę, „82," czyta jako 82. */
export function parseDecimal(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "" || t === "." || t === "-") return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  // Pół grama nikomu nie jest potrzebne, a dwa miejsca po przecinku
  // wystarczą na 2,25 kg (najmniejszy realny talerzyk ułamkowy).
  return Math.round(n * 100) / 100;
}

/** Liczba do wyświetlenia po polsku — z przecinkiem, bez zbędnych zer. */
export function formatDecimal(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(v).replace(".", ",");
}

/** Odsiewa znaki, których w liczbie być nie może, i pilnuje jednego separatora. */
function sanitize(raw: string): string {
  const only = raw.replace(/[^0-9.,]/g, "");
  const firstSep = only.search(/[.,]/);
  if (firstSep === -1) return only;
  const head = only.slice(0, firstSep + 1);
  const tail = only.slice(firstSep + 1).replace(/[.,]/g, "");
  return head + tail;
}

export interface NumericDrafts {
  /** Co pokazać w polu: brudnopis, jeśli trwa edycja, inaczej wartość modelu. */
  show: (key: string, value: number | null | undefined) => string;
  /** Reakcja na pisanie. Zwraca liczbę do zapisania w modelu. */
  type: (key: string, raw: string) => number | null;
  /** Koniec edycji — pole wraca do sformatowanej wartości. */
  done: (key: string) => void;
}

/**
 * Brudnopisy pól liczbowych dla całego ekranu.
 *
 * Klucz jest dowolny, byle stabilny dla danego pola — np. `${ei}-${si}-kg`.
 */
export function useNumericDrafts(): NumericDrafts {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const show = useCallback(
    (key: string, value: number | null | undefined) =>
      Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : formatDecimal(value),
    [drafts],
  );

  const type = useCallback((key: string, raw: string): number | null => {
    const clean = sanitize(raw);
    setDrafts((d) => ({ ...d, [key]: clean }));
    return parseDecimal(clean);
  }, []);

  const done = useCallback((key: string) => {
    setDrafts((d) => {
      if (!Object.prototype.hasOwnProperty.call(d, key)) return d;
      const next = { ...d };
      delete next[key];
      return next;
    });
  }, []);

  return { show, type, done };
}
