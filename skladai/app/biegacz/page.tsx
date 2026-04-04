"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Timer,
  Heart,
  Sparkles,
  Flame,
  ClipboardList,
  Trophy,
  Medal,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { getProfile } from "@/lib/storage";
import type { UserProfile } from "@/lib/types";
import dynamic from "next/dynamic";

const ProgressChart = dynamic(() => import("@/components/ProgressChart"), { ssr: false });

/* ─────────────────── TYPES ─────────────────── */

interface RunRecord {
  id: string;
  distance: string;
  distanceKm: number;
  timeSeconds: number;
  date: string;
  paceSecPerKm: number;
}

interface RacePlan {
  id: string;
  name: string;
  date: string;
  goalTime: string;
}

interface TrainingSession {
  label: string;
  description: string;
}

interface TrainingWeek {
  weekNum: number;
  sessions: TrainingSession[];
}

interface TrainingPlan {
  id: string;
  name: string;
  emoji: string;
  weeks: TrainingWeek[];
}

/* ─────────────────── CONSTANTS ─────────────────── */

const CARDS = [
  { id: "pace", emoji: "⏱️", label: "Kalkulator tempa", icon: Timer },
  { id: "hr", emoji: "❤️", label: "Strefy tętna", icon: Heart },
  { id: "riegel", emoji: "🔮", label: "Przelicznik dystansów (Riegel)", icon: Sparkles },
  { id: "calories", emoji: "🔥", label: "Kalorie z biegu", icon: Flame },
  { id: "plans", emoji: "📋", label: "Plany treningowe", icon: ClipboardList },
  { id: "records", emoji: "🏆", label: "Moje rekordy biegowe", icon: Trophy },
  { id: "races", emoji: "🏅", label: "Zawody biegowe w Polsce", icon: Medal },
] as const;

type ViewId = (typeof CARDS)[number]["id"] | "main";

const PRESET_DISTANCES = [
  { label: "5K", km: 5.0 },
  { label: "10K", km: 10.0 },
  { label: "Półmaraton", km: 21.0975 },
  { label: "Maraton", km: 42.195 },
  { label: "Własny", km: 0 },
];

const HR_ZONES = [
  { zone: 1, low: 0.5, high: 0.6, color: "#3B82F6", name: "Regeneracja", desc: "Lekki wysiłek, regeneracja aktywna, rozgrzewka" },
  { zone: 2, low: 0.6, high: 0.7, color: "#22C55E", name: "Spalanie tłuszczu", desc: "Długie, spokojne biegi. Budowanie bazy tlenowej" },
  { zone: 3, low: 0.7, high: 0.8, color: "#EAB308", name: "Tlenowa", desc: "Tempo komfortowe, poprawa wydolności" },
  { zone: 4, low: 0.8, high: 0.9, color: "#F97316", name: "Próg", desc: "Tempo wyścigowe, interwały. Ciężki wysiłek" },
  { zone: 5, low: 0.9, high: 1.0, color: "#EF4444", name: "Maksimum", desc: "Sprint, max wysiłek. Tylko krótkie odcinki" },
];

const COMPARISONS = [
  { name: "Big Mac", kcal: 508, emoji: "🍔" },
  { name: "kawałek pizzy", kcal: 285, emoji: "🍕" },
  { name: "piwo 500ml", kcal: 215, emoji: "🍺" },
  { name: "Snickers", kcal: 488, emoji: "🍫" },
  { name: "pączek", kcal: 340, emoji: "🍩" },
  { name: "kebab", kcal: 750, emoji: "🥙" },
];

const RACE_SOURCES = [
  { name: "MoveMore.pl", url: "https://movemore.pl", tag: "Wszystkie" },
  { name: "Maratonypolskie.pl", url: "https://maratonypolskie.pl", tag: "Maratony" },
  { name: "Ahotu.com", url: "https://ahotu.com/calendar/running/poland", tag: "Międzynarodowe" },
  { name: "MyRaceland.com", url: "https://myraceland.com", tag: "Zapisy" },
  { name: "Parkrun Polska", url: "https://www.parkrun.pl", tag: "5K co sobotę" },
];

const RACE_SERIES = [
  { name: "Runmageddon", url: "https://runmageddon.pl", tag: "OCR" },
  { name: "Biegnij Warszawa", url: "https://biegnijwarszawa.pl", tag: "Warszawa" },
  { name: "UTMB (Poland)", url: "https://utmb.world", tag: "Ultra-Trail" },
];

const RECORDS_KEY = "skladai_running_records";
const PLAN_PROGRESS_KEY = "skladai_training_plan_progress";
const RACE_PLAN_KEY = "skladai_race_plans";

/* ─────────────────── TRAINING PLANS DATA ─────────────────── */

