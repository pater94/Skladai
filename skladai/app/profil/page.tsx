"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { UserProfile } from "@/lib/types";
import { getProfile, getStreak, getHistory } from "@/lib/storage";
import { ACTIVITY_LEVELS, GOALS, COMMON_ALLERGENS, DIETS, DIABETES_TYPES, TRIMESTERS } from "@/lib/nutrition";
import ProfileSetup from "@/components/ProfileSetup";
import { createClient } from "@/lib/supabase";
import { useHealthData } from "@/lib/useHealthData";

const AreaChart = dynamic(() => import("recharts").then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then(m => m.ReferenceLine), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });

interface WeightEntry { date: string; weight: number; source: string; }
const WH_KEY = "skladai_weight_history";

function getWeightHistory(): WeightEntry[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(WH_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveWeightHistory(entries: WeightEntry[]) { localStorage.setItem(WH_KEY, JSON.stringify(entries)); }

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  return { slope: (n * sxy - sx * sy) / denom, intercept: (sy - (n * sxy - sx * sy) / denom * sx) / n };
}

/* Glass card component */
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [normsOpen, setNormsOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [scanCount, setScanCount] = useState(0);

  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newWeightDate, setNewWeightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const health = useHealthData();

  useEffect(() => {
    (document.getElementById("scroll-container") || window).scrollTo(0, 0);
    const p = getProfile();
    setProfile(p);
    setStreak(getStreak());
    setScanCount(getHistory().length);
    setWeightHistory(getWeightHistory());
    setLoaded(true);

    // Check Supabase auth
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthEmail(user.email || null);
      }
    });
  }, []);

  const handleSaveWeight = useCallback(() => {
    const w = parseFloat(newWeight.replace(",", "."));
    if (isNaN(w) || w < 20 || w > 400) return;
    const entry: WeightEntry = { date: newWeightDate, weight: w, source: "manual" };
    const updated = [...weightHistory, entry].sort((a, b) => a.date.localeCompare(b.date));
    saveWeightHistory(updated);
    setWeightHistory(updated);
    setShowWeightForm(false);
    setNewWeight("");
    setNewWeightDate(new Date().toISOString().slice(0, 10));
    if (profile) {
      const updatedProfile = { ...profile, weight_kg: w, updated_at: new Date().toISOString() };
      localStorage.setItem("skladai_profile", JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
    }
  }, [newWeight, newWeightDate, weightHistory, profile]);

  const weightChartData = useMemo(() => {
    const byDate = new Map<string, WeightEntry>();
    for (const e of weightHistory) byDate.set(e.date, e);
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [weightHistory]);

  const uniqueDateCount = weightChartData.length;

  const targetWeight = useMemo(() => {
    if (!profile) return null;
    const currentW = weightChartData.length > 0 ? weightChartData[weightChartData.length - 1].weight : profile.weight_kg;
    if (profile.goal === "lose") return currentW - 5;
    if (profile.goal === "gain") return currentW + 5;
    return currentW;
  }, [profile, weightChartData]);

  const prediction = useMemo(() => {
    if (uniqueDateCount < 3 || !profile || targetWeight === null) return null;
    const baseDate = new Date(weightChartData[0].date).getTime();
    const msPerDay = 86400000;
    const points = weightChartData.map(e => ({ x: (new Date(e.date).getTime() - baseDate) / msPerDay, y: e.weight }));
    const reg = linearRegression(points);
    if (!reg || reg.slope === 0) return null;
    const lastPoint = points[points.length - 1];
    const goodTrend = (profile.goal === "lose" && reg.slope < 0) || (profile.goal === "gain" && reg.slope > 0) || (profile.goal !== "lose" && profile.goal !== "gain");
    let weeksToGoal: number | null = null;
    if ((profile.goal === "lose" || profile.goal === "gain") && reg.slope !== 0) {
      const d = (targetWeight - (reg.intercept + reg.slope * lastPoint.x)) / reg.slope;
      if (d > 0) weeksToGoal = Math.round(d / 7);
    }
    const predictionPoints: { date: string; prediction: number }[] = [];
    for (let d = 1; d <= 30; d++) {
      const futureX = lastPoint.x + d;
      const futureDate = new Date(baseDate + futureX * msPerDay);
      predictionPoints.push({ date: `${String(futureDate.getDate()).padStart(2, "0")}.${String(futureDate.getMonth() + 1).padStart(2, "0")}`, prediction: Math.round((reg.intercept + reg.slope * futureX) * 10) / 10 });
    }
    return { goodTrend, weeksToGoal, targetWeight, predictionPoints };
  }, [weightChartData, uniqueDateCount, profile, targetWeight]);

  const chartDisplayData = useMemo(() => {
    const actual = weightChartData.map(e => {
      const d = new Date(e.date);
      return { date: `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`, weight: e.weight, prediction: undefined as number | undefined };
    });
    if (prediction && prediction.predictionPoints.length > 0) {
      const last = actual[actual.length - 1];
      last.prediction = last.weight;
      for (const pp of prediction.predictionPoints) actual.push({ date: pp.date, weight: undefined as unknown as number, prediction: pp.prediction });
    }
    return actual;
  }, [weightChartData, prediction]);

  // Loading
  if (!loaded) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0e0c" }}>
        <div style={{ width: 48, height: 48, border: "4px solid rgba(110,252,180,0.3)", borderTopColor: "#6efcb4", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Profile editing (user clicked edit or "Rozpocznij")
  if (editing) {
    return (
      <ProfileSetup
        existingProfile={profile}
        onComplete={(p) => { setProfile(p); setEditing(false); }}
        onSkip={() => { setEditing(false); if (!profile) router.push("/"); }}
      />
    );
  }

  // ═══ EMPTY STATE (no profile) ═══
  if (!profile) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0e0c", paddingBottom: 100 }}>
        <div style={{ padding: "20px 22px 30px", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 300, height: 200, background: "radial-gradient(ellipse, rgba(110,252,180,0.08), transparent 70%)", pointerEvents: "none" }} />

          <div style={{ textAlign: "center", paddingTop: 30 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 16px", background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "rgba(255,255,255,0.2)" }}>👤</div>

            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Cześć!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 28 }}>Uzupełnij profil żeby AI lepiej Cię znał</div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, marginBottom: 20, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)", marginBottom: 14 }}>Krok 1 z 4</div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "25%", background: "#6efcb4", borderRadius: 2 }} />
              </div>

              {[
                { icon: "👤", label: "Podstawowe dane", desc: "Imię, płeć, wiek", active: true },
                { icon: "⚖️", label: "Wymiary", desc: "Waga, wzrost", active: false },
                { icon: "🎯", label: "Twój cel", desc: "Odchudzanie, masa, zdrowie", active: false },
                { icon: "⚠️", label: "Alergie", desc: "Czego unikasz", active: false },
              ].map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", marginBottom: 6, borderRadius: 12,
                  background: s.active ? "rgba(110,252,180,0.06)" : "transparent",
                  border: s.active ? "1px solid rgba(110,252,180,0.12)" : "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: s.active ? "rgba(110,252,180,0.1)" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: s.active ? "#6efcb4" : "rgba(255,255,255,0.55)" }}>{s.label}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setEditing(true)} style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6efcb4, #3dd990)", color: "#0a0f0d", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 20px rgba(110,252,180,0.2)" }}>
              Rozpocznij →
            </button>

            <div style={{ marginTop: 12 }}>
              <span onClick={() => router.push("/")} style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>Pomiń na razie</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activityLabel = ACTIVITY_LEVELS[profile.activity]?.label || profile.activity;
  const goalLabel = GOALS[profile.goal]?.label || profile.goal;
  const diabetesLabel = profile.health.diabetes ? DIABETES_TYPES[profile.health.diabetes]?.label : null;
  const pregnancyLabel = profile.health.pregnancy ? TRIMESTERS[profile.health.pregnancy]?.label : null;
  const dietLabel = profile.health.diet && profile.health.diet !== "none" ? DIETS[profile.health.diet as keyof typeof DIETS]?.label : null;
  const allergenLabels = profile.health.allergens.map((id) => {
    const a = COMMON_ALLERGENS.find((x) => x.id === id);
    return a ? `${a.icon} ${a.label}` : id;
  });
  const hasHealthProfile = !!(diabetesLabel || pregnancyLabel || allergenLabels.length > 0 || dietLabel);
  const n = profile.daily_norms;
  const avatarLetter = profile.name ? profile.name.charAt(0).toUpperCase() : "👤";
  const isEmoji = !profile.name;
  const streakLabel = streak === 1 ? "dzień" : "dni";

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0e0c", paddingBottom: 100 }}>

      {/* Header with gradient */}
      <div style={{ padding: "16px 22px 30px", background: "linear-gradient(180deg, rgba(110,252,180,0.1) 0%, rgba(110,252,180,0.02) 60%, transparent 100%)", textAlign: "center", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <div onClick={() => setEditing(true)} style={{ padding: "6px 16px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600, cursor: "pointer" }}>
            Edytuj profil
          </div>
        </div>

        {/* Avatar */}
        <div style={{ width: 76, height: 76, borderRadius: "50%", margin: "0 auto 12px", background: "linear-gradient(135deg, rgba(110,252,180,0.2), rgba(59,130,246,0.15))", border: "2px solid rgba(110,252,180,0.2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", inset: -6, background: "radial-gradient(circle, rgba(110,252,180,0.15), transparent 70%)", borderRadius: "50%" }} />
          {isEmoji ? (
            <span style={{ fontSize: 30, position: "relative" }}>👤</span>
          ) : (
            <span style={{ fontSize: 30, fontWeight: 900, color: "#6efcb4", position: "relative" }}>{avatarLetter}</span>
          )}
        </div>

        <div style={{ fontSize: 20, fontWeight: 900, color: "#6efcb4", letterSpacing: "-0.02em" }}>
          {profile.name ? `Cześć, ${profile.name}!` : "Cześć!"}
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
          {[
            `${profile.weight_kg} kg`,
            `${profile.height_cm} cm`,
            `BMI ${profile.bmi}`,
            ...(streak > 0 ? [`🔥 ${streak} ${streakLabel}`] : []),
            ...(scanCount > 0 ? [`📱 ${scanCount} skanów`] : []),
          ].map((s, i) => (
            <div key={i} style={{ padding: "5px 12px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
              {s}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px 24px" }}>

        {/* Activity & Goal */}
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>🎯</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Aktywność i cel</span>
          </div>
          {[
            { label: "Aktywność", value: activityLabel },
            { label: "Cel", value: goalLabel },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>{r.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{r.value}</span>
            </div>
          ))}
        </GlassCard>

        {/* Apple Health (iOS) / Health Connect (Android) — native only */}
        {health.isNative && (() => {
          const healthLabel = health.platform === "android" ? "Health Connect" : "Apple Health";
          const needsInstall = health.platform === "android" && !health.loading && !health.isAvailable;
          return (
            <GlassCard>
              {health.isConnected ? (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "4px 2px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(110,252,180,0.85)",
                  }}
                >
                  <span style={{ fontSize: 16 }}>✅</span>
                  <span style={{ flex: 1 }}>{healthLabel} — połączono</span>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "2px 0",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "rgba(52,211,153,0.1)",
                      border: "1px solid rgba(52,211,153,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>❤️</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>
                      {healthLabel}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      Śledź aktywność i bilans kaloryczny
                    </div>
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
                      padding: "8px 16px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {needsInstall ? "Zainstaluj" : "Połącz"}
                  </button>
                </div>
              )}
            </GlassCard>
          );
        })()}

        {/* Health profile */}
        {hasHealthProfile && (
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>🏥</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Profil zdrowotny</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {diabetesLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.12)" }}>
                  <span>🩸</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(251,191,36,0.8)" }}>Cukrzyca {diabetesLabel}</span>
                </div>
              )}
              {pregnancyLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.12)" }}>
                  <span>🤰</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(244,114,182,0.8)" }}>{pregnancyLabel}</span>
                </div>
              )}
              {allergenLabels.length > 0 && (
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(239,68,68,0.7)", marginBottom: 6 }}>⚠️ Alergie:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {allergenLabels.map((a, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 16, background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.7)" }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {dietLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(110,252,180,0.06)", border: "1px solid rgba(110,252,180,0.12)" }}>
                  <span>🥗</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(110,252,180,0.8)" }}>{dietLabel}</span>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Weight progress */}
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>📈</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Progres do celu</span>
          </div>

          {uniqueDateCount >= 2 ? (
            <>
              <div style={{ height: 80, borderRadius: 12, background: "rgba(110,252,180,0.04)", border: "1px solid rgba(110,252,180,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, overflow: "hidden" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDisplayData} margin={{ top: 8, right: 8, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6efcb4" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#6efcb4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.5)" }} tickLine={false} axisLine={false} />
                    <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={false} tickLine={false} axisLine={false} />
                    {targetWeight !== null && (profile.goal === "lose" || profile.goal === "gain") && (
                      <ReferenceLine y={targetWeight} stroke="rgba(110,252,180,0.3)" strokeDasharray="6 4" strokeWidth={1} />
                    )}
                    <Area type="monotone" dataKey="weight" stroke="#6efcb4" strokeWidth={2} fill="url(#wGrad)" dot={{ r: 3, fill: "#6efcb4" }} connectNulls={false} />
                    {prediction && <Area type="monotone" dataKey="prediction" stroke="#6efcb4" strokeWidth={1.5} strokeDasharray="6 4" fill="none" dot={false} connectNulls />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {prediction && (
                prediction.goodTrend ? (
                  <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(110,252,180,0.06)", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "rgba(110,252,180,0.7)", fontWeight: 600 }}>
                      📈 Przy tym tempie osiągniesz {targetWeight} kg{prediction.weeksToGoal !== null ? ` za ~${prediction.weeksToGoal} tyg.` : ""}
                    </span>
                  </div>
                ) : (
                  <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.06)", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "rgba(239,68,68,0.7)", fontWeight: 600 }}>⚠️ Trend prowadzi w złą stronę</span>
                  </div>
                )
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>Zacznij logować wagę żeby zobaczyć progres</div>
            </div>
          )}

          {!showWeightForm ? (
            <button onClick={() => setShowWeightForm(true)} style={{ width: "100%", padding: 10, borderRadius: 12, background: "rgba(110,252,180,0.06)", border: "1px solid rgba(110,252,180,0.12)", color: "#6efcb4", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              + Dodaj wagę
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600, display: "block", marginBottom: 4 }}>Waga (kg)</label>
                <input type="number" step="0.1" min="20" max="400" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder={String(profile.weight_kg)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600, display: "block", marginBottom: 4 }}>Data</label>
                <input type="date" value={newWeightDate} onChange={(e) => setNewWeightDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, colorScheme: "dark" }} />
              </div>
              <button type="button" onClick={handleSaveWeight} style={{ padding: "8px 16px", borderRadius: 10, background: "#6efcb4", color: "#0a0f0d", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", flexShrink: 0, WebkitAppearance: "none" }}>
                Zapisz
              </button>
            </div>
          )}
        </GlassCard>

        {/* Daily norms — collapsible */}
        <GlassCard>
          <div onClick={() => setNormsOpen(!normsOpen)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Twoje dzienne normy</span>
            </div>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", transition: "transform 0.2s", transform: normsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
          </div>

          {normsOpen && (
            <div style={{ marginTop: 16 }}>
              {/* Calories */}
              <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(110,252,180,0.06)", border: "1px solid rgba(110,252,180,0.1)", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(110,252,180,0.8)" }}>⚡ Kalorie</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{n.calories} kcal</span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(110,252,180,0.6)", marginTop: 4 }}>BMR: {profile.bmr} · TDEE: {profile.tdee} · Cel: {goalLabel}</div>
              </div>

              {/* Macros */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[
                  { icon: "💪", label: "Białko", value: `${n.protein_min}-${n.protein_max}g` },
                  { icon: "🫧", label: "Tłuszcz", value: `${n.fat_min}-${n.fat_max}g` },
                  { icon: "🍞", label: "Węgle", value: `${n.carbs_min}-${n.carbs_max}g` },
                ].map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{m.icon} {m.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Micros */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "🧂", label: "Sól max", value: `${n.salt_max}g` },
                  { icon: "🥄", label: "Cukier max", value: `${n.sugar_max}g` },
                  { icon: "🥦", label: "Błonnik min", value: `${n.fiber_min}g` },
                  { icon: "💧", label: "Woda", value: `${(n.water_ml / 1000).toFixed(1)}L` },
                ].map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 12 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{m.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{m.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Auth info & Logout */}
        {authEmail && (
          <GlassCard>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>🔑</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>Konto</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 12, wordBreak: "break-all" }}>
               {authEmail}
            </div>
            <button
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                localStorage.removeItem("onboardingCompleted");
                router.push("/");
              }}
              style={{
                width: "100%", padding: 12, borderRadius: 12,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
                color: "rgba(239,68,68,0.7)", fontSize: 13, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Wyloguj się
            </button>
          </GlassCard>
        )}

        {/* Disclaimer */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
            SkładAI nie jest wyrobem medycznym. Skonsultuj z dietetykiem.
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
