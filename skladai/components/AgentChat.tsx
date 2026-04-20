"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useHealthData } from "@/lib/useHealthData";
import { createClient } from "@/lib/supabase";
import { IS_DEMO } from "@/lib/config";
import { activatePremiumDemo, resetChatLimitsDemo } from "@/lib/demo";

interface Props {
  open: boolean;
  onClose: () => void;
  isPremium: boolean;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ── Message counters (localStorage) ──
// Free users: lifetime counter, no reset, hard limit 5.
// Premium users: daily counter, resets at midnight.
const FREE_COUNT_KEY = "agent_free_msgs";
const PAID_COUNT_KEY = "agent_daily_msgs";
const PAID_DATE_KEY = "agent_daily_date";
const FREE_LIFETIME_LIMIT = 5;
const PAID_DAILY_LIMIT = 100;
const EXPERT_COST = 5;

function getFreeUsed(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(FREE_COUNT_KEY) || "0", 10);
}

function bumpFreeUsed(amount: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FREE_COUNT_KEY, String(getFreeUsed() + amount));
}

function getPaidUsedToday(): number {
  if (typeof window === "undefined") return 0;
  const today = new Date().toDateString();
  const date = localStorage.getItem(PAID_DATE_KEY);
  if (date !== today) return 0;
  return parseInt(localStorage.getItem(PAID_COUNT_KEY) || "0", 10);
}

function bumpPaidUsed(amount: number) {
  if (typeof window === "undefined") return;
  const today = new Date().toDateString();
  const cur = getPaidUsedToday();
  localStorage.setItem(PAID_DATE_KEY, today);
  localStorage.setItem(PAID_COUNT_KEY, String(cur + amount));
}

const WELCOME_MESSAGE = "Cześć! Jestem Twoim Agentem AI. Wiem jaki masz cel, śledzę Twoją aktywność, sen i formę. Zapytaj mnie o dietę, trening, suplementy — pomogę Ci osiągnąć wymarzoną formę 💪";