function buildCouchTo5K(): TrainingPlan {
  const weeks: TrainingWeek[] = [
    { weekNum: 1, sessions: [
      { label: "Dzień 1", description: "6× (1 min bieg / 2 min marsz)" },
      { label: "Dzień 2", description: "6× (1 min bieg / 2 min marsz)" },
      { label: "Dzień 3", description: "6× (1 min bieg / 2 min marsz)" },
    ]},
    { weekNum: 2, sessions: [
      { label: "Dzień 1", description: "6× (1.5 min bieg / 1.5 min marsz)" },
      { label: "Dzień 2", description: "6× (1.5 min bieg / 1.5 min marsz)" },
      { label: "Dzień 3", description: "6× (1.5 min bieg / 1.5 min marsz)" },
    ]},
    { weekNum: 3, sessions: [
      { label: "Dzień 1", description: "3× (3 min bieg / 1.5 min marsz)" },
      { label: "Dzień 2", description: "3× (3 min bieg / 1.5 min marsz)" },
      { label: "Dzień 3", description: "4× (3 min bieg / 1 min marsz)" },
    ]},
    { weekNum: 4, sessions: [
      { label: "Dzień 1", description: "3× (5 min bieg / 2 min marsz)" },
      { label: "Dzień 2", description: "2× (8 min bieg / 3 min marsz)" },
      { label: "Dzień 3", description: "3× (5 min bieg / 1.5 min marsz)" },
    ]},
    { weekNum: 5, sessions: [
      { label: "Dzień 1", description: "2× (8 min bieg / 2 min marsz)" },
      { label: "Dzień 2", description: "10 min bieg / 3 min marsz / 10 min bieg" },
      { label: "Dzień 3", description: "20 min ciągłego biegu" },
    ]},
    { weekNum: 6, sessions: [
      { label: "Dzień 1", description: "2× (10 min bieg / 2 min marsz)" },
      { label: "Dzień 2", description: "15 min bieg / 2 min marsz / 10 min bieg" },
      { label: "Dzień 3", description: "25 min ciągłego biegu" },
    ]},
    { weekNum: 7, sessions: [
      { label: "Dzień 1", description: "25 min ciągłego biegu" },
      { label: "Dzień 2", description: "28 min ciągłego biegu" },
      { label: "Dzień 3", description: "25 min ciągłego biegu" },
    ]},
    { weekNum: 8, sessions: [
      { label: "Dzień 1", description: "28 min ciągłego biegu" },
      { label: "Dzień 2", description: "30 min ciągłego biegu" },
      { label: "Dzień 3", description: "30 min ciągłego biegu — UKOŃCZONO!" },
    ]},
  ];
  return { id: "c25k", name: "Couch to 5K", emoji: "🛋️➡️🏃", weeks };
}

function build5Kto10K(): TrainingPlan {
  const weeks: TrainingWeek[] = [
    { weekNum: 1, sessions: [
      { label: "Dzień 1", description: "5 km łatwo" },
      { label: "Dzień 2", description: "6 km spokojnie" },
      { label: "Dzień 3", description: "5 km + 4×100m przybiegi" },
    ]},
    { weekNum: 2, sessions: [
      { label: "Dzień 1", description: "6 km łatwo" },
      { label: "Dzień 2", description: "7 km spokojnie" },
      { label: "Dzień 3", description: "5 km tempo + 1 km rozluźnienie" },
    ]},
    { weekNum: 3, sessions: [
      { label: "Dzień 1", description: "6 km + 4×400m interwały" },
      { label: "Dzień 2", description: "8 km długi bieg" },
      { label: "Dzień 3", description: "5 km regeneracja" },
    ]},
    { weekNum: 4, sessions: [
      { label: "Dzień 1", description: "7 km łatwo" },
      { label: "Dzień 2", description: "6×400m interwały + 2 km" },
      { label: "Dzień 3", description: "9 km długi bieg" },
    ]},
    { weekNum: 5, sessions: [
      { label: "Dzień 1", description: "7 km spokojnie" },
      { label: "Dzień 2", description: "3×1 km tempo / 2 min przerwy" },
      { label: "Dzień 3", description: "10 km długi bieg" },
    ]},
    { weekNum: 6, sessions: [
      { label: "Dzień 1", description: "5 km regeneracja" },
      { label: "Dzień 2", description: "4 km tempo" },
      { label: "Dzień 3", description: "10 km — START!" },
    ]},
  ];
  return { id: "5k10k", name: "5K → 10K", emoji: "🚀", weeks };
}

function buildHalfMarathon(): TrainingPlan {
  const weeks: TrainingWeek[] = [];
  const longRuns = [10, 12, 14, 12, 16, 14, 18, 16, 20, 12];
  for (let w = 1; w <= 10; w++) {
    weeks.push({
      weekNum: w,
      sessions: [
        { label: "Wt", description: w <= 5 ? `${5 + w} km łatwo` : `${6 + Math.floor(w / 2)} km tempo` },
        { label: "Ćw", description: w % 2 === 0 ? `6×400m interwały` : `5 km regeneracja` },
        { label: "Pt", description: `${4 + Math.floor(w / 3)} km spokojnie` },
        { label: "Nd", description: w === 10 ? "21.1 km — PÓŁMARATON!" : `${longRuns[w - 1]} km długi bieg` },
      ],
    });
  }
  return { id: "half", name: "Półmaraton", emoji: "🏅", weeks };
}

