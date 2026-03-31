"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserProfile, DailyTotals } from "@/lib/types";
import { getProfile, getDailyTotals, getWeekTotals, todayStr, removeDiaryEntry, getStreak, isPremium, getDiary } from "@/lib/storage";
import PremiumGate from "@/components/PremiumGate";
import WaterTracker from "@/components/WaterTracker";
import StepCounter from "@/components/StepCounter";
import dynamic from "next/dynamic";

const WeeklyChart = dynamic(() => import("@/components/DashboardCharts"), { ssr: false });
const ProgressChart = dynamic(() => import("@/components/ProgressChart"), { ssr: false });

/* ─── Animated Calorie Ring ─── */
function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const [animPct, setAnimPct] = useState(0);
  const pct = target > 0 ? Math.min((consumed / target) * 100, 120) : 0;
  const remaining = Math.max(0, target - consumed);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimPct(Math.min(pct, 100)), 80);
    return () => clearTimeout(timeout);
  }, [pct]);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animPct / 100) * circumference;

  const gradientId = pct > 100 ? "ring-red" : pct > 80 ? "ring-orange" : "ring-green";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[130px] h-[130px]">
        <svg width="130" height="130" className="-rotate-90">
          <defs>
            <linearGradient id="ring-green" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="ring-orange" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <linearGradient id="ring-red" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="8" />
          <circle
            cx="65" cy="65" r={radius} fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {consumed === 0 && target > 0 ? (
            <p className="text-[11px] font-semibold text-emerald-500 text-center px-2">
              Zeskanuj coś
            </p>
          ) : (
            <>
              <span className="text-[10px] text-gray-400 font-medium">Pozostało</span>
              <span className="text-[22px] font-black text-gray-800 leading-none">
                {remaining > 0 ? remaining : 0}
              </span>
              <span className="text-[10px] text-gray-400">
                {consumed > target ? `+${consumed - target}` : `z ${target}`} kcal
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Mini Macro Ring ─── */
function MiniMacroRing({ value, max, label, color }: {
  value: number; max: number; label: string; color: string;
}) {
  const [animPct, setAnimPct] = useState(0);
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  useEffect(() => {
    const timeout = setTimeout(() => setAnimPct(pct), 150);
    return () => clearTimeout(timeout);
  }, [pct]);

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animPct / 100) * circumference;
  const isOver = value > max;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[60px] h-[60px]">
        <svg width="60" height="60" className="-rotate-90">
          <circle cx="30" cy="30" r={radius} fill="none" stroke={color + "26"} strokeWidth="5" />
          <circle
            cx="30" cy="30" r={radius} fill="none"
            stroke={isOver ? "#ef4444" : color}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[12px] font-bold text-gray-700">{Math.round(value)}</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-gray-500">{label}</span>
      <span className="text-[9px] text-gray-400">/{max}g</span>
    </div>
  );
}

