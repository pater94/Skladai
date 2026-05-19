/**
 * Pobiera skany Patryka z Supabase `scan_logs` tabeli.
 *
 * RLS: nie można czytać scanów innego usera. Dlatego używamy
 * service_role key (bypass RLS) + WHITELIST `user_id` z env var
 * `AUDITOR_USER_IDS`. Refusal-on-empty w run-audit.ts.
 *
 * Schema `scan_logs` z lib/storage.ts logScanToSupabase():
 *   id, mode, scan_type, user_id, image_url, image2_url, ocr_text,
 *   ingredients_raw, ingredients_parsed, ai_result (JSON), ai_model,
 *   score, product_name, brand, product_category, processing_time_ms,
 *   prompt_version, risk_level, has_pregnancy_warning, ocr_succeeded,
 *   is_two_photo, ingredient_count, harmful_count, verdict_short,
 *   created_at (timestamp)
 */

import { createClient } from "@supabase/supabase-js";

export interface ScanRecord {
  id: string;
  user_id: string;
  image_url: string;
  ai_result: Record<string, unknown> | null;
  prompt_version: string | null;
  product_name: string | null;
  score: number | null;
  scan_type: string | null;
  created_at: string;
}

export interface FetchOptions {
  userIds: string[];
  sinceHours: number;
  limit: number;
}

export async function fetchScansToAudit(options: FetchOptions): Promise<ScanRecord[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "[auditor] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - options.sinceHours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("scan_logs")
    .select("id, user_id, image_url, ai_result, prompt_version, product_name, score, scan_type, created_at")
    .in("user_id", options.userIds)
    .gte("created_at", since.toISOString())
    .not("image_url", "is", null)
    .not("ai_result", "is", null)
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (error) {
    throw new Error(`[auditor] fetch scan_logs failed: ${error.message}`);
  }

  return (data ?? []) as ScanRecord[];
}
