import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

/**
 * Lightweight endpoint: takes a base64 image of a product front,
 * runs Google Vision OCR, then asks Claude to extract just the
 * product name + brand. Used by the premium alternative-finder
 * on the cosmetics/suplement result screen.
 */
export async function POST(request: NextRequest) {
  try {
    const { image } = (await request.json()) as { image?: string };
    if (!image) {
      return NextResponse.json({ error: "Brak zdjęcia." }, { status: 400 });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Nieprawidłowy format." }, { status: 400 });
    }
    const base64Data = match[2];

    // ── Step 1: Google Vision OCR ──
    const gvKey = process.env.GOOGLE_VISION_API_KEY;
    let ocrText = "";

    if (gvKey) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      try {
        const resp = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${gvKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [
                {
                  image: { content: base64Data },
                  features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
                },
              ],
            }),
            signal: ctl.signal,
          }
        );
        clearTimeout(t);
        if (resp.ok) {
          const data = await resp.json();
          const ann = data.responses?.[0];
          ocrText =
            ann?.fullTextAnnotation?.text ||
            ann?.textAnnotations?.[0]?.description ||
            "";
        }
      } catch {
        clearTimeout(t);
      }
    }

    // ── Step 2: Claude extracts product name + brand ──
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Brak klucza API." }, { status: 500 });
    }

    const userContent: unknown[] = [];

    // Always send the image so Claude can read the front label visually
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: match[1], data: base64Data },
    });

    if (ocrText.length > 10) {
      userContent.push({
        type: "text",
        text: `OCR odczytał z frontu opakowania:\n---\n${ocrText}\n---\nWyciągnij nazwę produktu i markę. Odpowiedz WYŁĄCZNIE JSON: {"name":"...","brand":"..."}`,
      });
    } else {
      userContent.push({
        type: "text",
        text: `Odczytaj z tego zdjęcia frontu opakowania nazwę produktu i markę. Odpowiedz WYŁĄCZNIE JSON: {"name":"...","brand":"..."}`,
      });
    }

    const ctl2 = new AbortController();
    const t2 = setTimeout(() => ctl2.abort(), 12000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: ctl2.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          temperature: 0,
          system:
            "Jesteś czytnikiem etykiet. Wyciągnij nazwę produktu i markę z tekstu OCR lub zdjęcia. Odpowiedz WYŁĄCZNIE JSON: {\"name\":\"Nazwa produktu po polsku\",\"brand\":\"Marka\"}. Jeśli nie widzisz — brand=null.",
          messages: [{ role: "user", content: userContent }],
        }),
      });
      clearTimeout(t2);

      if (!resp.ok) {
        return NextResponse.json(
          { error: "Nie udało się odczytać nazwy." },
          { status: 502 }
        );
      }

      const data = await resp.json();
      const text = data.content?.[0]?.text || "";

      // Parse JSON from Claude's response
      let parsed: { name?: string; brand?: string };
      try {
        let cleaned = text.trim();
        if (cleaned.startsWith("```"))
          cleaned = cleaned
            .replace(/^```(?:json)?\s*/g, "")
            .replace(/\s*```$/g, "");
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first !== -1 && last > first) {
          parsed = JSON.parse(cleaned.slice(first, last + 1));
        } else {
          parsed = JSON.parse(cleaned);
        }
      } catch {
        return NextResponse.json(
          { error: "Nie rozpoznano nazwy produktu." },
          { status: 422 }
        );
      }

      const name = parsed.name || "Nieznany produkt";
      const brand = parsed.brand || null;
      const query = brand ? `${brand} ${name}` : name;

      return NextResponse.json({ name, brand, query });
    } catch {
      clearTimeout(t2);
      return NextResponse.json(
        { error: "Odczyt nazwy trwał za długo." },
        { status: 504 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Wystąpił błąd." },
      { status: 500 }
    );
  }
}