function buildMarathon(): TrainingPlan {
  const weeks: TrainingWeek[] = [];
  const longRuns = [14, 16, 18, 16, 20, 18, 24, 20, 26, 22, 30, 24, 32, 20, 14, 10];
  for (let w = 1; w <= 16; w++) {
    const isRecovery = w % 4 === 0;
    weeks.push({
      weekNum: w,
      sessions: [
        { label: "Wt", description: isRecovery ? "6 km regeneracja" : `${7 + Math.floor(w / 3)} km łatwo` },
        { label: "Ćw", description: w > 4 && w % 2 === 0 ? `8×400m interwały` : `6 km spokojnie` },
        { label: "Pt", description: w > 8 ? `${5 + Math.floor(w / 4)} km tempo` : `5 km łatwo` },
        { label: "Nd", description: w === 16 ? "42.195 km — MARATON!" : `${longRuns[w - 1]} km długi bieg` },
      ],
    });
  }
  return { id: "marathon", name: "Maraton", emoji: "🏆", weeks };
}

const ALL_PLANS: TrainingPlan[] = [buildCouchTo5K(), build5Kto10K(), buildHalfMarathon(), buildMarathon()];

/* ─────────────────── HELPERS ─────────────────── */

function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parsePace(str: string): number | null {
  const parts = str.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s)) return null;
  return m * 60 + s;
}

function parseTime(str: string): number | null {
  const parts = str.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number);
    if ([h, m, s].some(isNaN)) return null;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts.map(Number);
    if ([m, s].some(isNaN)) return null;
    return m * 60 + s;
  }
  return null;
}

function getRecords(): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]");
  } catch { return []; }
}

function saveRecords(r: RunRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
}

function getPlanProgress(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PLAN_PROGRESS_KEY) || "{}");
  } catch { return {}; }
}

function savePlanProgress(p: Record<string, boolean>) {
  localStorage.setItem(PLAN_PROGRESS_KEY, JSON.stringify(p));
}

function getRacePlans(): RacePlan[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RACE_PLAN_KEY) || "[]");
  } catch { return []; }
}

function saveRacePlans(p: RacePlan[]) {
  localStorage.setItem(RACE_PLAN_KEY, JSON.stringify(p));
}

/* ─────────────────── COMPONENT ─────────────────── */

