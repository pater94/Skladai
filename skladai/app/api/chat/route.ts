import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 60;

// ──────────────────────────────────────────────────────────────────────
// Types (mirrored from lib/types.ts and components/SkinProfileSetup —
// duplicated here so the route stays self-contained and can't break
// if shared types are reshuffled).
// ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UserProfile {
  name?: string;
  gender?: string;
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  activity?: string;
  goal?: string;
  health?: {
    diabetes?: string | null;
    pregnancy?: string | null;
    allergens?: string[];
    diet?: string;
  };
  daily_norms?: {
    calories?: number;
    protein_min?: number; protein_max?: number;
    fat_min?: number; fat_max?: number;
    carbs_min?: number; carbs_max?: number;
    salt_max?: number; sugar_max?: number;
    fiber_min?: number; water_ml?: number;
  };
}

interface SkinProfile {
  skin_type?: string;
  sensitivity?: string;
  skin_age?: string;
  skin_problems?: string[];
  hair_type?: string;
  hair_problems?: string[];
}

interface DiaryEntry {
  date: string;
  calories: number; protein: number; fat: number; carbs: number;
  sugar: number; salt: number; fiber: number;
}

interface ScanRow {
  product_name: string | null;
  scan_type: string | null;
  product_category: string | null;
  brand: string | null;
  score: number | null;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────────
// Auth: extract Supabase user_id from request cookies.
// Same pattern as analyze/route.ts. Hard 3s timeout so a slow Supabase
// Auth call can never stall the chat response.
// ──────────────────────────────────────────────────────────────────────

async function extractUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return null;

    const cookieStore = request.cookies;
    let accessToken: string | null = null;

    for (const [name, cookie] of cookieStore) {
      if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
        try {
          const parsed = JSON.parse(cookie.value);
          accessToken = parsed?.access_token || parsed?.[0] || null;
          if (accessToken) break;
        } catch { /* not JSON */ }
      }
    }
    if (!accessToken) return null;

    const supaAdmin = createSupabaseClient(supabaseUrl, serviceKey);
    const result = await Promise.race([
      supaAdmin.auth.getUser(accessToken),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!result || !("data" in result)) return null;
    return result.data?.user?.id || null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Context: pull profile + diary + skin profile + last 5 scans
// ──────────────────────────────────────────────────────────────────────

interface UserContext {
  profile: UserProfile | null;
  skinProfile: SkinProfile | null;
  todayDiary: DiaryEntry[];
  recentScans: ScanRow[];
}

function safeParse<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  return null;
}

