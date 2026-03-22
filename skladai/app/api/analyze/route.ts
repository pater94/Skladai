import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Jesteś ekspertem od żywienia i bezpieczeństwa żywności. Analizujesz zdjęcie etykiety produktu spożywczego.
Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown, bez \`\`\`json, bez komentarzy):
{
  "name": "Nazwa produktu",
  "brand": "Marka",
  "weight": "Waga",
  "score": 7,
  "verdict_short": "Dobry/Doskonały/Przeciętny/Słaby/Unikaj",
  "verdict": "2-3 zdania podsumowania",
  "ingredients": [
    {
      "name": "Nazwa składnika",
      "original": "Jak napisane na etykiecie",
      "category": "natural|processed|controversial|harmful",
      "risk": "safe|caution|warning",
      "explanation": "Wyjaśnienie po ludzku, 1-2 zdania"
    }
  ],
  "allergens": ["Mleko", "Gluten"],
  "pros": ["Plus 1", "Plus 2"],
  "cons": ["Minus 1", "Minus 2"],
  "tip": "Praktyczna rada dla konsumenta",
  "nutrition": [
    {"label": "Energia", "value": "374 kcal", "icon": "⚡"},
    {"label": "Tłuszcz", "value": "4.4 g", "icon": "🫧", "sub": "nasycone: 1.8 g"},
    {"label": "Węglowodany", "value": "67 g", "icon": "🍞", "sub": "w tym cukry: 1.2 g"},
    {"label": "Białko", "value": "15 g", "icon": "💪"},
    {"label": "Sól", "value": "7.0 g", "icon": "🧂"}
  ]
}
ZASADY SCORINGU (1-10):
- 10: Jeden składnik, zero przetworzenia (np. świeże mięso, woda mineralna)
- 9: 2-3 naturalne składniki, zero kontrowersji (np. mleko bez laktozy, serek kozi)
- 8: Krótki skład, minimalne przetworzenie (np. kukurydza konserwowa)
- 7: Dobry produkt z drobnymi zastrzeżeniami (np. jogurt z cukrem, ketchup 86% pomidorów)
- 6: Przeciętny, kilka przetworzonych składników
- 5: Dłuższy skład, niepotrzebne dodatki (np. chleb tostowy z cukrem i soją)
- 4: Dużo przetworzenia, wysoka sól/cukier (np. panierka z 7g soli/100g)
- 3: Mocno przetworzony, kontrowersyjne dodatki (np. BHA, 6 słodzików)
- 2: Głównie chemia, zero wartości odżywczych (np. cola zero z E150d + aspartam)
- 1: Niebezpieczny produkt
KATEGORIE SKŁADNIKÓW:
- "natural": składniki naturalne, nieprzetworzone (mleko, mąka, sól, woda, owoce, mięso, przyprawy)
- "processed": przetworzone ale bezpieczne (skrobia modyfikowana, aromaty naturalne, lecytyna)
- "controversial": kontrowersyjne, debata naukowa (aspartam, sukraloza, acesulfam K, cukier dodany)
- "harmful": potencjalnie szkodliwe (BHA, E150d, kwas fosforowy w nadmiarze)
POZIOMY RYZYKA:
- "safe": bezpieczny ✅
- "caution": umiarkowane ryzyko, warto wiedzieć ⚠️
- "warning": potencjalnie szkodliwy, unikaj 🔴
WAŻNE:
- Odpowiadaj PO POLSKU
- Bądź konkretny w wyjaśnieniach — pisz po ludzku, nie naukowo
- W "tip" dawaj praktyczną radę (np. "odsącz kukurydzę żeby zmniejszyć sól")
- Jeśli nie widzisz wyraźnie etykiety, napisz co udało się odczytać i zaznacz niepewność
- Jeśli to suplement/lek, dostosuj format (zamiast wartości odżywczych — dawkowanie)
- Jeśli to woda mineralna, pokaż profil mineralny zamiast standardowej tabeli`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Brak klucza API. Skonfiguruj ANTHROPIC_API_KEY." },
        { status: 500 }
      );
    }

    const { image } = await request.json();
    if (!image) {
      return NextResponse.json(
        { error: "Brak zdjęcia do analizy." },
        { status: 400 }
      );
    }

    // Extract base64 data and media type
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Nieprawidłowy format zdjęcia." },
        { status: 400 }
      );
    }

    const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const base64Data = match[2];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: "Przeanalizuj etykietę tego produktu spożywczego. Zwróć wynik jako JSON.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("Anthropic API error:", response.status, errData);
      return NextResponse.json(
        { error: "Błąd API. Spróbuj ponownie." },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Parse JSON from response (handle potential markdown wrapping)
    let result;
    try {
      const jsonStr = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
      result = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", text);
      return NextResponse.json(
        { error: "Nie mogę odczytać etykiety. Zrób wyraźniejsze zdjęcie." },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analiza trwa dłużej niż zwykle. Spróbuj ponownie." },
      { status: 500 }
    );
  }
}
