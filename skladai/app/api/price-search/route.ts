import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

type Category = "cosmetic" | "supplement";

interface CeneoResult {
  found: boolean;
  name?: string;
  price?: number;
  url?: string;
  searchUrl: string;
}

interface AllegroResult {
  found: boolean;
  url: string;
}

interface PriceSearchResponse {
  ceneo: CeneoResult;
  allegro: AllegroResult;
}

// Build a Ceneo human search URL (used as fallback and always available).
function buildCeneoSearchUrl(productName: string): string {
  // Ceneo search slugs use dashes
  const slug = encodeURIComponent(productName).replace(/%20/g, "-");
  return `https://www.ceneo.pl/szukaj-${slug}`;
}

// Build an Allegro listing search URL.
function buildAllegroSearchUrl(productName: string): string {
  return `https://allegro.pl/listing?string=${encodeURIComponent(productName)}`;
}

// Try to extract a numeric price from any of the common Ceneo shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPrice(p: any): number | undefined {
  if (!p) return undefined;
  if (typeof p === "number") return p;
  if (typeof p === "string") {
    const n = parseFloat(p.replace(",", "."));
    return isNaN(n) ? undefined : n;
  }
  if (typeof p === "object") {
    // Common shapes: { min, max } | { value } | { amount }
    const candidate = p.min ?? p.value ?? p.amount ?? p.lowest ?? p.from;
    if (candidate != null) return extractPrice(candidate);
  }
  return undefined;
}

// Try to extract product URL.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUrl(item: any): string | undefined {
  return item?.url || item?.productUrl || item?.shopUrl || item?.link || undefined;
}

// Try to extract product name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractName(item: any): string | undefined {
  return item?.name || item?.title || item?.productName || undefined;
}

// Hit Ceneo Partner API and return the first reasonable match, or null on failure.
async function searchCeneo(
  productName: string,
  category: Category
): Promise<CeneoResult> {
  const apiKey = process.env.CENEO_API_KEY;
  const searchUrl = buildCeneoSearchUrl(productName);
  const fallback: CeneoResult = { found: false, searchUrl };

  if (!apiKey) {
    return fallback;
  }

  try {
    const url = `https://api.ceneo.pl/api/v3/products?apiKey=${apiKey}&query=${encodeURIComponent(
      productName
    )}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[price-search] Ceneo API ${res.status} for "${productName}"`);
      return fallback;
    }

    const data = await res.json();

    // Defensive extraction — Ceneo API has variants across versions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] =
      data?.products ||
      data?.results ||
      data?.items ||
      (Array.isArray(data) ? data : []) ||
      [];

    if (!items.length) return fallback;

    // Pick first item that loosely matches category keywords.
    const categoryKeywords =
      category === "cosmetic"
        ? ["krem", "balsam", "serum", "tonik", "żel", "szampon", "maska", "olejek", "mleczko", "lotion", "cream"]
        : ["suplement", "tabletki", "kapsuł", "witamin", "magnez", "cynk", "kwas", "omega", "białko", "protein"];

    const lowerName = productName.toLowerCase();
    const hasCategoryHint = categoryKeywords.some((k) => lowerName.includes(k));

    // If product name itself already contains category hint, just take first.
    // Otherwise, try to find an item whose name contains a category keyword.
    let chosen = items[0];
    if (!hasCategoryHint) {
      const filtered = items.find((it) => {
        const n = (extractName(it) || "").toLowerCase();
        return categoryKeywords.some((k) => n.includes(k));
      });
      if (filtered) chosen = filtered;
    }

    const name = extractName(chosen);
    const price = extractPrice(chosen?.price ?? chosen);
    const productUrl = extractUrl(chosen);

    if (!name || !productUrl) {
      return fallback;
    }

    return {
      found: true,
      name,
      price,
      url: productUrl,
      searchUrl,
    };
  } catch (e) {
    console.warn(`[price-search] Ceneo lookup failed for "${productName}":`, e);
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  let body: { productName?: string; category?: Category };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productName = (body.productName || "").trim();
  const category: Category = body.category === "supplement" ? "supplement" : "cosmetic";

  if (!productName || productName.length < 2) {
    return NextResponse.json({ error: "Missing productName" }, { status: 400 });
  }

  const ceneo = await searchCeneo(productName, category);

  const allegro: AllegroResult = {
    found: true,
    url: buildAllegroSearchUrl(productName),
  };

  const response: PriceSearchResponse = { ceneo, allegro };
  return NextResponse.json(response);
}