async function fetchUserContext(userId: string): Promise<UserContext> {
  const empty: UserContext = { profile: null, skinProfile: null, todayDiary: [], recentScans: [] };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return empty;

  const supaAdmin = createSupabaseClient(supabaseUrl, serviceKey);

  // Run both queries in parallel — both have their own internal timeouts at the network layer
  const [userDataRes, scansRes] = await Promise.all([
    supaAdmin.from("user_data").select("data").eq("user_id", userId).maybeSingle(),
    supaAdmin
      .from("scan_logs")
      .select("product_name, scan_type, product_category, brand, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // user_data is a JSONB blob keyed by SYNC_KEYS — the synced localStorage values
  // (each value is itself JSON-stringified, see lib/sync.ts:collectLocal).
  const blob = (userDataRes.data?.data || {}) as Record<string, unknown>;
  const profile = safeParse<UserProfile>(blob.skladai_profile);
  const skinProfile = safeParse<SkinProfile>(blob.skladai_skin_profile);
  const allDiary = safeParse<DiaryEntry[]>(blob.skladai_diary) || [];

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todayDiary = allDiary.filter((e) => e?.date === today);

  return {
    profile,
    skinProfile,
    todayDiary,
    recentScans: (scansRes.data as ScanRow[] | null) || [],
  };
}

// ──────────────────────────────────────────────────────────────────────
// System prompt builder
// ──────────────────────────────────────────────────────────────────────

interface TodayStats {
  steps?: number;
  kcalBurned?: number;
  /** Total minutes slept last night (18:00 yesterday → 12:00 today, local). */
  sleepMinutes?: number;
  /** ISO 8601 timestamp of earliest sleep sample in last-night window. */
  sleepStart?: string | null;
  /** ISO 8601 timestamp of latest sleep sample in last-night window. */
  sleepEnd?: string | null;
}

function sumDiary(entries: DiaryEntry[]) {
  const t = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const e of entries) {
    t.calories += e.calories || 0;
    t.protein += e.protein || 0;
    t.fat += e.fat || 0;
    t.carbs += e.carbs || 0;
  }
  return {
    calories: Math.round(t.calories),
    protein: Math.round(t.protein * 10) / 10,
    fat: Math.round(t.fat * 10) / 10,
    carbs: Math.round(t.carbs * 10) / 10,
  };
}

function buildSystemPrompt(ctx: UserContext, today: TodayStats): string {
  const { profile, skinProfile, todayDiary, recentScans } = ctx;

  const lines: string[] = [];
  lines.push("Jesteś Agent AI w aplikacji SkładAI — osobisty doradca zdrowotny użytkownika.");
  lines.push("");

  // Profile
  if (profile) {
    lines.push("PROFIL UŻYTKOWNIKA:");
    const p = profile;
    if (p.weight_kg) lines.push(`- Waga: ${p.weight_kg}kg, Wzrost: ${p.height_cm || "?"}cm, Wiek: ${p.age || "?"}, BMI: ${p.bmi || "?"}`);
    if (p.goal) {
      const goalLabel = ({ maintain: "utrzymanie wagi", lose: "odchudzanie", gain: "budowa masy", healthy: "zdrowsze nawyki" } as Record<string, string>)[p.goal] || p.goal;
      lines.push(`- Cel: ${goalLabel}`);
    }
    if (p.activity) lines.push(`- Aktywność: ${p.activity}`);
    const allergens = p.health?.allergens || [];
    if (allergens.length > 0) lines.push(`- Alergie: ${allergens.join(", ")}`);
    if (p.health?.diabetes) lines.push(`- Cukrzyca: ${p.health.diabetes}`);
    if (p.health?.pregnancy) lines.push(`- Ciąża/karmienie: ${p.health.pregnancy}`);
    if (p.health?.diet) lines.push(`- Dieta: ${p.health.diet}`);
    lines.push("");
  } else {
    lines.push("PROFIL UŻYTKOWNIKA: (nie wypełniony — przy poradach zaproponuj wypełnienie profilu w aplikacji)");
    lines.push("");
  }

  // Skin profile (cosmetics context)
  if (skinProfile) {
    lines.push("PROFIL SKÓRY:");
    if (skinProfile.skin_type) lines.push(`- Typ skóry: ${skinProfile.skin_type}`);
    if (skinProfile.sensitivity) lines.push(`- Wrażliwość: ${skinProfile.sensitivity}`);
    if (skinProfile.skin_age) lines.push(`- Wiek skóry: ${skinProfile.skin_age}`);
    if (skinProfile.skin_problems?.length) lines.push(`- Problemy skóry: ${skinProfile.skin_problems.join(", ")}`);
    if (skinProfile.hair_type) lines.push(`- Włosy: ${skinProfile.hair_type}`);
    lines.push("");
  }

  // Today's diary
  const eaten = sumDiary(todayDiary);
  const norms = profile?.daily_norms;
  lines.push("DZISIEJSZE DANE:");
  if (norms?.calories) lines.push(`- Kalorie: ${eaten.calories}/${norms.calories} kcal`);
  else lines.push(`- Kalorie zjedzone dziś: ${eaten.calories} kcal`);
  if (norms?.protein_min) lines.push(`- Białko: ${eaten.protein}/${norms.protein_min}-${norms.protein_max || norms.protein_min}g`);
  else lines.push(`- Białko: ${eaten.protein}g`);
  if (norms?.fat_min) lines.push(`- Tłuszcz: ${eaten.fat}/${norms.fat_min}-${norms.fat_max || norms.fat_min}g`);
  else lines.push(`- Tłuszcz: ${eaten.fat}g`);
  if (norms?.carbs_min) lines.push(`- Węgle: ${eaten.carbs}/${norms.carbs_min}-${norms.carbs_max || norms.carbs_min}g`);
  else lines.push(`- Węgle: ${eaten.carbs}g`);
  if (typeof today.steps === "number") lines.push(`- Kroki: ${today.steps}`);
  if (typeof today.kcalBurned === "number") lines.push(`- Spalone: ${today.kcalBurned} kcal`);
  if (typeof today.sleepMinutes === "number" && today.sleepMinutes > 0) {
    const h = Math.floor(today.sleepMinutes / 60);
    const m = today.sleepMinutes % 60;
    const fmtHM = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    };
    const startHM = fmtHM(today.sleepStart);
    const endHM = fmtHM(today.sleepEnd);
    if (startHM && endHM) {
      lines.push(`- Sen ostatnia noc: ${h}h ${m}min (od ${startHM} do ${endHM})`);
    } else {
      lines.push(`- Sen ostatnia noc: ${h}h ${m}min`);
    }
  } else {
    lines.push(`- Sen: brak danych`);
  }
  lines.push("");

  // Recent scans
  if (recentScans.length > 0) {
    lines.push("OSTATNIE SKANY:");
    for (const s of recentScans) {
      const name = s.product_name || "Nieznany produkt";
      const score = typeof s.score === "number" ? `${s.score}/10` : "—";
      const cat = s.product_category || s.scan_type || "";
      lines.push(`- ${name} — ${score}${cat ? ` (${cat})` : ""}`);
    }
    lines.push("");
  }

  // Rules
  lines.push("ZASADY:");
  lines.push("- Odpowiadaj po polsku, zwięźle i konkretnie.");
  lines.push("- Personalizuj porady pod profil użytkownika (waga, cel, aktywność, alergie).");
  if ((profile?.health?.allergens || []).length > 0) {
    lines.push(`- KRYTYCZNE: użytkownik ma alergie (${(profile?.health?.allergens || []).join(", ")}). NIGDY nie proponuj produktów zawierających te alergeny.`);
  }
  lines.push("- Przy pytaniach o dietę podawaj konkretne gramaturki i kalorie.");
  lines.push("- Przy pytaniach o trening podawaj konkretne ćwiczenia, serie, powtórzenia.");
  lines.push("- NIE jesteś lekarzem. Przy poważnych problemach zdrowotnych odsyłaj do lekarza.");
  lines.push("- Gdy temat dotyczy zdrowia, leków lub diagnoz — dodaj na końcu krótki disclaimer: \"Nie zastępuję porady lekarskiej.\"");
  lines.push("- Bądź ciepły, motywujący, konkretny — jak osobisty trener.");
  lines.push("- NIE odpowiadaj na pytania niezwiązane ze zdrowiem, dietą, treningiem ani ze SkładAI. Grzecznie przekieruj rozmowę z powrotem na te tematy.");

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Brak klucza API." }, { status: 500 });
  }

  // Strict auth — chat is logged-in users only
  const userId = await extractUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Wymagane logowanie." }, { status: 401 });
  }

  // Parse body
  let body: { message?: string; history?: ChatMessage[]; expertMode?: boolean; todayStats?: TodayStats };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const message = (body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Pusta wiadomość." }, { status: 400 });
  }

  // Validate + clamp history (max 10 last messages)
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .slice(-10)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0);

  // Pull user context (profile + diary + recent scans). Failure here is non-critical
  // — chat still works without context, just less personalized.
  let ctx: UserContext = { profile: null, skinProfile: null, todayDiary: [], recentScans: [] };
  try {
    ctx = await fetchUserContext(userId);
  } catch (e) {
    console.warn("[chat] fetchUserContext failed:", e);
  }

  const todayStats: TodayStats = body.todayStats || {};
  const system = buildSystemPrompt(ctx, todayStats);

  const expertMode = !!body.expertMode;
  const model = expertMode ? "claude-opus-4-20250514" : "claude-sonnet-4-20250514";
  const maxTokens = expertMode ? 2048 : 1024;
  const timeoutMs = expertMode ? 55000 : 28000; // leave 5s/2s for serialization within Vercel 60s cap

  const messages = [...history, { role: "user" as const, content: message }];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.7,
        system,
        messages,
      }),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error(`[chat] Claude API ${resp.status}:`, errText.slice(0, 500));
      return NextResponse.json({ error: "Nie udało się uzyskać odpowiedzi." }, { status: 502 });
    }

    const data = await resp.json();
    const reply: string = data?.content?.[0]?.text || "";
    if (!reply) {
      return NextResponse.json({ error: "Pusta odpowiedź od modelu." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[chat] Local timeout after ${timeoutMs}ms`);
      return NextResponse.json({ error: "Odpowiedź trwała za długo. Spróbuj ponownie." }, { status: 504 });
    }
    console.error("[chat] Unexpected error:", err);
    return NextResponse.json({ error: "Wystąpił błąd. Spróbuj ponownie." }, { status: 500 });
  }
}
