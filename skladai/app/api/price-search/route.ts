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

async function searchCeneo(productName: string): Promise<CeneoResult> {
  const apiKey = process.env.CENEO_API_KEY;
  const searchUrl = buildCeneoSearchUrl(productName);
  const fallback: CeneoResult = { found: false, searchUrl };

  if (!apiKey) return fallback;

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
      console.warn(`[price-search] Ceneo ${res.status} for "${productName}"`);
      return fallback;
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] =
      data?.products ||
      data?.results ||
      data?.items ||
      (Array.isArray(data) ? data : []) ||
      [];

    if (!items.length) return fallback;

    const chosen = items[0];
    const name = extractName(chosen);
    const price = extractPrice(chosen?.price ?? chosen);
    const productUrl = extractCeneoUrl(chosen);

    if (!name || !productUrl) return fallback;

    return { found: true, name, price, url: productUrl, searchUrl };
  } catch (e) {
    console.warn(`[price-search] Ceneo failed for "${productName}":`, e);
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Allegro
// ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAllegroOfferUrl(item: any): string | undefined {
  const id = item?.id;
  if (!id) return undefined;
  // Allegro item URLs follow: https://allegro.pl/oferta/{slug}-{id}
  // The slug is informational only — the id alone is enough to resolve.
  // We still include a slug for cleaner-looking URLs when available.
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

async function searchAllegro(productName: string): Promise<AllegroResult> {
  const searchUrl = buildAllegroSearchUrl(productName);
  const fallback: AllegroResult = { found: false, searchUrl };

  try {
    const token = await getAllegroToken();

    const apiUrl = `https://api.allegro.pl/offers/listing?phrase=${encodeURIComponent(
      productName
    )}&limit=1&sort=relevance`;

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
      console.warn(`[price-search] Allegro ${res.status} for "${productName}"`);
      return fallback;
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoted: any[] = data?.items?.promoted || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regular: any[] = data?.items?.regular || [];
    const chosen = promoted[0] || regular[0];

    if (!chosen) return fallback;

    const name: string | undefined = chosen?.name;
    const price = extractPrice(chosen?.sellingMode?.price?.amount ?? chosen?.sellingMode?.price);
    const url = buildAllegroOfferUrl(chosen);

    if (!name || !url) return fallback;

    return { found: true, name, price, url, searchUrl };
  } catch (e) {
    console.warn(`[price-search] Allegro failed for "${productName}":`, e);
    return fallback;
  }
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
