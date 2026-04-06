"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProfile, DailyTotals } from "@/lib/types";
import { getProfile, getDailyTotals, getWeekTotals, todayStr, removeDiaryEntry, getStreak, getHistory, saveMode } from "@/lib/storage";
import { useHealthData } from "@/lib/useHealthData";
import VoiceLog, { VoiceMicButton } from "@/components/VoiceLog";

type DashView = "today" | "week";
type MealTypeKey = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_ICONS: Record<string, string> = { breakfast: "🥣", lunch: "🥗", dinner: "🍽️", snack: "🍿" };
const MEAL_TYPES: { key: MealTypeKey; icon: string; label: string }[] = [
  { key: "breakfast", icon: "🌅", label: "Śniadanie" },
  { key: "lunch", icon: "🌞", label: "Obiad" },
  { key: "dinner", icon: "🌙", label: "Kolacja" },
  { key: "snack", icon: "🍪", label: "Przekąska" },
];
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
  const [showVoice, setShowVoice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMealType, setSearchMealType] = useState<MealTypeKey>("breakfast");

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

  if (!loaded) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0e0c" }}>
        <div style={{ width: 48, height: 48, border: "4px solid rgba(110,252,180,0.3)", borderTopColor: "#6efcb4", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // ═══ EMPTY STATE (no profile) ═══
  if (!profile) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0e0c", paddingBottom: 100 }}>
        <div style={{ padding: "20px 22px 30px", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 300, height: 200, background: "radial-gradient(ellipse, rgba(110,252,180,0.08), transparent 70%)", pointerEvents: "none" }} />

          <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, margin: "0 auto 20px", background: "rgba(110,252,180,0.06)", border: "1.5px solid rgba(110,252,180,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, position: "relative" }}>
              <div style={{ position: "absolute", inset: -8, background: "radial-gradient(circle, rgba(110,252,180,0.15), transparent 70%)", animation: "breathe 3s ease-in-out infinite" }} />
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

            <button onClick={() => router.push("/profil")} style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6efcb4, #3dd990)", color: "#0a0f0d", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 20px rgba(110,252,180,0.2)", marginTop: 20 }}>
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
  const weekFoodCount = weekHistory.filter(h => h.scanType === "food").length;
  const weekCosmeticsCount = weekHistory.filter(h => h.scanType === "cosmetics").length;
  const weekSupplementCount = weekHistory.filter(h => h.scanType === "suplement").length;

  const GlassCard = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, ...style }}>
      {children}
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)", marginBottom: 12, letterSpacing: "0.03em", textTransform: "uppercase" as const }}>{children}</div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0e0c", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "16px 22px 24px", background: "linear-gradient(180deg, rgba(110,252,180,0.08) 0%, transparent 100%)", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>Dashboard</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{dateStr}</div>
          </div>
          {streak > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(110,252,180,0.08)", border: "1px solid rgba(110,252,180,0.15)", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12 }}>🔥</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#6efcb4" }}>{streak} {streak === 1 ? "dzień" : "dni"}</span>
            </div>
          )}
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", gap: 4, marginTop: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3 }}>
          {(["today", "week"] as DashView[]).map((v) => (
            <div key={v} onClick={() => setView(v)} style={{
              flex: 1, textAlign: "center", padding: 8, borderRadius: 10, cursor: "pointer",
              background: view === v ? "rgba(110,252,180,0.1)" : "transparent",
              border: view === v ? "1px solid rgba(110,252,180,0.15)" : "1px solid transparent",
              fontSize: 12, fontWeight: 700,
              color: view === v ? "#6efcb4" : "rgba(255,255,255,0.55)",
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
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(110,252,180,0.3), transparent)" }} />
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
                  { label: "Białko", value: t.protein, max: n.protein_max, color: "#3b82f6" },
                  { label: "Tłuszcz", value: t.fat, max: n.fat_max, color: "#FBBF24" },
                  { label: "Węgle", value: t.carbs, max: n.carbs_max, color: "#6efcb4" },
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
          </GlassCard>

          {/* Food search — opens VoiceLog for both text & mic */}
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 2px" }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setShowVoice(true);
                  }
                }}
                placeholder="Wpisz lub powiedz co zjadłeś..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "6px 0",
                }}
              />
              <VoiceMicButton onClick={() => setShowVoice(true)} accent="green" />
            </div>
            <button
              onClick={() => { saveMode("food"); router.push("/"); }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                marginTop: 10,
                background: "rgba(110,252,180,0.05)",
                border: "1px solid rgba(110,252,180,0.1)",
                color: "#6efcb4",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              📷 Zeskanuj posiłek →
            </button>
          </GlassCard>

          {/* Activity card — real data from Health */}
          {health.isNative && health.isConnected && (
            <GlassCard>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🏃</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Aktywność dziś</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { value: health.steps.toLocaleString("pl-PL"), label: "Kroki", icon: "👟", color: "#6efcb4" },
                  { value: String(health.kcalBurned), label: "kcal spalone", icon: "🔥", color: "#f97316" },
                  { value: `${health.distanceKm.toFixed(1)} km`, label: "Dystans", icon: "📍", color: "#3b82f6" },
                ].map((a, i) => (
                  <div key={i} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{a.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: a.color, letterSpacing: "-0.02em" }}>{a.value}</div>
                    <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{a.label}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Meals today */}
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>🍽️</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Posiłki dziś</span>
            </div>

            {/* Compact meal type selector */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 3 }}>
              {MEAL_TYPES.map((mt) => (
                <div
                  key={mt.key}
                  onClick={() => setSearchMealType(mt.key)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "6px 4px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: searchMealType === mt.key ? "rgba(110,252,180,0.1)" : "transparent",
                    border: searchMealType === mt.key ? "1px solid rgba(110,252,180,0.15)" : "1px solid transparent",
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: searchMealType === mt.key ? "#6efcb4" : "rgba(255,255,255,0.5)",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  <span style={{ fontSize: 11 }}>{mt.icon}</span>
                  <span>{mt.label}</span>
                </div>
              ))}
            </div>

            {t.entries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>🍽️</span>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
                  Brak posiłków — wpisz co zjadłeś wyżej ☝️
                </div>
              </div>
            ) : (
              t.entries.map((meal) => (
                <div key={meal.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginBottom: 6, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(110,252,180,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    {MEAL_ICONS[meal.mealType] || "🍽️"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{meal.productName}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{meal.timestamp ? new Date(meal.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6efcb4" }}>{meal.calories} kcal</span>
                  <button onClick={() => handleRemove(meal.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 14, cursor: "pointer", padding: 4 }}>✕</button>
                </div>
              ))
            )}
          </GlassCard>

          {/* Critical nutrients */}
          <GlassCard>
            <SectionTitle>Krytyczne składniki</SectionTitle>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { icon: "🍬", label: "Cukier", value: t.sugar, max: n.sugar_max, color: "#FBBF24" },
                { icon: "🧂", label: "Sól", value: t.salt, max: n.salt_max, color: "#f97316" },
                { icon: "🥦", label: "Błonnik", value: t.fiber, max: n.fiber_min, color: "#6efcb4" },
              ].map((nu, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>{nu.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{nu.label}</div>
                  <div style={{ fontSize: 10, color: nu.color, fontWeight: 600, marginTop: 2 }}>{Math.round(nu.value * 10) / 10}g / {nu.max}g</div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 6 }}>
                    <div style={{ height: "100%", width: `${Math.min((nu.value / nu.max) * 100, 100)}%`, background: nu.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
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
                        background: day.calories > 0 ? (day.calories > n.calories ? "linear-gradient(180deg, #f97316, #FBBF24)" : "linear-gradient(180deg, #6efcb4, #3dd990)") : "rgba(255,255,255,0.04)",
                        transition: "height 0.5s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{DAY_LABELS[dayIdx]}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              Średnio: <span style={{ color: "#6efcb4", fontWeight: 700 }}>{avgCal} kcal</span> / dzień
            </div>
          </GlassCard>

          {/* Average macros */}
          {daysWithData.length > 0 && (
            <GlassCard>
              <SectionTitle>Średnie dzienne makro</SectionTitle>
              {[
                { label: "Białko", value: Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / daysWithData.length), max: n.protein_max, color: "#3b82f6" },
                { label: "Tłuszcz", value: Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / daysWithData.length), max: n.fat_max, color: "#FBBF24" },
                { label: "Węgle", value: Math.round(daysWithData.reduce((s, d) => s + d.carbs, 0) / daysWithData.length), max: n.carbs_max, color: "#6efcb4" },
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

          {/* Weekly activity */}
          <GlassCard>
            <SectionTitle>Aktywność w tym tygodniu</SectionTitle>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { value: "47 894", label: "Kroki", icon: "👟", color: "#6efcb4" },
                { value: "2 009", label: "kcal spalone", icon: "🔥", color: "#f97316" },
                { value: "29.4 km", label: "Dystans", icon: "📍", color: "#3b82f6" },
              ].map((a, i) => (
                <div key={i} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{a.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: a.color, letterSpacing: "-0.02em" }}>{a.value}</div>
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{a.label}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Scan count */}
          <GlassCard>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginBottom: 8 }}>
                Zeskanowałeś <span style={{ color: "#6efcb4", fontWeight: 800 }}>{weekHistory.length}</span> produktów w tym tygodniu
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
          onComplete={() => {
            setShowVoice(false);
            setSearchQuery("");
            reload();
          }}
          onClose={() => {
            setShowVoice(false);
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 0.7; transform: scale(1.05); } }`}</style>
    </div>
  );
}
