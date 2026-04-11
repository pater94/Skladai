-- Migration: Add columns to scan_logs for future recommendation engine
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- These columns enable:
--   - scan_type: normalized type for cross-mode queries
--   - product_category: AI-detected category (szampon, krem, witamina D, etc.)
--   - brand: product brand extracted from AI result
--   - ingredients_raw: raw OCR text from the label
--   - ingredients_parsed: structured JSON array of ingredients from AI
--
-- All columns are nullable so existing rows are unaffected.

ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS scan_type text,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS ingredients_raw text,
  ADD COLUMN IF NOT EXISTS ingredients_parsed jsonb;

-- Backfill scan_type from existing mode column where possible
UPDATE public.scan_logs
SET scan_type = mode
WHERE scan_type IS NULL AND mode IS NOT NULL;

-- Create index on scan_type + user_id for future recommendation queries
CREATE INDEX IF NOT EXISTS idx_scan_logs_type_user
  ON public.scan_logs (scan_type, user_id)
  WHERE user_id IS NOT NULL;

-- Create index on product_category for category-based recommendations
CREATE INDEX IF NOT EXISTS idx_scan_logs_category
  ON public.scan_logs (product_category)
  WHERE product_category IS NOT NULL;
