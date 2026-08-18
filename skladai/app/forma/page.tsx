"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Timer,
  X,
  Camera,
  Trash2,
  Dumbbell,
  Image as ImageIcon,
  PersonStanding,
  Sparkles,
  Flame,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Scanner from "@/components/Scanner";
import dynamic from "next/dynamic";

const ProgressChart = dynamic(() => import("@/components/ProgressChart"), { ssr: false });
import { addToHistory, updateStreak, removeHistoryItem, getProfile as getStorageProfile } from "@/lib/storage";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import WorkoutJournalList from "@/components/forma/WorkoutJournalList";
import ActiveWorkout from "@/components/forma/ActiveWorkout";
import ExerciseHistory from "@/components/forma/ExerciseHistory";
import WorkoutImport from "@/components/forma/WorkoutImport";
import WorkoutSummary from "@/components/forma/WorkoutSummary";
import QuickLog from "@/components/forma/QuickLog";
import WorkoutHistory from "@/components/forma/WorkoutHistory";
import SessionEdit from "@/components/forma/SessionEdit";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────




type View =
  | "main"
  | "checkform"
  | "journal"            // Dziennik treningowy — lista treningów (Faza 2)
  | "workout"            // aktywny trening — logowanie serii (Faza 3)
  | "exercise-history"   // historia ćwiczenia + wykres (Faza 4)
  | "workout-import"     // import treningu ze zdjęcia (AI Vision)
  | "workout-summary"    // skondensowane podsumowanie treningu (zrzut/udostępnij)
  | "quick-log"          // szybki zapis treningu (także minionego)
  | "workout-history"    // wszystkie zapisane sesje treningu + zmiana nazwy
  | "session-edit";      // edycja zapisanego treningu (data, ciężary, ćwiczenia)

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────










