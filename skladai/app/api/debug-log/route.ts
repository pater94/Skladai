import { NextRequest, NextResponse } from "next/server";

/**
 * Temporary debug-log sink.
 *
 * The inline persistent logger in app/layout.tsx POSTs one event at a
 * time here. We just console.log the payload so it shows up in Vercel's
 * runtime logs (Project → Logs → Runtime), keyed by "[debug-log]" for
 * easy filtering. No Supabase, no storage — this is diagnostic only.
 *
 * Safe to keep enabled even in production because:
 *   - we never return anything but 204 so it's useless to scrape
 *   - no auth leaked (we don't require or log it)
 *   - the client trims each entry to a bounded size below
 */

export const runtime = "edge";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // Body wasn't JSON — log a short marker and move on.
    console.log("[debug-log] non-json body");
    return new NextResponse(null, { status: 204 });
  }

  // Single-line JSON keeps Vercel's log viewer happy and makes grep
  // trivial. Cap the stringified form so a runaway payload can't
  // blow past per-log size limits.
  try {
    const s = JSON.stringify(payload);
    const capped = s.length > 8000 ? s.slice(0, 8000) + "...[truncated]" : s;
    console.log("[debug-log]", capped);
  } catch {
    console.log("[debug-log] serialize-failed");
  }

  // No body, no-cache — browser MUST NOT reuse an old 200.
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
