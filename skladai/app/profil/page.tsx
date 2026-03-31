"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { UserProfile } from "@/lib/types";
import { getProfile, getStreak, getHistory } from "@/lib/storage";
import { ACTIVITY_LEVELS, GOALS, COMMON_ALLERGENS, DIETS, DIABETES_TYPES, TRIMESTERS } from "@/lib/nutrition";
import { getAllAchievements, getAchievementsByCategory, getEarnedCount, CATEGORY_LABELS, TIER_COLORS, Achievement, AchievementCategory } from "@/lib/badges";
import ProfileSetup from "@/components/ProfileSetup";
import LoginScreen from "@/components/LoginScreen";

/* ── Recharts (client-only) ── */
const AreaChart = dynamic(() => import("recharts").then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then(m => m.ReferenceLine), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });

/* ── Weight history types ── */
interface WeightEntry {
  date: string;
  weight: number;
  source: string;
}

const WH_KEY = "skladai_weight_history";

function getWeightHistory(): WeightEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WH_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WeightEntry[];
  } catch { return []; }
}

function saveWeightHistory(entries: WeightEntry[]) {
  localStorage.setItem(WH_KEY, JSON.stringify(entries));
}

/* ── Linear regression (least squares) ── */
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points) {
    sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

/* ══════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════ */
export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [normsOpen, setNormsOpen] = useState(false);

  const [achievements, setAchievements] = useState<Record<AchievementCategory, Achievement[]>>({} as Record<AchievementCategory, Achievement[]>);
  const [earnedStats, setEarnedStats] = useState({ earned: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [scanCount, setScanCount] = useState(0);

  /* ── Weight chart state ── */
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newWeightDate, setNewWeightDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const p = getProfile();
    setProfile(p);
    setAchievements(getAchievementsByCategory());
    setEarnedStats(getEarnedCount());
    setStreak(getStreak());
    setScanCount(getHistory().length);
    setWeightHistory(getWeightHistory());
    setLoaded(true);
    if (!p) setShowLogin(true);
  }, []);

  /* ── Save weight entry ── */
  const handleSaveWeight = useCallback(() => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w < 20 || w > 400) return;
    const entry: WeightEntry = { date: newWeightDate, weight: w, source: "manual" };
    const updated = [...weightHistory, entry].sort((a, b) => a.date.localeCompare(b.date));
    saveWeightHistory(updated);
    setWeightHistory(updated);
    setShowWeightForm(false);
    setNewWeight("");
    setNewWeightDate(new Date().toISOString().slice(0, 10));
    // Update profile weight
    if (profile) {
      const updatedProfile = { ...profile, weight_kg: w, updated_at: new Date().toISOString() };
      localStorage.setItem("skladai_profile", JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
    }
  }, [newWeight, newWeightDate, weightHistory, profile]);

  /* ── Weight chart data ── */
  const weightChartData = useMemo(() => {
    // Dedupe by date (keep last entry per date), sort chronologically
    const byDate = new Map<string, WeightEntry>();
    for (const e of weightHistory) byDate.set(e.date, e);
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [weightHistory]);

  const uniqueDateCount = weightChartData.length;

  /* ── Goal target weight ── */
  const targetWeight = useMemo(() => {
    if (!profile) return null;
    const currentW = weightChartData.length > 0 ? weightChartData[weightChartData.length - 1].weight : profile.weight_kg;
    if (profile.goal === "lose") return currentW - 5;
    if (profile.goal === "gain") return currentW + 5;
    if (profile.goal === "maintain" || profile.goal === "healthy") return currentW;
    return null;
  }, [profile, weightChartData]);

  /* ── Prediction via linear regression ── */
  const prediction = useMemo(() => {
    if (uniqueDateCount < 3 || !profile || targetWeight === null) return null;
    const baseDate = new Date(weightChartData[0].date).getTime();
    const msPerDay = 86400000;
    const points = weightChartData.map(e => ({
      x: (new Date(e.date).getTime() - baseDate) / msPerDay,
      y: e.weight,
    }));
    const reg = linearRegression(points);
    if (!reg || reg.slope === 0) return null;

    const lastPoint = points[points.length - 1];
    const lastWeight = lastPoint.y;

    // Is trend approaching goal?
    const isLoseGoal = profile.goal === "lose";
    const isGainGoal = profile.goal === "gain";
    const goodTrend =
      (isLoseGoal && reg.slope < 0) ||
      (isGainGoal && reg.slope > 0) ||
      (!isLoseGoal && !isGainGoal);

    // Days to target
    let weeksToGoal: number | null = null;
    if ((isLoseGoal || isGainGoal) && reg.slope !== 0) {
      const daysToGoal = (targetWeight - (reg.intercept + reg.slope * lastPoint.x)) / reg.slope;
      if (daysToGoal > 0) weeksToGoal = Math.round(daysToGoal / 7);
    }

    // Generate prediction points (extend 30 days)
    const predictionPoints: { date: string; prediction: number }[] = [];
    for (let d = 1; d <= 30; d++) {
      const futureX = lastPoint.x + d;
      const futureDate = new Date(baseDate + futureX * msPerDay);
      const dd = String(futureDate.getDate()).padStart(2, "0");
      const mm = String(futureDate.getMonth() + 1).padStart(2, "0");
      predictionPoints.push({
        date: `${dd}.${mm}`,
        prediction: Math.round((reg.intercept + reg.slope * futureX) * 10) / 10,
      });
    }

    return { goodTrend, weeksToGoal, targetWeight, predictionPoints, lastWeight };
  }, [weightChartData, uniqueDateCount, profile, targetWeight]);

  /* ── Chart display data (merge actual + prediction) ── */
  const chartDisplayData = useMemo(() => {
    const actual = weightChartData.map(e => {
      const d = new Date(e.date);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return { date: `${dd}.${mm}`, weight: e.weight, prediction: undefined as number | undefined };
    });
    if (prediction && prediction.predictionPoints.length > 0) {
      // Bridge: last actual point also gets prediction value
      const last = actual[actual.length - 1];
      last.prediction = last.weight;
      // Add future points
      for (const pp of prediction.predictionPoints) {
        actual.push({ date: pp.date, weight: undefined as unknown as number, prediction: pp.prediction });
      }
    }
    return actual;
  }, [weightChartData, prediction]);

  /* ── Loading spinner ── */
  if (!loaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f5f2ed]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full" style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  /* ── Login screen (no profile, not authenticated) ── */
  if (showLogin && !profile) {
    return (
      <LoginScreen
        onSkip={() => {
          setShowLogin(false);
          setEditing(true);
        }}
      />
    );
  }

  /* ── Profile editing / onboarding ── */
  if (editing || !profile) {
    return (
      <ProfileSetup
        existingProfile={profile}
        onComplete={(p) => { setProfile(p); setEditing(false); }}
        onSkip={() => router.push("/")}
      />
    );
  }

  /* ── Full achievements screen (premium) ── */
  if (showAchievements) {
    const pct = earnedStats.total > 0 ? Math.round((earnedStats.earned / earnedStats.total) * 100) : 0;
    return (
      <div className="min-h-[100dvh]" style={{ background: "#0a0f0d" }}>
        <div className="max-w-md mx-auto px-5 pt-6 pb-32">
          <button
            onClick={() => setShowAchievements(false)}
            className="flex items-center gap-1.5 text-[13px] text-white/60 font-semibold px-4 py-2 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all mb-5"
          >
            ← Wstecz
          </button>

          {/* Header with progress ring */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg width="64" height="64" className="transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none"
                  stroke="#10b981" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - pct / 100)}`}
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-emerald-400">
                {pct}%
              </span>
            </div>
            <div>
              <h1 className="text-[22px] font-black text-white">Osiagnięcia</h1>
              <p className="text-[13px] text-white/30 font-semibold">
                {earnedStats.earned} z {earnedStats.total} zdobytych
              </p>
            </div>
          </div>

          {(Object.entries(achievements) as [AchievementCategory, Achievement[]][]).map(([cat, items]) => (
            <div key={cat} className="mb-5 last:mb-0">
              <p className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-2.5">
                {CATEGORY_LABELS[cat]?.icon} {CATEGORY_LABELS[cat]?.name}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {items.map((a, idx) => {
                  const tierColor = TIER_COLORS[a.tier];
                  const progress = a.target > 0 ? Math.min(100, Math.round((a.current / a.target) * 100)) : 0;
                  return (
                    <div
                      key={a.id}
                      className={`relative overflow-hidden rounded-[16px] p-3.5 border transition-all ${
                        a.earned
                          ? "bg-white/[0.04] border-white/[0.08]"
                          : "bg-white/[0.02] border-white/[0.04] opacity-60"
                      }`}
                      style={{ animation: `fadeInUp 0.4s ease ${idx * 0.05}s both` }}
                    >
                      {/* Earned glow */}
                      {a.earned && (
                        <div
                          className="absolute top-0 right-0 w-16 h-16 rounded-full blur-[30px] opacity-15"
                          style={{
                            background: a.tier === "diamond" ? "#06b6d4"
                              : a.tier === "gold" ? "#eab308"
                              : a.tier === "silver" ? "#9ca3af"
                              : "#d97706",
                          }}
                        />
                      )}
                      <div className="flex items-start gap-3 relative z-10">
                        <span className={`text-[28px] ${a.earned ? "" : "grayscale opacity-40"}`}>
                          {a.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-bold leading-tight ${a.earned ? "text-white" : "text-white/40"}`}>
                            {a.name}
                          </p>
                          <p className={`text-[10px] mt-0.5 leading-snug ${a.earned ? "text-white/40" : "text-white/20"}`}>
                            {a.description}
                          </p>
                          {!a.earned && (
                            <div className="mt-2">
                              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${progress}%`,
                                    background: "linear-gradient(90deg, #10b981, #06b6d4)",
                                  }}
                                />
                              </div>
                              <p className="text-[9px] text-white/25 mt-1 font-medium">{a.current}/{a.target}</p>
                            </div>
                          )}
                          {a.earned && (
                            <span className={`inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${tierColor.bg} ${tierColor.text} ${tierColor.border} border`}>
                              {a.tier.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Computed values ── */
  const activityLabel = ACTIVITY_LEVELS[profile.activity]?.label || profile.activity;
  const goalLabel = GOALS[profile.goal]?.label || profile.goal;
  const diabetesLabel = profile.health.diabetes ? DIABETES_TYPES[profile.health.diabetes]?.label : null;
  const pregnancyLabel = profile.health.pregnancy ? TRIMESTERS[profile.health.pregnancy]?.label : null;
  const dietLabel = profile.health.diet && profile.health.diet !== "none" ? DIETS[profile.health.diet as keyof typeof DIETS]?.label : null;
  const allergenLabels = profile.health.allergens.map((id) => {
    const a = COMMON_ALLERGENS.find((x) => x.id === id);
    return a ? `${a.icon} ${a.label}` : id;
  });

  const n = profile.daily_norms;

  // Avatar
  const avatarLetter = profile.name ? profile.name.charAt(0).toUpperCase() : "U";

  // Streak
  const streakLabel = streak === 1 ? "dzień" : "dni";

  // Earned achievements preview (last 4)
  const allAchievements = getAllAchievements();
  const earnedAchievements = allAchievements.filter(a => a.earned).slice(-4);

  // Health profile visible?
  const hasHealthProfile = !!(diabetesLabel || pregnancyLabel || allergenLabels.length > 0 || dietLabel);

  return (
    <div className="min-h-[100dvh] bg-[#f5f2ed]">

      {/* ═══════════════════════════════════════
          A) HEADER — Premium dark
          ═══════════════════════════════════════ */}
      <div className="profil-header relative overflow-hidden">
        {/* 4 animated blobs */}
        <div className="profil-blob profil-blob-1" />
        <div className="profil-blob profil-blob-2" />
        <div className="profil-blob profil-blob-3" />
        <div className="profil-blob profil-blob-4" />
        {/* Film grain */}
        <div className="profil-grain" />

        <div className="max-w-md mx-auto px-5 pt-8 pb-28 relative z-10">
          {/* Edit button — top right, no back button */}
          <div className="flex items-center justify-end mb-6">
            <button
              onClick={() => setEditing(true)}
              className="profil-edit-btn text-[13px] font-semibold px-5 py-2 rounded-full active:scale-95 transition-all"
            >
              Edytuj profil
            </button>
          </div>

          {/* Avatar + Name */}
          <div className="flex flex-col items-center">
            <div className="profil-avatar mb-3">
              <span className="text-[32px] font-[800]" style={{ color: "#6efcb4" }}>{avatarLetter}</span>
            </div>
            <h1 className="text-[24px] font-[800] profil-gradient-text mb-3">
              {profile.name ? `Cześć, ${profile.name}!` : "Cześć!"}
            </h1>

            {/* Glass chips */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="profil-chip">{profile.weight_kg} kg</span>
              <span className="profil-chip">{profile.height_cm} cm</span>
              <span className="profil-chip">BMI {profile.bmi}</span>
              {streak > 0 && (
                <span className="profil-chip profil-chip-streak">
                  🔥 {streak} {streakLabel}
                </span>
              )}
              {scanCount > 0 && (
                <span className="profil-chip">📱 {scanCount} skanów</span>
              )}
            </div>
          </div>
        </div>

        {/* Curved SVG wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none" className="w-full h-[30px]">
            <path d="M0,60 L0,30 C240,0 480,0 720,10 C960,20 1200,0 1440,30 L1440,60 Z" fill="#f5f2ed" />
          </svg>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          BODY — Light warm
          ═══════════════════════════════════════ */}
      <div className="max-w-md mx-auto px-5 -mt-16 pb-10 relative z-20 space-y-4">

        {/* ─────────────────────────────────────
            1) ACTIVITY & GOAL
            ───────────────────────────────────── */}
        <div className="profil-card profil-fadeSlideUp" style={{ animationDelay: "0s" }}>
          <h2 className="text-[16px] font-bold text-gray-800 mb-3">🎯 Aktywność i cel</h2>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[13px] text-gray-500">Aktywność</span>
            <span className="text-[13px] font-bold text-gray-800">{activityLabel}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[13px] text-gray-500">Cel</span>
            <span className="text-[13px] font-bold text-gray-800">{goalLabel}</span>
          </div>
        </div>

        {/* ─────────────────────────────────────
            2) WEIGHT PROGRESS CHART
            ───────────────────────────────────── */}
        <div className="profil-card profil-fadeSlideUp" style={{ animationDelay: "0.05s" }}>
          <h2 className="text-[16px] font-bold text-gray-800 mb-4">📈 Progres do celu</h2>

          {uniqueDateCount >= 2 ? (
            <>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDisplayData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.06} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={["dataMin - 2", "dataMax + 2"]}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e5e7eb" }}
                      formatter={(value: unknown) => [`${value} kg`, "Waga"]}
                      labelFormatter={(label: unknown) => `Data: ${label}`}
                    />
                    {targetWeight !== null && (profile.goal === "lose" || profile.goal === "gain") && (
                      <ReferenceLine
                        y={targetWeight}
                        stroke="#10b981"
                        strokeDasharray="6 4"
                        strokeWidth={1.5}
                        label={{ value: `Cel: ${targetWeight} kg`, position: "right", fill: "#10b981", fontSize: 10 }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#weightGrad)"
                      dot={{ r: 4, fill: "#10b981", stroke: "#064e3b", strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                    {prediction && (
                      <Area
                        type="monotone"
                        dataKey="prediction"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        fill="url(#predGrad)"
                        dot={false}
                        connectNulls
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Prediction info */}
              {prediction ? (
                prediction.goodTrend ? (
                  <div className="mt-3 rounded-[14px] p-3" style={{ background: "rgba(16,185,129,0.06)" }}>
                    <p className="text-[12px] text-emerald-700 font-semibold">
                      📈 Przy tym tempie osiągniesz {targetWeight} kg
                      {prediction.weeksToGoal !== null ? ` za ~${prediction.weeksToGoal} tygodni` : ""}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-[14px] p-3" style={{ background: "rgba(239,68,68,0.06)" }}>
                    <p className="text-[12px] text-red-600 font-semibold">
                      ⚠️ Uwaga: trend prowadzi w zła stronę. Rozważ korekty.
                    </p>
                  </div>
                )
              ) : uniqueDateCount < 3 ? (
                <p className="text-[12px] text-gray-400 mt-3 text-center">
                  Dodaj więcej wpisów żeby zobaczyć predykcję
                </p>
              ) : null}
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-[13px] text-gray-400 mb-4">
                Zacznij logować wagę żeby zobaczyć progres
              </p>
              {!showWeightForm && (
                <button
                  onClick={() => setShowWeightForm(true)}
                  className="text-[13px] font-bold text-emerald-600 bg-emerald-50 px-5 py-2.5 rounded-full active:scale-95 transition-all"
                >
                  + Dodaj wagę
                </button>
              )}
            </div>
          )}

          {/* Add weight button (always shown when chart visible) */}
          {uniqueDateCount >= 2 && !showWeightForm && (
            <button
              onClick={() => setShowWeightForm(true)}
              className="mt-3 w-full text-center text-[13px] font-bold text-emerald-600 py-2.5 rounded-full bg-emerald-50 active:scale-95 transition-all"
            >
              + Dodaj wagę
            </button>
          )}

          {/* Inline weight form */}
          {showWeightForm && (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-semibold block mb-1">Waga (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="400"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder={String(profile.weight_kg)}
                  className="w-full px-3 py-2 rounded-[12px] border border-gray-200 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-semibold block mb-1">Data</label>
                <input
                  type="date"
                  value={newWeightDate}
                  onChange={(e) => setNewWeightDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-gray-200 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <button
                onClick={handleSaveWeight}
                className="px-4 py-2 rounded-[12px] bg-emerald-500 text-white text-[13px] font-bold active:scale-95 transition-all shrink-0"
              >
                Zapisz
              </button>
            </div>
          )}
        </div>

        {/* ── Health profiles (if any) ── */}
        {hasHealthProfile && (
          <div className="profil-card profil-fadeSlideUp" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-[16px] font-bold text-gray-800 mb-3">🏥 Profil zdrowotny</h2>
            <div className="space-y-3">
              {diabetesLabel && (
                <div className="flex items-center gap-2 bg-amber-50 rounded-[12px] p-3">
                  <span>🩸</span>
                  <span className="text-[13px] font-semibold text-amber-700">Cukrzyca {diabetesLabel}</span>
                </div>
              )}
              {pregnancyLabel && (
                <div className="flex items-center gap-2 bg-pink-50 rounded-[12px] p-3">
                  <span>🤰</span>
                  <span className="text-[13px] font-semibold text-pink-700">{pregnancyLabel}</span>
                </div>
              )}
              {allergenLabels.length > 0 && (
                <div className="bg-red-50 rounded-[12px] p-3">
                  <p className="text-[11px] font-semibold text-red-600 mb-2">⚠️ Alergie:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allergenLabels.map((a, i) => (
                      <span key={i} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {dietLabel && (
                <div className="flex items-center gap-2 bg-green-50 rounded-[12px] p-3">
                  <span>🥗</span>
                  <span className="text-[13px] font-semibold text-green-700">{dietLabel}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────
            3) DAILY NORMS — collapsible
            ───────────────────────────────────── */}
        <div className="profil-card profil-fadeSlideUp" style={{ animationDelay: "0.15s" }}>
          <button
            onClick={() => setNormsOpen(!normsOpen)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-[16px] font-bold text-gray-800">📋 Twoje dzienne normy</h2>
            <span className="text-[14px] text-gray-400 transition-transform" style={{ transform: normsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              ▸
            </span>
          </button>

          {normsOpen && (
            <div className="mt-4 space-y-3">
              {/* Calories / BMR / TDEE */}
              <div className="bg-emerald-50 rounded-[16px] p-4">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-bold text-emerald-700">⚡ Kalorie</span>
                  <span className="text-[20px] font-black text-gray-800">{n.calories} kcal</span>
                </div>
                <p className="text-[10px] text-emerald-600/60 mt-1">BMR: {profile.bmr} · TDEE: {profile.tdee} · Cel: {goalLabel}</p>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-[14px] p-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold">💪 Białko</p>
                  <p className="text-[15px] font-bold text-gray-800">{n.protein_min}-{n.protein_max}g</p>
                </div>
                <div className="bg-gray-50 rounded-[14px] p-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold">🫧 Tłuszcz</p>
                  <p className="text-[15px] font-bold text-gray-800">{n.fat_min}-{n.fat_max}g</p>
                </div>
                <div className="bg-gray-50 rounded-[14px] p-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold">🍞 Węgle</p>
                  <p className="text-[15px] font-bold text-gray-800">{n.carbs_min}-{n.carbs_max}g</p>
                </div>
              </div>

              {/* Micros */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-gray-50 rounded-[12px] p-2.5">
                  <span className="text-[12px]">🧂</span>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">Sól max</p>
                    <p className="text-[13px] font-bold text-gray-800">{n.salt_max}g</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-[12px] p-2.5">
                  <span className="text-[12px]">🥄</span>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">Cukier max</p>
                    <p className="text-[13px] font-bold text-gray-800">{n.sugar_max}g</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-[12px] p-2.5">
                  <span className="text-[12px]">🥦</span>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">Błonnik min</p>
                    <p className="text-[13px] font-bold text-gray-800">{n.fiber_min}g</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-[12px] p-2.5">
                  <span className="text-[12px]">💧</span>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">Woda</p>
                    <p className="text-[13px] font-bold text-gray-800">{(n.water_ml / 1000).toFixed(1)}L</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────
            4) ACHIEVEMENTS PREVIEW
            ───────────────────────────────────── */}
        <div className="profil-card profil-fadeSlideUp" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold text-gray-800">🏆 Osiągnięcia</h2>
            <span className="text-[12px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              {earnedStats.earned}/{earnedStats.total}
            </span>
          </div>

          {earnedAchievements.length > 0 ? (
            <div className="flex gap-2 mb-3">
              {earnedAchievements.map((a) => (
                <div
                  key={a.id}
                  className="flex-1 text-center py-2.5 rounded-[14px] bg-emerald-50 border border-emerald-100"
                >
                  <span className="text-[22px] block">{a.icon}</span>
                  <p className="text-[8px] font-bold text-emerald-700 mt-0.5 leading-tight">{a.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-gray-400 mb-3">Skanuj produkty żeby zdobywać odznaki!</p>
          )}

          <button
            onClick={() => setShowAchievements(true)}
            className="w-full text-center text-[13px] font-bold text-emerald-600 py-2 rounded-full bg-emerald-50 active:scale-95 transition-all"
          >
            Zobacz wszystkie →
          </button>
        </div>

        {/* ─────────────────────────────────────
            5) EDIT PROFILE BUTTON
            ───────────────────────────────────── */}
        <div className="profil-fadeSlideUp" style={{ animationDelay: "0.3s" }}>
          <button
            onClick={() => setEditing(true)}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-[14px] rounded-[18px] active:scale-[0.97] transition-all"
            style={{ boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}
          >
            Edytuj profil
          </button>
        </div>

        {/* ── Disclaimer ── */}
        <p className="text-[10px] text-gray-400 text-center mt-2 leading-relaxed px-4">
          SkładAI nie jest wyrobem medycznym. Obliczone normy oparte na wzorach Harris-Benedict.
          Indywidualne zapotrzebowanie może się różnić. Skonsultuj z dietetykiem.
        </p>
      </div>

      {/* ═══════════════════════════════════════
          STYLES
          ═══════════════════════════════════════ */}
      <style jsx>{`
        .profil-header {
          background: #0a0f0d;
        }

        /* ── 4 animated floating blobs ── */
        .profil-blob {
          position: absolute;
          border-radius: 50%;
          opacity: 0.4;
          pointer-events: none;
        }
        .profil-blob-1 {
          width: 180px; height: 180px;
          background: #10b981;
          filter: blur(45px);
          top: -40px; right: -30px;
          animation: blobFloat1 10s ease-in-out infinite;
        }
        .profil-blob-2 {
          width: 140px; height: 140px;
          background: #06b6d4;
          filter: blur(40px);
          bottom: 40px; left: -20px;
          animation: blobFloat2 12s ease-in-out infinite;
        }
        .profil-blob-3 {
          width: 100px; height: 100px;
          background: #34d399;
          filter: blur(35px);
          top: 50%; left: 50%;
          animation: blobFloat3 8s ease-in-out infinite;
        }
        .profil-blob-4 {
          width: 120px; height: 120px;
          background: #10b981;
          filter: blur(50px);
          top: 20%; left: 15%;
          animation: blobFloat4 11s ease-in-out infinite;
        }

        @keyframes blobFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.1); }
          66% { transform: translate(15px, -15px) scale(0.9); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(25px, -20px) scale(1.15); }
          66% { transform: translate(-10px, 25px) scale(0.85); }
        }
        @keyframes blobFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, -30px) scale(1.2); }
        }
        @keyframes blobFloat4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(30px, 15px) scale(1.1); }
          70% { transform: translate(-20px, -10px) scale(0.95); }
        }

        /* ── Film grain ── */
        .profil-grain {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          pointer-events: none;
          background-image: repeating-conic-gradient(
            rgba(255,255,255,0.08) 0% 25%,
            transparent 0% 50%
          );
          background-size: 4px 4px;
          z-index: 1;
        }

        /* ── Avatar ── */
        .profil-avatar {
          width: 68px; height: 68px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(16,185,129,0.15);
          position: relative;
          animation: avatarPulse 3s ease-in-out infinite;
        }
        .profil-avatar::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(#10b981, #06b6d4, #34d399, #10b981);
          z-index: -1;
        }
        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        /* ── Gradient text ── */
        .profil-gradient-text {
          background: linear-gradient(135deg, #10b981, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── Glass chips ── */
        .profil-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.8);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
        }
        .profil-chip-streak {
          background: rgba(251,191,36,0.15);
          border-color: rgba(251,191,36,0.2);
          color: #FBBF24;
        }

        /* ── Edit button ── */
        .profil-edit-btn {
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border: 1px solid #6efcb4;
          color: #6efcb4;
          box-shadow: 0 0 12px rgba(110,252,180,0.15);
        }

        /* ── Body cards ── */
        .profil-card {
          background: white;
          border-radius: 20px;
          padding: 20px 24px;
          box-shadow: 0 2px 20px rgba(0,0,0,0.06);
        }

        /* ── Fade-slide animation ── */
        .profil-fadeSlideUp {
          animation: fadeSlideUp 0.4s ease-out both;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
