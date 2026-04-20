/**
 * POST /api/tts — Text-to-speech for Agent AI replies.
 *
 * Workflow:
 *   1. Hash the text (+ voice + model + speed) with SHA-256 → cache key.
 *   2. Look for {hash}.mp3 in Supabase storage bucket `tts-cache`.
 *   3. Cache hit  → return the public URL immediately.
 *      Cache miss → call OpenAI /v1/audio/speech, upload the mp3 to
 *                   the bucket, return its public URL.
 *
 * Response shape: { audioUrl: string, cached: boolean, truncated?: boolean }
 *
 * ─── Required infrastructure ───
 * - ENV: OPENAI_API_KEY (Vercel + .env.local)
 * - ENV: NEXT_PUBLIC_SUPABASE_URL (already present)
 * - ENV: SUPABASE_SERVICE_ROLE_KEY (already present)
 * - Supabase storage bucket `tts-cache`:
 *     • public read  (anyone with the hashed URL can play it)
 *     • authenticated write  (only the service role uploads)
 *     • lifecycle policy: delete objects older than 30 days
 *                         (configure in Supabase dashboard — Storage →
 *                         tts-cache → Policies / Object lifecycle)
 *
 * Auth: requires a Supabase user (same pattern as /api/chat) so we
 * don't pay OpenAI for anonymous abuse. Cache-hit path still costs
 * nothing OpenAI-side, so it's essentially free for returning users.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const maxDuration = 60;

const BUCKET = "tts-cache";
const VOICE = "onyx"; // Deep, authoritative masculine voice (doctor/expert vibe)
const MODEL = "tts-1"; // Swap to "tts-1-hd" if studio quality is worth 2× cost
const SPEED = 0.95; // Slightly slower than neutral — feels calmer, more "expert"
const RESPONSE_FORMAT = "mp3";
const MAX_CHARS = 4096; // OpenAI TTS hard limit per request

// ──────────────────────────────────────────────────────────────────────
// Auth (copied from /api/chat — Bearer first, cookies fallback)
// ──────────────────────────────────────────────────────────────────────

async function extractUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return null;

    let accessToken: string | null = null;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      accessToken = authHeader.slice(7).trim() || null;
    }
    if (!accessToken) {
      const cookieStore = request.cookies;
      for (const [name, cookie] of cookieStore) {
        if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
          try {
            const parsed = JSON.parse(cookie.value);
            accessToken = parsed?.access_token || parsed?.[0] || null;
            if (accessToken) break;
          } catch { /* not JSON */ }
        }
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
// Handler
// ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // --- parse request ---
  let body: { text?: string; messageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawText = (body?.text || "").trim();
  if (!rawText) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const truncated = rawText.length > MAX_CHARS;
  const text = truncated ? rawText.slice(0, MAX_CHARS) : rawText;

  // --- auth ---
  const userId = await extractUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- env ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  if (!openaiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 500 });
  }

  const supa = createSupabaseClient(supabaseUrl, serviceKey);

  // --- cache key ---
  // Include model/voice/speed so a later config bump invalidates old mp3s
  // without having to manually clear the bucket.
  const cacheKey = crypto
    .createHash("sha256")
    .update(`${MODEL}|${VOICE}|${SPEED}|${text}`)
    .digest("hex");
  const objectPath = `${cacheKey}.mp3`;

  // --- cache lookup ---
  // We try `list({ search: cacheKey })` instead of downloading — cheaper
  // than pulling the mp3 just to check existence. Supabase list is
  // `starts-with` match on the filename.
  try {
    const { data: listed } = await supa.storage
      .from(BUCKET)
      .list("", { limit: 1, search: cacheKey });
    if (listed && listed.some((f) => f.name === objectPath)) {
      const { data: urlData } = supa.storage.from(BUCKET).getPublicUrl(objectPath);
      return NextResponse.json({
        audioUrl: urlData.publicUrl,
        cached: true,
        ...(truncated ? { truncated: true } : {}),
      });
    }
  } catch (e) {
    // Most common reason the list fails is a missing bucket. Log and
    // keep going — we'll try to create-or-upload below, and if the
    // bucket truly doesn't exist the upload will surface a clean error
    // for the operator to fix.
    console.warn("[tts] bucket list failed:", e);
  }

  // --- OpenAI call ---
  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        voice: VOICE,
        input: text,
        response_format: RESPONSE_FORMAT,
        speed: SPEED,
      }),
    });
  } catch (e) {
    console.error("[tts] OpenAI fetch failed:", e);
    return NextResponse.json({ error: "Nie mogłem wygenerować audio" }, { status: 502 });
  }

  if (!openaiRes.ok) {
    // Surface a short excerpt of the OpenAI error for debugging, but
    // send a friendly Polish string back to the client.
    const errText = await openaiRes.text().catch(() => "");
    console.error("[tts] OpenAI error", openaiRes.status, errText.slice(0, 300));
    return NextResponse.json(
      { error: "Nie mogłem wygenerować audio" },
      { status: 502 }
    );
  }

  const audioBuffer = await openaiRes.arrayBuffer();
  const audioBytes = new Uint8Array(audioBuffer);

  // --- upload ---
  const { error: uploadErr } = await supa.storage
    .from(BUCKET)
    .upload(objectPath, audioBytes, {
      contentType: "audio/mpeg",
      upsert: false, // we hash so collisions already map to cache hits
      cacheControl: "public, max-age=2592000", // 30 days, matches lifecycle
    });

  // "Resource already exists" means another request won the race —
  // that's a cache hit for all practical purposes, carry on.
  if (uploadErr && !/already exists|duplicate/i.test(uploadErr.message || "")) {
    console.error("[tts] upload failed:", uploadErr.message);
    return NextResponse.json(
      { error: "Nie mogłem zapisać audio" },
      { status: 500 }
    );
  }

  const { data: urlData } = supa.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({
    audioUrl: urlData.publicUrl,
    cached: false,
    ...(truncated ? { truncated: true } : {}),
  });
}
