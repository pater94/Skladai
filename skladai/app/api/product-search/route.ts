import { NextRequest, NextResponse } from "next/server";

// Lightweight, focused endpoint: takes a query string, asks Claude for 5–8
// real Polish supermarket product suggestions, returns a normalized list
// the FoodSearch dropdown can display directly.
//
// Intentionally separate from /api/analyze (which is heavy and has the
// 60s maxDuration). This route is short, JSON-only, and tuned for
// dropdown latency (~3-6s typical).

export const maxDuration = 20;

interface ProductSuggestion {
  name: string;
  brand: string;
  emoji: string;
  package_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  sugar_per_100g?: number;
  fiber_per_100g?: number;
  score: number;
}

const SYSTEM_PROMPT = `Jesteś bazą polskich produktów spożywczych. Dla zapytania użytkownika podaj 5–8 KONKRETNYCH produktów z polskich sklepów (Biedronka, Lidl, Carrefour, Auchan, Żabka, Kaufland, sklepy zdrowej żywności).

ZASADY:
- TYLKO realne, istniejące produkty znanych polskich marek (Sonko, Kupiec, Good Food, Łowicz, Krakus, Mlekovita, Wawel, Bakalland, OstroVit, Olimp, Biedronka own brand, Lidl Pilos, etc.)
- Każdy wynik MUSI mieć: dokładną nazwę, markę, gramaturę OPAKOWANIA i wartości odżywcze NA 100g
- Wartości odżywcze realne (Atwater: kcal ≈ 4×białko + 4×węgle + 9×tłuszcz)
- Różne marki/warianty/gramatury żeby user miał WYBÓR
- score 1-100: ocena nutrycyjna (warzywa/owoce ~80, mięso ~60, słodycze ~25)
- emoji odpowiednie do produktu
- Jeśli zapytanie jest niejednoznaczne (np. "jajko") — pokaż różne formy/marki

ODPOWIEDZ WYŁĄCZNIE JSON (bez markdown, bez komentarzy):
{"suggestions":[{"name":"Wafle ryżowe naturalne","brand":"Sonko","emoji":"🍘","package_g":130,"calories_per_100g":380,"protein_per_100g":8.2,"fat_per_100g":2.8,"carbs_per_100g":81,"sugar_per_100g":0.4,"fiber_per_100g":2.5,"score":62}]}

JEŚLI nie ma sensownych dopasowań — zwróć pustą tablicę: {"suggestions":[]}`;

async function callClaudeShort(
  apiKey: string,
  userText: string,
  timeoutMs: number
): Promise<{ ok: boolean; text: string; status?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userText }],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return { ok: false, text: "", status: response.status };
    }
    const data = await response.json();
    return { ok: true, text: data.content?.[0]?.text || "" };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, text: "", status: 504 };
    }
    return { ok: false, text: "", status: 500 };
  }
}

function parseSuggestions(text: string): ProductSuggestion[] {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/g, "").replace(/\s*```$/g, "");
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.suggestions)) return parsed.suggestions;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        const parsed = JSON.parse(cleaned.slice(first, last + 1));
        if (Array.isArray(parsed.suggestions)) return parsed.suggestions;
      } catch {
        /* ignore */
      }
    }
  }
  return [];
}

function normalize(s: ProductSuggestion): ProductSuggestion | null {
  if (!s || typeof s.name !== "string" || s.name.trim().length < 2) return null;
  const num = (v: unknown, fallback = 0) => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    name: s.name.trim(),
    brand: typeof s.brand === "string" ? s.brand.trim() : "",
    emoji: typeof s.emoji === "string" && s.emoji ? s.emoji : "🍽️",
    package_g: Math.max(1, Math.round(num(s.package_g, 100))),
    calories_per_100g: Math.max(0, Math.round(num(s.calories_per_100g))),
    protein_per_100g: Math.max(0, Math.round(num(s.protein_per_100g) * 10) / 10),
    fat_per_100g: Math.max(0, Math.round(num(s.fat_per_100g) * 10) / 10),
    carbs_per_100g: Math.max(0, Math.round(num(s.carbs_per_100g) * 10) / 10),
    sugar_per_100g:
      s.sugar_per_100g !== undefined ? Math.max(0, Math.round(num(s.sugar_per_100g) * 10) / 10) : undefined,
    fiber_per_100g:
      s.fiber_per_100g !== undefined ? Math.max(0, Math.round(num(s.fiber_per_100g) * 10) / 10) : undefined,
    score: Math.max(1, Math.min(100, Math.round(num(s.score, 50)))),
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ suggestions: [], error: "Brak klucza API." }, { status: 500 });
    }

    let body: { query?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ suggestions: [], error: "Nieprawidłowe dane." }, { status: 400 });
    }

    const query = (body.query || "").trim();
    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }
    if (query.length > 80) {
      return NextResponse.json({ suggestions: [], error: "Zapytanie za długie." }, { status: 400 });
    }

    const res = await callClaudeShort(
      apiKey,
      `Zapytanie użytkownika: "${query}"\n\nPodaj 5-8 konkretnych polskich produktów pasujących do tego zapytania. Odpowiedz WYŁĄCZNIE JSON.`,
      15000
    );

    if (!res.ok) {
      return NextResponse.json(
        { suggestions: [], error: "Nie udało się pobrać propozycji." },
        { status: res.status ?? 500 }
      );
    }

    const raw = parseSuggestions(res.text);
    const normalized = raw
      .map(normalize)
      .filter((x): x is ProductSuggestion => x !== null)
      .slice(0, 8);

    return NextResponse.json({ suggestions: normalized });
  } catch (err) {
    console.error("[product-search] error:", err);
    return NextResponse.json(
      { suggestions: [], error: "Wystąpił błąd. Spróbuj ponownie." },
      { status: 500 }
    );
  }
}
