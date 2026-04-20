"use client";

/**
 * TTSButton — speaker icon next to every Agent-AI reply in the chat.
 *
 * States:
 *   idle     — 🔊 gray, click to fetch + play
 *   loading  — spinner, audio is being generated server-side
 *   playing  — ⏸️ accent-colored, click to pause
 *   paused   — ▶️ accent-colored, click to resume
 *   error    — ⚠️ short toast, click to retry
 *
 * Coordination:
 *   Only one TTSButton plays at a time. When a second button starts,
 *   it dispatches a window event that all other buttons listen for and
 *   pause themselves. A tiny module-level singleton keeps a reference
 *   to the currently-playing audio so we can pause it synchronously
 *   when a new one starts (events are async).
 *
 * Cache:
 *   The server-side cache keys off the text hash. On the client we
 *   additionally hold the returned `audioUrl` in component state —
 *   replay after pause reuses the same <audio> element, and fresh
 *   starts reuse the URL (no re-fetch). Backend cache-hit is near-
 *   instant anyway, but this avoids even the round-trip.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

// ── Module-level "only one plays at a time" manager ──
// A shared ref + a window CustomEvent so every mounted TTSButton can
// react synchronously when a sibling starts playing.
let currentAudio: HTMLAudioElement | null = null;
let currentMessageId: string | null = null;
const ACQUIRE_EVENT = "skladai:tts-acquired";

function acquire(audio: HTMLAudioElement, messageId: string) {
  if (currentAudio && currentMessageId !== messageId) {
    try { currentAudio.pause(); } catch { /* noop */ }
  }
  currentAudio = audio;
  currentMessageId = messageId;
  // Async notification so other buttons can reset their UI state.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACQUIRE_EVENT, { detail: { messageId } }));
  }
}

function release(messageId: string) {
  if (currentMessageId === messageId) {
    currentAudio = null;
    currentMessageId = null;
  }
}

export type TTSButtonStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface Props {
  /** Text to speak (post-render, no markdown). Max 4096 chars — longer is truncated server-side. */
  text: string;
  /** Stable identifier for this message — used to coordinate "only one plays at a time". */
  messageId: string;
  /** Accent color hex used for the active (playing/paused) state. */
  accent: string;
  /** Accent "r,g,b" triplet for tinted backgrounds. */
  accentRgb: string;
}

// Hide entirely on environments without <audio> — vanishingly rare but
// defensive. We check once on mount.
function audioSupported(): boolean {
  if (typeof window === "undefined") return false;
  try { return typeof window.Audio === "function"; } catch { return false; }
}

