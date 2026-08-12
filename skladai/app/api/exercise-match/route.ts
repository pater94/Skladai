import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { EXERCISE_ANATOMY } from "@/lib/anatomy/exercises";

// FORMA — dopasowanie dowolnej nazwy ćwiczenia (wpisanej przez użytkownika lub
// odczytanej ze zdjęcia) do ćwiczenia z katalogu anatomicznego. Wołane TYLKO gdy
// lokalny matcher nie jest pewny — wynik jest zapamiętywany po stronie klienta,
// więc na jedno nowe ćwiczenie przypada maksymalnie jedno zapytanie.

export const maxDuration = 30;

const SYSTEM = `Jesteś ekspertem od nazewnictwa ćwiczeń siłowych (polski i angielski, w tym slang siłowniany i skróty).

ZADANIE: dopasuj nazwę ćwiczenia podaną przez użytkownika do JEDNEGO ćwiczenia z listy dostępnych (podanej niżej). Zwróć jego dokładne "id".

ZASADY:
- Rozpoznawaj potoczne skróty i slang: "płaska" = wyciskanie sztangi leżąc, "suwnica"/"prasa" = wyciskanie nogami, "wyprosty" = prostowanie nóg, "uginania" = uginanie nóg (jeśli kontekst nóg) lub uginanie ramion (jeśli kontekst bicepsa), "linka"/"wyciąg górny" przy tricepsie = prostowanie ramion na wyciągu, "motylek"/"butterfly" = rozpiętki, "OHP" = wyciskanie żołnierskie, "MC" = martwy ciąg, "RDL" = martwy ciąg rumuński.
- Zwracaj uwagę na SŁOWA KLUCZOWE partii ("triceps", "biceps", "klatka", "plecy", "barki", "łydki") — one rozstrzygają dwuznaczności. "Triceps ... wyciąg górny" to prostowanie ramion na wyciągu, NIE ściąganie drążka.
- Zwracaj uwagę na wariant: sztanga vs hantle, płaska vs skos, stojąc vs siedząc, nachwyt vs podchwyt vs neutralny, kolano proste vs zgięte (łydki).
- Jeśli nazwa jest zbyt ogólna lub pasuje równie dobrze do kilku ćwiczeń — ustaw "confident": false i wskaż najlepszy strzał w "id".
- Jeśli to w ogóle nie jest ćwiczenie siłowe albo nie ma sensownego odpowiednika — "id": null.

Odpowiedz WYŁĄCZNIE poprawnym JSON (pierwszy znak {, ostatni }, bez markdown):
{"id": "bench_flat", "confident": true, "reason": "krótkie uzasadnienie po polsku"}`;

export async function POST(request: NextRequest) {
  const rl = rateLimit(`exmatch:${getClientIp(request)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Zbyt wiele prób. Poczekaj chwilę." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Brak klucza API." }, { status: 500 });

  let body: { name?: string; candidates?: Array<{ id?: string; name?: string }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "Brak nazwy." }, { status: 400 });

  const catalog = EXERCISE_ANATOMY.map((e) => `${e.id} = ${e.name} (${e.pattern})`).join("\n");
  const hint = Array.isArray(body.candidates) && body.candidates.length
    ? `\n\nLokalny algorytm typuje (od najlepszego): ${body.candidates.filter((c) => c?.id).map((c) => c.id).join(", ")}. Możesz się z nim nie zgodzić.`
    : "";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `DOSTĘPNE ĆWICZENIA:\n${catalog}\n\nNAZWA OD UŻYTKOWNIKA: "${name}"${hint}\n\nZwróć JSON wg instrukcji.`,
        }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[exercise-match] anthropic", res.status, t.slice(0, 200));
      return NextResponse.json({ id: null, confident: false }, { status: 200 });
    }

    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ id: null, confident: false });

    let parsed: { id?: unknown; confident?: unknown; reason?: unknown };
    try { parsed = JSON.parse(jsonMatch[0]); } catch { return NextResponse.json({ id: null, confident: false }); }

    // Walidacja: id MUSI istnieć w katalogu (model nie może wymyślić swojego).
    const id = typeof parsed.id === "string" && EXERCISE_ANATOMY.some((e) => e.id === parsed.id) ? parsed.id : null;

    return NextResponse.json({
      id,
      confident: id ? parsed.confident === true : false,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : undefined,
    });
  } catch (err) {
    console.error("[exercise-match]", err);
    return NextResponse.json({ id: null, confident: false }, { status: 200 });
  }
}
