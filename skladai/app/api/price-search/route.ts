import { NextRequest, NextResponse } from "next/server";
import { getAllegroToken } from "@/lib/allegro-auth";

export const maxDuration = 15;

interface CeneoResult {
  found: boolean;
  name?: string;
  price?: number;
  url?: string;
  searchUrl: string;
}

interface AllegroResult {
  found: boolean;
  name?: string;
  price?: number;
  url?: string;
  searchUrl: string;
}

interface PriceSearchResponse {
  ceneo: CeneoResult;
  allegro: AllegroResult;
}

// ──────────────────────────────────────────────────────────────────────
// Query simplification
// ──────────────────────────────────────────────────────────────────────

/**
 * Strip noisy bits from a product name so the search engines can match it.
 *  - Removes weights/volumes: 500g, 1kg, 50ml, 1L, 2x100g, 30 caps, 60 tab, 90 kapsułek
 *  - Removes percentages: 100%, 5 %
 *  - Removes parenthesised parts: "(orange flavour)"
 *  - Collapses whitespace
 */
function simplifyQuery(raw: string): string {
  let s = raw;

  // Remove parenthesised parts entirely
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\[[^\]]*\]/g, " ");

  // Remove percentages like "100%" or "5 %"
  s = s.replace(/\b\d+\s*%/g, " ");

  // Remove weights / volumes / counts
  // matches: 500g, 1kg, 50 ml, 1.5l, 2x100g, 30 caps, 60 tab, 90 kapsułek/tabletek/porcji
  s = s.replace(
    /\b\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?)?\s*(?:kg|g|mg|µg|mcg|ml|l|caps?|capsules?|tabs?|tabletek|tabletki|kapsułek|kapsułki|porcji|porcje|szt\.?|sztuk|servings?)\b/gi,
    " "
  );

  // Remove standalone "x2", "x 30"
  s = s.replace(/\bx\s*\d+\b/gi, " ");

  // Remove leftover punctuation that confuses search engines
  s = s.replace(/[•·|/+]/g, " ");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Build a shorter fallback query: take the first 2–3 meaningful tokens
 * (brand + product type) so we still get results when the full simplified
 * name is too specific.
 */
function shortenQuery(simplified: string): string {
  const tokens = simplified.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return simplified;
  return tokens.slice(0, 2).join(" ");
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function buildCeneoSearchUrl(productName: string): string {
  const slug = encodeURIComponent(productName).replace(/%20/g, "-");
  return `https://www.ceneo.pl/szukaj-${slug}`;
}

function buildAllegroSearchUrl(productName: string): string {
  return `https://allegro.pl/listing?string=${encodeURIComponent(productName)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPrice(p: any): number | undefined {
  if (p == null) return undefined;
  if (typeof p === "number") return p;
  if (typeof p === "string") {
    const n = parseFloat(p.replace(",", "."));
    return isNaN(n) ? undefined : n;
  }
  if (typeof p === "object") {
    const candidate = p.amount ?? p.min ?? p.value ?? p.lowest ?? p.from;
    if (candidate != null) return extractPrice(candidate);
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCeneoUrl(item: any): string | undefined {
  return item?.url || item?.productUrl || item?.shopUrl || item?.link || undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractName(item: any): string | undefined {
  return item?.name || item?.title || item?.productName || undefined;
}

// ──────────────────────────────────────────────────────────────────────
// Ceneo
// ──────────────────────────────────────────────────────────────────────

async function ceneoFetch(query: string): Promise<CeneoResult | null> {
  const apiKey = process.env.CENEO_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.ceneo.pl/api/v3/products?apiKey=${apiKey}&query=${encodeURIComponent(
      query
    )}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[price-search] Ceneo ${res.status} for "${query}"`);
      return null;
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] =
      data?.products ||
      data?.results ||
      data?.items ||
      (Array.isArray(data) ? data : []) ||
      [];

    if (!items.length) return null;

    // Pick the cheapest item that has a price.
    let best: { price: number; item: unknown } | null = null;
    for (const it of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = extractPrice((it as any)?.price ?? it);
      if (p == null) continue;
      if (best == null || p < best.price) {
        best = { price: p, item: it };
      }
    }

    // If nothing had a price, fall back to first item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chosen = (best?.item ?? items[0]) as any;
    const name = extractName(chosen);
    const productUrl = extractCeneoUrl(chosen);
    const price = best?.price ?? extractPrice(chosen?.price ?? chosen);

    if (!name || !productUrl) return null;

    return {
      found: true,
      name,
      price,
      url: productUrl,
      searchUrl: buildCeneoSearchUrl(query),
    };
  } catch (e) {
    console.warn(`[price-search] Ceneo failed for "${query}":`, e);
    return null;
  }
}

