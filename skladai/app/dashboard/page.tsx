"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProfile, DailyTotals } from "@/lib/types";
import { getProfile, getDailyTotals, getWeekTotals, todayStr, removeDiaryEntry, getStreak, getHistory, saveMode } from "@/lib/storage";
import { useHealthData } from "@/lib/useHealthData";
import VoiceLog, { VoiceMicButton } from "@/components/VoiceLog";

type DashView = "today" | "week";

const MEAL_ICONS: Record<string, string> = { breakfast: "🥣", lunch: "🥗", dinner: "🍽️", snack: "🍿" };

// IMPORTANT: Keep GlassCard and SectionTitle at module scope, NOT inside the
// component function. Defining them inside DashboardPage would create a new
// component reference on every render, causing React to unmount/remount every
// GlassCard — which would blur the search input on every keystroke and
// dismiss the mobile keyboard.
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)", marginBottom: 12, letterSpacing: "0.03em", textTransform: "uppercase" as const }}>{children}</div>
  );
}
const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [totals, setTotals] = useState<DailyTotals | null>(null);
  const [weekTotals, setWeekTotals] = useState<DailyTotals[]>([]);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<DashView>("today");
  const health = useHealthData();
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceInitialText, setVoiceInitialText] = useState<string | undefined>(undefined);

  const submitSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setVoiceInitialText(trimmed);
    setShowVoice(true);
    setSearchQuery("");
  };

  const reload = () => {
    const p = getProfile();
    setProfile(p);
    setTotals(getDailyTotals(todayStr()));
    setWeekTotals(getWeekTotals());
    setStreak(getStreak());
    setLoaded(true);
  };

  useEffect(() => {
    (document.getElementById("scroll-container") || window).scrollTo(0, 0);
    reload();
  }, []);

  // Smooth-scroll to Aktywność card when navigated with #aktywnosc-dzis.
  // Runs after loaded=true so the target div is mounted, and also listens
  // for hashchange in case the user re-enters this page with a new hash.
  useEffect(() => {
    if (!loaded) return;
    const maybeScroll = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== "#aktywnosc-dzis") return;
      setView("today");
      requestAnimationFrame(() => {
        const el = document.getElementById("aktywnosc-dzis");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    maybeScroll();
    window.addEventListener("hashchange", maybeScroll);
    return () => window.removeEventListener("hashchange", maybeScroll);
  }, [loaded]);

  // First-time HealthKit consent prompt — iOS native only, asked once.
  useEffect(() => {
    if (health.loading) return;
    if (!health.isNative) return;
    if (health.isConnected) return;
    try {
      if (localStorage.getItem("healthKitAsked") === "1") return;
    } catch {
      return;
    }
    // Defer to next tick to avoid cascading renders inside effect body.
    const id = setTimeout(() => setShowHealthModal(true), 0);
    return () => clearTimeout(id);
  }, [health.loading, health.isNative, health.isConnected]);

  if (!loaded) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #0a0e0c)" }}>
        <div style={{ width: 48, height: 48, border: "4px solid rgba(var(--c-mint-rgb, 110,252,180), 0.3)", borderTopColor: "var(--c-mint, #6efcb4)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // ═══ EMPTY STATE (no profile) ═══
  if (!profile) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg, #0a0e0c)", paddingBottom: 100 }}>
        <div style={{ padding: "20px 22px 30px", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 300, height: 200, background: "radial-gradient(ellipse, rgba(var(--c-mint-rgb, 110,252,180), 0.08), transparent 70%)", pointerEvents: "none" }} />

          <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, margin: "0 auto 20px", background: "rgba(var(--c-mint-rgb, 110,252,180), 0.06)", border: "1.5px solid rgba(var(--c-mint-rgb, 110,252,180), 0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, position: "relative" }}>
              <div style={{ position: "absolute", inset: -8, background: "radial-gradient(circle, rgba(var(--c-mint-rgb, 110,252,180), 0.15), transparent 70%)", animation: "breathe 3s ease-in-out infinite" }} />
              <span style={{ position: "relative" }}>📊</span>
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 8 }}>Odblokuj Dashboard</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: "19px", marginBottom: 28, padding: "0 10px" }}>
              Uzupełnij profil żeby śledzić kalorie, makro i postępy. To zajmie minutę.
            </div>

            {[
              { icon: "📈", text: "Śledź kalorie i makroskładniki" },
              { icon: "🏃", text: "Monitoruj swoją aktywność" },
              { icon: "🎯", text: "Porównuj spożycie z normami dziennymi" },
            ].map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 6, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 16 }}>{b.icon}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{b.text}</span>
              </div>
            ))}

            <button onClick={() => router.push("/profil")} style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: "linear-gradient(135deg, var(--c-mint, #6efcb4), var(--c-green-2, #3dd990))", color: "var(--c-ink, #0a0f0d)", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 20px rgba(var(--c-mint-rgb, 110,252,180), 0.2)", marginTop: 20 }}>
              🎯 Ustaw profil →
            </button>
          </div>
        </div>
        <style>{`@keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 0.7; transform: scale(1.05); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ═══ WITH DATA ═══
  const n = profile.daily_norms;
  const t = totals!;
  const calPct = n.calories > 0 ? Math.min((t.calories / n.calories), 1) : 0;
  const calDash = Math.round(calPct * 264);
  const dateStr = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  const handleRemove = (id: string) => { removeDiaryEntry(id); reload(); };

  // Week aggregates
  const daysWithData = weekTotals.filter(d => d.calories > 0);
  const avgCal = daysWithData.length > 0 ? Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length) : 0;
  const maxWeekCal = Math.max(n.calories, ...weekTotals.map(d => d.calories));
  const totalWeekScans = daysWithData.reduce((s, d) => s + d.entries.length, 0);
  const weekFoodScans = daysWithData.flatMap(d => d.entries).length;

  // History breakdown for week
  const weekHistory = getHistory().filter(h => {
    const d = new Date(h.date);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 86400000;
    return diff <= 7;
  });
  const weekFoodCount = weekHistory.filter(h => (h.scanType || "").startsWith("food")).length;
  const weekCosmeticsCount = weekHistory.filter(h => h.scanType === "cosmetics").length;
  const weekSupplementCount = weekHistory.filter(h => h.scanType === "suplement").length;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg, #0a0e0c)", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "16px 22px 24px", background: "linear-gradient(180deg, rgba(var(--c-mint-rgb, 110,252,180), 0.08) 0%, transparent 100%)", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>Dashboard</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{dateStr}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Chipy kroki/kcal/sen usunięte z nagłówka — dane w karcie "Aktywność dziś". */}
            {streak > 0 && (
              <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(var(--c-mint-rgb, 110,252,180), 0.08)", border: "1px solid rgba(var(--c-mint-rgb, 110,252,180), 0.15)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12 }}>🔥</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--c-mint, #6efcb4)" }}>{streak} {streak === 1 ? "dzień" : "dni"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", gap: 4, marginTop: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3 }}>
          {(["today", "week"] as DashView[]).map((v) => (
            <div key={v} onClick={() => setView(v)} style={{
              flex: 1, textAlign: "center", padding: 8, borderRadius: 10, cursor: "pointer",
              background: view === v ? "rgba(var(--c-mint-rgb, 110,252,180), 0.1)" : "transparent",
              border: view === v ? "1px solid rgba(var(--c-mint-rgb, 110,252,180), 0.15)" : "1px solid transparent",
              fontSize: 12, fontWeight: 700,
              color: view === v ? "var(--c-mint, #6efcb4)" : "rgba(255,255,255,0.55)",
            }}>
              {v === "today" ? "Dziś" : "Tydzień"}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px 24px" }}>

        {/* ═══ TODAY VIEW ═══ */}
        {view === "today" && (<>

          {/* Calorie ring card */}
          <GlassCard style={{ borderRadius: 20, padding: "20px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(var(--c-mint-rgb, 110,252,180), 0.3), transparent)" }} />
            <SectionTitle>Bilans dnia</SectionTitle>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 100, height: 100, position: "relative", flexShrink: 0 }}>
                <svg width="100" height="100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#6efcb4" strokeWidth="8"
                    strokeDasharray={`${calDash} ${264 - calDash}`} strokeLinecap="round" transform="rotate(-90 50 50)"
                    style={{ transition: "stroke-dasharray 0.8s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{t.calories}</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>/ {n.calories} kcal</span>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                {[
                  { label: "Białko", value: t.protein, max: n.protein_max, color: "var(--c-blue, #3b82f6)" },
                  { label: "Tłuszcz", value: t.fat, max: n.fat_max, color: "var(--c-amber, #FBBF24)" },
                  { label: "Węgle", value: t.carbs, max: n.carbs_max, color: "var(--c-mint, #6efcb4)" },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{Math.round(m.value)}g / {m.max}g</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${Math.min((m.value / m.max) * 100, 100)}%`, background: m.color, borderRadius: 2, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bilans netto — wyróżniona stopka karty "Bilans dnia" (tylko gdy health połączony) */}
            {health.isNative && health.isConnected && (() => {
              const net = t.calories - health.kcalBurned;
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13, padding: "10px 12px", background: "rgba(var(--c-mint-rgb, 110,252,180), 0.08)", border: "1px solid rgba(var(--c-mint-rgb, 110,252,180), 0.22)", borderRadius: 13 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "#fff" }}>Bilans netto</span>
                    <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginLeft: 8 }}>Zjedzone {t.calories} − Spalone {health.kcalBurned}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--c-mint, #6efcb4)" }}>{net > 0 ? "+" : ""}{net}<span style={{ fontSize: 11, marginLeft: 2 }}>kcal</span></span>
                </div>
              );
            })()}
          </GlassCard>

          {/* Posiłki dziś — płaska lista (bez tabów pór posiłku) */}
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>🍽️</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Posiłki dziś</span>
            </div>

            {t.entries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>🍽️</span>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
                  Brak posiłków — dodaj posiłek poniżej 👇
                </div>
              </div>
            ) : (
              t.entries.map((meal) => (
                <div key={meal.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginBottom: 6, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(var(--c-mint-rgb, 110,252,180), 0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    {MEAL_ICONS[meal.mealType] || "🍽️"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{meal.productName}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{meal.timestamp ? new Date(meal.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-mint, #6efcb4)" }}>{meal.calories} kcal</span>
                  <button onClick={() => handleRemove(meal.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 14, cursor: "pointer", padding: 4 }}>✕</button>
                </div>
              ))
            )}
          </GlassCard>

          {/* Szybkie dodawanie — kompakt: pole + mikrofon + 📸 skan (jeden rząd, pod posiłkami) */}
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "8px 12px" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitSearch();
                    }
                  }}
                  placeholder="Wpisz lub powiedz co zjadłeś..."
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500, padding: "2px 0" }}
                />
              </div>
              {searchQuery.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={submitSearch}
                  aria-label="Szukaj"
                  style={{ width: 40, height: 40, borderRadius: "9999px", border: "none", background: "var(--c-mint, #6efcb4)", color: "var(--c-ink, #0a0f0d)", fontSize: 17, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 14px rgba(var(--c-mint-rgb, 110,252,180), 0.34)" }}
                >
                  →
                </button>
              ) : (
                <VoiceMicButton onClick={() => { setVoiceInitialText(undefined); setShowVoice(true); }} accent="green" hideNewBadge />
              )}
              {/* Kompaktowa ikona skanu — handler bez zmian (saveMode + push do skanera) */}
              <button
                type="button"
                onClick={() => { saveMode("food"); router.push("/"); }}
                aria-label="Zeskanuj posiłek"
                style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(var(--c-mint-rgb, 110,252,180), 0.10)", border: "1px solid rgba(var(--c-mint-rgb, 110,252,180), 0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, cursor: "pointer" }}
              >
                📸
              </button>
            </div>
          </GlassCard>

          {/* Aktywność dziś — poziomy pasek 4 metryk (bez wiersza Bilans netto) */}
          {health.isNative && (
            <div id="aktywnosc-dzis" style={{ scrollMarginTop: 16 }}>
            <GlassCard>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🏃</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Aktywność dziś</span>
                </div>
              </div>

              {health.isConnected ? (
                (() => {
                  const fmtSleep = (mins: number): string => {
                    if (!mins || mins <= 0) return "—";
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return `${h}h ${m}m`;
                  };
                  const stats = [
                    { value: health.steps.toLocaleString("pl-PL"), label: "Kroki", icon: "👟", color: "var(--c-mint, #6efcb4)" },
                    { value: String(health.kcalBurned), label: "Spalone", icon: "🔥", color: "var(--c-orange, #f97316)" },
                    { value: `${health.distanceKm.toFixed(1)} km`, label: "Dystans", icon: "📍", color: "var(--c-blue, #3b82f6)" },
                    { value: fmtSleep(health.sleepMinutes), label: "Sen", icon: "😴", color: "var(--c-violet-3, #8b5cf6)" },
                  ];
                  return (
                    <div style={{ display: "flex" }}>
                      {stats.map((a, i) => (
                        <div key={i} style={{ flex: 1, textAlign: "center", padding: "0 4px", borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                          <div style={{ fontSize: 14 }}>{a.icon}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: a.color, marginTop: 3, letterSpacing: "-0.02em" }}>{a.value}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{a.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (() => {
                // Not connected — inline CTA inside the Aktywność card.
                const healthLabel = health.platform === "android" ? "Health Connect" : "Apple Health";
                const needsInstall = health.platform === "android" && !health.loading && !health.isAvailable;
                return (
                  <div style={{ textAlign: "center", padding: "4px 0 2px" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 12px" }}>
                      Śledź aktywność i bilans kaloryczny
                    </div>
                    <button
                      onClick={() => {
                        try { localStorage.setItem("healthKitAsked", "1"); } catch {}
                        if (needsInstall) {
                          health.openSettings();
                        } else {
                          health.requestAccess();
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 12,
                        background: "linear-gradient(135deg, var(--c-emerald, #34d399) 0%, var(--c-emerald-2, #10b981) 100%)",
                        color: "#fff",
                        fontSize: 13.5,
                        fontWeight: 800,
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 4px 15px rgba(52,211,153,0.2)",
                      }}
                    >
                      🏃 {needsInstall ? `Zainstaluj ${healthLabel}` : `Połącz z ${healthLabel}`}
                    </button>
                  </div>
                );
              })()}
            </GlassCard>
            </div>
          )}
        </>)}

        {/* ═══ WEEK VIEW ═══ */}
        {view === "week" && (<>

          {/* Weekly calorie chart */}
          <GlassCard style={{ borderRadius: 20, padding: "20px 18px" }}>
            <SectionTitle>Kalorie w tym tygodniu</SectionTitle>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, marginBottom: 12 }}>
              {weekTotals.map((day, i) => {
                const pct = maxWeekCal > 0 ? (day.calories / maxWeekCal) * 100 : 0;
                const d = new Date(day.date);
                const dayIdx = (d.getDay() + 6) % 7;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", position: "relative" }}>
                      {/* Target line */}
                      {n.calories > 0 && (
                        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(n.calories / maxWeekCal) * 100}%`, height: 1, borderBottom: "1px dashed rgba(255,255,255,0.15)" }} />
                      )}
                      <div style={{
                        width: "100%", borderRadius: "4px 4px 0 0",
                        height: `${Math.max(pct, 2)}%`,
                        background: day.calories > 0 ? (day.calories > n.calories ? "linear-gradient(180deg, var(--c-orange, #f97316), var(--c-amber, #FBBF24))" : "linear-gradient(180deg, var(--c-mint, #6efcb4), var(--c-green-2, #3dd990))") : "rgba(255,255,255,0.04)",
                        transition: "height 0.5s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{DAY_LABELS[dayIdx]}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              Średnio: <span style={{ color: "var(--c-mint, #6efcb4)", fontWeight: 700 }}>{avgCal} kcal</span> / dzień
            </div>
          </GlassCard>

          {/* Average macros */}
          {daysWithData.length > 0 && (
            <GlassCard>
              <SectionTitle>Średnie dzienne makro</SectionTitle>
              {[
                { label: "Białko", value: Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / daysWithData.length), max: n.protein_max, color: "var(--c-blue, #3b82f6)" },
                { label: "Tłuszcz", value: Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / daysWithData.length), max: n.fat_max, color: "var(--c-amber, #FBBF24)" },
                { label: "Węgle", value: Math.round(daysWithData.reduce((s, d) => s + d.carbs, 0) / daysWithData.length), max: n.carbs_max, color: "var(--c-mint, #6efcb4)" },
              ].map((m, i) => (
                <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{m.value}g / {m.max}g</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${Math.min((m.value / m.max) * 100, 100)}%`, background: m.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </GlassCard>
          )}

          {/* Weekly activity — real data from HealthKit / Health Connect */}
          {health.isNative && (
            <GlassCard>
              <SectionTitle>Aktywność w tym tygodniu</SectionTitle>
              {health.isConnected ? (
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { value: health.weekSteps.toLocaleString("pl-PL"), label: "Kroki", icon: "👟", color: "var(--c-mint, #6efcb4)" },
                    { value: String(health.weekKcalBurned), label: "kcal spalone", icon: "🔥", color: "var(--c-orange, #f97316)" },
                    { value: `${health.weekDistanceKm.toFixed(1)} km`, label: "Dystans", icon: "📍", color: "var(--c-blue, #3b82f6)" },
                  ].map((a, i) => (
                    <div key={i} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>{a.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: a.color, letterSpacing: "-0.02em" }}>{a.value}</div>
                      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{a.label}</div>
                    </div>
                  ))}
                </div>
              ) : (() => {
                const healthLabel = health.platform === "android" ? "Health Connect" : "Apple Health";
                const needsInstall = health.platform === "android" && !health.loading && !health.isAvailable;
                return (
                  <div style={{ textAlign: "center", padding: "4px 0 2px" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 12px" }}>
                      Połącz z {healthLabel} żeby zobaczyć historię
                    </div>
                    <button
                      onClick={() => {
                        try { localStorage.setItem("healthKitAsked", "1"); } catch {}
                        if (needsInstall) {
                          health.openSettings();
                        } else {
                          health.requestAccess();
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 12,
                        background: "linear-gradient(135deg, var(--c-emerald, #34d399) 0%, var(--c-emerald-2, #10b981) 100%)",
                        color: "#fff",
                        fontSize: 13.5,
                        fontWeight: 800,
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 4px 15px rgba(52,211,153,0.2)",
                      }}
                    >
                      🏃 {needsInstall ? `Zainstaluj ${healthLabel}` : `Połącz z ${healthLabel}`}
                    </button>
                  </div>
                );
              })()}
            </GlassCard>
          )}

          {/* Scan count */}
          <GlassCard>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginBottom: 8 }}>
                Zeskanowałeś <span style={{ color: "var(--c-mint, #6efcb4)", fontWeight: 800 }}>{weekHistory.length}</span> produktów w tym tygodniu
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {weekFoodCount > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", padding: "4px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>{weekFoodCount} żywność</span>}
                {weekCosmeticsCount > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", padding: "4px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>{weekCosmeticsCount} kosmetyk</span>}
                {weekSupplementCount > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", padding: "4px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>{weekSupplementCount} suplement</span>}
              </div>
            </div>
          </GlassCard>
        </>)}

        {/* Disclaimer */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
            SkładAI nie jest wyrobem medycznym. Skonsultuj z dietetykiem.
          </span>
        </div>
      </div>

      {/* Voice Log Modal — mic + text search for meals */}
      {showVoice && (
        <VoiceLog
          mode="food"
          initialOpen={true}
          hideButton={true}
          initialText={voiceInitialText}
          onComplete={() => {
            setShowVoice(false);
            setSearchQuery("");
            setVoiceInitialText(undefined);
            reload();
          }}
          onClose={() => {
            setShowVoice(false);
            setVoiceInitialText(undefined);
          }}
        />
      )}

      {/* First-time Health consent modal — iOS HealthKit / Android Health Connect */}
      {showHealthModal && (() => {
        const healthLabel = health.platform === "android" ? "Health Connect" : "Apple Health";
        // Android-specific: Health Connect not installed
        const needsInstall = health.platform === "android" && !health.isAvailable;
        return (
        <div
          onClick={() => {
            try { localStorage.setItem("healthKitAsked", "1"); } catch {}
            setShowHealthModal(false);
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 340,
              background: "#13191a",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 12 }}>🏃</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
              Śledź swoją aktywność
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: "19px", marginBottom: 22 }}>
              {needsInstall
                ? "Zainstaluj Google Health Connect z Play Store, żeby śledzić kroki i spalone kalorie w Dashboard."
                : `Połącz z ${healthLabel} aby zobaczyć kroki i spalone kalorie w Dashboard.`}
            </div>
            <button
              onClick={async () => {
                try { localStorage.setItem("healthKitAsked", "1"); } catch {}
                setShowHealthModal(false);
                if (needsInstall) {
                  // Open Health Connect settings — routes user to install if missing.
                  await health.openSettings();
                } else {
                  await health.requestAccess();
                }
              }}
              style={{
                width: "100%", padding: 14, borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, var(--c-mint, #6efcb4), var(--c-green-2, #3dd990))",
                color: "var(--c-ink, #0a0f0d)", fontWeight: 800, fontSize: 14, cursor: "pointer",
                marginBottom: 8,
              }}
            >
              {needsInstall ? "Otwórz Health Connect" : "Połącz"}
            </button>
            <button
              onClick={() => {
                try { localStorage.setItem("healthKitAsked", "1"); } catch {}
                setShowHealthModal(false);
              }}
              style={{
                width: "100%", padding: 14, borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              Nie teraz
            </button>
          </div>
        </div>
        );
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 0.7; transform: scale(1.05); } }`}</style>
    </div>
  );
}