/* ─── Nutrient Mini Bar (inline) ─── */
function NutrientMiniBar({ label, icon, value, max, unit = "g" }: {
  label: string; icon: string; value: number; max: number; unit?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = value > max;
  const isNear = value > max * 0.8;
  const barColor = isOver ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[12px]">{icon}</span>
        <span className="text-[10px] font-semibold text-gray-600 truncate">{label}</span>
      </div>
      <div className="w-full h-[6px] rounded-full bg-gray-100 overflow-hidden mb-1">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-[9px] font-bold ${isOver ? "text-red-500" : "text-gray-400"}`}>
        {Math.round(value * 10) / 10}{unit} / {max}{unit}
      </p>
    </div>
  );
}

const MEAL_ICONS: Record<string, string> = { breakfast: "\u{1F305}", lunch: "☀️", dinner: "\u{1F319}", snack: "\u{1F37F}" };
const MEAL_LABELS: Record<string, string> = { breakfast: "Śniadanie", lunch: "Obiad", dinner: "Kolacja", snack: "Przekąska" };

type DashView = "today" | "week";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [totals, setTotals] = useState<DailyTotals | null>(null);
  const [weekTotals, setWeekTotals] = useState<DailyTotals[]>([]);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [view, setView] = useState<DashView>("today");

  const reload = () => {
    const p = getProfile();
    setProfile(p);
    setTotals(getDailyTotals(todayStr()));
    setWeekTotals(getWeekTotals());
    setStreak(getStreak());
    setHasPremium(isPremium());
    setLoaded(true);
  };

  useEffect(() => { reload(); }, []);

  if (loaded && !hasPremium) {
    return <PremiumGate feature="Dashboard zdrowotny — śledź kalorie, makro i cukier" isPremium={false}><div /></PremiumGate>;
  }

  if (!loaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f5f2ed]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !profile.onboarding_complete) {
    return (
      <div className="min-h-[100dvh] bg-[#f5f2ed] flex items-center justify-center p-5">
        <div className="bg-white rounded-[24px] p-8 text-center max-w-sm shadow-lg">
          <span className="text-5xl block mb-4">{"\u{1F4CA}"}</span>
          <h2 className="text-[20px] font-bold text-gray-800 mb-2">Dashboard wymaga profilu</h2>
          <p className="text-[13px] text-gray-400 mb-6">Uzupełnij swoje dane żeby śledzić spożycie i porównywać z normami.</p>
          <button onClick={() => router.push("/profil")}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-[18px] active:scale-[0.97] transition-all">
            {"\u{1F464}"} Ustaw profil
          </button>
        </div>
      </div>
    );
  }

  const n = profile.daily_norms;
  const t = totals!;
  const calPct = n.calories > 0 ? Math.round((t.calories / n.calories) * 100) : 0;
  const sugarTeaspoons = Math.round(t.sugar / 4 * 10) / 10;

  const handleRemove = (id: string) => {
    removeDiaryEntry(id);
    reload();
  };

  return (
    <div className="min-h-[100dvh] bg-[#f5f2ed]">
      {/* ─── HEADER ─── */}
      <div className="relative overflow-hidden" style={{ background: "#0a0f0d" }}>
        {/* Animated blobs */}
        <div className="dash-blob dash-blob-1" />
        <div className="dash-blob dash-blob-2" />
        <div className="dash-blob dash-blob-3" />

        {/* Film grain overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ background: "repeating-conic-gradient(rgba(255,255,255,0.1) 0% 25%, transparent 0% 50%) 0 0 / 3px 3px" }} />

        <div className="max-w-md mx-auto px-5 pt-8 pb-20 relative z-10">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h1 className="text-[28px] font-black leading-tight"
                style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Dashboard
              </h1>
              <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                {new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {streak > 0 && (
                <div className="px-3 py-1.5 rounded-full border"
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
                  <span className="text-[12px] font-bold text-white">{"\u{1F525}"} {streak} {streak === 1 ? "dzień" : "dni"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Dziś / Tydzień */}
          <div className="inline-flex rounded-full p-1"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
            {(["today", "week"] as DashView[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-5 py-2 text-[12px] font-bold rounded-full transition-all"
                style={{
                  background: view === v ? "linear-gradient(135deg, #10b981, #06b6d4)" : "transparent",
                  color: view === v ? "#fff" : "rgba(255,255,255,0.4)",
                }}>
                {v === "today" ? "Dziś" : "Tydzień"}
              </button>
            ))}
          </div>
        </div>

        {/* Curved bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0 60V0C240 45 480 60 720 55C960 50 1200 35 1440 20V60H0Z" fill="#f5f2ed"/>
          </svg>
        </div>
      </div>

      {/* ─── BODY ─── */}
      <div className="max-w-md mx-auto px-5 -mt-8 pb-10 relative z-20 space-y-4">

        {/* ═══ TODAY VIEW ═══ */}
        {view === "today" && (<>

          {/* Hero Calorie Card */}
          <div className="bg-white rounded-[24px] p-4 dash-card-anim"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)", animationDelay: "0s", maxHeight: "280px" }}>
            <p className="text-[13px] font-bold text-gray-700 mb-2">Bilans dnia</p>
            <CalorieRing consumed={t.calories} target={n.calories} />
            {/* Macro mini rings */}
            <div className="flex justify-center gap-8 mt-3 pt-3 border-t border-gray-100">
              <MiniMacroRing value={t.protein} max={n.protein_max} label="Białko" color="#3B82F6" />
              <MiniMacroRing value={t.fat} max={n.fat_max} label="Tłuszcz" color="#EAB308" />
              <MiniMacroRing value={t.carbs} max={n.carbs_max} label="Węgle" color="#F97316" />
            </div>
          </div>

          {/* Critical Nutrients — compact inline */}
          <div className="bg-white rounded-[20px] p-5 dash-card-anim"
            style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.06)", animationDelay: "0.1s" }}>
            <p className="text-[13px] font-bold text-gray-700 mb-3">Krytyczne składniki</p>
            <div className="flex gap-4">
              <NutrientMiniBar label="Cukier" icon={"\u{1F944}"} value={t.sugar} max={n.sugar_max} />
              <NutrientMiniBar label="Sól" icon={"\u{1F9C2}"} value={t.salt} max={n.salt_max} />
              <NutrientMiniBar label="Błonnik" icon={"\u{1F966}"} value={t.fiber} max={n.fiber_min} />
            </div>
            {sugarTeaspoons > 0 && (
              <div className="mt-3 bg-amber-50 rounded-[12px] p-2.5">
                <p className="text-[10px] font-semibold text-amber-700">
                  {"\u{1F944}"} Dziś zjadłeś {sugarTeaspoons} łyżeczek cukru (norma: ~6)
                </p>
              </div>
            )}
          </div>

          {/* Alerts */}
          {t.sugar > n.sugar_max && (
            <div className="bg-red-50 border border-red-100 rounded-[20px] p-4 dash-card-anim"
              style={{ animationDelay: "0.2s" }}>
              <p className="text-[13px] font-bold text-red-600">
                {"\u{1F534}"} CUKIER {Math.round((t.sugar / n.sugar_max) * 100)}% normy!
              </p>
              <p className="text-[11px] text-red-500 mt-1">
                Główne źródła: {t.entries.filter(e => e.sugar > 0).map(e => `${e.productName} (${e.sugar}g)`).join(", ") || "brak danych"}
              </p>
            </div>
          )}

          {/* Water Tracker */}
          <div className="dash-card-anim" style={{ animationDelay: "0.3s" }}>
            <WaterTracker />
          </div>

          {/* Step Counter (native only) */}
          <div className="dash-card-anim" style={{ animationDelay: "0.35s" }}>
            <StepCounter />
          </div>

          {/* Meals Today */}
          <div className="bg-white rounded-[20px] p-5 dash-card-anim"
            style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.06)", animationDelay: "0.4s" }}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-[13px] font-bold text-gray-700">{"\u{1F37D}️"} Posiłki dziś</p>
              {t.entries.length > 0 && (
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Śr. ocena: {t.avgScore}/10
                </span>
              )}
            </div>

            {t.entries.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-3xl block mb-2">{"\u{1F37D}️"}</span>
                <p className="text-[13px] text-gray-400 font-medium">Brak posiłków — zeskanuj pierwszy produkt</p>
                <button onClick={() => router.push("/")}
                  className="mt-3 px-6 py-2.5 text-white text-[13px] font-bold rounded-full active:scale-[0.97] transition-all"
                  style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}>
                  Zeskanuj teraz {"→"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {t.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 bg-gray-50 rounded-[14px] p-3">
                    <span className="text-[18px]">{MEAL_ICONS[entry.mealType] || "\u{1F37D}️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-gray-700 truncate">{entry.productName}</p>
                      <p className="text-[10px] text-gray-400">
                        {MEAL_LABELS[entry.mealType]} {"·"} {entry.portion_g > 1 ? `${entry.portion_g}g` : "cały"} {"·"} {entry.calories}kcal
                      </p>
                    </div>
                    <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-white text-[11px] font-bold ${
                      entry.score >= 7 ? "bg-emerald-500" : entry.score >= 4 ? "bg-amber-500" : "bg-red-500"
                    }`}>
                      {entry.score}
                    </div>
                    <button onClick={() => handleRemove(entry.id)} className="text-gray-300 hover:text-red-500 text-[14px] px-1">{"✕"}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </>)}

        {/* ═══ WEEKLY VIEW ═══ */}
        {view === "week" && (<>
          <div className="bg-white rounded-[24px] p-5 dash-card-anim"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)", animationDelay: "0s" }}>
            <WeeklyChart weekData={weekTotals} targetCalories={n.calories} view="week" />
          </div>

          {/* Average scan score chart */}
          {(() => {
            const scoreData = weekTotals
              .filter((d) => d.avgScore > 0)
              .map((d) => ({ date: d.date, value: d.avgScore }));
            if (scoreData.length >= 2) {
              return (
                <div className="bg-white rounded-[24px] p-5 dash-card-anim"
                  style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.06)", animationDelay: "0.1s" }}>
                  <p className="text-[13px] font-bold text-gray-700 mb-3">Średnia ocena skanów</p>
                  <ProgressChart
                    data={scoreData}
                    label="/10"
                    color="#2D5A16"
                    targetValue={7}
                    targetLabel="Cel: 7/10"
                  />
                </div>
              );
            }
            return null;
          })()}

          {/* Weekly summary stats */}
          {(() => {
            const daysWithData = weekTotals.filter(d => d.calories > 0);
            if (daysWithData.length === 0) return null;
            const avgCal = Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length);
            const bestDay = daysWithData.reduce((best, d) => d.calories > 0 && d.calories <= n.calories && (!best || Math.abs(d.calories - n.calories) < Math.abs(best.calories - n.calories)) ? d : best, null as DailyTotals | null);
            const totalProducts = daysWithData.reduce((s, d) => s + d.entries.length, 0);
            const scoredEntries = daysWithData.flatMap(d => d.entries).filter(e => e.score > 0);
            const avgScore = scoredEntries.length > 0 ? Math.round(scoredEntries.reduce((s, e) => s + e.score, 0) / scoredEntries.length * 10) / 10 : 0;

            const bestDayLabel = bestDay ? new Date(bestDay.date).toLocaleDateString("pl-PL", { weekday: "long" }) : null;

            return (
              <div className="bg-white rounded-[20px] p-5 dash-card-anim"
                style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.06)", animationDelay: "0.2s" }}>
                <p className="text-[13px] font-bold text-gray-700 mb-3">Podsumowanie tygodnia</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-[14px] p-3">
                    <p className="text-[10px] text-gray-400 font-medium">Średnia kcal/dzień</p>
                    <p className="text-[18px] font-black text-gray-800">{avgCal}</p>
                  </div>
                  {bestDayLabel && (
                    <div className="bg-emerald-50 rounded-[14px] p-3">
                      <p className="text-[10px] text-gray-400 font-medium">Najlepszy dzień</p>
                      <p className="text-[14px] font-bold text-emerald-600 capitalize">{bestDayLabel}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-[14px] p-3">
                    <p className="text-[10px] text-gray-400 font-medium">Zeskanowane</p>
                    <p className="text-[18px] font-black text-gray-800">{totalProducts} <span className="text-[11px] font-medium text-gray-400">prod.</span></p>
                  </div>
                  {avgScore > 0 && (
                    <div className="bg-gray-50 rounded-[14px] p-3">
                      <p className="text-[10px] text-gray-400 font-medium">Śr. ocena</p>
                      <p className="text-[18px] font-black text-gray-800">{avgScore}<span className="text-[11px] font-medium text-gray-400">/10</span></p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </>)}

        {/* Disclaimer */}
        <p className="text-[9px] text-gray-300 text-center px-4 leading-relaxed pt-2">
          SkładAI nie jest wyrobem medycznym. Wartości orientacyjne. Skonsultuj z dietetykiem.
        </p>
      </div>

      {/* ─── INLINE STYLES for animations ─── */}
      <style jsx>{`
        .dash-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.4;
          pointer-events: none;
        }
        .dash-blob-1 {
          width: 180px;
          height: 180px;
          background: #10b981;
          top: -40px;
          right: -30px;
          animation: dashFloat1 10s ease-in-out infinite;
        }
        .dash-blob-2 {
          width: 120px;
          height: 120px;
          background: #06b6d4;
          bottom: 30px;
          left: -20px;
          animation: dashFloat2 8s ease-in-out infinite;
        }
        .dash-blob-3 {
          width: 100px;
          height: 100px;
          background: #34d399;
          top: 40px;
          left: 40%;
          animation: dashFloat3 12s ease-in-out infinite;
        }
        @keyframes dashFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.1); }
          66% { transform: translate(15px, -15px) scale(0.95); }
        }
        @keyframes dashFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, -20px) scale(1.15); }
        }
        @keyframes dashFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-20px, 15px) scale(1.05); }
          75% { transform: translate(20px, -10px) scale(0.9); }
        }
        .dash-card-anim {
          animation: dashFadeUp 0.5s ease-out both;
        }
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
