"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Timer,
  X,
  Camera,
  Trash2,
  Share2,
  TrendingUp,
  TrendingDown,
  Lock,
  Trophy,
  Dumbbell,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Scanner from "@/components/Scanner";
import dynamic from "next/dynamic";

const ProgressChart = dynamic(() => import("@/components/ProgressChart"), { ssr: false });
import { addToHistory, checkFreeTierLimit, incrementScanCount, updateStreak, removeHistoryItem, getProfile as getStorageProfile } from "@/lib/storage";
import { isNative, takePhotoForMode } from "@/lib/native-camera";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

interface StrengthRecord {
  exercise: string;
  oneRepMax: number;
  weight: number;
  reps: number;
  bodyWeight: number | null;
  ratio: number | null;
  date: string;
}

interface Measurement {
  date: string;
  biceps: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  thigh: number | null;
  calf: number | null;
  neck: number | null;
  bodyFatPercent: number | null;
  bodyFatCategory: string | null;
}

interface ProgressPhoto {
  id: string;
  date: string;
  type: "front" | "side" | "back";
  data: string; // base64
}

type View =
  | "main"
  | "calculator"
  | "records"
  | "measurements"
  | "photos"
  | "strength-card"
  | "checkform";

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────

const EXERCISES = [
  "Bench Press",
  "Back Squat",
  "Deadlift",
  "Hip Thrust",
  "Barbell Row",
  "OHP",
] as const;

type ExerciseName = (typeof EXERCISES)[number];

const EXERCISE_LABELS: Record<ExerciseName, string> = {
  "Bench Press": "Wyciskanie na ławce",
  "Back Squat": "Przysiad ze sztangą",
  Deadlift: "Martwy ciąg",
  "Hip Thrust": "Hip Thrust",
  "Barbell Row": "Wiosłowanie sztangą",
  OHP: "Wyciskanie nad głowę",
};

// Strength-to-weight ratio scales
// Format: [beginner_max, novice_max, intermediate_max, advanced_max, elite_max]
const RATIO_SCALES_MALE: Record<ExerciseName, number[]> = {
  "Bench Press": [0.5, 0.75, 1.0, 1.25, 1.5],
  "Back Squat": [0.75, 1.0, 1.5, 2.0, 2.5],
  Deadlift: [1.0, 1.25, 1.75, 2.25, 2.75],
  "Hip Thrust": [0.75, 1.0, 1.5, 2.0, 2.5],
  "Barbell Row": [0.4, 0.6, 0.8, 1.0, 1.25],
  OHP: [0.35, 0.5, 0.65, 0.85, 1.0],
};

const RATIO_SCALES_FEMALE: Record<ExerciseName, number[]> = {
  "Bench Press": [0.25, 0.4, 0.6, 0.8, 1.0],
  "Back Squat": [0.5, 0.75, 1.0, 1.25, 1.5],
  Deadlift: [0.5, 0.75, 1.0, 1.5, 2.0],
  "Hip Thrust": [0.5, 0.75, 1.25, 1.75, 2.25],
  "Barbell Row": [0.25, 0.4, 0.55, 0.7, 0.85],
  OHP: [0.2, 0.3, 0.45, 0.6, 0.75],
};

const LEVEL_LABELS = [
  "Początkujący",
  "Nowicjusz",
  "Średniozaawansowany",
  "Zaawansowany",
  "Elita",
];
const LEVEL_COLORS = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981"];

const MEASUREMENT_FIELDS = [
  { key: "biceps", label: "Biceps", unit: "cm", upGood: true },
  { key: "chest", label: "Klatka piersiowa", unit: "cm", upGood: true },
  { key: "waist", label: "Talia", unit: "cm", upGood: false },
  { key: "hips", label: "Biodra", unit: "cm", upGood: false },
  { key: "thigh", label: "Udo", unit: "cm", upGood: true },
  { key: "calf", label: "Łydka", unit: "cm", upGood: true },
  { key: "neck", label: "Szyja", unit: "cm", upGood: true },
] as const;

const BF_CATEGORIES_MALE = [
  { max: 6, label: "Niezbędny", color: "#EF4444" },
  { max: 13, label: "Atletyczny", color: "#3B82F6" },
  { max: 17, label: "Sprawny", color: "#10B981" },
  { max: 24, label: "Przeciętny", color: "#F59E0B" },
  { max: 31, label: "Powyżej przeciętnej", color: "#F97316" },
  { max: 100, label: "Wysoki", color: "#EF4444" },
];

const BF_CATEGORIES_FEMALE = [
  { max: 14, label: "Niezbędny", color: "#EF4444" },
  { max: 20, label: "Atletyczny", color: "#3B82F6" },
  { max: 24, label: "Sprawny", color: "#10B981" },
  { max: 31, label: "Przeciętny", color: "#F59E0B" },
  { max: 39, label: "Powyżej przeciętnej", color: "#F97316" },
  { max: 100, label: "Wysoki", color: "#EF4444" },
];

// ──────────────────────────────────────────
// LocalStorage helpers
// ──────────────────────────────────────────