// ── Logo (rounded square + scanner brackets + S) — inline SVG ──
function ScannerLogo({ size = 40, expert = false }: { size?: number; expert?: boolean }) {
  const accent = expert ? "#FBBF24" : "#6efcb4";
  const filterId = `agentLogoGlow_${size}_${expert ? "e" : "s"}`;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 512 512">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="512" height="512" rx="108" fill="#0a0f0d" />
        <circle cx="256" cy="256" r="200" fill={`${accent}10`} />
        <g stroke={accent} strokeWidth="16" strokeLinecap="round" fill="none" filter={`url(#${filterId})`}>
          <path d="M120 200 L120 140 Q120 120 140 120 L200 120" />
          <path d="M312 120 L372 120 Q392 120 392 140 L392 200" />
          <path d="M392 312 L392 372 Q392 392 372 392 L312 392" />
          <path d="M200 392 L140 392 Q120 392 120 372 L120 312" />
        </g>
        <line x1="150" y1="256" x2="362" y2="256" stroke={accent} strokeWidth="3" opacity="0.3" />
        <text x="256" y="290" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="900" fontSize="180" fill={accent}>S</text>
      </svg>
      {expert && (
        <span style={{ position: "absolute", top: -8, right: -6, fontSize: size * 0.34, lineHeight: 1, transform: "rotate(15deg)", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>👑</span>
      )}
    </div>
  );
}

const SUGGESTIONS = [
  "Ułóż jadłospis na jutro",
  "Jaki trening na dziś?",
  "Dlaczego nie chudnę?",
  "Co jeść przed treningiem?",
];

export default function AgentChat({ open, onClose, isPremium }: Props) {
  const router = useRouter();
  const health = useHealthData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [expertMode, setExpertMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState(0);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  // Expert-mode education banner for non-premium users. Shown once per
  // session the first time they flip expert ON. After X is clicked,
  // `expertEduDismissedRef` prevents the banner from re-appearing; a
  // toast takes its place on subsequent 🔒 send taps.
  const [showExpertEdu, setShowExpertEdu] = useState(false);
  const expertEduDismissedRef = useRef(false);
  const [expertToast, setExpertToast] = useState<string>("");
  const [contextPills, setContextPills] = useState<{ label: string; value: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Free users can't use expert mode — lock it visually
  const accent = expertMode ? "#FBBF24" : "#6efcb4";
  const accentRgb = expertMode ? "251,191,36" : "110,252,180";

  // Tier-specific counter helpers
  const limit = isPremium ? PAID_DAILY_LIMIT : FREE_LIFETIME_LIMIT;
  const freeLimitReached = !isPremium && usedCount >= FREE_LIFETIME_LIMIT;

  // Refresh counter + welcome + context pills whenever the chat opens
  useEffect(() => {
    if (!open) return;
    setUsedCount(isPremium ? getPaidUsedToday() : getFreeUsed());
    setError(null);

    // Inject the welcome message once if the chat has no prior messages
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [{ role: "assistant", content: WELCOME_MESSAGE }];
    });

    // Reset transient UI state from previous session
    setShowExpertEdu(false);
    setExpertToast("");
    expertEduDismissedRef.current = false;

    // Load context pills from profile
    try {
      const profileRaw = localStorage.getItem("skladai_profile");
      if (profileRaw) {
        const p = JSON.parse(profileRaw);
        const pills: { label: string; value: string }[] = [];
        if (p.weight_kg) pills.push({ label: "⚖️", value: `${p.weight_kg} kg` });
        if (p.goal) {
          const goalLabels: Record<string, string> = { maintain: "Utrzymanie", lose: "Odchudzanie", gain: "Masa", healthy: "Zdrowie" };
          pills.push({ label: "🎯", value: goalLabels[p.goal] || p.goal });
        }
        if (p.daily_norms?.calories) pills.push({ label: "🔥", value: `${p.daily_norms.calories} kcal/d` });
        const allergens = p.health?.allergens || [];
        if (allergens.length > 0) pills.push({ label: "⚠️", value: allergens.slice(0, 2).join(", ") });
        setContextPills(pills);
      } else {
        setContextPills([]);
      }
    } catch {
      setContextPills([]);
    }
  }, [open, isPremium]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages, sending]);

  const handleSend = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    // Expert mode requires premium — non-premium users can toggle to
    // preview the UI but sending is blocked. We delegate to the same
    // handler that the 🔒 send button uses.
    if (expertMode && !isPremium) {
      handleLockClick();
      return;
    }

    // Free users: hard lifetime cap at 5. The paywall banner is already
    // rendered inline; we simply refuse to call the API.
    if (!isPremium && usedCount >= FREE_LIFETIME_LIMIT) {
      return;
    }

    const cost = isPremium && expertMode ? EXPERT_COST : 1;
    if (isPremium && usedCount + cost > PAID_DAILY_LIMIT) {
      setError(`Wykorzystałeś dzienny limit (${PAID_DAILY_LIMIT}). Wróć jutro.`);
      return;
    }

    setError(null);
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    // Build history: last 10 non-system messages
    const history = [...messages, userMsg]
      .filter((m) => m.role !== "system")
      .slice(-10)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Build optional todayStats payload — include only populated fields so
    // the request stays small when the user hasn't connected Health yet.
    const todayStats: Record<string, number | string> = {};
    if (health.steps > 0) todayStats.steps = health.steps;
    if (health.kcalBurned > 0) todayStats.kcalBurned = health.kcalBurned;
    if (health.sleepMinutes > 0) todayStats.sleepMinutes = health.sleepMinutes;
    if (health.sleepStart) todayStats.sleepStart = health.sleepStart;
    if (health.sleepEnd) todayStats.sleepEnd = health.sleepEnd;

    // Pull the access token directly from the Supabase client's storage
    // (Capacitor Preferences on native, localStorage on web) and send it
    // via Authorization: Bearer header. The backend /api/chat tries this
    // header first, then falls back to cookies for plain web browsers.
    // WKWebView cookies are unreliable across cold reopens, so this is
    // the path that actually works on iOS/Android Capacitor builds.
    let accessToken: string | null = null;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token ?? null;
    } catch {
      // no-op — backend will return 401 and the existing error UI handles it
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1),
          expertMode,
          ...(Object.keys(todayStats).length > 0 ? { todayStats } : {}),
        }),
      });

      if (res.status === 401) {
        setMessages((prev) => [...prev, { role: "system", content: "🔒 Zaloguj się żeby korzystać z czatu." }]);
        setSending(false);
        return;
      }

      if (!res.ok) {
        setError("Nie udało się połączyć. Spróbuj ponownie.");
        setSending(false);
        return;
      }

      const data = await res.json();
      const reply: string = data.reply || "(brak odpowiedzi)";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (isPremium) bumpPaidUsed(cost);
      else bumpFreeUsed(1);
      setUsedCount(isPremium ? getPaidUsedToday() : getFreeUsed());
    } catch {
      setError("Nie udało się połączyć. Spróbuj ponownie.");
    }
    setSending(false);
  }, [input, sending, usedCount, expertMode, messages, isPremium, health.steps, health.kcalBurned, health.sleepMinutes, health.sleepStart, health.sleepEnd]);

  const handleExpertToggle = () => {
    // Everyone can toggle expert mode — UI flips to amber so users can
    // see what it does. Non-premium users see an education banner the
    // first time per session; premium users see nothing extra.
    // No system-message pills are appended — mode change is purely visual.
    const next = !expertMode;
    setExpertMode(next);
    if (next && !isPremium && !expertEduDismissedRef.current) {
      setShowExpertEdu(true);
    }
    if (!next) {
      setShowExpertEdu(false);
      setExpertToast("");
    }
  };

  const dismissExpertEdu = () => {
    setShowExpertEdu(false);
    expertEduDismissedRef.current = true;
  };

  const handleLockClick = () => {
    // Non-premium user tapped 🔒 in expert mode. If they haven't
    // explicitly dismissed the edu banner yet, re-surface it. Otherwise
    // show a transient toast.
    if (expertEduDismissedRef.current) {
      setExpertToast("Tryb ekspercki wymaga Pro+");
      setTimeout(() => setExpertToast(""), 2500);
    } else {
      setShowExpertEdu(true);
    }
  };

  const handlePhotoAttach = () => {
    alert("📎 Załączanie zdjęć — wkrótce dostępne");
  };

  const counterPercent = Math.min(100, (usedCount / limit) * 100);
  const counterColor = usedCount >= limit ? "#ef4444" : usedCount >= limit * 0.8 ? "#f59e0b" : accent;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s ease",
          zIndex: 199,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0e0c",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          // Reserve space at the bottom of the sheet for the app's
          // BottomNav (position: fixed, zIndex 9999 — stacks above this
          // sheet). 68px matches BottomNav's height; env(safe-area-inset-
          // bottom) clears the iOS home indicator below it. Without this,
          // the input + counter would be hidden behind the nav.
          paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Safe area top */}
        <div style={{ height: 50, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "12px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <ScannerLogo size={48} expert={expertMode} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
                  Agent AI
                </h2>
                {expertMode && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#000", background: "linear-gradient(135deg,#FBBF24,#F59E0B)", padding: "2px 6px", borderRadius: 5, letterSpacing: 0.5 }}>
                    EKSPERT
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2, marginBottom: 0 }}>
                Zna Twój profil i cele
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Zamknij czat"
              style={{
                width: 32, height: 32, borderRadius: 16, border: "none",
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)",
                fontSize: 18, lineHeight: 1, cursor: "pointer", flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Expert toggle row — open to everyone; paywall is on send */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingLeft: 60 }}>
            <button
              onClick={handleExpertToggle}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10, padding: "7px 14px",
                borderRadius: 999,
                background: `rgba(${accentRgb},0.1)`,
                border: `1px solid rgba(${accentRgb},0.28)`,
                cursor: "pointer",
              }}
            >
              <span style={{
                width: 42, height: 24, borderRadius: 999, position: "relative", flexShrink: 0,
                background: expertMode ? accent : "rgba(255,255,255,0.22)", transition: "background 0.2s",
              }}>
                <span style={{
                  position: "absolute", top: 2, left: expertMode ? 20 : 2,
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                  transition: "left 0.2s",
                }} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: expertMode ? accent : "rgba(255,255,255,0.85)" }}>
                Tryb ekspercki
              </span>
            </button>

            <button
              onClick={() => setShowInfoTooltip((v) => !v)}
              aria-label="Co to tryb ekspercki?"
              style={{
                width: 26, height: 26, borderRadius: 13, border: "1px solid rgba(255,255,255,0.28)",
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
                fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}
            >
              ?
            </button>
          </div>

          {/* Info tooltip */}
          {showInfoTooltip && (
            <div
              style={{
                marginTop: 10, padding: 14, borderRadius: 14,
                background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 800, color: "#FBBF24", marginBottom: 8 }}>
                👑 Tryb ekspercki (Pro+)
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "🩸 Analiza wyników badań krwi",
                  "🥗 Rozpisanie spersonalizowanej diety",
                  "💪 Planowanie cyklu treningowego",
                  "🤕 Porady przy kontuzjach i regeneracji",
                  "💊 Analiza interakcji suplementów i leków",
                ].map((line) => (
                  <li key={line} style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", padding: "3px 0" }}>
                    {line}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 11, color: "rgba(251,191,36,0.85)", marginTop: 8, marginBottom: 0 }}>
                ⚡ Zużywa 5x więcej z puli wiadomości
              </p>
            </div>
          )}

          {/* Context pills */}
          {contextPills.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", paddingLeft: 60 }}>
              {contextPills.map((p, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px",
                    borderRadius: 999, background: `rgba(${accentRgb},0.08)`,
                    border: `1px solid rgba(${accentRgb},0.18)`,
                    fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)",
                  }}
                >
                  <span>{p.label}</span><span>{p.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div data-scrollable="true" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 18px 8px", position: "relative" }}>
          {/* Floating toast for transient expert-mode nudges */}
          {expertToast && (
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 5,
                margin: "-8px auto 8px",
                maxWidth: 280,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(251,191,36,0.16)",
                border: "1px solid rgba(251,191,36,0.35)",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#FBBF24",
              }}
            >
              👑 {expertToast}
            </div>
          )}
          {messages.length === 0 && (
            <div style={{ padding: "20px 0" }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textAlign: "center", marginBottom: 16 }}>
                Zapytaj o cokolwiek
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    style={{
                      padding: "12px 14px", borderRadius: 12,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    💬 {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === "system") {
              return (
                <div key={i} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                  <span style={{
                    padding: "4px 12px", borderRadius: 999,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600,
                  }}>
                    {m.content}
                  </span>
                </div>
              );
            }
            const isUser = m.role === "user";
            return (
              <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12, gap: 8, alignItems: "flex-end" }}>
                {!isUser && <ScannerLogo size={28} expert={expertMode} />}
                <div style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: 16,
                  borderBottomRightRadius: isUser ? 4 : 16,
                  borderBottomLeftRadius: isUser ? 16 : 4,
                  background: isUser
                    ? "rgba(255,255,255,0.08)"
                    : `rgba(${accentRgb},0.08)`,
                  border: isUser
                    ? "1px solid rgba(255,255,255,0.1)"
                    : `1px solid rgba(${accentRgb},0.18)`,
                  fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.92)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {sending && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12, gap: 8, alignItems: "flex-end" }}>
              <ScannerLogo size={28} expert={expertMode} />
              <div style={{
                padding: "12px 14px", borderRadius: 16, borderBottomLeftRadius: 4,
                background: `rgba(${accentRgb},0.08)`,
                border: `1px solid rgba(${accentRgb},0.18)`,
                display: "inline-flex", gap: 4, alignItems: "center",
              }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: accent,
                    animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 12, marginTop: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            }}>
              <p style={{ fontSize: 12, color: "#fca5a5", margin: 0, marginBottom: 8 }}>{error}</p>
              <button
                onClick={() => handleSend(messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "")}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}
              >
                🔄 Spróbuj ponownie
              </button>
            </div>
          )}

          {/* Expert-mode education banner (one-time per session, dismissible) */}
          {showExpertEdu && !isPremium && expertMode && (
            <div
              style={{
                marginTop: 8,
                padding: 16,
                borderRadius: 16,
                position: "relative",
                background: "linear-gradient(135deg, rgba(251,191,36,0.14), rgba(249,115,22,0.1))",
                border: "1px solid rgba(251,191,36,0.35)",
              }}
            >
              <button
                onClick={dismissExpertEdu}
                aria-label="Zamknij informację o trybie eksperckim"
                style={{
                  position: "absolute", top: 8, right: 8,
                  width: 26, height: 26, borderRadius: 13, border: "none",
                  background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.9)",
                  fontSize: 13, lineHeight: 1, cursor: "pointer",
                }}
              >
                ✕
              </button>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#FBBF24", margin: 0, marginBottom: 8, paddingRight: 28 }}>
                👑 Tryb ekspercki
              </p>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", margin: 0, marginBottom: 8, lineHeight: 1.55 }}>
                Zaawansowany AI najlepszy do: analizy badań krwi, rozpisania diety, planowania treningu, porad przy kontuzjach i regeneracji, analizy interakcji suplementów i leków.
              </p>
              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", margin: 0, marginBottom: 12, fontWeight: 600 }}>
                ⚡ Zużywa 5x więcej z puli wiadomości
              </p>
              <button
                onClick={() => router.push("/premium")}
                style={{
                  width: "100%", padding: 12, borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
                  color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer",
                }}
              >
                Odblokuj Pro+
              </button>
              {IS_DEMO && (
                <button
                  onClick={() => {
                    if (activatePremiumDemo()) {
                      dismissExpertEdu();
                      onClose();
                      // Force parent to re-check premium on next open
                      window.dispatchEvent(new Event("premium-changed"));
                    }
                  }}
                  style={{
                    width: "100%", padding: 10, borderRadius: 10,
                    background: "rgba(245,158,11,0.1)",
                    border: "1px dashed #f59e0b",
                    color: "#f59e0b",
                    fontSize: 12, fontWeight: 700, marginTop: 8, cursor: "pointer",
                  }}
                >
                  🧪 Aktywuj Premium DEMO (bez płatności)
                </button>
              )}
            </div>
          )}

          {/* Free-trial exhausted paywall (inline, not redirect) */}
          {freeLimitReached && (
            <div
              style={{
                marginTop: 8,
                padding: 16,
                borderRadius: 16,
                background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(249,115,22,0.08))",
                border: "1px solid rgba(251,191,36,0.28)",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 800, color: "#FBBF24", margin: 0, marginBottom: 6 }}>
                ⚡ Wykorzystałeś 5 darmowych wiadomości
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
                Odblokuj Agenta AI bez limitów — plan dietetyczny, trening, analiza skanów i więcej.
              </p>
              <button
                onClick={() => router.push("/premium")}
                style={{
                  width: "100%", padding: 12, borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
                  color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer",
                }}
              >
                👑 Odblokuj Premium
              </button>
              {IS_DEMO && (
                <button
                  onClick={() => {
                    if (activatePremiumDemo()) {
                      resetChatLimitsDemo();
                      setUsedCount(0);
                      window.dispatchEvent(new Event("premium-changed"));
                    }
                  }}
                  style={{
                    width: "100%", padding: 10, borderRadius: 10,
                    background: "rgba(245,158,11,0.1)",
                    border: "1px dashed #f59e0b",
                    color: "#f59e0b",
                    fontSize: 12, fontWeight: 700, marginTop: 8, cursor: "pointer",
                  }}
                >
                  🧪 Aktywuj Premium DEMO (bez płatności)
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input — sits ABOVE the counter bar so it's always visible.
            Previously the input was last in the flex column, which meant
            iOS' home-indicator safe area (~34px) clipped it out of view.
            Border-top visually separates input from the scrollable
            messages above. */}
        <div style={{ padding: "10px 18px 10px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.04)", background: "#0a0e0c" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {expertMode && (
              <button
                onClick={handlePhotoAttach}
                aria-label="Załącz zdjęcie"
                style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `rgba(${accentRgb},0.08)`, border: `1px solid rgba(${accentRgb},0.18)`,
                  color: accent, fontSize: 16, cursor: "pointer",
                }}
              >
                📎
              </button>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={freeLimitReached ? "Odblokuj Premium żeby kontynuować" : expertMode && !isPremium ? "Tryb ekspercki — Pro+ wymagany" : expertMode ? "Zapytaj eksperta..." : "Zapytaj Agenta AI..."}
              rows={1}
              disabled={freeLimitReached}
              style={{
                flex: 1, resize: "none", maxHeight: 120, minHeight: 44,
                padding: "12px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 14, lineHeight: 1.4, outline: "none",
                fontFamily: "inherit",
                opacity: freeLimitReached ? 0.5 : 1,
              }}
            />
            {expertMode && !isPremium ? (
              <button
                onClick={handleLockClick}
                aria-label="Tryb ekspercki wymaga Pro+"
                style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0, border: "1px solid rgba(251,191,36,0.28)",
                  background: "rgba(251,191,36,0.12)", color: "#FBBF24",
                  fontSize: 18, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                🔒
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sending || freeLimitReached}
                aria-label="Wyślij wiadomość"
                style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0, border: "none",
                  background: input.trim() && !sending && !freeLimitReached
                    ? `linear-gradient(135deg, ${accent}, ${expertMode ? "#F59E0B" : "#3dd990"})`
                    : "rgba(255,255,255,0.06)",
                  color: input.trim() && !sending && !freeLimitReached ? "#000" : "rgba(255,255,255,0.3)",
                  fontSize: 18, cursor: input.trim() && !sending && !freeLimitReached ? "pointer" : "default",
                  transition: "all 0.2s",
                }}
              >
                ➤
              </button>
            )}
          </div>
        </div>

        {/* Counter bar — sits below the input. Bottom-nav and iOS
            home-indicator clearance is handled by the sheet's own
            paddingBottom, so this just needs its normal inner padding. */}
        <div
          style={{
            padding: "6px 18px 8px",
            flexShrink: 0,
            background: "#0a0e0c",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>
              {isPremium
                ? `Wiadomości${expertMode ? " (×5 w trybie eksperckim)" : ""}`
                : "Darmowe wiadomości"}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: counterColor }}>
              {usedCount} / {limit}{isPremium ? " dziś" : ""}
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${counterPercent}%`, background: counterColor, transition: "width 0.4s ease" }} />
          </div>
          {IS_DEMO && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button
                onClick={() => {
                  if (resetChatLimitsDemo()) {
                    setUsedCount(0);
                  }
                }}
                style={{
                  padding: "4px 10px",
                  background: "rgba(245,158,11,0.1)",
                  border: "1px dashed #f59e0b",
                  borderRadius: 6,
                  color: "#f59e0b",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >
                🧪 RESET LIMITÓW
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </>
  );
}
