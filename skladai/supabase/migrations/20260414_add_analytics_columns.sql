-- Migration: Add queryable analytics columns to scan_logs
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- These columns promote key fields from the ai_result jsonb blob into
-- top-level columns so periodic analysis can use simple WHERE/GROUP BY
-- instead of jsonb operators.
--
-- All columns are nullable — existing rows are unaffected.

-- ── New columns ──

ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS has_pregnancy_warning boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ocr_succeeded boolean,
  ADD COLUMN IF NOT EXISTS is_two_photo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ingredient_count integer,
  ADD COLUMN IF NOT EXISTS harmful_count integer,
  ADD COLUMN IF NOT EXISTS verdict_short text,
  ADD COLUMN IF NOT EXISTS error_type text;

-- ── Indexes for common analytics queries ──

-- "Products scoring <5 by scan type"
CREATE INDEX IF NOT EXISTS idx_scan_logs_type_score
  ON public.scan_logs (scan_type, score);

-- "Which cosmetics are HIGH risk?"
CREATE INDEX IF NOT EXISTS idx_scan_logs_risk_level
  ON public.scan_logs (risk_level)
  WHERE risk_level IS NOT NULL;

-- "All scans with pregnancy warnings"
CREATE INDEX IF NOT EXISTS idx_scan_logs_pregnancy
  ON public.scan_logs (has_pregnancy_warning)
  WHERE has_pregnancy_warning = true;

-- "What % of scans fail and why?"
CREATE INDEX IF NOT EXISTS idx_scan_logs_error_type
  ON public.scan_logs (error_type)
  WHERE error_type IS NOT NULL;

-- ── Backfill from existing ai_result jsonb ──

-- risk_level (cosmetics only)
UPDATE public.scan_logs
SET risk_level = ai_result->>'risk_level'
WHERE risk_level IS NULL
  AND ai_result->>'risk_level' IS NOT NULL;

-- verdict_short (all modes)
UPDATE public.scan_logs
SET verdict_short = ai_result->>'verdict_short'
WHERE verdict_short IS NULL
  AND ai_result->>'verdict_short' IS NOT NULL;

-- ingredient_count (from ingredients array)
UPDATE public.scan_logs
SET ingredient_count = jsonb_array_length(ai_result->'ingredients')
WHERE ingredient_count IS NULL
  AND ai_result->'ingredients' IS NOT NULL
  AND jsonb_typeof(ai_result->'ingredients') = 'array';

-- harmful_count (cosmetics: count ingredients with category harmful/controversial or risk warning)
UPDATE public.scan_logs
SET harmful_count = (
  SELECT COUNT(*)
  FROM jsonb_array_elements(ai_result->'ingredients') AS elem
  WHERE elem->>'category' IN ('harmful', 'controversial')
     OR elem->>'risk' = 'warning'
)
WHERE harmful_count IS NULL
  AND scan_type IN ('cosmetics', 'suplement')
  AND ai_result->'ingredients' IS NOT NULL
  AND jsonb_typeof(ai_result->'ingredients') = 'array';

-- has_pregnancy_warning (cosmetics: check warnings[].pregnancy_risk)
UPDATE public.scan_logs
SET has_pregnancy_warning = true
WHERE has_pregnancy_warning IS NOT true
  AND scan_type = 'cosmetics'
  AND ai_result->'warnings' IS NOT NULL
  AND jsonb_typeof(ai_result->'warnings') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(ai_result->'warnings') AS w
    WHERE (w->>'pregnancy_risk')::boolean = true
  );

-- has_pregnancy_warning (food: check pregnancy_info.alerts)
UPDATE public.scan_logs
SET has_pregnancy_warning = true
WHERE has_pregnancy_warning IS NOT true
  AND scan_type = 'food'
  AND ai_result->'pregnancy_info' IS NOT NULL
  AND ai_result->'pregnancy_info'->'alerts' IS NOT NULL
  AND jsonb_typeof(ai_result->'pregnancy_info'->'alerts') = 'array'
  AND jsonb_array_length(ai_result->'pregnancy_info'->'alerts') > 0;

-- is_two_photo (from image2_url presence)
UPDATE public.scan_logs
SET is_two_photo = (image2_url IS NOT NULL)
WHERE is_two_photo IS NULL;

-- ocr_succeeded (from ocr_text presence)
UPDATE public.scan_logs
SET ocr_succeeded = (ocr_text IS NOT NULL AND length(ocr_text) > 20)
WHERE ocr_succeeded IS NULL
  AND scan_type IN ('food', 'cosmetics', 'suplement');

-- error_type (from failed scans)
UPDATE public.scan_logs
SET error_type = 'parse_failed'
WHERE error_type IS NULL
  AND ai_model = 'error'
  AND ai_result->>'failed' = 'true';
