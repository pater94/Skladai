import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

// FORMA — import treningu ze zdjęcia (notatnik / screenshot z apki / tabela).
// Claude Vision odczytuje ćwiczenia + serie i zwraca ustrukturyzowany JSON.
// Dopasowanie do istniejących ćwiczeń + zapis robi klient (lib/workoutJournal).

export const maxDuration = 60;

const IMPORT_PROMPT = `Jesteś ekspertem od czytania zapisów treningowych. Dostajesz ZDJĘCIE — notatnik odręczny, screenshot z aplikacji treningowej, tabela albo lista. Odczytaj DOKŁADNIE wykonane ćwiczenia i ich serie.

ŻELAZNE ZASADY:
- Czytaj TYLKO to co fizycznie widać. NIGDY nie zmyślaj ćwiczeń ani liczb.
- NAZWY ćwiczeń: znormalizuj do czystej polskiej nazwy (np. "Wyciskanie sztangi płaskie", "Przysiad ze sztangą", "Martwy ciąg", "Podciąganie", "Wiosłowanie sztangą", "Uginanie ramion ze sztangą", "Wyciskanie żołnierskie"). Zachowaj wariant jeśli podany (płaskie/skos, sztanga/hantle, wąsko/szeroko). Jeśli skrót (np. "WP", "OHP") — rozwiń do pełnej polskiej nazwy jeśli jednoznaczne, inaczej zostaw jak jest.
- SERIE: dla każdego ćwiczenia wypisz KAŻDĄ serię osobno jako {weight, reps}. Rozpoznawaj notacje:
  • "112,5 x 5", "112.5×5", "112.5 x 5" → weight 112.5, reps 5
  • "5 x 112,5" → reps 5, weight 112.5 (mniejsza liczba przy typowych ciężarach to zwykle powtórzenia)
  • "112,5 kg 5 powt" → weight 112.5, reps 5
  • "3 x 10 x 60" lub "3x10 60kg" → 3 SERIE po 10 powt z 60 kg → ROZWIŃ na 3 osobne serie {weight:60, reps:10}
  • tabela z kolumnami (seria / kg / powt) → jedna seria = jeden wiersz
  • PRZECINEK = kropka dziesiętna (112,5 → 112.5)
- BEZ CIĘŻARU (np. "podciąganie 3x10", pompki, brzuszki) → kind="bodyweight", weight=null, wypełnij reps.
- NA CZAS (plank, deska, np. "60s", "1 min") → kind="duration", duration_sec (w sekundach), bez weight/reps.
- weight w KILOGRAMACH (liczba). reps liczba całkowita.
- Pomiń: daty, nagłówki, notatki, komentarze, wszystko co nie jest ćwiczeniem/serią.
- Jeśli liczba serii podana zbiorczo (np. "4 serie") ale bez wartości — utwórz tyle pustych serii ({weight:null, reps:null}) ile podano, albo pomiń jeśli zupełnie nieczytelne.

Odpowiedz WYŁĄCZNIE poprawnym JSON (pierwszy znak {, ostatni }, bez markdown):
{
  "exercises": [
    { "name": "Wyciskanie sztangi płaskie", "kind": "weighted", "sets": [ {"weight": 112.5, "reps": 5}, {"weight": 112.5, "reps": 5}, {"weight": 110, "reps": 6} ] },
    { "name": "Podciąganie", "kind": "bodyweight", "sets": [ {"reps": 10}, {"reps": 8}, {"reps": 7} ] }
  ]
}
Jeśli nic nie rozpoznasz (to nie jest zapis treningu): {"exercises": []}.`;

export async function POST(request: NextRequest) {
  const rl = rateLimit(`import:${getClientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Zbyt wiele prób. Poczekaj chwilę." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Brak klucza API." }, { status: 500 });

  let body: { image?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 }); }
  const image = body.image;
  if (!image || typeof image !== "string") return NextResponse.json({ error: "Brak zdjęcia." }, { status: 400 });

  const m = image.match(/^data:(image\/\w+);base64,(.+)$/);
  const mediaType = m ? m[1] : "image/jpeg";
  const base64 = m ? m[2] : image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3500,
        system: IMPORT_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Odczytaj ten zapis treningu i zwróć JSON wg instrukcji." },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[workout-import] anthropic", res.status, t.slice(0, 200));
      if (res.status === 429) return NextResponse.json({ error: "Zbyt wiele zapytań. Poczekaj chwilę." }, { status: 429 });
      return NextResponse.json({ error: "Nie udało się odczytać zdjęcia. Spróbuj wyraźniejsze / lepiej oświetlone." }, { status: 502 });
    }
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Nie rozpoznano treningu na zdjęciu." }, { status: 422 });

    let parsed: { exercises?: unknown };
    try { parsed = JSON.parse(jsonMatch[0]); } catch {
      return NextResponse.json({ error: "Nie udało się przetworzyć odczytu. Spróbuj ponownie." }, { status: 422 });
    }
    // Normalizacja: ujednolić pola serii (weight/reps/duration) — model bywa
    // zwraca duration_sec dla ćwiczeń na czas.
    const rawExercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
    const exercises = rawExercises.map((ex) => {
      const e = ex as { name?: string; kind?: string; sets?: unknown };
      const rawSets = Array.isArray(e.sets) ? e.sets : [];
      const sets = rawSets.map((s) => {
        const st = s as { weight?: number; reps?: number; duration?: number; duration_sec?: number };
        return {
          weight: typeof st.weight === "number" ? st.weight : null,
          reps: typeof st.reps === "number" ? st.reps : null,
          duration: typeof st.duration === "number" ? st.duration : (typeof st.duration_sec === "number" ? st.duration_sec : null),
        };
      });
      return { name: String(e.name || "Ćwiczenie"), kind: e.kind || "weighted", sets };
    });
    return NextResponse.json({ exercises });
  } catch (e) {
    console.error("[workout-import] exception", e);
    return NextResponse.json({ error: "Błąd analizy. Spróbuj ponownie." }, { status: 500 });
  }
}
