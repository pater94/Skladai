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
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("scan_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (mode && mode !== "all") {
    query = query.eq("mode", mode);
  }
  if (dateFrom) {
    query = query.gte("created_at", `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59`);
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