function getRecords(): StrengthRecord[] {
  try {
    const d = localStorage.getItem("skladai_strength_records");
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

function saveRecord(r: StrengthRecord) {
  const records = getRecords();
  records.push(r);
  localStorage.setItem("skladai_strength_records", JSON.stringify(records));
}

function getMeasurements(): Measurement[] {
  try {
    const d = localStorage.getItem("skladai_measurements");
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

function saveMeasurement(m: Measurement) {
  const all = getMeasurements();
  all.push(m);
  localStorage.setItem("skladai_measurements", JSON.stringify(all));
}

function getPhotos(): ProgressPhoto[] {
  try {
    const d = localStorage.getItem("skladai_progress_photos");
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

function savePhotos(photos: ProgressPhoto[]) {
  localStorage.setItem("skladai_progress_photos", JSON.stringify(photos));
}

function getProfile(): { gender: string; weight_kg: number; height_cm: number } | null {
  try {
    const d = localStorage.getItem("skladai_profile");
    if (!d) return null;
    const p = JSON.parse(d);
    return { gender: p.gender || "male", weight_kg: p.weight_kg || 0, height_cm: p.height_cm || 0 };
  } catch {
    return null;
  }
}

function getTimerPref(): number {
  try {
    return parseInt(localStorage.getItem("skladai_timer_pref") || "90", 10);
  } catch {
    return 90;
  }
}

function setTimerPref(s: number) {
  localStorage.setItem("skladai_timer_pref", String(s));
}

// ──────────────────────────────────────────
// Utility
// ──────────────────────────────────────────

function calc1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function getLevel(ratio: number, scales: number[]): { level: number; label: string; color: string; next: number | null } {
  for (let i = 0; i < scales.length; i++) {
    if (ratio <= scales[i]) {
      return {
        level: i,
        label: LEVEL_LABELS[i],
        color: LEVEL_COLORS[i],
        next: i < scales.length - 1 ? scales[i + 1] : null,
      };
    }
  }
  return { level: 4, label: LEVEL_LABELS[4], color: LEVEL_COLORS[4], next: null };
}

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        const MAX = 800;
        if (w > MAX) { h = (h * MAX) / w; w = MAX; }
        if (h > MAX) { w = (w * MAX) / h; h = MAX; }
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No ctx")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("Load error"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Read error"));
    reader.readAsDataURL(file);
  });
}

function calcBodyFat(
  gender: string,
  waist: number,
  neck: number,
  height: number,
  hips?: number
): number | null {
  if (!waist || !neck || !height) return null;
  if (waist <= neck) return null;
  try {
    if (gender === "female") {
      if (!hips) return null;
      const val = waist + hips - neck;
      if (val <= 0) return null;
      const bf = 495 / (1.29579 - 0.35004 * Math.log10(val) + 0.221 * Math.log10(height)) - 450;
      return Math.round(bf * 10) / 10;
    } else {
      const val = waist - neck;
      if (val <= 0) return null;
      const bf = 495 / (1.0324 - 0.19077 * Math.log10(val) + 0.15456 * Math.log10(height)) - 450;
      return Math.round(bf * 10) / 10;
    }
  } catch {
    return null;
  }
}

function getBfCategory(bf: number, gender: string): { label: string; color: string } {
  const cats = gender === "female" ? BF_CATEGORIES_FEMALE : BF_CATEGORIES_MALE;
  for (const c of cats) {
    if (bf <= c.max) return { label: c.label, color: c.color };
  }
  return { label: "Wysoki", color: "#EF4444" };
}

// ──────────────────────────────────────────
// CheckForm history helper
// ──────────────────────────────────────────

interface CheckFormEntry {
  id: string;
  date: string;
  score: number;
  name: string;
}

function getCheckFormHistory(): CheckFormEntry[] {
  try {
    const d = localStorage.getItem("skladai_history");
    if (!d) return [];
    const all = JSON.parse(d);
    return all
      .filter((item: { scanType?: string }) => item.scanType === "forma")
      .map((item: { id: string; date: string; result?: { score?: number }; name?: string }) => ({
        id: item.id,
        date: item.date,
        score: item.result?.score ?? 0,
        name: item.name || "CheckForm",
      }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────

export default function FormaPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("main");
  const [autoOpenGallery, setAutoOpenGallery] = useState(false);
  const [profile, setProfileState] = useState<ReturnType<typeof getProfile>>(null);
  const [records, setRecords] = useState<StrengthRecord[]>([]);

  // Timer state (persists across views)
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLeft, setTimerLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setProfileState(getProfile());
    setRecords(getRecords());
  }, []);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && timerLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimerLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            try { navigator.vibrate([200, 100, 200]); } catch { /* noop */ }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timerLeft]);

  const refreshRecords = useCallback(() => setRecords(getRecords()), []);

  // Big 3 total
  const big3 = (() => {
    const bench = records.filter((r) => r.exercise === "Bench Press");
    const squat = records.filter((r) => r.exercise === "Back Squat");
    const dead = records.filter((r) => r.exercise === "Deadlift");
    const bPR = bench.length ? Math.max(...bench.map((r) => r.oneRepMax)) : 0;
    const sPR = squat.length ? Math.max(...squat.map((r) => r.oneRepMax)) : 0;
    const dPR = dead.length ? Math.max(...dead.map((r) => r.oneRepMax)) : 0;
    return bPR + sPR + dPR;
  })();

  const goBack = () => { setView("main"); setAutoOpenGallery(false); };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const startTimer = (s: number) => {
    setTimerSeconds(s);
    setTimerLeft(s);
    setTimerRunning(true);
    setTimerPref(s);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#0a0e0c", color: "#fff" }}>
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute" style={{
        top: "-40px", right: "-60px", width: "220px", height: "220px",
        background: "radial-gradient(circle, rgba(249,115,22,0.07), transparent 70%)",
        filter: "blur(40px)",
        animation: "floatBlob1 8s ease-in-out infinite",
      }} />
      <div className="pointer-events-none absolute" style={{
        bottom: "120px", left: "-80px", width: "180px", height: "180px",
        background: "radial-gradient(circle, rgba(249,115,22,0.07), transparent 70%)",
        filter: "blur(50px)",
        animation: "floatBlob2 10s ease-in-out infinite",
      }} />
      {/* Film grain */}
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ opacity: 0.08 }}>
        <svg width="100%" height="100%">
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>
      <style>{`
        @keyframes floatBlob1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-20px,30px); } }
        @keyframes floatBlob2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(25px,-20px); } }
        @keyframes breathe { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="max-w-md mx-auto px-4 pt-6 relative z-[2]" style={{
        paddingBottom: "200px",
      }}>
        {view === "main" && (
          <MainView
            setView={setView}
            big3={big3}
            records={records}
            onRunnerClick={() => router.push("/biegacz")}
            router={router}
            onGalleryCheckForm={() => { setAutoOpenGallery(true); setView("checkform"); }}
            onTimerOpen={() => setTimerOpen(true)}
          />
        )}
        {view === "calculator" && (
          <CalculatorView
            goBack={goBack}
            profile={profile}
            refreshRecords={refreshRecords}
          />
        )}
        {view === "records" && (
          <RecordsView goBack={goBack} records={records} profile={profile} />
        )}
        {view === "measurements" && (
          <MeasurementsView goBack={goBack} profile={profile} />
        )}
        {view === "photos" && <PhotosView goBack={goBack} />}
        {view === "strength-card" && (
          <StrengthCardView goBack={goBack} records={records} profile={profile} />
        )}
        {view === "checkform" && (
          <CheckFormView goBack={goBack} router={router} autoOpenGallery={autoOpenGallery} />
        )}
      </div>

      {/* Floating Timer Button (hidden on main view — timer icon in header instead) */}
      {view !== "main" && <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTimerOpen(true); }}
        className="fixed z-[100] flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
        style={{
          bottom: "100px",
          right: "16px",
          width: "56px",
          height: "56px",
          background: timerRunning
            ? `conic-gradient(#F97316 ${((timerSeconds - timerLeft) / timerSeconds) * 360}deg, #EF4444 ${((timerSeconds - timerLeft) / timerSeconds) * 360}deg)`
            : "linear-gradient(135deg, #F97316, #EF4444)",
          boxShadow: "0 6px 24px rgba(249,115,22,0.3)",
        }}
      >
        <Timer size={24} color="#fff" />
        {timerRunning && (
          <span className="absolute text-[10px] font-bold text-white" style={{ bottom: "-18px" }}>
            {formatTime(timerLeft)}
          </span>
        )}
      </button>}

      {/* Timer Modal */}
      {timerOpen && (
        <TimerModal
          onClose={() => setTimerOpen(false)}
          timerLeft={timerLeft}
          timerRunning={timerRunning}
          timerSeconds={timerSeconds}
          startTimer={startTimer}
          setTimerRunning={setTimerRunning}
          setTimerLeft={setTimerLeft}
          formatTime={formatTime}
        />
      )}

      <BottomNav />
    </div>
  );
}

// ──────────────────────────────────────────
// CARD COMPONENT (redesigned)
// ──────────────────────────────────────────

function Card({
  icon,
  title,
  subtitle,
  onClick,
  accentColor = "#f97316",
  animDelay = 0,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
  accentColor?: string;
  animDelay?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 text-left transition-all active:scale-[0.98]"
      style={{
        padding: "15px 15px 15px 20px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderLeft: `3px solid ${accentColor}`,
        backdropFilter: "blur(8px)",
        animation: `fadeInUp 0.4s ease both`,
        animationDelay: `${0.35 + animDelay * 0.05}s`,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "13px",
          background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,
          fontSize: "20px",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-white" style={{ fontSize: "14px" }}>{title}</div>
        {subtitle && (
          <div className="mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
            {subtitle}
          </div>
        )}
      </div>
      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "15px" }}>{"›"}</span>
    </button>
  );
}

