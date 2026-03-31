import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { product_name, feedback, feedback_note } = await request.json();

  if (!product_name || !feedback || !["good", "bad"].includes(feedback)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find most recent scan_log matching product name
  const { data: rows } = await supabase
    .from("scan_logs")
    .select("id")
    .eq("product_name", product_name)
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

  return NextResponse.json({ ok: true });
}