async function searchCeneo(originalName: string): Promise<CeneoResult> {
  const simplified = simplifyQuery(originalName);
  const shortened = shortenQuery(simplified);
  const fallback: CeneoResult = { found: false, searchUrl: buildCeneoSearchUrl(simplified || originalName) };

  // Attempt 1: simplified query
  const first = await ceneoFetch(simplified || originalName);
  if (first?.found) return first;

  // Attempt 2: shortened (brand + type only) — only if it differs
  if (shortened && shortened !== simplified) {
    const second = await ceneoFetch(shortened);
    if (second?.found) return second;
  }

  return fallback;
}

// ──────────────────────────────────────────────────────────────────────
// Allegro
// ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAllegroOfferUrl(item: any): string | undefined {
  const id = item?.id;
  if (!id) return undefined;
  const rawName = item?.name || "";
  const slug = rawName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug ? `https://allegro.pl/oferta/${slug}-${id}` : `https://allegro.pl/oferta/${id}`;
}

async function allegroFetch(query: string): Promise<AllegroResult | null> {
  try {
    const token = await getAllegroToken();

    // limit=10 so we can pick the cheapest from regular (non-sponsored) results.
    const apiUrl = `https://api.allegro.pl/offers/listing?phrase=${encodeURIComponent(
      query
    )}&limit=10&sort=relevance`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.allegro.public.v1+json",
        "User-Agent": "SkładAI/1.0 +https://skladai.com",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[price-search] Allegro ${res.status} for "${query}"`);
      return null;
    }

    const data = await res.json();

    // Prefer regular results (non-sponsored). Only fall back to promoted if no regular results.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regular: any[] = data?.items?.regular || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoted: any[] = data?.items?.promoted || [];
    const pool = regular.length > 0 ? regular : promoted;

    if (!pool.length) return null;

    // Pick cheapest with a parseable price
    let best: { price: number; item: unknown } | null = null;
    for (const it of pool) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itAny = it as any;
      const p = extractPrice(itAny?.sellingMode?.price?.amount ?? itAny?.sellingMode?.price);
      if (p == null) continue;
      if (best == null || p < best.price) {
        best = { price: p, item: it };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chosen = (best?.item ?? pool[0]) as any;
    const name: string | undefined = chosen?.name;
    const url = buildAllegroOfferUrl(chosen);
    const price = best?.price ?? extractPrice(chosen?.sellingMode?.price?.amount ?? chosen?.sellingMode?.price);

    if (!name || !url) return null;

    return {
      found: true,
      name,
      price,
      url,
      searchUrl: buildAllegroSearchUrl(query),
    };
  } catch (e) {
    console.warn(`[price-search] Allegro failed for "${query}":`, e);
    return null;
  }
}

async function searchAllegro(originalName: string): Promise<AllegroResult> {
  const simplified = simplifyQuery(originalName);
  const shortened = shortenQuery(simplified);
  const fallback: AllegroResult = { found: false, searchUrl: buildAllegroSearchUrl(simplified || originalName) };

  const first = await allegroFetch(simplified || originalName);
  if (first?.found) return first;

  if (shortened && shortened !== simplified) {
    const second = await allegroFetch(shortened);
    if (second?.found) return second;
  }

  return fallback;
}

// ──────────────────────────────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: { productName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productName = (body.productName || "").trim();

  if (!productName || productName.length < 2) {
    return NextResponse.json({ error: "Missing productName" }, { status: 400 });
  }

  // Run Ceneo and Allegro in parallel — independent failures.
  const [ceneo, allegro] = await Promise.all([
    searchCeneo(productName),
    searchAllegro(productName),
  ]);

  const response: PriceSearchResponse = { ceneo, allegro };
  return NextResponse.json(response);
}