// ──────────────────────────────────────────
// BACK BUTTON (redesigned with ChevronLeft)
// ──────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 mb-5 transition-colors"
      style={{ color: "rgba(255,255,255,0.7)" }}
    >
      <ChevronLeft size={24} />
      <span className="font-semibold" style={{ fontSize: "14px" }}>Wstecz</span>
    </button>
  );
}

// ──────────────────────────────────────────
// MAIN VIEW (redesigned with hero CheckForm)
// ──────────────────────────────────────────

function MainView({
  setView,
  big3,
  records,
  onRunnerClick,
  router,
  onGalleryCheckForm,
  onTimerOpen,
}: {
  setView: (v: View) => void;
  big3: number;
  records: StrengthRecord[];
  onRunnerClick?: () => void;
  router: AppRouterInstance;
  onGalleryCheckForm?: () => void;
  onTimerOpen?: () => void;
}) {
  const [checkFormHistory, setCheckFormHistory] = useState<CheckFormEntry[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [galleryDate, setGalleryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setCheckFormHistory(getCheckFormHistory());
  }, []);

  const recentCheckForms = checkFormHistory.slice(0, 2);

  const getScoreColor = (score: number) => score >= 8 ? "#22c55e" : score >= 5 ? "#f97316" : "#ef4444";

  const handleDeleteResult = (id: string) => {
    removeHistoryItem(id);
    setCheckFormHistory(getCheckFormHistory());
    setDeleteConfirm(null);
  };

  return (
    <>
      {/* Header with gradient bg */}
      <div style={{
        background: "linear-gradient(to bottom, rgba(26,16,8,0.9), transparent)",
        margin: "-24px -16px 0",
        padding: "24px 16px 16px",
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2" style={{ fontSize: "26px", fontWeight: 900 }}>
              <span>{"🔥"}</span>
              <span style={{ color: "#f97316" }}>Forma</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", marginTop: "2px" }}>
              Śledź siłę, pomiary i progres
            </p>
          </div>
          <button
            onClick={() => onTimerOpen?.()}
            className="flex items-center justify-center transition-all active:scale-95"
            style={{
              width: "42px", height: "42px", borderRadius: "50%",
              background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.15)",
            }}
          >
            <Timer size={20} style={{ color: "#f97316" }} />
          </button>
        </div>
      </div>

      {/* HERO: CheckForm */}
      <div className="relative mt-5 mb-6" style={{ animation: "fadeInUp 0.5s ease both" }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 -z-10" style={{
          background: "radial-gradient(ellipse at center, rgba(249,115,22,0.12), transparent 70%)",
          animation: "breathe 4s ease-in-out infinite",
          filter: "blur(20px)",
          transform: "scale(1.2)",
        }} />
        <div className="relative" style={{
          padding: "24px",
          borderRadius: "20px",
          background: "linear-gradient(145deg, rgba(249,115,22,0.1), rgba(249,115,22,0.03))",
          border: "1.5px solid rgba(249,115,22,0.18)",
          backdropFilter: "blur(16px)",
          overflow: "hidden",
        }}>
          {/* Scanner corners */}
          <div className="absolute" style={{ top: 10, left: 10, width: 22, height: 22, borderTop: "2.5px solid #f97316", borderLeft: "2.5px solid #f97316", borderRadius: "4px 0 0 0" }} />
          <div className="absolute" style={{ top: 10, right: 10, width: 22, height: 22, borderTop: "2.5px solid #f97316", borderRight: "2.5px solid #f97316", borderRadius: "0 4px 0 0" }} />
          <div className="absolute" style={{ bottom: 10, left: 10, width: 22, height: 22, borderBottom: "2.5px solid #f97316", borderLeft: "2.5px solid #f97316", borderRadius: "0 0 0 4px" }} />
          <div className="absolute" style={{ bottom: 10, right: 10, width: 22, height: 22, borderBottom: "2.5px solid #f97316", borderRight: "2.5px solid #f97316", borderRadius: "0 0 4px 0" }} />
          {/* Decorative circles */}
          <div className="absolute pointer-events-none" style={{ top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(249,115,22,0.06)" }} />
          <div className="absolute pointer-events-none" style={{ bottom: -10, left: -10, width: 45, height: 45, borderRadius: "50%", background: "rgba(249,115,22,0.04)" }} />

          {/* Content */}
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="flex items-center justify-center mb-3" style={{
              width: 52, height: 52, borderRadius: "16px",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              boxShadow: "0 4px 20px rgba(249,115,22,0.3)",
              fontSize: "26px",
            }}>{"📸"}</div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#fff" }}>CheckForm</h2>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px", marginBottom: "16px" }}>
              AI przeanalizuje Twoją sylwetkę
            </p>
            <button
              onClick={() => setView("checkform")}
              className="w-full py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                fontSize: "15px",
                boxShadow: "0 4px 24px rgba(249,115,22,0.4)",
              }}
            >
              {"🎯"} Rozpocznij analizę
            </button>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                fontWeight: 600,
              }}>{"✦"} AI VISION</span>
              <button
                onClick={() => setShowDatePicker(true)}
                className="transition-all active:scale-95"
                style={{ fontSize: "12px", color: "#f97316", fontWeight: 600 }}
              >
                z galerii
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setShowDatePicker(false)}
        >
          <div
            className="w-[85%] max-w-xs rounded-2xl p-6"
            style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Kiedy zrobiono zdjęcie?</h3>
            <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Wybierz datę wykonania zdjęcia
            </p>
            <input
              type="date"
              value={galleryDate}
              onChange={(e) => setGalleryDate(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-4"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                colorScheme: "dark",
              }}
            />
            <button
              onClick={() => {
                setShowDatePicker(false);
                if (onGalleryCheckForm) {
                  localStorage.setItem("skladai_checkform_date", galleryDate);
                  onGalleryCheckForm();
                } else {
                  localStorage.setItem("skladai_checkform_date", galleryDate);
                  setView("checkform");
                }
              }}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
            >
              Dalej
            </button>
          </div>
        </div>
      )}

      {/* Recent results */}
      {recentCheckForms.length > 0 && (
        <div className="mb-6" style={{ animation: "fadeInUp 0.5s ease both", animationDelay: "0.15s" }}>
          <div className="mb-3" style={{
            fontSize: "10px", color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: "2px", fontWeight: 600,
          }}>OSTATNIE WYNIKI</div>
          <div className="grid grid-cols-2 gap-2.5">
            {recentCheckForms.map((entry) => (
              <div
                key={entry.id}
                className="relative flex flex-col p-3 rounded-[14px] text-left transition-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <button
                  onClick={() => router.push(`/wyniki/${entry.id}`)}
                  className="flex-1 text-left active:scale-[0.97] transition-all"
                >
                  <div className="text-xs font-medium text-white">CheckForm</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px", marginTop: "2px" }}>
                    {new Date(entry.date).toLocaleDateString("pl-PL")}
                  </div>
                  <div className="text-lg font-bold mt-1" style={{ color: getScoreColor(entry.score) }}>
                    {entry.score}/10
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(entry.id); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg transition-all active:scale-90"
                  style={{ background: "rgba(239,68,68,0.1)" }}
                >
                  <Trash2 size={12} style={{ color: "#ef4444" }} />
                </button>
              </div>
            ))}
          </div>

          {/* Delete confirmation */}
          {deleteConfirm && (() => {
            const entry = recentCheckForms.find((e) => e.id === deleteConfirm);
            return entry ? (
              <div
                className="fixed inset-0 z-[200] flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.8)" }}
                onClick={() => setDeleteConfirm(null)}
              >
                <div
                  className="w-[85%] max-w-xs rounded-2xl p-5"
                  style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm text-white mb-4">
                    Usunąć wynik CheckForm z {new Date(entry.date).toLocaleDateString("pl-PL")}?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                    >
                      Nie
                    </button>
                    <button
                      onClick={() => handleDeleteResult(deleteConfirm)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}
                    >
                      Tak, usuń
                    </button>
                  </div>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* CheckForm score chart */}
      {checkFormHistory.length >= 2 && (
        <div className="mb-6 rounded-[14px] p-4" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Wynik CheckForm — trend</p>
          <ProgressChart
            data={checkFormHistory.map((h) => ({ date: h.date, value: h.score }))}
            label="/10"
            color="#f97316"
            targetValue={8}
            targetLabel="Cel: 8/10"
          />
        </div>
      )}

      {/* Separator */}
      <div className="flex items-center gap-3 mb-4" style={{ animation: "fadeInUp 0.4s ease both", animationDelay: "0.25s" }}>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }} />
        <span style={{
          fontSize: "9px",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          letterSpacing: "2.5px",
          fontWeight: 600,
        }}>NARZĘDZIA</span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }} />
      </div>

      {/* Tool cards */}
      <div className="flex flex-col gap-2.5">
        <Card icon={"🏋️"} title="Kalkulator 1RM" subtitle="Oblicz maksymalną siłę" accentColor="#f97316" animDelay={0} onClick={() => setView("calculator")} />
        <Card
          icon={"🏆"}
          title="Moje Rekordy"
          subtitle={records.length > 0 ? `Big 3: ${Math.round(big3)}kg` : "Śledź postępy w siłowni"}
          accentColor="#eab308" animDelay={1}
          onClick={() => setView("records")}
        />
        <Card icon={"📐"} title="Pomiary ciała" subtitle="Obwody + % tłuszczu" accentColor="#3b82f6" animDelay={2} onClick={() => setView("measurements")} />
        <Card icon={"📷"} title="Zdjęcia progresowe" subtitle="Before / After" accentColor="#a855f7" animDelay={3} onClick={() => setView("photos")} />
        <Card icon={"💪"} title="Karta siły" subtitle="Udostępnij osiągnięcia" accentColor="#ef4444" animDelay={4} onClick={() => setView("strength-card")} />
        {onRunnerClick && <Card icon={"🏃"} title="Strefa Biegacza" subtitle="Tempo, tętno, plany" accentColor="#22c55e" animDelay={5} onClick={onRunnerClick} />}
        <Card icon={"🍺"} title="Alkomat" subtitle="Oblicz promile i kalorie" accentColor="#fbbf24" animDelay={6} onClick={() => router.push("/promile")} />
      </div>
    </>
  );
}