export default function TTSButton({ text, messageId, accent, accentRgb }: Props) {
  const [status, setStatus] = useState<TTSButtonStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supported] = useState<boolean>(audioSupported);

  // Persist the audio element + the cached URL across clicks so pause/
  // resume reuses the same element. We use refs (not state) because we
  // don't want to trigger re-renders on playback position changes.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const fetchingRef = useRef<boolean>(false);

  // ── Listen for "some other button started playing" → reset our UI ──
  useEffect(() => {
    if (!supported) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string }>).detail;
      if (detail?.messageId !== messageId) {
        // Another message is playing. Our audio element was already
        // paused by `acquire()` above — reflect that in UI.
        setStatus((s) => (s === "playing" ? "paused" : s));
      }
    };
    window.addEventListener(ACQUIRE_EVENT, handler as EventListener);
    return () => window.removeEventListener(ACQUIRE_EVENT, handler as EventListener);
  }, [messageId, supported]);

  // ── Cleanup on unmount: pause our audio and release the slot ──
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { /* noop */ }
        audioRef.current = null;
      }
      release(messageId);
    };
    // messageId is stable per message — no re-run needed even if it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachAudioHandlers = useCallback(
    (audio: HTMLAudioElement) => {
      audio.onplay = () => setStatus("playing");
      audio.onpause = () => {
        // Only flip to "paused" if we haven't already ended / errored
        setStatus((s) => (s === "playing" ? "paused" : s));
      };
      audio.onended = () => {
        setStatus("idle");
        audio.currentTime = 0;
        release(messageId);
      };
      audio.onerror = () => {
        setStatus("error");
        setErrorMsg("Nie mogłem odtworzyć audio");
        release(messageId);
      };
    },
    [messageId]
  );

  const fetchAndPlay = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setStatus("loading");
    setErrorMsg(null);

    try {
      // Pull the Supabase access token the same way AgentChat does —
      // Preferences on native, localStorage on web.
      let accessToken: string | null = null;
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token ?? null;
      } catch { /* backend will 401 and we handle it below */ }

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ text, messageId }),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Zaloguj się żeby słuchać");
        throw new Error("server-error");
      }
      const data: { audioUrl?: string } = await res.json();
      if (!data.audioUrl) throw new Error("empty-url");

      urlRef.current = data.audioUrl;
      const audio = new Audio(data.audioUrl);
      // Preload so first play starts faster on slow connections.
      audio.preload = "auto";
      attachAudioHandlers(audio);
      audioRef.current = audio;

      acquire(audio, messageId);
      await audio.play();
      // onplay will flip status → "playing"
    } catch (e) {
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      setStatus("error");
      if (!isOnline) {
        setErrorMsg("Brak połączenia — spróbuj ponownie");
      } else if (e instanceof Error && e.message.includes("Zaloguj")) {
        setErrorMsg(e.message);
      } else {
        setErrorMsg("Nie mogłem wygenerować audio");
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [text, messageId, attachAudioHandlers]);

  const handleClick = useCallback(() => {
    if (!supported) return;

    if (status === "idle" || status === "error") {
      // If we already have the URL from a previous play, skip the API.
      if (urlRef.current) {
        let audio = audioRef.current;
        if (!audio) {
          audio = new Audio(urlRef.current);
          audio.preload = "auto";
          attachAudioHandlers(audio);
          audioRef.current = audio;
        }
        audio.currentTime = 0;
        acquire(audio, messageId);
        audio.play().catch(() => {
          setStatus("error");
          setErrorMsg("Nie mogłem odtworzyć audio");
        });
        return;
      }
      fetchAndPlay();
      return;
    }

    if (status === "playing" && audioRef.current) {
      audioRef.current.pause();
      return;
    }

    if (status === "paused" && audioRef.current) {
      // Resume — acquire the slot so any other playing audio stops first.
      acquire(audioRef.current, messageId);
      audioRef.current.play().catch(() => {
        setStatus("error");
        setErrorMsg("Nie mogłem odtworzyć audio");
      });
      return;
    }
  }, [status, supported, messageId, fetchAndPlay, attachAudioHandlers]);

  if (!supported) return null;

  // ── Visual ──
  const isActive = status === "playing" || status === "paused";
  const baseBg = isActive ? `rgba(${accentRgb},0.14)` : "rgba(255,255,255,0.05)";
  const baseBorder = isActive ? `1px solid rgba(${accentRgb},0.35)` : "1px solid rgba(255,255,255,0.1)";
  const iconColor = isActive ? accent : "rgba(255,255,255,0.55)";

  const label =
    status === "loading" ? "Ładowanie audio..."
    : status === "playing" ? "Wstrzymaj"
    : status === "paused" ? "Wznów"
    : status === "error" ? "Ponów"
    : "Odtwórz";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        aria-label={label}
        title={label}
        style={{
          width: 28, height: 28, borderRadius: 999,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: baseBg,
          border: baseBorder,
          cursor: status === "loading" ? "default" : "pointer",
          color: iconColor,
          transition: "all 0.2s",
          padding: 0,
          flexShrink: 0,
        }}
      >
        {status === "loading" ? (
          <span
            style={{
              width: 12, height: 12, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.2)",
              borderTopColor: accent,
              animation: "ttsSpin 0.8s linear infinite",
            }}
          />
        ) : status === "playing" ? (
          // Pause glyph
          <svg width="12" height="12" viewBox="0 0 12 12" fill={iconColor} aria-hidden="true">
            <rect x="2" y="2" width="3" height="8" rx="1" />
            <rect x="7" y="2" width="3" height="8" rx="1" />
          </svg>
        ) : status === "paused" ? (
          // Play triangle
          <svg width="12" height="12" viewBox="0 0 12 12" fill={iconColor} aria-hidden="true">
            <path d="M3 2 L10 6 L3 10 Z" />
          </svg>
        ) : status === "error" ? (
          <span style={{ fontSize: 12, lineHeight: 1 }}>⚠️</span>
        ) : (
          // Idle speaker icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>
      {status === "error" && errorMsg && (
        <span
          onClick={() => { setStatus("idle"); setErrorMsg(null); }}
          style={{
            fontSize: 10, color: "#fca5a5", fontWeight: 600,
            cursor: "pointer", maxWidth: 160, textAlign: "right",
            lineHeight: 1.3,
          }}
        >
          {errorMsg}
        </span>
      )}

      <style jsx>{`
        @keyframes ttsSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
