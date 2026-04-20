/**
 * POST /api/feedback — attach user 👍 / 👎 to a specific scan.
 *
 * Preferred payload: `{ scan_id, feedback, feedback_note? }` — writes
 * directly to the scan_logs row by its primary key. This is what the
 * results screen should send.
 *
 * Back-compat: `{ product_name, feedback, feedback_note? }` still works
 * for older clients. It does a best-effort "most recent scan with this
 * product name" lookup, which is fragile (two scans of the same
 * product route to whichever is newer) — that's why scan_id is the
 * preferred path.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  let body: { scan_id?: string; product_name?: string; feedback?: string; feedback_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { scan_id, product_name, feedback, feedback_note } = body;

  if (!feedback || !["good", "bad"].includes(feedback)) {
    return NextResponse.json({ error: "Invalid feedback value" }, { status: 400 });
  }
  if (!scan_id && !product_name) {
    return NextResponse.json({ error: "Missing scan_id or product_name" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Preferred: update by PK — exact, unambiguous, and won't drift if the
  // user scans the same product twice.
  if (scan_id) {
    const { error, data } = await supabase
      .from("scan_logs")
      .update({
        user_feedback: feedback,
        feedback_note: feedback_note || null,
      })
      .eq("id", scan_id)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, scan_id, matched: "id" });
  }

  // Legacy fallback: fuzzy lookup by product_name. Kept for any client
  // version still in the wild that hasn't started sending scan_id.
  const { data: rows } = await supabase
    .from("scan_logs")
    .select("id")
    .eq("product_name", product_name!)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("scan_logs")
    .update({
      user_feedback: feedback,
      feedback_note: feedback_note || null,
    })
    .eq("id", rows[0].id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scan_id: rows[0].id, matched: "product_name" });
}