// ──────────────────────────────────────────
// TIMER MODAL
// ──────────────────────────────────────────

function TimerModal({
  onClose,
  timerLeft,
  timerRunning,
  timerSeconds,
  startTimer,
  setTimerRunning,
  setTimerLeft,
  formatTime,
}: {
  onClose: () => void;
  timerLeft: number;
  timerRunning: boolean;
  timerSeconds: number;
  startTimer: (s: number) => void;
  setTimerRunning: (v: boolean) => void;
  setTimerLeft: (v: number) => void;
  formatTime: (s: number) => string;
}) {
  const [customSec, setCustomSec] = useState("");
  const presets = [60, 90, 120, 180];
  const progress = timerRunning || timerLeft > 0 ? ((timerSeconds - timerLeft) / timerSeconds) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-sm rounded-3xl p-6"
        style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Timer size={20} style={{ color: "#F97316" }} /> Przerwa
          </h2>
          <button onClick={onClose} className="p-1">
            <X size={20} style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
        </div>

        {/* Countdown */}
        <div className="text-center mb-6">
          <div
            className="font-mono font-bold"
            style={{
              fontSize: "48px",
              color: timerLeft === 0 && !timerRunning ? "rgba(255,255,255,0.3)" : timerLeft <= 10 && timerRunning ? "#EF4444" : "#F97316",
            }}
          >
            {formatTime(timerLeft > 0 ? timerLeft : timerSeconds)}
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full mt-3" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #F97316, #EF4444)" }}
            />
          </div>
        </div>

        {/* Presets */}
        {!timerRunning && timerLeft === 0 && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {presets.map((s) => (
                <button
                  key={s}
                  onClick={() => startTimer(s)}
                  className="py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                  style={{
                    background: timerSeconds === s ? "#F97316" : "rgba(255,255,255,0.06)",
                    color: timerSeconds === s ? "#fff" : "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {s}s
                </button>
              ))}
            </div>
            {/* Custom */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Własny (sek.)"
                value={customSec}
                onChange={(e) => setCustomSec(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              />
              <button
                onClick={() => {
                  const n = parseInt(customSec, 10);
                  if (n > 0 && n <= 600) startTimer(n);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "#F97316", color: "#fff" }}
              >
                Start
              </button>
            </div>
          </>
        )}

        {/* Controls when running / finished */}
        {(timerRunning || timerLeft > 0) && (
          <div className="flex gap-3 mt-2">
            {timerRunning ? (
              <button
                onClick={() => setTimerRunning(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "#F59E0B", color: "#000" }}
              >
                Pauza
              </button>
            ) : (
              <button
                onClick={() => setTimerRunning(true)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "linear-gradient(135deg, #F97316, #EF4444)", color: "#fff" }}
              >
                Wznów
              </button>
            )}
            <button
              onClick={() => {
                setTimerRunning(false);
                setTimerLeft(0);
              }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(239,68,68,0.2)", color: "#EF4444" }}
            >
              Reset
            </button>
          </div>
        )}

        {timerLeft === 0 && !timerRunning && (
          <p className="text-center text-xs mt-4" style={{ color: "rgba(255,255,255,0.55)" }}>
            Ostatnio: {getTimerPref()}s
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// CALCULATOR VIEW
// ──────────────────────────────────────────

function CalculatorView({
  goBack,
  profile,
  refreshRecords,
}: {
  goBack: () => void;
  profile: ReturnType<typeof getProfile>;
  refreshRecords: () => void;
}) {
  const [exercise, setExercise] = useState<ExerciseName>("Bench Press");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [saved, setSaved] = useState(false);

  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  const oneRM = w > 0 && r > 0 ? calc1RM(w, r) : null;

  const ratio = oneRM && profile && profile.weight_kg > 0 ? Math.round((oneRM / profile.weight_kg) * 100) / 100 : null;
  const scales = profile?.gender === "female" ? RATIO_SCALES_FEMALE : RATIO_SCALES_MALE;
  const levelInfo = ratio ? getLevel(ratio, scales[exercise]) : null;

  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60];

  const handleSave = () => {
    if (!oneRM) return;
    saveRecord({
      exercise,
      oneRepMax: oneRM,
      weight: w,
      reps: r,
      bodyWeight: profile?.weight_kg || null,
      ratio: ratio,
      date: new Date().toISOString(),
    });
    setSaved(true);
    refreshRecords();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <BackButton onClick={goBack} />
      <h2 className="text-xl font-bold mb-4">{"🏋️"} Kalkulator 1RM</h2>

      {/* Exercise selector */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {EXERCISES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setExercise(ex); setSaved(false); }}
            className="py-2.5 px-3 rounded-xl text-xs font-medium transition-all text-left"
            style={{
              background: exercise === ex ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${exercise === ex ? "#F97316" : "rgba(255,255,255,0.08)"}`,
              color: exercise === ex ? "#F97316" : "rgba(255,255,255,0.7)",
            }}
          >
            {EXERCISE_LABELS[ex]}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Ciężar (kg)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => { setWeight(e.target.value); setSaved(false); }}
            placeholder="0"
            className="w-full rounded-xl px-3 py-3 text-lg font-bold outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Powtórzenia</label>
          <input
            type="number"
            value={reps}
            onChange={(e) => { setReps(e.target.value); setSaved(false); }}
            placeholder="0"
            className="w-full rounded-xl px-3 py-3 text-lg font-bold outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        </div>
      </div>

      {r > 12 && (
        <div className="rounded-xl px-3 py-2 mb-4 text-xs" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
          {"⚠️"} Powyżej 12 powtórzeń wynik może być mniej dokładny
        </div>
      )}

      {/* Result */}
      {oneRM !== null && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
          <div className="text-center">
            <div className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Szacowane 1RM</div>
            <div className="text-4xl font-bold" style={{ color: "#F97316" }}>{oneRM} <span className="text-lg">kg</span></div>
          </div>

          {/* Ratio */}
          {ratio !== null && levelInfo && profile && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Siła / masa ciała</span>
                <span className="text-sm font-bold" style={{ color: levelInfo.color }}>
                  {ratio}x — {levelInfo.label}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-3 rounded-full flex overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                {scales[exercise].map((_, i) => (
                  <div
                    key={i}
                    className="h-full"
                    style={{
                      flex: 1,
                      background: i <= levelInfo.level ? LEVEL_COLORS[i] : "transparent",
                      opacity: i <= levelInfo.level ? 1 : 0.15,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {LEVEL_LABELS.map((l, i) => (
                  <span key={i} className="text-[9px]" style={{ color: i === levelInfo.level ? LEVEL_COLORS[i] : "rgba(255,255,255,0.25)" }}>{l.slice(0, 4)}.</span>
                ))}
              </div>
              {levelInfo.next !== null && profile.weight_kg > 0 && (
                <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Brakuje <span className="font-bold" style={{ color: "#F59E0B" }}>
                    {Math.round((levelInfo.next * profile.weight_kg - oneRM) * 10) / 10} kg
                  </span> do następnego poziomu
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saved}
            className="w-full mt-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: saved ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #F97316, #EF4444)",
              color: saved ? "#10B981" : "#fff",
            }}
          >
            {saved ? "✓ Zapisano!" : "💾 Zapisz jako rekord"}
          </button>
        </div>
      )}

      {/* Percentage table */}
      {oneRM !== null && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>Tabela procentowa</h3>
          <div className="space-y-1.5">
            {percentages.map((pct) => (
              <div key={pct} className="flex items-center gap-2">
                <span className="text-xs w-10 text-right" style={{ color: "rgba(255,255,255,0.4)" }}>{pct}%</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 90 ? "#EF4444" : pct >= 75 ? "#F97316" : "#F59E0B",
                    }}
                  />
                </div>
                <span className="text-xs font-mono w-14 text-right font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {Math.round(oneRM * pct / 100 * 10) / 10} kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────
// RECORDS VIEW
// ──────────────────────────────────────────

function RecordsView({
  goBack,
  records,
  profile,
}: {
  goBack: () => void;
  records: StrengthRecord[];
  profile: ReturnType<typeof getProfile>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const big3Exercises: ExerciseName[] = ["Bench Press", "Back Squat", "Deadlift"];
  const big3Total = big3Exercises.reduce((sum, ex) => {
    const exRecords = records.filter((r) => r.exercise === ex);
    const pr = exRecords.length ? Math.max(...exRecords.map((r) => r.oneRepMax)) : 0;
    return sum + pr;
  }, 0);

  return (
    <>
      <BackButton onClick={goBack} />
      <h2 className="text-xl font-bold mb-4">{"🏆"} Moje Rekordy</h2>

      {records.length === 0 && (
        <div className="text-center py-8 mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          <Trophy size={48} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.55)" }} />
          <p className="text-sm">Brak rekordów — oblicz pierwszy w kalkulatorze 1RM</p>
        </div>
      )}

      {records.length > 0 && (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(239,68,68,0.15))",
          border: "1px solid rgba(249,115,22,0.2)",
        }}>
          <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Big 3 Total</div>
          <div className="text-3xl font-bold" style={{ color: "#F97316" }}>{Math.round(big3Total)} kg</div>
          <div className="flex justify-center gap-4 mt-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {big3Exercises.map((ex) => {
              const exR = records.filter((r) => r.exercise === ex);
              const pr = exR.length ? Math.max(...exR.map((r) => r.oneRepMax)) : 0;
              return (
                <span key={ex}>
                  {EXERCISE_LABELS[ex].split(" ")[0]}: <span className="font-bold text-white">{pr > 0 ? Math.round(pr) : "—"}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Big 3 Total chart */}
      {(() => {
        // Build Big 3 total per date
        const dateMap = new Map<string, number>();
        for (const rec of records) {
          if (big3Exercises.includes(rec.exercise as ExerciseName)) {
            const d = rec.date.split("T")[0];
            dateMap.set(d, (dateMap.get(d) || 0) + rec.oneRepMax);
          }
        }
        // Accumulate running Big 3 total per date
        const big3PerDate = Array.from(dateMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, _val]) => {
            // Calculate running Big 3 total using all records up to this date
            const total = big3Exercises.reduce((sum, ex) => {
              const exRecs = records
                .filter((r) => r.exercise === ex && r.date.split("T")[0] <= date);
              return sum + (exRecs.length ? Math.max(...exRecs.map((r) => r.oneRepMax)) : 0);
            }, 0);
            return { date, value: Math.round(total) };
          });
        if (big3PerDate.length >= 2) {
          return (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Big 3 Total — progres</p>
              <ProgressChart data={big3PerDate} label="kg" color="#F97316" />
            </div>
          );
        }
        return null;
      })()}

      {/* Per exercise - always show all 6 */}
      {EXERCISES.map((ex) => {
        const exRecords = records
          .filter((r) => r.exercise === ex)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const hasRecords = exRecords.length > 0;
        const pr = hasRecords ? Math.max(...exRecords.map((r) => r.oneRepMax)) : 0;
        const first = hasRecords ? exRecords[exRecords.length - 1].oneRepMax : 0;
        const progress = pr - first;
        const isExpanded = expanded === ex;

        return (
          <div
            key={ex}
            className="rounded-2xl mb-3 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <button
              onClick={() => hasRecords && setExpanded(isExpanded ? null : ex)}
              className="w-full flex items-center justify-between p-4"
              style={{ cursor: hasRecords ? "pointer" : "default" }}
            >
              <div className="text-left">
                <div className="font-semibold text-sm text-white">{EXERCISE_LABELS[ex]}</div>
                {hasRecords ? (
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    PR: <span className="font-bold" style={{ color: "#F97316" }}>{Math.round(pr)} kg</span>
                    {exRecords[0].ratio !== null && (
                      <span className="ml-2">Ratio: {exRecords[0].ratio}x</span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Brak rekordu
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {progress > 0 && (
                  <span className="text-xs font-bold" style={{ color: "#F97316" }}>+{Math.round(progress)} kg</span>
                )}
                {hasRecords && (
                  <ChevronRight
                    size={16}
                    className="transition-transform"
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      transform: isExpanded ? "rotate(90deg)" : "none",
                    }}
                  />
                )}
              </div>
            </button>

            {isExpanded && hasRecords && (
              <div className="px-4 pb-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {exRecords.length >= 2 && (
                  <div className="mb-3">
                    <ProgressChart
                      data={exRecords.map((r) => ({ date: r.date, value: Math.round(r.oneRepMax) }))}
                      label="kg"
                      color="#F97316"
                    />
                  </div>
                )}
                {exRecords.map((rec, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 text-xs">
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {new Date(rec.date).toLocaleDateString("pl-PL")}
                    </span>
                    <span>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{rec.weight}kg x{rec.reps}</span>
                      <span className="ml-2 font-bold text-white">{"→"} {Math.round(rec.oneRepMax)} kg</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ──────────────────────────────────────────
// MEASUREMENTS VIEW
// ──────────────────────────────────────────

function MeasurementsView({
  goBack,
  profile,
}: {
  goBack: () => void;
  profile: ReturnType<typeof getProfile>;
}) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [chartField, setChartField] = useState<string>("waist");

  useEffect(() => {
    setMeasurements(getMeasurements());
  }, []);

  const prev = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  const handleSave = () => {
    const waist = parseFloat(values.waist || "0");
    const neck = parseFloat(values.neck || "0");
    const hips = parseFloat(values.hips || "0");
    const height = profile?.height_cm || 0;
    const gender = profile?.gender || "male";

    let bf: number | null = null;
    let bfCat: string | null = null;
    if (waist > 0 && neck > 0 && height > 0) {
      bf = calcBodyFat(gender, waist, neck, height, gender === "female" ? hips : undefined);
      if (bf !== null) {
        bfCat = getBfCategory(bf, gender).label;
      }
    }

    const m: Measurement = {
      date: new Date().toISOString(),
      biceps: parseFloat(values.biceps || "") || null,
      chest: parseFloat(values.chest || "") || null,
      waist: waist || null,
      hips: hips || null,
      thigh: parseFloat(values.thigh || "") || null,
      calf: parseFloat(values.calf || "") || null,
      neck: neck || null,
      bodyFatPercent: bf,
      bodyFatCategory: bfCat,
    };

    saveMeasurement(m);
    setMeasurements((prev) => [...prev, m]);
    setValues({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const gender = profile?.gender || "male";

  // Body fat from latest
  const latestBf = measurements.length > 0 ? measurements[measurements.length - 1].bodyFatPercent : null;
  const bfInfo = latestBf !== null ? getBfCategory(latestBf!, gender) : null;

  return (
    <>
      <BackButton onClick={goBack} />
      <h2 className="text-xl font-bold mb-4">{"📏"} Pomiary ciała</h2>

      {/* Body fat display */}
      {latestBf !== null && bfInfo && (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Tkanka tłuszczowa (US Navy)</div>
          <div className="text-3xl font-bold" style={{ color: bfInfo.color }}>{latestBf}%</div>
          <div className="text-sm mt-1" style={{ color: bfInfo.color }}>{bfInfo.label}</div>
          {/* Scale */}
          <div className="flex gap-1 mt-3">
            {(gender === "female" ? BF_CATEGORIES_FEMALE : BF_CATEGORIES_MALE).map((c, i) => (
              <div
                key={i}
                className="flex-1 h-2 rounded-full"
                style={{
                  background: c.label === bfInfo.label ? c.color : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Body Fat chart */}
      {(() => {
        const bfData = measurements
          .filter((m) => m.bodyFatPercent !== null)
          .map((m) => ({ date: m.date, value: m.bodyFatPercent! }));
        if (bfData.length >= 2) {
          return (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>% tkanki tłuszczowej — trend</p>
              <ProgressChart data={bfData} label="%" color="#3B82F6" invertTrend />
            </div>
          );
        }
        return null;
      })()}

      {/* Measurement chart with selector */}
      {measurements.length >= 2 && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Wykres pomiaru</p>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {MEASUREMENT_FIELDS.map((f) => (
              <button
                key={f.key}
                onClick={() => setChartField(f.key)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                style={{
                  background: chartField === f.key ? "#F97316" : "rgba(255,255,255,0.06)",
                  color: chartField === f.key ? "#fff" : "rgba(255,255,255,0.5)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {(() => {
            const field = MEASUREMENT_FIELDS.find((f) => f.key === chartField);
            const mData = measurements
              .filter((m) => (m as unknown as Record<string, unknown>)[chartField] !== null && (m as unknown as Record<string, unknown>)[chartField] !== undefined)
              .map((m) => ({ date: m.date, value: (m as unknown as Record<string, number>)[chartField] }));
            if (mData.length >= 2 && field) {
              return (
                <ProgressChart
                  data={mData}
                  label={field.unit}
                  color={field.upGood ? "#F97316" : "#10B981"}
                  invertTrend={!field.upGood}
                />
              );
            }
            return (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", textAlign: "center", padding: "16px 0" }}>
                Dodaj więcej wyników żeby zobaczyć wykres progresu
              </p>
            );
          })()}
        </div>
      )}

      {/* Input fields */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>Nowy pomiar</h3>
        <div className="space-y-3">
          {MEASUREMENT_FIELDS.map((f) => {
            const prevVal = prev ? (prev as unknown as Record<string, unknown>)[f.key] as number | null : null;
            const currVal = parseFloat(values[f.key] || "");
            const diff = prevVal && currVal ? Math.round((currVal - prevVal) * 10) / 10 : null;
            const isGood = diff ? (f.upGood ? diff > 0 : diff < 0) : null;

            return (
              <div key={f.key} className="flex items-center gap-3">
                <label className="text-sm w-28 flex-shrink-0" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {f.label}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={prevVal ? `${prevVal}` : "cm"}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                />
                {diff !== null && (
                  <span
                    className="text-xs font-bold w-16 text-right flex items-center justify-end gap-0.5"
                    style={{ color: isGood ? "#10B981" : "#EF4444" }}
                  >
                    {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {diff > 0 ? "+" : ""}{diff}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {!profile?.height_cm && (
          <p className="text-xs mt-3" style={{ color: "#F59E0B" }}>
            {"⚠️"} Ustaw wzrost w profilu, aby obliczyć % tłuszczu
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saved}
          className="w-full mt-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{
            background: saved ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #F97316, #EF4444)",
            color: saved ? "#10B981" : "#fff",
          }}
        >
          {saved ? "✓ Zapisano!" : "💾 Zapisz pomiar"}
        </button>
      </div>

      {/* History */}
      {measurements.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>Historia pomiarów</h3>
          <div className="space-y-2">
            {[...measurements].reverse().slice(0, 10).map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 text-xs"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <span style={{ color: "rgba(255,255,255,0.5)" }}>
                  {new Date(m.date).toLocaleDateString("pl-PL")}
                </span>
                <div className="flex gap-3" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {m.waist && <span>Talia: {m.waist}</span>}
                  {m.biceps && <span>Biceps: {m.biceps}</span>}
                  {m.bodyFatPercent && (
                    <span className="font-bold" style={{ color: "#F97316" }}>{m.bodyFatPercent}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────
// PHOTOS VIEW
// ──────────────────────────────────────────

function PhotosView({ goBack }: { goBack: () => void }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [photoType, setPhotoType] = useState<"front" | "side" | "back">("front");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhotos(getPhotos());
  }, []);

  const handleFile = async (file: File) => {
    if (photos.length >= 20) {
      alert("Maksymalnie 20 zdjęć. Usuń stare, aby dodać nowe.");
      return;
    }
    try {
      const compressed = await compressPhoto(file);
      const newPhoto: ProgressPhoto = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: photoType,
        data: compressed,
      };
      const updated = [newPhoto, ...photos];
      savePhotos(updated);
      setPhotos(updated);
    } catch {
      alert("Nie udało się przetworzyć zdjęcia");
    }
  };

  const handleDelete = (id: string) => {
    const updated = photos.filter((p) => p.id !== id);
    savePhotos(updated);
    setPhotos(updated);
  };

  const typeLabels = { front: "Przód", side: "Bok", back: "Tył" };

  return (
    <>
      <BackButton onClick={goBack} />
      <h2 className="text-xl font-bold mb-4">{"📸"} Zdjęcia progresowe</h2>

      {/* Privacy notice */}
      <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4 text-xs" style={{ background: "rgba(249,115,22,0.1)", color: "#F97316" }}>
        <Lock size={14} />
        Zdjęcia zapisane tylko na Twoim telefonie
      </div>

      {/* Type selector + capture */}
      <div className="flex gap-2 mb-4">
        {(["front", "side", "back"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPhotoType(t)}
            className="flex-1 py-2 rounded-xl text-xs font-medium"
            style={{
              background: photoType === t ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${photoType === t ? "#F97316" : "rgba(255,255,255,0.08)"}`,
              color: photoType === t ? "#F97316" : "rgba(255,255,255,0.6)",
            }}
          >
            {typeLabels[t]}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={async () => {
            if (isNative()) {
              const base64 = await takePhotoForMode("forma", "camera");
              if (base64) {
                const res = await fetch(base64);
                const blob = await res.blob();
                handleFile(new File([blob], "photo.jpg", { type: "image/jpeg" }));
              }
            } else { cameraRef.current?.click(); }
          }}
          className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #F97316, #EF4444)", color: "#fff" }}
        >
          <Camera size={18} /> Zrób zdjęcie
        </button>
        <button
          onClick={async () => {
            if (isNative()) {
              const base64 = await takePhotoForMode("forma", "gallery");
              if (base64) {
                const res = await fetch(base64);
                const blob = await res.blob();
                handleFile(new File([blob], "photo.jpg", { type: "image/jpeg" }));
              }
            } else { fileRef.current?.click(); }
          }}
          className="flex-1 py-3 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
        >
          Z galerii
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {/* Compare mode */}
      {photos.length >= 2 && (
        <button
          onClick={() => { setIsComparing(!isComparing); setCompareA(null); setCompareB(null); }}
          className="w-full py-2 rounded-xl text-xs font-medium mb-4"
          style={{
            background: isComparing ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: isComparing ? "#F97316" : "rgba(255,255,255,0.6)",
          }}
        >
          {isComparing ? "Anuluj porównanie" : "🖼️ Porównaj zdjęcia (przed/po)"}
        </button>
      )}

      {isComparing && compareA && compareB && (
        <div className="grid grid-cols-2 gap-2 mb-4 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {[compareA, compareB].map((id, i) => {
            const photo = photos.find((p) => p.id === id);
            return photo ? (
              <div key={i} className="relative">
                <img src={photo.data} alt="" className="w-full aspect-[3/4] object-cover" />
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] text-center" style={{ background: "rgba(0,0,0,0.7)" }}>
                  {new Date(photo.date).toLocaleDateString("pl-PL")}
                </div>
              </div>
            ) : null;
          })}
        </div>
      )}

      {isComparing && (!compareA || !compareB) && (
        <p className="text-xs mb-3" style={{ color: "#F59E0B" }}>
          Wybierz {!compareA ? "pierwsze" : "drugie"} zdjęcie do porównania
        </p>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative rounded-xl overflow-hidden cursor-pointer"
            style={{
              border: (compareA === photo.id || compareB === photo.id) ? "2px solid #F59E0B" : "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={() => {
              if (isComparing) {
                if (!compareA) setCompareA(photo.id);
                else if (!compareB && photo.id !== compareA) setCompareB(photo.id);
                else if (compareA === photo.id) setCompareA(null);
                else if (compareB === photo.id) setCompareB(null);
              }
            }}
          >
            <img src={photo.data} alt="" className="w-full aspect-[3/4] object-cover" />
            <div
              className="absolute bottom-0 left-0 right-0 px-1.5 py-1 flex justify-between items-center"
              style={{ background: "rgba(0,0,0,0.7)", fontSize: "9px" }}
            >
              <span style={{ color: "rgba(255,255,255,0.7)" }}>
                {typeLabels[photo.type]} · {new Date(photo.date).toLocaleDateString("pl-PL")}
              </span>
              {!isComparing && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                  className="p-0.5"
                >
                  <Trash2 size={10} style={{ color: "#EF4444" }} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {photos.length === 0 && (
        <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>
          <Camera size={40} className="mx-auto mb-2" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm">Brak zdjęć</p>
          <p className="text-xs mt-1">Zrób pierwsze zdjęcie progresowe</p>
        </div>
      )}

      <p className="text-[10px] text-center mt-4" style={{ color: "rgba(255,255,255,0.55)" }}>
        {photos.length}/20 zdjęć
      </p>
    </>
  );
}

// ──────────────────────────────────────────
// STRENGTH CARD VIEW
// ──────────────────────────────────────────

function StrengthCardView({
  goBack,
  records,
  profile,
}: {
  goBack: () => void;
  records: StrengthRecord[];
  profile: ReturnType<typeof getProfile>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shared, setShared] = useState(false);

  const prs: Record<string, number> = {};
  const ratios: Record<string, number | null> = {};
  for (const ex of EXERCISES) {
    const exR = records.filter((r) => r.exercise === ex);
    prs[ex] = exR.length ? Math.max(...exR.map((r) => r.oneRepMax)) : 0;
    const prRec = exR.length ? exR.reduce((best, r) => r.oneRepMax > best.oneRepMax ? r : best) : null;
    ratios[ex] = prRec?.ratio ?? null;
  }

  const big3 = (prs["Bench Press"] || 0) + (prs["Back Squat"] || 0) + (prs["Deadlift"] || 0);

  const handleShare = async () => {
    // Build text-based share (no photos for privacy)
    const lines = [
      "💪 Karta Siły — SkładAI Forma",
      "",
      `Big 3 Total: ${Math.round(big3)} kg`,
      "",
      ...EXERCISES.filter((ex) => prs[ex] > 0).map(
        (ex) =>
          `${EXERCISE_LABELS[ex]}: ${Math.round(prs[ex])} kg${ratios[ex] ? ` (${ratios[ex]}x)` : ""}`
      ),
      "",
      profile?.weight_kg ? `Masa ciała: ${profile.weight_kg} kg` : "",
    ].filter(Boolean);

    const text = lines.join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Karta Siły", text });
        setShared(true);
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setShared(true);
    }
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <>
      <BackButton onClick={goBack} />
      <h2 className="text-xl font-bold mb-4">{"💪"} Karta Siły</h2>

      {records.length === 0 ? (
        <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.4)" }}>
          <Dumbbell size={48} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.55)" }} />
          <p className="text-sm">Dodaj rekordy w kalkulatorze 1RM</p>
          <p className="text-xs mt-1">żeby wygenerować kartę</p>
        </div>
      ) : (
        <>
          <div
            ref={cardRef}
            className="rounded-3xl p-5 mb-4"
            style={{
              background: "linear-gradient(135deg, #111827, #1E293B)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-medium" style={{ color: "#F97316" }}>SKŁAD<span style={{ color: "#F59E0B" }}>AI</span> FORMA</div>
                <div className="text-lg font-bold text-white">Karta Siły</div>
              </div>
              {profile?.weight_kg && (
                <div className="text-right">
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Masa ciała</div>
                  <div className="text-sm font-bold text-white">{profile.weight_kg} kg</div>
                </div>
              )}
            </div>

            {/* Big 3 */}
            <div className="text-center py-3 rounded-2xl mb-4" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>BIG 3 TOTAL</div>
              <div className="text-3xl font-bold" style={{ color: "#F97316" }}>{Math.round(big3)} kg</div>
            </div>

            {/* Exercises - show all 6 */}
            <div className="space-y-2">
              {EXERCISES.map((ex) => {
                const scales = profile?.gender === "female" ? RATIO_SCALES_FEMALE : RATIO_SCALES_MALE;
                const lvl = ratios[ex] ? getLevel(ratios[ex]!, scales[ex]) : null;
                const hasPR = prs[ex] > 0;
                return (
                  <div key={ex} className="flex items-center justify-between py-1.5">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{EXERCISE_LABELS[ex]}</span>
                    <div className="flex items-center gap-2">
                      {hasPR ? (
                        <span className="text-sm font-bold text-white">{Math.round(prs[ex])} kg</span>
                      ) : (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{"—"}</span>
                      )}
                      {lvl && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${lvl.color}20`, color: lvl.color }}>
                          {lvl.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Date */}
            <div className="text-center mt-4 text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              {new Date().toLocaleDateString("pl-PL")}
            </div>
          </div>

          <button
            onClick={handleShare}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: shared ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #F97316, #EF4444)",
              color: shared ? "#10B981" : "#fff",
            }}
          >
            {shared ? "✓ Skopiowano!" : <><Share2 size={16} /> Udostępnij (tylko statystyki)</>}
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Udostępniane są tylko wyniki, bez zdjęć
          </p>
        </>
      )}
    </>
  );
}

// ──────────────────────────────────────────
// CHECKFORM VIEW (AI Body Analysis)
// ──────────────────────────────────────────

function CheckFormView({
  goBack,
  router,
  autoOpenGallery,
}: {
  goBack: () => void;
  router: AppRouterInstance;
  autoOpenGallery?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CheckFormEntry[]>([]);

  useEffect(() => {
    setHistory(getCheckFormHistory());
  }, []);

  const handleScan = useCallback(
    async (base64: string) => {
      setError(null);
      const { allowed, isPremium } = checkFreeTierLimit();
      if (!allowed) {
        setError(
          isPremium
            ? "Osiągnięto limit. Spróbuj jutro."
            : "Limit 5 skanów/dzień w wersji Free. Odblokuj Premium!"
        );
        return;
      }
      if (!navigator.onLine) {
        setError("Brak połączenia z internetem.");
        return;
      }
      setIsLoading(true);
      try {
        const userProfile = getStorageProfile();
        const profileData = userProfile ? {
          gender: userProfile.gender || "male",
          weight_kg: userProfile.weight_kg || 0,
          height_cm: userProfile.height_cm || 0,
          age: userProfile.age || 0,
          bmi: userProfile.weight_kg && userProfile.height_cm
            ? Math.round(userProfile.weight_kg / ((userProfile.height_cm / 100) ** 2) * 10) / 10
            : 0,
        } : undefined;
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mode: "forma", profileData }),
        });
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error(`server_${res.status}`);
        }
        if (!res.ok) throw new Error(data.error || `error_${res.status}`);

        incrementScanCount();
        updateStreak();

        // Create thumbnail
        const canvas = document.createElement("canvas");
        const img = new Image();
        img.src = base64;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - minDim) / 2,
          (img.height - minDim) / 2,
          minDim,
          minDim,
          0,
          0,
          96,
          96
        );
        const thumbnail = canvas.toDataURL("image/jpeg", 0.5);
        // Use gallery date if set, otherwise current date
        const galleryDateStr = localStorage.getItem("skladai_checkform_date");
        let customDate: string | undefined;
        if (galleryDateStr) {
          customDate = new Date(galleryDateStr + "T12:00:00").toISOString();
          localStorage.removeItem("skladai_checkform_date");
        }
        const historyItem = addToHistory(data, thumbnail, "forma", customDate);
        router.push(`/wyniki/${historyItem.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("504") || msg.includes("timeout")) {
          setError(
            "Nie udało się przeanalizować. Spróbuj ponownie — upewnij się, że zdjęcie jest dobrze widoczne."
          );
        } else {
          setError(msg || "Wystąpił błąd. Spróbuj ponownie.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  return (
    <>
      <BackButton onClick={goBack} />
      <h2 className="text-xl font-bold mb-4">{"📸"} CheckForm</h2>
      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
        Zrób zdjęcie sylwetki, a AI przeanalizuje Twoją kompozycję ciała
      </p>

      <Scanner onScan={handleScan} isLoading={isLoading} mode="forma" autoOpenGallery={autoOpenGallery} />

      <div className="text-center mt-3" style={{
        fontSize: "11px",
        color: "rgba(255,255,255,0.85)",
        textTransform: "uppercase" as const,
        letterSpacing: "1.5px",
        fontWeight: 600,
        textShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}>
        {"✦"} POWERED BY AI VISION
      </div>

      {error && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
        >
          {error}
        </div>
      )}

      {/* CheckForm score chart */}
      {history.length >= 2 && (
        <div className="mt-6">
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Wynik CheckForm — trend</p>
          <ProgressChart
            data={[...history].sort((a, b) => a.date.localeCompare(b.date)).map((h) => ({ date: h.date, value: h.score }))}
            label="/10"
            color="#F97316"
            targetValue={8}
            targetLabel="Cel: 8/10"
          />
        </div>
      )}

      {/* CheckForm History */}
      {history.length > 0 && (
        <div className="mt-6">
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Historia CheckForm
          </h3>
          <div className="space-y-2">
            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => router.push(`/wyniki/${entry.id}`)}
                className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {entry.name}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {new Date(entry.date).toLocaleDateString("pl-PL")}
                  </div>
                </div>
                <div
                  className="text-lg font-bold"
                  style={{ color: "#F97316" }}
                >
                  {entry.score}/10
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