// ──────────────────────────────────────────
// LocalStorage helpers
// ──────────────────────────────────────────








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
  const [autoOpenCamera, setAutoOpenCamera] = useState(false);
  // Dziennik treningowy — parametry nawigacji między ekranami (Fazy 2-4).
  const [jWorkoutId, setJWorkoutId] = useState<string | null>(null);
  const [jSessionId, setJSessionId] = useState<string | null>(null);
  const [jExerciseId, setJExerciseId] = useState<string | null>(null);
  const [jSummarySessionId, setJSummarySessionId] = useState<string | null>(null);
  const [jHistoryName, setJHistoryName] = useState<string>("");
  const [jEditSessionId, setJEditSessionId] = useState<string | null>(null);
  // openWorkout: wejście w aktywny trening (z listy / nowy). openExerciseHistory: wykres ćwiczenia.
  const openWorkout = (sessionId: string, workoutId: string) => { setJSessionId(sessionId); setJWorkoutId(workoutId); setView("workout"); };
  const openExerciseHistory = (exerciseId: string) => { setJExerciseId(exerciseId); setView("exercise-history"); };
  const openSummary = (sessionId: string) => { setJSummarySessionId(sessionId); setView("workout-summary"); };
  const openWorkoutHistory = (workoutId: string, name: string) => {
    setJWorkoutId(workoutId); setJHistoryName(name); setView("workout-history");
  };
  const openSessionEdit = (sessionId: string) => { setJEditSessionId(sessionId); setView("session-edit"); };

  // Timer state (persists across views)
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLeft, setTimerLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll to top on view change
  useEffect(() => {
    (document.getElementById("scroll-container") || window).scrollTo(0, 0);
  }, [view]);

  // Ukryj pływający czat AI (AgentFAB) na immersyjnych ekranach dziennika —
  // logowanie serii / podsumowanie mają być bez rozpraszaczy. AgentFAB czyta tę klasę.
  useEffect(() => {
    const immersive = ["journal", "workout", "exercise-history", "workout-import", "workout-summary"].includes(view);
    document.body.classList.toggle("forma-immersive", immersive);
    return () => document.body.classList.remove("forma-immersive");
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



  const goBack = () => { setView("main"); setAutoOpenGallery(false); setAutoOpenCamera(false); };

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
    // min-h-screen to 100vh (cała wysokość okna), a ten kawałek żyje w
    // #scroll-container, który kończy się 68 px wyżej — nad dolną nawigacją.
    // Efekt: strona zawsze miała 68 px do przewinięcia. Na ekranie podsumowania,
    // który ma się mieścić w całości, bierzemy wysokość kontenera zamiast okna.
    <div
      className={`relative overflow-hidden ${view === "workout-summary" ? "min-h-full" : "min-h-screen"}`}
      style={{ background: "var(--bg, #0a0e0c)", color: "var(--fg, #fff)" }}
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute" style={{
        top: "-40px", right: "-60px", width: "220px", height: "220px",
        background: "radial-gradient(circle, rgba(var(--c-orange-rgb, 249,115,22),0.07), transparent 70%)",
        filter: "blur(40px)",
        animation: "floatBlob1 8s ease-in-out infinite",
      }} />
      <div className="pointer-events-none absolute" style={{
        bottom: "120px", left: "-80px", width: "180px", height: "180px",
        background: "radial-gradient(circle, rgba(var(--c-orange-rgb, 249,115,22),0.07), transparent 70%)",
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
        // Podsumowanie treningu ma się mieścić na jednym ekranie — pod nim nie
        // rezerwujemy 200 px zapasu na przewijanie, bo to jedyne, co zostawiałoby
        // stronie powód do scrollowania.
        paddingBottom: view === "workout-summary" ? 0 : "200px",
      }}>
        {view === "main" && (
          <MainView
            setView={setView}
            onRunnerClick={() => router.push("/biegacz")}
            router={router}
            onGalleryCheckForm={() => { setAutoOpenCamera(false); setAutoOpenGallery(true); setView("checkform"); }}
            onCameraCheckForm={() => { setAutoOpenGallery(false); setAutoOpenCamera(true); setView("checkform"); }}
          />
        )}
        {view === "checkform" && (
          <CheckFormView goBack={goBack} router={router} autoOpenGallery={autoOpenGallery} autoOpenCamera={autoOpenCamera} />
        )}
        {view === "journal" && (
          <WorkoutJournalList goBack={goBack} openWorkout={openWorkout} onImport={() => setView("workout-import")} onOpenSummary={openSummary} onQuickLog={() => setView("quick-log")} onOpenHistory={openWorkoutHistory} />
        )}
        {view === "quick-log" && (
          <QuickLog goBack={() => setView("journal")} onSaved={() => setView("journal")} />
        )}
        {view === "workout-import" && (
          <WorkoutImport goBack={() => setView("journal")} onSaved={() => setView("journal")} />
        )}
        {view === "workout" && jSessionId && jWorkoutId && (
          <ActiveWorkout
            goBack={() => setView("journal")}
            sessionId={jSessionId}
            workoutId={jWorkoutId}
            openExerciseHistory={openExerciseHistory}
            onOpenSummary={openSummary}
            onOpenTimer={() => setTimerOpen(true)}
          />
        )}
        {view === "exercise-history" && jExerciseId && (
          <ExerciseHistory goBack={() => setView(jSessionId ? "workout" : "journal")} exerciseId={jExerciseId} workoutId={jWorkoutId} />
        )}
        {view === "workout-history" && jWorkoutId && (
          <WorkoutHistory
            workoutId={jWorkoutId}
            workoutName={jHistoryName}
            goBack={() => setView("journal")}
            onEditSession={openSessionEdit}
            onArchived={() => setView("journal")}
          />
        )}
        {view === "session-edit" && jEditSessionId && (
          <SessionEdit
            sessionId={jEditSessionId}
            goBack={() => setView(jWorkoutId ? "workout-history" : "journal")}
            onSaved={() => setView(jWorkoutId ? "workout-history" : "journal")}
          />
        )}
        {view === "workout-summary" && jSummarySessionId && (
          <WorkoutSummary goBack={() => setView("journal")} sessionId={jSummarySessionId} />
        )}
      </div>

      {/* Pływający timer — TYLKO gdy odpalony (odliczanie). Uruchamia się z nagłówka
          (main) lub przycisku ⏱ w aktywnym treningu; poza tym nie zaśmieca ekranu. */}
      {timerRunning && <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTimerOpen(true); }}
        className="fixed z-[100] flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
        style={{
          bottom: "100px",
          right: "16px",
          width: "56px",
          height: "56px",
          background: timerRunning
            ? `conic-gradient(var(--c-orange, #F97316) ${((timerSeconds - timerLeft) / timerSeconds) * 360}deg, var(--c-red, #EF4444) ${((timerSeconds - timerLeft) / timerSeconds) * 360}deg)`
            : "linear-gradient(135deg, var(--c-orange, #F97316), var(--c-red, #EF4444))",
          boxShadow: "0 6px 24px rgba(var(--c-orange-rgb, 249,115,22),0.3)",
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
        background: "rgba(var(--fg-rgb, 255,255,255),0.025)",
        border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.05)",
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
          <div className="mt-0.5" style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.3)", fontSize: "11px" }}>
            {subtitle}
          </div>
        )}
      </div>
      <span style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.2)", fontSize: "15px" }}>{"›"}</span>
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
      style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.7)" }}
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
  onRunnerClick,
  router,
  onGalleryCheckForm,
  onCameraCheckForm,
}: {
  setView: (v: View) => void;
  onRunnerClick?: () => void;
  router: AppRouterInstance;
  onGalleryCheckForm?: () => void;
  onCameraCheckForm?: () => void;
}) {
  const [checkFormHistory, setCheckFormHistory] = useState<CheckFormEntry[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [galleryDate, setGalleryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // odczyt localStorage odroczony o klatkę — bez synchronicznego setState w efekcie
  useEffect(() => {
    const raf = requestAnimationFrame(() => setCheckFormHistory(getCheckFormHistory()));
    return () => cancelAnimationFrame(raf);
  }, []);

  const recentCheckForms = checkFormHistory.slice(0, 2);

  const getScoreColor = (score: number) => score >= 8 ? "#22c55e" : score >= 5 ? "var(--c-orange, #f97316)" : "var(--c-red, #ef4444)";

  const handleDeleteResult = (id: string) => {
    removeHistoryItem(id);
    setCheckFormHistory(getCheckFormHistory());
    setDeleteConfirm(null);
  };

  return (
    <>
      {/* Nagłówek „🔥 Forma" usunięty — dolna nawigacja już mówi, gdzie jesteś,
          a pasek tylko zabierał pierwszy ekran. Timer odpoczynku zostaje dostępny
          tam, gdzie się go używa: przycisk ⏱ w aktywnym treningu oraz pływający
          guzik w trakcie odliczania. */}

      {/* HERO: CheckForm */}
      <div className="relative mb-6" style={{ animation: "fadeInUp 0.5s ease both" }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 -z-10" style={{
          background: "radial-gradient(ellipse at center, rgba(var(--c-orange-rgb, 249,115,22),0.12), transparent 70%)",
          animation: "breathe 4s ease-in-out infinite",
          filter: "blur(20px)",
          transform: "scale(1.2)",
        }} />
        <div className="relative" style={{
          padding: "24px",
          borderRadius: "20px",
          background: "linear-gradient(145deg, rgba(var(--c-orange-rgb, 249,115,22),0.1), rgba(var(--c-orange-rgb, 249,115,22),0.03))",
          border: "1.5px solid rgba(var(--c-orange-rgb, 249,115,22),0.18)",
          backdropFilter: "blur(16px)",
          overflow: "hidden",
        }}>
          {/* Scanner corners */}
          <div className="absolute" style={{ top: 10, left: 10, width: 22, height: 22, borderTop: "2.5px solid var(--c-orange, #f97316)", borderLeft: "2.5px solid var(--c-orange, #f97316)", borderRadius: "4px 0 0 0" }} />
          <div className="absolute" style={{ top: 10, right: 10, width: 22, height: 22, borderTop: "2.5px solid var(--c-orange, #f97316)", borderRight: "2.5px solid var(--c-orange, #f97316)", borderRadius: "0 4px 0 0" }} />
          <div className="absolute" style={{ bottom: 10, left: 10, width: 22, height: 22, borderBottom: "2.5px solid var(--c-orange, #f97316)", borderLeft: "2.5px solid var(--c-orange, #f97316)", borderRadius: "0 0 0 4px" }} />
          <div className="absolute" style={{ bottom: 10, right: 10, width: 22, height: 22, borderBottom: "2.5px solid var(--c-orange, #f97316)", borderRight: "2.5px solid var(--c-orange, #f97316)", borderRadius: "0 0 4px 0" }} />
          {/* Decorative circles */}
          <div className="absolute pointer-events-none" style={{ top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(var(--c-orange-rgb, 249,115,22),0.06)" }} />
          <div className="absolute pointer-events-none" style={{ bottom: -10, left: -10, width: 45, height: 45, borderRadius: "50%", background: "rgba(var(--c-orange-rgb, 249,115,22),0.04)" }} />

          {/* Content */}
          <div className="relative z-10">
            <style>{`
              @keyframes cfScan { 0% { top: 12%; opacity: .45 } 50% { opacity: 1 } 100% { top: 84%; opacity: .45 } }
              .cf-scanbar { animation: cfScan 2.6s ease-in-out infinite alternate; }
              @media (prefers-reduced-motion: reduce) { .cf-scanbar { animation: none; top: 48% } }
            `}</style>

            {/* Eyebrow */}
            <div style={{ textAlign: "center", fontSize: "10px", fontWeight: 700, letterSpacing: "2px", color: "var(--c-orange, #f97316)", textTransform: "uppercase", marginBottom: "14px" }}>
              {"✦"} CHECKFORM · AI VISION
            </div>

            {/* BodyScan — sylwetka + animowana linia skanu + odczyty */}
            <div style={{ position: "relative", width: "100%", maxWidth: 240, margin: "0 auto 18px" }}>
              <svg viewBox="0 0 230 190" width="100%" style={{ display: "block", overflow: "visible" }} aria-hidden="true">
                <defs>
                  <linearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-orange, #f97316)" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="var(--c-orange-3, #ea580c)" stopOpacity="0.18" />
                  </linearGradient>
                  <radialGradient id="bgGlow" cx="50%" cy="42%" r="55%">
                    <stop offset="0%" stopColor="var(--c-orange, #f97316)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="var(--c-orange, #f97316)" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <ellipse cx="115" cy="92" rx="84" ry="86" fill="url(#bgGlow)" />
                {/* sylwetka */}
                <circle cx="115" cy="32" r="12" fill="url(#bodyG)" stroke="var(--c-orange, #f97316)" strokeOpacity="0.5" strokeWidth="1" />
                <path d="M115 43 C 121 43 124 47 128 51 C 139 55 150 62 154 74 C 156 81 150 85 144 83 C 139 81 136 76 134 70 C 133 82 132 95 131 106 C 138 110 139 116 139 124 C 139 140 137 158 135 173 L 124 173 C 124 160 123 146 121 136 C 119 132 117 132 115 132 C 113 132 111 132 109 136 C 107 146 106 160 106 173 L 95 173 C 93 158 91 140 91 124 C 91 116 92 110 99 106 C 98 95 97 82 96 70 C 94 76 91 81 86 83 C 80 85 74 81 76 74 C 80 62 91 55 102 51 C 106 47 109 43 115 43 Z" fill="url(#bodyG)" stroke="var(--c-orange, #f97316)" strokeOpacity="0.5" strokeWidth="1" />
                {/* linie definicji mięśni */}
                <g stroke="var(--c-orange, #f97316)" strokeOpacity="0.35" strokeWidth="1" fill="none" strokeLinecap="round">
                  <path d="M115 54 L115 116" />
                  <path d="M101 66 Q115 74 129 66" />
                  <path d="M104 88 L126 88 M105 98 L125 98 M106 108 L124 108" />
                </g>
                {/* narożniki skanu */}
                <g stroke="var(--c-orange, #f97316)" strokeWidth="2.4" fill="none" strokeLinecap="round">
                  <path d="M64 26 L64 18 L72 18" /><path d="M166 18 L174 18 L174 26" />
                  <path d="M64 174 L64 182 L72 182" /><path d="M166 182 L174 182 L174 174" />
                </g>
                {/* liderzy + węzły */}
                <g>
                  <circle cx="133" cy="74" r="3" fill="var(--c-orange, #f97316)" />
                  <path d="M133 74 L176 58" stroke="var(--c-orange, #f97316)" strokeOpacity="0.6" strokeWidth="1" fill="none" />
                  <circle cx="97" cy="110" r="3" fill="var(--c-orange, #f97316)" />
                  <path d="M97 110 L54 126" stroke="var(--c-orange, #f97316)" strokeOpacity="0.6" strokeWidth="1" fill="none" />
                </g>
              </svg>
              {/* animowana linia skanu */}
              <div className="cf-scanbar" style={{ position: "absolute", left: "16%", right: "16%", top: "12%", height: 2, borderRadius: 2, background: "linear-gradient(90deg, transparent, var(--c-orange, #f97316), transparent)", boxShadow: "0 0 14px 2px rgba(var(--c-orange-rgb, 249,115,22),0.5)" }} />
              {/* pigułki odczytów */}
              <div style={{ position: "absolute", top: "14%", right: "-4%", display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 99, fontSize: "11px", fontWeight: 700, color: "var(--fg, #fff)", background: "rgba(var(--bg-rgb, 10,14,12),0.7)", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.4)", backdropFilter: "blur(4px)", whiteSpace: "nowrap" }}>💪 Mięśnie: ~38&nbsp;kg</div>
              <div style={{ position: "absolute", top: "56%", left: "-4%", display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 99, fontSize: "11px", fontWeight: 700, color: "var(--fg, #fff)", background: "rgba(var(--bg-rgb, 10,14,12),0.7)", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.4)", backdropFilter: "blur(4px)", whiteSpace: "nowrap" }}>🔥 Tłuszcz: ~14%</div>
            </div>

            {/* Tytuł + podtekst */}
            <h2 style={{ textAlign: "center", fontSize: "21px", fontWeight: 800, color: "var(--fg, #fff)", letterSpacing: "-0.01em" }}>Zrób zdjęcie w lustrze</h2>
            <p style={{ textAlign: "center", fontSize: "12.5px", lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.55)", margin: "8px 2px 18px" }}>
              AI oszacuje Twój poziom <strong style={{ color: "var(--fg, #fff)" }}>tkanki tłuszczowej</strong> i <strong style={{ color: "var(--fg, #fff)" }}>masy mięśniowej</strong>, a do tego da wynik <strong style={{ color: "var(--fg, #fff)" }}>0–10</strong> z wskazówkami.
            </p>

            {/* CTA główne */}
            <button
              onClick={() => { if (onCameraCheckForm) onCameraCheckForm(); else setView("checkform"); }}
              className="w-full transition-all active:scale-[0.97]"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px", borderRadius: "16px", border: "none", color: "#fff", fontWeight: 800, fontSize: "15.5px",
                background: "linear-gradient(135deg, var(--c-orange, #f97316), var(--c-orange-3, #ea580c))",
                boxShadow: "0 6px 24px rgba(var(--c-orange-rgb, 249,115,22),0.4)", cursor: "pointer",
              }}
            >
              <Camera size={19} /> Zrób zdjęcie
            </button>

            {/* link galeria */}
            <button
              onClick={() => setShowDatePicker(true)}
              className="w-full active:scale-95 transition-transform"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, background: "none", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.5)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              <ImageIcon size={15} /> lub wybierz z galerii
            </button>
          </div>
        </div>
      </div>

      {/* CO OSZACUJE AI */}
      <div style={{ marginBottom: 22, animation: "fadeInUp 0.5s ease both", animationDelay: "0.08s" }}>
        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase" as const, color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginBottom: 12 }}>CO OSZACUJE AI</div>
        <div style={{ display: "flex", gap: 10 }}>
          {([
            { Icon: Flame, title: "Tkanka tłuszczowa", ex: "np. ~14%" },
            { Icon: Dumbbell, title: "Masa mięśniowa", ex: "np. ~38 kg" },
          ]).map((c, i) => (
            <div key={i} style={{ flex: 1, padding: "14px 12px", borderRadius: 16, background: "linear-gradient(145deg, rgba(var(--c-orange-rgb, 249,115,22),0.08), rgba(var(--c-orange-rgb, 249,115,22),0.02))", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.25)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--c-orange-rgb, 249,115,22),0.14)", marginBottom: 10 }}>
                <c.Icon size={20} style={{ color: "var(--c-orange, #f97316)" }} />
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--fg, #fff)" }}>{c.title}</div>
              <div style={{ fontSize: "11.5px", color: "rgba(var(--fg-rgb, 255,255,255),0.45)", marginTop: 3 }}>{c.ex}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "10.5px", color: "rgba(var(--fg-rgb, 255,255,255),0.35)", marginTop: 10, textAlign: "center" }}>
          Wartości szacunkowe na podstawie zdjęcia — to nie pomiar medyczny.
        </p>
      </div>

      {/* JAK TO DZIAŁA */}
      <div style={{ marginBottom: 24, animation: "fadeInUp 0.5s ease both", animationDelay: "0.12s" }}>
        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase" as const, color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginBottom: 14 }}>JAK TO DZIAŁA</div>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { n: 1, Icon: PersonStanding, t: "Stań przed lustrem", s: "całą sylwetką" },
            { n: 2, Icon: Camera, t: "Zrób zdjęcie", s: "telefonem w lustrze" },
            { n: 3, Icon: Sparkles, t: "Odbierz analizę", s: "skład ciała + wynik" },
          ]).map((step) => (
            <div key={step.n} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ position: "relative", width: 44, height: 44, margin: "0 auto 8px", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
                <step.Icon size={20} style={{ color: "var(--c-orange, #f97316)" }} />
                <span style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--c-orange, #f97316)", color: "#fff", fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{step.n}</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg, #fff)" }}>{step.t}</div>
              <div style={{ fontSize: "10.5px", color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginTop: 2 }}>{step.s}</div>
            </div>
          ))}
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
            style={{ background: "#1a1a1a", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Kiedy zrobiono zdjęcie?</h3>
            <p className="text-xs mb-4" style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>
              Wybierz datę wykonania zdjęcia
            </p>
            <input
              type="date"
              value={galleryDate}
              onChange={(e) => setGalleryDate(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-4"
              style={{
                background: "rgba(var(--fg-rgb, 255,255,255),0.06)",
                border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)",
                color: "var(--fg, #fff)",
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
              style={{ background: "linear-gradient(135deg, var(--c-orange, #f97316), var(--c-orange-3, #ea580c))" }}
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
            fontSize: "10px", color: "rgba(var(--fg-rgb, 255,255,255),0.3)",
            textTransform: "uppercase", letterSpacing: "2px", fontWeight: 600,
          }}>OSTATNIE WYNIKI</div>
          <div className="grid grid-cols-2 gap-2.5">
            {recentCheckForms.map((entry) => (
              <div
                key={entry.id}
                className="relative flex flex-col p-3 rounded-[14px] text-left transition-all"
                style={{
                  background: "rgba(var(--fg-rgb, 255,255,255),0.03)",
                  border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.06)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <button
                  onClick={() => router.push(`/wyniki/${entry.id}`)}
                  className="flex-1 text-left active:scale-[0.97] transition-all"
                >
                  <div className="text-xs font-medium text-white">CheckForm</div>
                  <div style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.3)", fontSize: "10px", marginTop: "2px" }}>
                    {new Date(entry.date).toLocaleDateString("pl-PL")}
                  </div>
                  <div className="text-lg font-bold mt-1" style={{ color: getScoreColor(entry.score) }}>
                    {entry.score}/10
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(entry.id); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg transition-all active:scale-90"
                  style={{ background: "rgba(var(--c-red-rgb, 239,68,68),0.1)" }}
                >
                  <Trash2 size={12} style={{ color: "var(--c-red, #ef4444)" }} />
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
                  style={{ background: "#1a1a1a", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm text-white mb-4">
                    Usunąć wynik CheckForm z {new Date(entry.date).toLocaleDateString("pl-PL")}?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: "rgba(var(--fg-rgb, 255,255,255),0.06)", color: "rgba(var(--fg-rgb, 255,255,255),0.7)" }}
                    >
                      Nie
                    </button>
                    <button
                      onClick={() => handleDeleteResult(deleteConfirm)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: "rgba(var(--c-red-rgb, 239,68,68),0.2)", color: "var(--c-red, #ef4444)" }}
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
          background: "rgba(var(--fg-rgb, 255,255,255),0.03)",
          border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.06)",
        }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>Wynik CheckForm — trend</p>
          <ProgressChart
            data={checkFormHistory.map((h) => ({ date: h.date, value: h.score }))}
            label="/10"
            color="#f97316"
            targetValue={8}
            targetLabel="Cel: 8/10"
          />
        </div>
      )}

      {/* Dziennik treningowy — główny punkt wejścia (nad NARZĘDZIA) */}
      <button
        onClick={() => setView("journal")}
        data-testid="forma-open-journal"
        className="w-full text-left active:scale-[0.98] transition-transform"
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 18px", borderRadius: 18, marginBottom: 20, cursor: "pointer",
          background: "linear-gradient(135deg, rgba(var(--c-orange-rgb, 249,115,22),0.16), rgba(var(--c-orange-rgb, 249,115,22),0.04))",
          border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.35)",
          boxShadow: "0 6px 22px rgba(var(--c-orange-rgb, 249,115,22),0.14)",
          animation: "fadeInUp 0.4s ease both", animationDelay: "0.18s",
        }}
      >
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          background: "linear-gradient(135deg, var(--c-orange, #f97316), var(--c-orange-3, #ea580c))",
          boxShadow: "0 4px 14px rgba(var(--c-orange-rgb, 249,115,22),0.35)",
        }}>{"📓"}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--fg, #fff)" }}>Dziennik treningowy</div>
          <div style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.55)", marginTop: 2 }}>Loguj serie, śledź progres i rekordy</div>
        </div>
        <span style={{ color: "var(--c-orange, #f97316)", fontSize: 22, flexShrink: 0 }}>›</span>
      </button>

      {/* Separator */}
      <div className="flex items-center gap-3 mb-4" style={{ animation: "fadeInUp 0.4s ease both", animationDelay: "0.25s" }}>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(var(--fg-rgb, 255,255,255),0.08), transparent)" }} />
        <span style={{
          fontSize: "9px",
          color: "rgba(var(--fg-rgb, 255,255,255),0.55)",
          textTransform: "uppercase",
          letterSpacing: "2.5px",
          fontWeight: 600,
        }}>NARZĘDZIA</span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(var(--fg-rgb, 255,255,255),0.08), transparent)" }} />
      </div>

      {/* Tool cards */}
      <div className="flex flex-col gap-2.5">
        {onRunnerClick && <Card icon={"🏃"} title="Strefa Biegacza" subtitle="Tempo, tętno, plany" accentColor="#22c55e" animDelay={0} onClick={onRunnerClick} />}
        <Card icon={"🍺"} title="Alkomat" subtitle="Oblicz promile i kalorie" accentColor="#fbbf24" animDelay={1} onClick={() => router.push("/promile")} />
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
        style={{ background: "#1A1A1A", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Timer size={20} style={{ color: "var(--c-orange, #F97316)" }} /> Przerwa
          </h2>
          <button onClick={onClose} className="p-1">
            <X size={20} style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }} />
          </button>
        </div>

        {/* Countdown */}
        <div className="text-center mb-6">
          <div
            className="font-mono font-bold"
            style={{
              fontSize: "48px",
              color: timerLeft === 0 && !timerRunning ? "rgba(var(--fg-rgb, 255,255,255),0.3)" : timerLeft <= 10 && timerRunning ? "var(--c-red, #EF4444)" : "var(--c-orange, #F97316)",
            }}
          >
            {formatTime(timerLeft > 0 ? timerLeft : timerSeconds)}
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full mt-3" style={{ background: "rgba(var(--fg-rgb, 255,255,255),0.1)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--c-orange, #F97316), var(--c-red, #EF4444))" }}
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
                    background: timerSeconds === s ? "var(--c-orange, #F97316)" : "rgba(var(--fg-rgb, 255,255,255),0.06)",
                    color: timerSeconds === s ? "#fff" : "rgba(var(--fg-rgb, 255,255,255),0.7)",
                    border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)",
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
                  background: "rgba(var(--fg-rgb, 255,255,255),0.06)",
                  border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)",
                  color: "var(--fg, #fff)",
                }}
              />
              <button
                onClick={() => {
                  const n = parseInt(customSec, 10);
                  if (n > 0 && n <= 600) startTimer(n);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--c-orange, #F97316)", color: "var(--fg, #fff)" }}
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
                style={{ background: "var(--c-amber-2, #F59E0B)", color: "#000" }}
              >
                Pauza
              </button>
            ) : (
              <button
                onClick={() => setTimerRunning(true)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "linear-gradient(135deg, var(--c-orange, #F97316), var(--c-red, #EF4444))", color: "var(--fg, #fff)" }}
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
              style={{ background: "rgba(var(--c-red-rgb, 239,68,68),0.2)", color: "var(--c-red, #EF4444)" }}
            >
              Reset
            </button>
          </div>
        )}

        {timerLeft === 0 && !timerRunning && (
          <p className="text-center text-xs mt-4" style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.55)" }}>
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


// ──────────────────────────────────────────
// RECORDS VIEW
// ──────────────────────────────────────────


// ──────────────────────────────────────────
// MEASUREMENTS VIEW
// ──────────────────────────────────────────


// ──────────────────────────────────────────
// PHOTOS VIEW
// ──────────────────────────────────────────


// ──────────────────────────────────────────
// STRENGTH CARD VIEW
// ──────────────────────────────────────────


// ──────────────────────────────────────────
// CHECKFORM VIEW (AI Body Analysis)
// ──────────────────────────────────────────

function CheckFormView({
  goBack,
  router,
  autoOpenGallery,
  autoOpenCamera,
}: {
  goBack: () => void;
  router: AppRouterInstance;
  autoOpenGallery?: boolean;
  autoOpenCamera?: boolean;
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
      // CheckForm scans do NOT count toward the 20-scan free limit.
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

        // CheckForm doesn't increment the 20-scan free limit.
        updateStreak();

        // Create thumbnail — keep high res for hero card display
        const canvas = document.createElement("canvas");
        const img = new Image();
        img.src = base64;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        const maxDim = 480;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.92);
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
      <p className="text-sm mb-4" style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>
        Zrób zdjęcie sylwetki, a AI przeanalizuje Twoją kompozycję ciała
      </p>

      <Scanner onScan={handleScan} isLoading={isLoading} mode="forma" autoOpenGallery={autoOpenGallery} autoOpenCamera={autoOpenCamera} />

      <div className="text-center mt-3" style={{
        fontSize: "11px",
        color: "rgba(var(--fg-rgb, 255,255,255),0.85)",
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
          style={{ background: "rgba(var(--c-red-rgb, 239,68,68),0.15)", color: "var(--c-red, #EF4444)" }}
        >
          {error}
        </div>
      )}

      {/* CheckForm score chart */}
      {history.length >= 2 && (
        <div className="mt-6">
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>Wynik CheckForm — trend</p>
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
            style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}
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
                  background: "rgba(var(--fg-rgb, 255,255,255),0.04)",
                  border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)",
                }}
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {entry.name}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}
                  >
                    {new Date(entry.date).toLocaleDateString("pl-PL")}
                  </div>
                </div>
                <div
                  className="text-lg font-bold"
                  style={{ color: "var(--c-orange, #F97316)" }}
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