export default function BiegaczPage() {
  const [view, setView] = useState<ViewId>("main");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    setProfile(getProfile());
  }, []);

  // Scroll to top on view change
  useEffect(() => {
    (document.getElementById("scroll-container") || window).scrollTo(0, 0);
  }, [view]);

  const goBack = () => setView("main");

  /* ── MAIN LIST ── */
  if (view === "main") {
    return (
      <div className="min-h-screen bg-[#111111] text-white">
        <div className="max-w-md mx-auto px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold mb-1">{"🏃"} Strefa Biegacza</h1>
          <p className="text-sm text-white/40 mb-5">Wszystko czego potrzebujesz do biegania</p>
          <div className="space-y-3">
            {CARDS.map((c) => (
              <button
                key={c.id}
                onClick={() => setView(c.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="flex-1 font-medium">{c.label}</span>
                <ChevronRight size={18} className="text-white/30" />
              </button>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <div className="max-w-md mx-auto px-4 pt-4 pb-4">
        <button onClick={goBack} className="flex items-center gap-1 mb-5 transition-colors" style={{ color: "rgba(255,255,255,0.7)" }}>
          <ChevronLeft size={24} />
          <span className="font-semibold" style={{ fontSize: "14px" }}>Wstecz</span>
        </button>
        {view === "pace" && <PaceCalculator />}
        {view === "hr" && <HeartRateZones profile={profile} />}
        {view === "riegel" && <RiegelConverter />}
        {view === "calories" && <CaloriesCalc profile={profile} />}
        {view === "plans" && <TrainingPlans />}
        {view === "records" && <RunningRecords />}
        {view === "races" && <PolishRaces />}
      </div>
      <BottomNav />
    </div>
  );
}

/* ─────────────── FEATURE 1: PACE CALCULATOR ─────────────── */

function PaceCalculator() {
  const [mode, setMode] = useState<"toPace" | "toTime">("toPace");
  const [distPreset, setDistPreset] = useState(0);
  const [customDist, setCustomDist] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [paceInput, setPaceInput] = useState("");

  const distKm = distPreset === 4 ? parseFloat(customDist) || 0 : PRESET_DISTANCES[distPreset].km;

  const result = useMemo(() => {
    if (distKm <= 0) return null;
    if (mode === "toPace") {
      const totalSec = parseTime(timeInput);
      if (!totalSec || totalSec <= 0) return null;
      const paceSecPerKm = totalSec / distKm;
      const paceSecPerMile = paceSecPerKm * 1.60934;
      const speedKmh = 3600 / paceSecPerKm;
      const step = distKm <= 10 ? 1 : 5;
      const splits: { km: number; time: string }[] = [];
      for (let km = step; km <= distKm; km += step) {
        splits.push({ km, time: fmtTime(paceSecPerKm * km) });
      }
      if (splits.length === 0 || splits[splits.length - 1].km < distKm) {
        splits.push({ km: Math.round(distKm * 100) / 100, time: fmtTime(totalSec) });
      }
      return { pacePerKm: fmtTime(paceSecPerKm), pacePerMile: fmtTime(paceSecPerMile), speedKmh: speedKmh.toFixed(1), splits };
    } else {
      const paceSec = parsePace(paceInput);
      if (!paceSec || paceSec <= 0) return null;
      const totalSec = paceSec * distKm;
      const speedKmh = 3600 / paceSec;
      const step = distKm <= 10 ? 1 : 5;
      const splits: { km: number; time: string }[] = [];
      for (let km = step; km <= distKm; km += step) {
        splits.push({ km, time: fmtTime(paceSec * km) });
      }
      if (splits.length === 0 || splits[splits.length - 1].km < distKm) {
        splits.push({ km: Math.round(distKm * 100) / 100, time: fmtTime(totalSec) });
      }
      return { finishTime: fmtTime(totalSec), pacePerMile: fmtTime(paceSec * 1.60934), speedKmh: speedKmh.toFixed(1), splits };
    }
  }, [mode, distKm, timeInput, paceInput]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{"⏱️"} Kalkulator tempa</h2>
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        {(["toPace", "toTime"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: mode === m ? "#3B82F6" : "rgba(255,255,255,0.06)",
              color: mode === m ? "#fff" : "rgba(255,255,255,0.5)",
            }}
          >
            {m === "toPace" ? "Dystans + Czas → Tempo" : "Dystans + Tempo → Czas"}
          </button>
        ))}
      </div>
      {/* Distance */}
      <label className="block text-xs text-white/40 mb-1">Dystans</label>
      <div className="flex gap-2 mb-3 flex-wrap">
        {PRESET_DISTANCES.map((d, i) => (
          <button
            key={d.label}
            onClick={() => setDistPreset(i)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: distPreset === i ? "#3B82F6" : "rgba(255,255,255,0.06)",
              color: distPreset === i ? "#fff" : "rgba(255,255,255,0.5)",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      {distPreset === 4 && (
        <input
          type="number"
          placeholder="km"
          value={customDist}
          onChange={(e) => setCustomDist(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
        />
      )}
      {/* Input */}
      {mode === "toPace" ? (
        <>
          <label className="block text-xs text-white/40 mb-1">Czas (h:mm:ss lub mm:ss)</label>
          <input
            placeholder="np. 25:30 lub 1:45:00"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
          />
        </>
      ) : (
        <>
          <label className="block text-xs text-white/40 mb-1">Tempo (mm:ss /km)</label>
          <input
            placeholder="np. 5:30"
            value={paceInput}
            onChange={(e) => setPaceInput(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
          />
        </>
      )}
      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {mode === "toPace" ? (
              <>
                <div className="text-2xl font-bold text-blue-400">{result.pacePerKm} <span className="text-sm font-normal text-white/40">/km</span></div>
                <div className="text-sm text-white/50 mt-1">{result.pacePerMile} /mile &middot; {result.speedKmh} km/h</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-400">{result.finishTime}</div>
                <div className="text-sm text-white/50 mt-1">{result.pacePerMile} /mile &middot; {result.speedKmh} km/h</div>
              </>
            )}
          </div>
          {/* Splits */}
          {result.splits && result.splits.length > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-sm font-semibold mb-2 text-white/60">Tabela splitów</h3>
              <div className="space-y-1">
                {result.splits.map((s) => (
                  <div key={s.km} className="flex justify-between text-sm">
                    <span className="text-white/50">{s.km} km</span>
                    <span className="font-mono">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── FEATURE 2: HEART RATE ZONES ─────────────── */

function HeartRateZones({ profile }: { profile: UserProfile | null }) {
  const [manualAge, setManualAge] = useState("");
  const age = profile?.age || (manualAge ? parseInt(manualAge, 10) : 0);
  const hrMax = age > 0 ? 220 - age : 0;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{"❤️"} Strefy tętna</h2>
      {!profile?.age && (
        <>
          <label className="block text-xs text-white/40 mb-1">Twój wiek</label>
          <input
            type="number"
            placeholder="np. 30"
            value={manualAge}
            onChange={(e) => setManualAge(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
          />
        </>
      )}
      {hrMax > 0 && (
        <>
          <div className="p-3 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-white/50 text-sm">HR max (220 - {age})</span>
            <span className="text-xl font-bold ml-2">{hrMax} BPM</span>
          </div>
          <div className="space-y-3">
            {HR_ZONES.map((z) => {
              const lo = Math.round(hrMax * z.low);
              const hi = Math.round(hrMax * z.high);
              const pct = z.high * 100;
              return (
                <div key={z.zone}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold">Strefa {z.zone}: {z.name}</span>
                    <span className="text-sm font-mono text-white/60">{lo}–{hi} BPM</span>
                  </div>
                  <div className="h-4 rounded-full bg-white/5 overflow-hidden mb-1">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: z.color }} />
                  </div>
                  <p className="text-xs text-white/40">{z.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 rounded-2xl text-sm" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
            {"💡"} <strong>Zasada 80/20:</strong> 80% treningów w strefach 1–2, 20% w 3–5
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────── FEATURE 3: RIEGEL CONVERTER ─────────────── */

function RiegelConverter() {
  const [knownDist, setKnownDist] = useState(0);
  const [customKnown, setCustomKnown] = useState("");
  const [timeInput, setTimeInput] = useState("");

  const d1 = knownDist === 4 ? parseFloat(customKnown) || 0 : PRESET_DISTANCES[knownDist].km;
  const t1 = parseTime(timeInput);

  const predictions = useMemo(() => {
    if (!t1 || d1 <= 0) return null;
    return PRESET_DISTANCES.filter((d) => d.km > 0 && d.km !== d1).map((d) => {
      const t2 = t1 * Math.pow(d.km / d1, 1.06);
      return { label: d.label, km: d.km, time: fmtTime(t2), pace: fmtTime(t2 / d.km) };
    });
  }, [t1, d1]);

  const level5k = useMemo(() => {
    if (!t1 || d1 <= 0) return null;
    const t5k = d1 === 5 ? t1 : t1 * Math.pow(5 / d1, 1.06);
    const min5k = t5k / 60;
    // Rough levels
    const mLevels = [
      { max: 16, label: "Elita" }, { max: 18, label: "Łatwiej niż niektórym na Olimpiadzie" },
      { max: 20, label: "Zaawansowany" }, { max: 23, label: "Średnio-zaawansowany" },
      { max: 27, label: "Średni" }, { max: 32, label: "Początkujący+" }, { max: 99, label: "Początkujący" },
    ];
    const fLevels = [
      { max: 18, label: "Elita" }, { max: 21, label: "Zaawansowana" },
      { max: 24, label: "Średnio-zaawansowana" }, { max: 28, label: "Średnia" },
      { max: 33, label: "Początkująca+" }, { max: 38, label: "Początkująca" }, { max: 99, label: "Początkująca" },
    ];
    const mLevel = mLevels.find((l) => min5k <= l.max)?.label || "Początkujący";
    const fLevel = fLevels.find((l) => min5k <= l.max)?.label || "Początkująca";
    return { time: fmtTime(t5k), mLevel, fLevel };
  }, [t1, d1]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{"🔮"} Przelicznik Riegel</h2>
      <p className="text-sm text-white/40 mb-3">T2 = T1 × (D2/D1)^1.06</p>
      <label className="block text-xs text-white/40 mb-1">Znany dystans</label>
      <div className="flex gap-2 mb-3 flex-wrap">
        {PRESET_DISTANCES.map((d, i) => (
          <button
            key={d.label}
            onClick={() => setKnownDist(i)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: knownDist === i ? "#3B82F6" : "rgba(255,255,255,0.06)",
              color: knownDist === i ? "#fff" : "rgba(255,255,255,0.5)",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      {knownDist === 4 && (
        <input
          type="number"
          placeholder="km"
          value={customKnown}
          onChange={(e) => setCustomKnown(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
        />
      )}
      <label className="block text-xs text-white/40 mb-1">Czas (h:mm:ss lub mm:ss)</label>
      <input
        placeholder="np. 25:00"
        value={timeInput}
        onChange={(e) => setTimeInput(e.target.value)}
        className="w-full mb-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
      />
      {predictions && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 className="text-sm font-semibold mb-2 text-white/60">Przewidywane czasy</h3>
            {predictions.map((p) => (
              <div key={p.label} className="flex justify-between py-1 text-sm">
                <span className="text-white/50">{p.label} ({p.km} km)</span>
                <span className="font-mono">{p.time} <span className="text-white/30">({p.pace}/km)</span></span>
              </div>
            ))}
          </div>
          {level5k && (
            <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-sm font-semibold mb-2 text-white/60">Ocena poziomu (5K: {level5k.time})</h3>
              <div className="text-sm"><span className="text-blue-400">{"♂️"}</span> {level5k.mLevel}</div>
              <div className="text-sm"><span className="text-pink-400">{"♀️"}</span> {level5k.fLevel}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── FEATURE 4: CALORIES ─────────────── */

function CaloriesCalc({ profile }: { profile: UserProfile | null }) {
  const [weightInput, setWeightInput] = useState(profile?.weight_kg?.toString() || "");
  const [distInput, setDistInput] = useState("");
  const [inputMode, setInputMode] = useState<"tempo" | "czas">("tempo");
  const [tempoMin, setTempoMin] = useState("");
  const [tempoSec, setTempoSec] = useState("");
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("");
  const [timeS, setTimeS] = useState("");
  const [calculated, setCalculated] = useState(false);

  const weight = parseFloat(weightInput) || 0;
  const dist = parseFloat(distInput) || 0;

  // Compute pace in seconds per km
  const paceSecPerKm = useMemo(() => {
    if (inputMode === "tempo") {
      const m = parseInt(tempoMin, 10) || 0;
      const s = parseInt(tempoSec, 10) || 0;
      return m * 60 + s;
    } else {
      const h = parseInt(timeH, 10) || 0;
      const m = parseInt(timeM, 10) || 0;
      const s = parseInt(timeS, 10) || 0;
      const totalSec = h * 3600 + m * 60 + s;
      if (dist > 0 && totalSec > 0) return totalSec / dist;
      return 0;
    }
  }, [inputMode, tempoMin, tempoSec, timeH, timeM, timeS, dist]);

  // Pace-dependent multiplier
  const multiplier = useMemo(() => {
    if (paceSecPerKm <= 0) return 1.036;
    const paceMinPerKm = paceSecPerKm / 60;
    if (paceMinPerKm < 5) return 1.1;
    if (paceMinPerKm <= 6.5) return 1.036;
    if (paceMinPerKm <= 8) return 0.95;
    return 0.708; // walking
  }, [paceSecPerKm]);

  const kcal = calculated && weight > 0 && dist > 0 ? Math.round(weight * dist * multiplier) : 0;

  const paceLabel = useMemo(() => {
    if (paceSecPerKm <= 0) return "";
    const paceMinPerKm = paceSecPerKm / 60;
    if (paceMinPerKm < 5) return "Szybki bieg (<5:00/km)";
    if (paceMinPerKm <= 6.5) return "Umiarkowany bieg (5:00-6:30/km)";
    if (paceMinPerKm <= 8) return "Wolny bieg (>6:30/km)";
    return "Marsz/nordic walking";
  }, [paceSecPerKm]);

  const handleCalc = () => {
    if (weight > 0 && dist > 0) setCalculated(true);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{"🔥"} Kalorie z biegu</h2>
      <p className="text-xs text-white/40 mb-3">Wzór: waga × dystans × mnożnik tempa</p>

      {/* Weight */}
      <label className="block text-xs text-white/40 mb-1">Waga (kg)</label>
      <input
        type="number"
        placeholder="np. 75"
        value={weightInput}
        onChange={(e) => { setWeightInput(e.target.value); setCalculated(false); }}
        className="w-full mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
      />

      {/* Distance */}
      <label className="block text-xs text-white/40 mb-1">Dystans (km)</label>
      <input
        type="number"
        placeholder="np. 10"
        value={distInput}
        onChange={(e) => { setDistInput(e.target.value); setCalculated(false); }}
        className="w-full mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
      />

      {/* Mode toggle */}
      <div className="flex gap-2 mb-3">
        {(["tempo", "czas"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setInputMode(m); setCalculated(false); }}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: inputMode === m ? "#F97316" : "rgba(255,255,255,0.06)",
              color: inputMode === m ? "#fff" : "rgba(255,255,255,0.5)",
            }}
          >
            {m === "tempo" ? "Tempo" : "Czas"}
          </button>
        ))}
      </div>

      {/* Tempo input: min + sec per km */}
      {inputMode === "tempo" && (
        <>
          <label className="block text-xs text-white/40 mb-1">Tempo (min:sek /km)</label>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <input
                type="number"
                placeholder="min"
                value={tempoMin}
                onChange={(e) => { setTempoMin(e.target.value); setCalculated(false); }}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
              />
            </div>
            <span className="text-white/30 self-center text-lg font-bold">:</span>
            <div className="flex-1">
              <input
                type="number"
                placeholder="sek"
                value={tempoSec}
                onChange={(e) => { setTempoSec(e.target.value); setCalculated(false); }}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
              />
            </div>
            <span className="text-white/30 self-center text-xs">/km</span>
          </div>
        </>
      )}

      {/* Time input: h + min + sec */}
      {inputMode === "czas" && (
        <>
          <label className="block text-xs text-white/40 mb-1">Czas biegu (godz : min : sek)</label>
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              placeholder="h"
              value={timeH}
              onChange={(e) => { setTimeH(e.target.value); setCalculated(false); }}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
            />
            <span className="text-white/30 self-center font-bold">:</span>
            <input
              type="number"
              placeholder="min"
              value={timeM}
              onChange={(e) => { setTimeM(e.target.value); setCalculated(false); }}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
            />
            <span className="text-white/30 self-center font-bold">:</span>
            <input
              type="number"
              placeholder="sek"
              value={timeS}
              onChange={(e) => { setTimeS(e.target.value); setCalculated(false); }}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
            />
          </div>
        </>
      )}

      {/* Calculate button */}
      <button
        onClick={handleCalc}
        disabled={weight <= 0 || dist <= 0}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 mb-4"
        style={{
          background: weight > 0 && dist > 0 ? "linear-gradient(135deg, #F97316, #EF4444)" : "rgba(255,255,255,0.1)",
          opacity: weight > 0 && dist > 0 ? 1 : 0.5,
        }}
      >
        Oblicz
      </button>

      {kcal > 0 && (
        <div className="space-y-3">
          {/* Big calorie number */}
          <div className="p-5 rounded-2xl text-center" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(239,68,68,0.15))", border: "1px solid rgba(249,115,22,0.2)" }}>
            <div className="text-5xl font-bold" style={{ color: "#F97316" }}>{kcal}</div>
            <div className="text-lg font-semibold text-white/60 mt-1">kcal</div>
            <div className="text-xs text-white/40 mt-2">{weight} kg × {dist} km × {multiplier}</div>
            {paceLabel && (
              <div className="text-xs mt-1 px-2 py-1 inline-block rounded-lg" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>
                {paceLabel}
              </div>
            )}
          </div>

          {/* Comparison cards */}
          <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 className="text-sm font-semibold mb-3 text-white/60">To równowartość...</h3>
            <div className="grid grid-cols-2 gap-2">
              {COMPARISONS.map((c) => {
                const count = kcal / c.kcal;
                return (
                  <div
                    key={c.name}
                    className="flex items-center gap-2 p-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <span className="text-2xl">{c.emoji}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{count.toFixed(1)}×</div>
                      <div className="text-[10px] text-white/40">{c.name} ({c.kcal} kcal)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── FEATURE 5: TRAINING PLANS ─────────────── */

function TrainingPlans() {
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setProgress(getPlanProgress());
  }, []);

  const toggle = (key: string) => {
    const next = { ...progress, [key]: !progress[key] };
    setProgress(next);
    savePlanProgress(next);
  };

  const plan = ALL_PLANS.find((p) => p.id === selected);

  if (!plan) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">{"📋"} Plany treningowe</h2>
        <div className="space-y-3">
          {ALL_PLANS.map((p) => {
            const totalSessions = p.weeks.reduce((a, w) => a + w.sessions.length, 0);
            const doneSessions = p.weeks.reduce((a, w) => a + w.sessions.filter((_, si) => progress[`${p.id}_${w.weekNum}_${si}`]).length, 0);
            const pct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="w-full p-4 rounded-2xl text-left"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{p.emoji} {p.name}</span>
                  <span className="text-xs text-white/40">{p.weeks.length} tyg.</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-white/40 mt-1">{pct}% ({doneSessions}/{totalSessions})</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const totalSessions = plan.weeks.reduce((a, w) => a + w.sessions.length, 0);
  const doneSessions = plan.weeks.reduce((a, w) => a + w.sessions.filter((_, si) => progress[`${plan.id}_${w.weekNum}_${si}`]).length, 0);
  const totalPct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0;

  return (
    <div>
      <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 mb-3">
        <ArrowLeft size={14} /> Wszystkie plany
      </button>
      <h2 className="text-xl font-bold mb-1">{plan.emoji} {plan.name}</h2>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-1">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${totalPct}%` }} />
      </div>
      <div className="text-xs text-white/40 mb-4">{totalPct}% ukończono ({doneSessions}/{totalSessions})</div>
      <div className="space-y-4">
        {plan.weeks.map((w) => {
          const wDone = w.sessions.filter((_, si) => progress[`${plan.id}_${w.weekNum}_${si}`]).length;
          const wPct = w.sessions.length > 0 ? Math.round((wDone / w.sessions.length) * 100) : 0;
          return (
            <div key={w.weekNum} className="p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Tydzień {w.weekNum}</span>
                <span className="text-xs text-white/40">{wPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${wPct}%` }} />
              </div>
              <div className="space-y-1.5">
                {w.sessions.map((s, si) => {
                  const key = `${plan.id}_${w.weekNum}_${si}`;
                  const done = !!progress[key];
                  return (
                    <label key={si} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggle(key)}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div>
                        <span className={`text-sm ${done ? "line-through text-white/30" : ""}`}>
                          <strong>{s.label}:</strong> {s.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────── FEATURE 6: RUNNING RECORDS ─────────────── */

function RunningRecords() {
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [distLabel, setDistLabel] = useState("5K");
  const [customDist, setCustomDist] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().split("T")[0]);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    setRecords(getRecords());
  }, []);

  const distKm = (() => {
    const found = PRESET_DISTANCES.find((d) => d.label === distLabel);
    if (found && found.km > 0) return found.km;
    return parseFloat(customDist) || 0;
  })();

  const addRecord = () => {
    const t = parseTime(timeInput);
    if (!t || distKm <= 0) return;
    const rec: RunRecord = {
      id: Date.now().toString(36),
      distance: distLabel === "Własny" ? `${distKm}km` : distLabel,
      distanceKm: distKm,
      timeSeconds: t,
      date: dateInput,
      paceSecPerKm: t / distKm,
    };
    const next = [rec, ...records];
    setRecords(next);
    saveRecords(next);
    setTimeInput("");
  };

  const grouped = useMemo(() => {
    const map = new Map<string, RunRecord[]>();
    for (const r of records) {
      const arr = map.get(r.distance) || [];
      arr.push(r);
      map.set(r.distance, arr);
    }
    return map;
  }, [records]);

  const prs = useMemo(() => {
    const result: Record<string, RunRecord> = {};
    grouped.forEach((recs, dist) => {
      const best = recs.reduce((a, b) => (a.timeSeconds < b.timeSeconds ? a : b));
      result[dist] = best;
    });
    return result;
  }, [grouped]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{"🏆"} Moje rekordy</h2>
      {/* Add */}
      <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 className="text-sm font-semibold mb-2 text-white/60">Dodaj wynik</h3>
        <div className="flex gap-2 mb-2 flex-wrap">
          {["5K", "10K", "Półmaraton", "Maraton", "Własny"].map((d) => (
            <button
              key={d}
              onClick={() => setDistLabel(d)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: distLabel === d ? "#3B82F6" : "rgba(255,255,255,0.06)",
                color: distLabel === d ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              {d}
            </button>
          ))}
        </div>
        {distLabel === "Własny" && (
          <input
            type="number"
            placeholder="Dystans (km)"
            value={customDist}
            onChange={(e) => setCustomDist(e.target.value)}
            className="w-full mb-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
          />
        )}
        <input
          placeholder="Czas (h:mm:ss lub mm:ss)"
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
          className="w-full mb-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
        />
        <input
          type="date"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          className="w-full mb-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
        />
        <button
          onClick={addRecord}
          className="w-full py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold"
        >
          Dodaj rekord
        </button>
      </div>
      {/* PRs */}
      {Object.keys(prs).length > 0 && (
        <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-semibold mb-2 text-white/60">{"🥇"} Rekordy życiowe (PR)</h3>
          {Object.entries(prs).map(([dist, r]) => (
            <div key={dist} className="flex justify-between py-1 text-sm">
              <span className="text-white/50">{dist}</span>
              <span className="font-mono">{fmtTime(r.timeSeconds)} <span className="text-white/30">({fmtTime(r.paceSecPerKm)}/km)</span></span>
            </div>
          ))}
          <button
            onClick={() => setShowCard(!showCard)}
            className="mt-3 text-xs text-blue-400 underline"
          >
            {showCard ? "Ukryj kartę" : "🎴 Pokaż Kartę Biegacza"}
          </button>
        </div>
      )}
      {/* Runner Card */}
      {showCard && Object.keys(prs).length > 0 && (
        <div className="p-5 rounded-2xl mb-4 text-center" style={{ background: "linear-gradient(135deg, #1e3a5f, #0f172a)", border: "1px solid rgba(59,130,246,0.3)" }}>
          <div className="text-lg font-bold mb-2">{"🏃"} Karta Biegacza</div>
          <div className="space-y-1 text-sm">
            {Object.entries(prs).map(([dist, r]) => (
              <div key={dist}>{dist}: <strong>{fmtTime(r.timeSeconds)}</strong> ({fmtTime(r.paceSecPerKm)}/km)</div>
            ))}
          </div>
          <div className="text-xs text-white/30 mt-3">SkładAI &middot; Strefa Biegacza</div>
        </div>
      )}
      {/* History with charts */}
      {Array.from(grouped.entries()).map(([dist, recs]) => {
        const sorted = [...recs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const paceData = sorted.map((r) => ({
          date: r.date,
          value: Math.round(r.paceSecPerKm / 6) / 10, // convert to min/km decimal
        }));
        const timeData = sorted.map((r) => ({
          date: r.date,
          value: Math.round(r.timeSeconds / 60 * 10) / 10, // minutes
        }));
        return (
          <div key={dist} className="mb-4">
            <h3 className="text-sm font-semibold text-white/60 mb-1">{dist}</h3>
            {timeData.length >= 2 && (
              <div className="mb-2">
                <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>Czas — trend</p>
                <ProgressChart data={timeData} label="min" color="#3B82F6" invertTrend />
              </div>
            )}
            <div className="space-y-1">
              {recs.sort((a, b) => a.timeSeconds - b.timeSeconds).map((r) => (
                <div key={r.id} className="flex justify-between text-sm px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-white/40">{r.date}</span>
                  <span className="font-mono">{fmtTime(r.timeSeconds)} <span className="text-white/30">({fmtTime(r.paceSecPerKm)}/km)</span></span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── FEATURE 7: POLISH RACES ─────────────── */

function PolishRaces() {
  const [filter, setFilter] = useState("Wszystkie");
  const [plans, setPlans] = useState<RacePlan[]>([]);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newGoal, setNewGoal] = useState("");

  useEffect(() => {
    setPlans(getRacePlans());
  }, []);

  const allTags = Array.from(new Set([...RACE_SOURCES, ...RACE_SERIES].map((s) => s.tag)));
  const filtered = [...RACE_SOURCES, ...RACE_SERIES].filter((s) => filter === "Wszystkie" || s.tag === filter);

  const addPlan = () => {
    if (!newName || !newDate) return;
    const p: RacePlan = { id: Date.now().toString(36), name: newName, date: newDate, goalTime: newGoal };
    const next = [...plans, p];
    setPlans(next);
    saveRacePlans(next);
    setNewName("");
    setNewDate("");
    setNewGoal("");
  };

  const removePlan = (id: string) => {
    const next = plans.filter((p) => p.id !== id);
    setPlans(next);
    saveRacePlans(next);
  };

  const daysUntil = (d: string) => {
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(diff));
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{"🏅"} Zawody w Polsce</h2>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("Wszystkie")}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: filter === "Wszystkie" ? "#3B82F6" : "rgba(255,255,255,0.06)",
            color: filter === "Wszystkie" ? "#fff" : "rgba(255,255,255,0.5)",
          }}
        >
          Wszystkie
        </button>
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: filter === t ? "#3B82F6" : "rgba(255,255,255,0.06)",
              color: filter === t ? "#fff" : "rgba(255,255,255,0.5)",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {/* Links */}
      <div className="space-y-2 mb-6">
        {filtered.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-white/30">{s.tag}</div>
            </div>
            <ChevronRight size={16} className="text-white/30" />
          </a>
        ))}
      </div>
      {/* My race plan */}
      <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 className="text-sm font-semibold mb-2 text-white/60">{"🎯"} Mój plan startowy</h3>
        {plans.map((p) => {
          const days = daysUntil(p.date);
          return (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-white/40">{p.date} {p.goalTime && `· Cel: ${p.goalTime}`}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-orange-400">Za {days} dni!</span>
                <button onClick={() => removePlan(p.id)} className="text-white/20 hover:text-red-400 text-xs">{"✕"}</button>
              </div>
            </div>
          );
        })}
        <div className="mt-3 space-y-2">
          <input
            placeholder="Nazwa zawodów"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
          />
          <input
            placeholder="Cel czasowy (opcjonalnie)"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none"
          />
          <button onClick={addPlan} className="w-full py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold">
            Dodaj do planu
          </button>
        </div>
      </div>
    </div>
  );
}
