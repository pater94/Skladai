/**
 * GET /api/admin/scans — admin dashboard query endpoint.
 *
 * Supported query params:
 *   - mode           "all" | scan mode ("food", "cosmetics", …) | "error"
 *                    "error" surfaces rows with error_type IS NOT NULL OR
 *                    ai_model = "error" (shorter column projection).
 *   - date_from      ISO date (inclusive, 00:00:00 local)
 *   - date_to        ISO date (inclusive, 23:59:59 local)
 *   - feedback       "any" (default) | "good" | "bad" | "none"
 *                    Filter by user feedback state on the row.
 *   - ocr_ok         "any" (default) | "true" | "false"
 *                    Filter by ocr_succeeded flag (food/cosmetics/suplement).
 *   - score_min      integer 1-10
 *   - score_max      integer 1-10
 *   - prompt_version filter to a specific PROMPT_VERSION stamp (e.g. "v2")
 *   - page           1-indexed page number (default 1)
 *   - limit          items per page (default 50, error view 10, max 200)
 *
 * Auth: x-admin-password header must equal ADMIN_PASSWORD env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  // Password check
  const password = request.headers.get("x-admin-password");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const feedback = searchParams.get("feedback"); // "any" | "good" | "bad" | "none"
  const ocrOk = searchParams.get("ocr_ok"); // "any" | "true" | "false"
  const scoreMin = parseInt(searchParams.get("score_min") || "0", 10);
  const scoreMax = parseInt(searchParams.get("score_max") || "0", 10);
  const promptVersion = searchParams.get("prompt_version");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const requestedLimit = parseInt(searchParams.get("limit") || "0", 10);
  const isErrorView = mode === "error";
  const limit = requestedLimit > 0
    ? Math.min(requestedLimit, 200)
    : isErrorView ? 10 : 50;
  const offset = (page - 1) * limit;

  // Error view: only return columns needed for failure analysis.
  // Normal view: pull analytics columns so the UI can show OCR/2-photo
  // / pregnancy / harmful chips inline without expanding every row.
  const selectCols = isErrorView
    ? "id,mode,scan_type,error_type,ai_result,ai_model,processing_time_ms,is_two_photo,ocr_succeeded,created_at"
    : "*";

  let query = supabase
    .from("scan_logs")
    .select(selectCols, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (isErrorView) {
    // Show all failed scans (logged via logFailedScan with ai_model="error"
    // OR populated error_type column).
    query = query.or("error_type.not.is.null,ai_model.eq.error");
  } else if (mode && mode !== "all") {
    query = query.eq("mode", mode);
  }
  if (dateFrom) {
    query = query.gte("created_at", `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59`);
  }

  // Feedback filter — tri-state: has good / has bad / no feedback at all
  if (feedback === "good") {
    query = query.eq("user_feedback", "good");
  } else if (feedback === "bad") {
    query = query.eq("user_feedback", "bad");
  } else if (feedback === "none") {
    query = query.is("user_feedback", null);
  }

  // OCR success filter — boolean, null treated as unknown (omitted from both)
  if (ocrOk === "true") {
    query = query.eq("ocr_succeeded", true);
  } else if (ocrOk === "false") {
    query = query.eq("ocr_succeeded", false);
  }

  // Score range — 1..10 for real scans; error rows have score=null so
  // any score filter also drops error rows, which is usually what we want
  if (scoreMin >= 1 && scoreMin <= 10) {
    query = query.gte("score", scoreMin);
  }
  if (scoreMax >= 1 && scoreMax <= 10) {
    query = query.lte("score", scoreMax);
  }

  // Prompt version — lets us compare before/after prompt changes
  if (promptVersion) {
    query = query.eq("prompt_version", promptVersion);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    scans: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
