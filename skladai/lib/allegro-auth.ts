/**
 * Allegro OAuth — Client Credentials Flow
 *
 * Allegro Public API requires a Bearer token even for public listing search.
 * We use the `client_credentials` grant (no user login needed) and cache the
 * token in module memory until ~5 minutes before expiry.
 *
 * NOTE: Vercel serverless functions do not share memory across invocations,
 * so this cache only saves repeated requests within the same warm instance.
 * That is still useful — Allegro tokens last 12h and we'd otherwise auth
 * on every single price-search request.
 *
 * Required env vars:
 *   ALLEGRO_CLIENT_ID
 *   ALLEGRO_CLIENT_SECRET
 *
 * Required header on every Allegro call: User-Agent: SkładAI/1.0 +https://skladai.com
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAllegroToken(): Promise<string> {
  // Return cached token if still valid (with 5min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  const clientId = process.env.ALLEGRO_CLIENT_ID;
  const clientSecret = process.env.ALLEGRO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("ALLEGRO_CLIENT_ID / ALLEGRO_CLIENT_SECRET not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(
    "https://allegro.pl/auth/oauth/token?grant_type=client_credentials",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "SkładAI/1.0 +https://skladai.com",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Allegro auth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}
