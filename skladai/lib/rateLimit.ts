/**
 * Lekki rate-limiter per IP (in-memory, sliding window).
 *
 * UWAGA: na Vercel serverless pamięć jest PER-INSTANCJA i resetuje się przy
 * cold-startcie — to MIĘKKI limit. Skutecznie tnie spam z jednego źródła na
 * ciepłej instancji i chroni budżet Anthropic / przed prostym DoS, ale nie jest
 * globalnie spójny. Docelowo (skala) → @upstash/ratelimit + Redis/Vercel KV.
 *
 * Zastosowanie w route handlerze:
 *   const ip = getClientIp(request);
 *   const rl = rateLimit(`analyze:${ip}`, 8, 60_000);
 *   if (!rl.ok) return NextResponse.json({ error: "..." }, { status: 429,
 *     headers: { "Retry-After": String(rl.retryAfter) } });
 */

const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

  if (hits.length >= max) {
    buckets.set(key, hits);
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    return { ok: false, retryAfter };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Okresowe czyszczenie nieaktywnych kluczy — zapobiega wyciekowi pamięci.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }

  return { ok: true, retryAfter: 0 };
}

/** Najlepszy dostępny identyfikator klienta z nagłówków (Vercel ustawia x-forwarded-for). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
