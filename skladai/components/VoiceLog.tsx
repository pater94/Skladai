"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

// Safe import for alcoholGrams
let alcoholGrams: (ml: number, abv: number) => number;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  alcoholGrams = require("@/lib/bac").alcoholGrams;
} catch {
  alcoholGrams = (ml: number, abv: number) => ml * (abv / 100) * 0.789;
}

// ======================== TYPES ========================

interface VoiceItem {
  id: string;
  emoji: string;
  name: string;
  weight_g: number;
  min_g: number;
  max_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  // Alcohol-specific
  ml?: number;
  abv?: number;
}

type MealTypeKey = "breakfast" | "lunch" | "dinner" | "snack";

interface VoiceLogProps {
  mode: "food" | "alcohol";
  onComplete: (
    items: VoiceItem[],
    mealType?: MealTypeKey
  ) => void;
  onClose?: () => void;
  initialOpen?: boolean;
  hideButton?: boolean;
}

// ======================== HELPERS ========================

const MEAL_TYPES: { key: MealTypeKey; label: string }[] = [
  { key: "breakfast", label: "Śniadanie" },
  { key: "lunch", label: "Obiad" },
  { key: "dinner", label: "Kolacja" },
  { key: "snack", label: "Przekąska" },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function calc(per100: number, weightG: number): number {
  return Math.round((per100 * weightG) / 100);
}

function sumField(items: VoiceItem[], field: "calories_per_100g" | "protein_per_100g" | "fat_per_100g" | "carbs_per_100g"): number {
  return items.reduce((s, i) => s + calc(i[field], i.weight_g), 0);
}

function totalAlcoholGrams(items: VoiceItem[]): number {
  return items.reduce((s, i) => {
    if (i.ml && i.abv) return s + alcoholGrams(i.ml, i.abv);
    return s;
  }, 0);
}

function estimateBAC(alcoholG: number, weightKg: number, gender: "male" | "female"): number {
  const r = gender === "male" ? 0.68 : 0.55;
  if (weightKg <= 0) return 0;
  return Math.round((alcoholG / (weightKg * r)) * 100) / 100;
}

// ======================== SPEECH SUPPORT CHECK ========================

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const W = window as any;
  return W.SpeechRecognition || W.webkitSpeechRecognition || null;
}

// ======================== SINE WAVE COMPONENT ========================

function SineWave({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;
    const draw = () => {
      t += 0.06;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * 0.04 + t) * (h * 0.3) * (0.5 + 0.5 * Math.sin(t * 0.5));
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={48}
      className="w-full max-w-[280px] h-12 mx-auto"
    />
  );
}

// ======================== VOICELOG COMPONENT ========================

export default function VoiceLog({ mode, onComplete, onClose, initialOpen = false, hideButton = false }: VoiceLogProps) {
  const [open, setOpen] = useState(initialOpen);
  const [phase, setPhase] = useState<"idle" | "recording" | "processing" | "results">("idle");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<VoiceItem[]>([]);
  const [mealType, setMealType] = useState<MealTypeKey>("lunch");
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check browser support
  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* noop */ }
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    // 3.5s silence timeout (gives user time to think between words)
    silenceTimerRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
    }, 3500);
  }, []);

  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- START RECORDING ----
  const startRecording = useCallback(() => {
    setError("");
    setTranscript("");
    setInterimText("");

    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        setError("🍎 Nagrywanie głosu wymaga Safari na iPhone. Otwórz SkładAI w Safari.");
      } else {
        setError("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
      }
      return;
    }

    let recognition: SpeechRecognitionInstance;
    try {
      recognition = new SpeechRec();
    } catch {
      setError("Nie udało się uruchomić rozpoznawania mowy.");
      return;
    }

    recognition.lang = "pl-PL";
    recognition.interimResults = true;
    recognition.continuous = true; // Keep listening for multiple sentences
    recognition.maxAlternatives = 1;

    let finalText = "";
    let gotAnyResult = false;
    let manualStop = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      gotAnyResult = true;
      // Reset silence timer — user is still speaking
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // 5s of silence after last speech → stop
        if (recognitionRef.current && !manualStop) {
          try { recognitionRef.current.stop(); } catch { /* noop */ }
        }
      }, 5000);

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t + " ";
        } else {
          interim += t;
        }
      }
      setTranscript(finalText.trim());
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const errCode = event.error;
      if (errCode === "not-allowed" || errCode === "service-not-allowed") {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isChrome = /CriOS/.test(navigator.userAgent);
        if (isIOS && isChrome) {
          setError("🍎 Nagrywanie głosu działa tylko w Safari na iPhone.");
        } else if (isIOS) {
          setError("Zezwól na dostęp do mikrofonu: Ustawienia → Safari → Mikrofon");
        } else {
          setError("Brak uprawnień do mikrofonu. Zezwól w ustawieniach przeglądarki.");
        }
        setPhase("idle");
      } else if (errCode === "no-speech") {
        // If we already have some text, just submit what we have
        if (finalText.trim().length > 0) {
          setTranscript(finalText.trim());
          sendToAPI(finalText.trim());
        } else {
          setError("Nie wykryto mowy. Kliknij mikrofon i mów wyraźnie.");
          setPhase("idle");
        }
      } else if (errCode === "aborted") {
        // User cancelled or auto-restart — check if we have text
        if (finalText.trim().length > 0 && manualStop) {
          setTranscript(finalText.trim());
          sendToAPI(finalText.trim());
        }
      } else {
        // Network error etc — try to submit what we have
        if (finalText.trim().length > 0) {
          setTranscript(finalText.trim());
          sendToAPI(finalText.trim());
        } else {
          setError("Błąd mikrofonu. Spróbuj ponownie.");
          setPhase("idle");
        }
      }
    };

    recognition.onend = () => {
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const text = finalText.trim();

      if (text.length > 0) {
        setTranscript(text);
        sendToAPI(text);
      } else if (!gotAnyResult) {
        setError("Nie wykryto mowy. Kliknij mikrofon i mów wyraźnie.");
        setPhase("idle");
      } else {
        setPhase("idle");
      }
    };

    recognitionRef.current = recognition;
    // Store manualStop setter for stopRecording
    (recognition as unknown as Record<string, unknown>)._setManualStop = () => { manualStop = true; };

    try {
      recognition.start();
      setPhase("recording");
    } catch {
      setError("Nie udało się uruchomić mikrofonu. Spróbuj ponownie.");
      return;
    }

    // Max recording time: 30 seconds
    maxTimerRef.current = setTimeout(() => {
      manualStop = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
    }, 30000);

    // Initial wait: 10 seconds before giving up if no speech at all
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (!gotAnyResult && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
    }, 10000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSilenceTimer]);

  // ---- STOP RECORDING ----
  const stopRecording = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (recognitionRef.current) {
      // Signal manual stop so onend/onerror knows to submit
      const rec = recognitionRef.current as unknown as Record<string, unknown>;
      if (typeof rec._setManualStop === "function") (rec._setManualStop as () => void)();
      try { recognitionRef.current.stop(); } catch { /* noop */ }
    }
  }, []);

  // ---- SEND TO API ----
  const sendToAPI = useCallback(async (text: string) => {
    setPhase("processing");
    setError("");

    const apiMode = mode === "food" ? "voice_food" : "voice_alcohol";

    // Abort controller with 28s timeout (Vercel limit is 60s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: apiMode }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 504) {
          throw new Error("Serwer nie zdążył odpowiedzieć. Spróbuj ponownie — powiedz krócej.");
        }
        throw new Error(data.error || "Nie udało się przeanalizować. Spróbuj ponownie.");
      }

      const data = await res.json();

      // Parse results into VoiceItems
      let parsed: VoiceItem[] = [];

      if (mode === "food" && data.items && Array.isArray(data.items)) {
        parsed = data.items.map((it: Record<string, unknown>) => ({
          id: uid(),
          emoji: (it.emoji as string) || "🍽️",
          name: (it.name as string) || "Produkt",
          weight_g: (it.default_portion_g as number) || (it.estimated_weight_g as number) || 100,
          min_g: (it.min_portion_g as number) || (it.min_reasonable_g as number) || 10,
          max_g: (it.max_portion_g as number) || (it.max_reasonable_g as number) || 1000,
          calories_per_100g: (it.calories_per_100g as number) || 0,
          protein_per_100g: (it.protein_per_100g as number) || 0,
          fat_per_100g: (it.fat_per_100g as number) || 0,
          carbs_per_100g: (it.carbs_per_100g as number) || 0,
        }));
      } else if (mode === "alcohol") {
        // Alcohol search returns single item or items array
        const alcItems = data.items ? data.items : [data];
        parsed = alcItems.map((it: Record<string, unknown>) => ({
          id: uid(),
          emoji: (it.emoji as string) || "🍺",
          name: (it.name as string) || "Alkohol",
          weight_g: (it.ml as number) || (it.default_portion_g as number) || 100,
          min_g: 10,
          max_g: (it.ml as number) ? (it.ml as number) * 3 : 1000,
          calories_per_100g: (it.calories_per_100g as number) ||
            ((it.calories as number) && (it.ml as number) ? Math.round(((it.calories as number) / (it.ml as number)) * 100) : 40),
          protein_per_100g: 0,
          fat_per_100g: 0,
          carbs_per_100g: (it.carbs_per_100g as number) || 0,
          ml: (it.ml as number) || (it.volume_ml as number) || 500,
          abv: (it.abv as number) || (it.alcohol_percent as number) || 5,
        }));
      }

      if (parsed.length === 0) {
        // Fallback: create a single item from top-level data
        parsed = [{
          id: uid(),
          emoji: mode === "food" ? "🍽️" : "🍺",
          name: (data.name as string) || text,
          weight_g: 100,
          min_g: 10,
          max_g: 1000,
          calories_per_100g: (data.calories_per_100g as number) || 0,
          protein_per_100g: (data.protein_per_100g as number) || 0,
          fat_per_100g: (data.fat_per_100g as number) || 0,
          carbs_per_100g: (data.carbs_per_100g as number) || 0,
        }];
      }

      setItems(parsed);
      setPhase("results");
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Analiza trwa za długo. Spróbuj ponownie — powiedz krócej.");
      } else {
        setError(err instanceof Error ? err.message : "Nie udało się przeanalizować. Spróbuj ponownie.");
      }
      setPhase("idle");
    }
  }, [mode]);

  // ---- ITEM HANDLERS ----
  const updateItem = useCallback((id: string, updates: Partial<VoiceItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [
      ...prev,
      {
        id: uid(),
        emoji: mode === "food" ? "🍽️" : "🍺",
        name: "Nowy produkt",
        weight_g: 100,
        min_g: 10,
        max_g: 1000,
        calories_per_100g: 0,
        protein_per_100g: 0,
        fat_per_100g: 0,
        carbs_per_100g: 0,
        ...(mode === "alcohol" ? { ml: 500, abv: 5 } : {}),
      },
    ]);
  }, [mode]);

  // ---- OPEN / CLOSE ----
  const handleOpen = useCallback(() => {
    setOpen(true);
    setPhase("idle");
    setError("");
    setTranscript("");
    setInterimText("");
    setItems([]);
  }, []);

  const handleClose = useCallback(() => {
    stopRecording();
    setOpen(false);
    setPhase("idle");
    onClose?.();
  }, [stopRecording, onClose]);

  // ---- SUBMIT ----
  const handleSubmit = useCallback(() => {
    if (items.length === 0) return;
    onComplete(items, mode === "food" ? mealType : undefined);
    handleClose();
  }, [items, mealType, mode, onComplete, handleClose]);

  // ---- SUMS ----
  const totalCal = sumField(items, "calories_per_100g");
  const totalProt = sumField(items, "protein_per_100g");
  const totalFat = sumField(items, "fat_per_100g");
  const totalCarbs = sumField(items, "carbs_per_100g");
  const totalAlcG = mode === "alcohol" ? totalAlcoholGrams(items) : 0;
  const estBAC = mode === "alcohol" ? estimateBAC(totalAlcG, 80, "male") : 0;

  // Theme colors — dark mode for all
  const isFood = mode === "food";
  const bgOverlay = "bg-[#0a0e0c]";
  const textMain = "text-gray-100";
  const textSub = "text-gray-400";
  const btnPrimary = "bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold";
  const btnSecondary = "bg-white/[0.04] text-white/60 border border-white/[0.06]";
  const cardBg = "bg-white/[0.03]";
  const borderColor = "border-white/[0.06]";
  const sliderAccent = "accent-amber-400";

  const voiceHints = [
    "2 banany",
    "200g piersi z kurczaka",
    "Talerz rosołu",
    "Kanapka z serem",
    "3 jajka na twardo",
    "Kawa z mlekiem 2%",
  ];

  return (
    <>
      {/* FLOATING MIC BUTTON */}
      {!hideButton && (
        <button
          onClick={handleOpen}
          className={`
            w-11 h-11 rounded-full flex items-center justify-center
            shadow-lg active:scale-95 transition-transform
            ${isFood ? "bg-green-500" : "bg-indigo-500"}
          `}
          aria-label="Nagraj głosowo"
          title="Powiedz co zjadłeś"
        >
          <span className="text-lg">🎙️</span>
        </button>
      )}

      {/* MODAL OVERLAY */}
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <div
            data-scrollable="true"
            className={`
              relative w-full max-w-lg max-h-[85vh] overflow-y-auto
              rounded-t-2xl sm:rounded-2xl shadow-2xl p-5
              ${bgOverlay} ${textMain}
            `}
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            {/* Close */}
            <button
              onClick={handleClose}
              style={{
                position: "absolute", top: 12, right: 12, width: 32, height: 32,
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer",
              }}
              aria-label="Zamknij"
            >
              ✕
            </button>

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 16 }}>
              {isFood ? "🎙️ Nagraj posiłek" : "🎙️ Nagraj alkohol"}
            </h2>

            {/* ===== IDLE ===== */}
            {phase === "idle" && (
              <div className="flex flex-col items-center gap-4 py-4">
                {/* Pulsing mic circle */}
                <button
                  onClick={startRecording}
                  style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: "rgba(110,252,180,0.15)", border: "2px solid rgba(110,252,180,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.2s",
                    animation: "voicePulse 1.5s ease-in-out infinite",
                  }}
                  className="active:scale-95"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6efcb4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="1" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                  </svg>
                </button>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#6efcb4" }}>
                  Kliknij i mów
                </p>
                {error && (
                  <p className="text-sm text-red-500 text-center px-4">{error}</p>
                )}

                {/* Hints grid */}
                <div style={{ width: "100%", marginTop: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 10, textAlign: "center" }}>
                    Powiedz co zjadłeś:
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {voiceHints.map((hint, i) => (
                      <div key={i} style={{
                        padding: "8px 14px", borderRadius: 10,
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                        fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center",
                      }}>{hint}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== RECORDING ===== */}
            {phase === "recording" && (
              <div className="flex flex-col items-center gap-3 py-3">
                {/* Pulsing green circle */}
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "rgba(110,252,180,0.15)", border: "2px solid rgba(110,252,180,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "voicePulse 1.5s ease-in-out infinite",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6efcb4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="1" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                  </svg>
                </div>

                {/* Live text or "Słucham..." */}
                <div style={{ minHeight: 28, textAlign: "center", padding: "0 16px" }}>
                  {transcript && <span style={{ fontSize: 14, fontWeight: 600, color: "#6efcb4" }}>{transcript} </span>}
                  {interimText && <span style={{ fontSize: 14, color: "rgba(110,252,180,0.6)", fontStyle: "italic" }}>{interimText}</span>}
                  {!transcript && !interimText && (
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#6efcb4" }}>Słucham...</span>
                  )}
                </div>

                {/* Sine wave */}
                <SineWave active={phase === "recording"} />

                {/* Stop button */}
                <button
                  onClick={stopRecording}
                  style={{
                    padding: "10px 28px", borderRadius: 999,
                    background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                    color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                  className="active:scale-95 transition-transform"
                >
                  ⏹ STOP
                </button>

                {/* Hints — smaller during recording but VISIBLE */}
                <div style={{ width: "100%", marginTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, textAlign: "center" }}>
                    Powiedz co zjadłeś:
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {voiceHints.map((hint, i) => (
                      <div key={i} style={{
                        padding: "5px 10px", borderRadius: 8,
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                        fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center",
                      }}>{hint}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== PROCESSING ===== */}
            {phase === "processing" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div style={{ width: 40, height: 40, border: "4px solid rgba(251,191,36,0.3)", borderTopColor: "#FBBF24", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Analizuję: &ldquo;{transcript}&rdquo;</p>
              </div>
            )}

            <style>{`
              @keyframes voicePulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(110,252,180,0); }
                50% { transform: scale(1.15); box-shadow: 0 0 24px rgba(110,252,180,0.2); }
              }
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            {/* ===== RESULTS ===== */}
            {phase === "results" && (
              <div className="flex flex-col gap-3" style={{ paddingBottom: 80 }}>
                {/* Transcript recap */}
                <p className={`text-xs ${textSub} italic`}>
                  Rozpoznano: &ldquo;{transcript}&rdquo;
                </p>

                {/* Meal type selector (food only) — AT TOP before items */}
                {mode === "food" && (
                  <div>
                    <label className={`text-xs font-semibold ${textSub} mb-1 block`}>Typ posiłku</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {MEAL_TYPES.map(mt => (
                        <button
                          key={mt.key}
                          onClick={() => setMealType(mt.key)}
                          className={`
                            py-1.5 rounded-lg text-xs font-medium transition-colors
                            ${mealType === mt.key
                              ? btnPrimary
                              : btnSecondary
                            }
                          `}
                        >
                          {mt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items */}
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`${cardBg} rounded-xl p-3 border ${borderColor}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl flex-shrink-0">{item.emoji}</span>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => updateItem(item.id, { name: e.target.value })}
                          className={`
                            text-sm font-semibold bg-transparent border-b
                            ${borderColor} focus:outline-none focus:border-amber-500
                            w-full min-w-0
                          `}
                        />
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-500 text-lg ml-2 flex-shrink-0"
                        aria-label="Usuń"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Weight/quantity slider */}
                    <div className="mb-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className={textSub}>
                          {mode === "alcohol" ? "Objętość" : "Waga"}
                        </span>
                        <span className="font-semibold">
                          {item.weight_g}{mode === "alcohol" ? " ml" : " g"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={item.min_g}
                        max={item.max_g}
                        step={mode === "alcohol" ? 10 : 5}
                        value={item.weight_g}
                        onChange={e => updateItem(item.id, { weight_g: Number(e.target.value) })}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${sliderAccent}`}
                      />
                      <div className={`flex justify-between text-[10px] ${textSub}`}>
                        <span>{item.min_g}</span>
                        <span>{item.max_g}</span>
                      </div>
                    </div>

                    {/* Alcohol ABV slider */}
                    {mode === "alcohol" && item.abv !== undefined && (
                      <div className="mb-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className={textSub}>Alkohol %</span>
                          <span className="font-semibold">{item.abv}%</span>
                        </div>
                        <input
                          type="range"
                          min={0.5}
                          max={96}
                          step={0.5}
                          value={item.abv}
                          onChange={e => updateItem(item.id, { abv: Number(e.target.value), ml: item.weight_g })}
                          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${sliderAccent}`}
                        />
                      </div>
                    )}

                    {/* Live calculated macros */}
                    <div className={`grid grid-cols-4 gap-1 text-center text-[11px] mt-2 ${textSub}`}>
                      <div>
                        <div className="font-bold text-sm">{calc(item.calories_per_100g, item.weight_g)}</div>
                        <div>kcal</div>
                      </div>
                      <div>
                        <div className="font-bold text-sm">{calc(item.protein_per_100g, item.weight_g)}g</div>
                        <div>białko</div>
                      </div>
                      <div>
                        <div className="font-bold text-sm">{calc(item.fat_per_100g, item.weight_g)}g</div>
                        <div>tłuszcz</div>
                      </div>
                      <div>
                        <div className="font-bold text-sm">{calc(item.carbs_per_100g, item.weight_g)}g</div>
                        <div>węgle</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add product button */}
                <button
                  onClick={addItem}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold ${btnSecondary}`}
                >
                  + Dodaj produkt
                </button>

                {/* SUMA */}
                <div className={`${cardBg} rounded-xl p-3 border-2 border-amber-500/30`}>
                  <div className="text-xs font-bold mb-2 uppercase tracking-wider">SUMA</div>
                  <div className="grid grid-cols-4 gap-1 text-center text-sm">
                    <div>
                      <div className="font-bold text-base text-amber-500">{totalCal}</div>
                      <div className={`text-[10px] ${textSub}`}>kcal</div>
                    </div>
                    <div>
                      <div className="font-bold text-base">{totalProt}g</div>
                      <div className={`text-[10px] ${textSub}`}>białko</div>
                    </div>
                    <div>
                      <div className="font-bold text-base">{totalFat}g</div>
                      <div className={`text-[10px] ${textSub}`}>tłuszcz</div>
                    </div>
                    <div>
                      <div className="font-bold text-base">{totalCarbs}g</div>
                      <div className={`text-[10px] ${textSub}`}>węgle</div>
                    </div>
                  </div>

                  {/* Alcohol totals */}
                  {mode === "alcohol" && (
                    <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-2 text-center text-sm">
                      <div>
                        <div className="font-bold text-base text-indigo-400">{Math.round(totalAlcG * 10) / 10}g</div>
                        <div className={`text-[10px] ${textSub}`}>alkoholu</div>
                      </div>
                      <div>
                        <div className="font-bold text-base text-indigo-400">{estBAC.toFixed(2)}‰</div>
                        <div className={`text-[10px] ${textSub}`}>szac. BAC</div>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}
              </div>
            )}

            {/* Sticky action buttons — always visible at bottom of modal */}
            {phase === "results" && (
              <div style={{
                position: "sticky", bottom: -20, left: 0, right: 0,
                padding: "12px 0 4px",
                background: "linear-gradient(transparent, #0a0e0c 16px)",
                zIndex: 10,
              }}>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPhase("idle");
                      setItems([]);
                      setError("");
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${btnSecondary}`}
                  >
                    🔄 Ponownie
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={items.length === 0}
                    className={`
                      flex-[1.5] py-2.5 rounded-xl text-sm font-bold shadow-lg
                      ${btnPrimary} disabled:opacity-40
                    `}
                  >
                    {mode === "food" ? "📝 Dodaj do dziennika" : "🍺 Dodaj do Alkomatu"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ======================== VOICE MIC BUTTON (INLINE) ========================

export function VoiceMicButton({
  onClick,
  accent = "green",
  className = "",
}: {
  onClick: () => void;
  accent?: "green" | "indigo" | "blue";
  className?: string;
}) {
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Show tooltip on first visit
    if (!localStorage.getItem("skladai_voiceTipShown")) {
      setShowTip(true);
      const t = setTimeout(() => { setShowTip(false); localStorage.setItem("skladai_voiceTipShown", "1"); }, 5000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("skladai_voiceUsed")) setShowNew(true);
  }, []);

  const handleClick = () => {
    // Hide tooltip and NEW badge
    setShowTip(false);
    localStorage.setItem("skladai_voiceTipShown", "1");
    setShowNew(false);
    localStorage.setItem("skladai_voiceUsed", "1");

    const SR = getSpeechRecognition();
    if (!SR) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        setShowUnsupported(true);
        setTimeout(() => setShowUnsupported(false), 4000);
      } else {
        setShowUnsupported(true);
        setTimeout(() => setShowUnsupported(false), 3000);
      }
      return;
    }
    onClick();
  };

  const glowColors: Record<string, string> = {
    green: "shadow-green-500/40",
    indigo: "shadow-indigo-500/40",
    blue: "shadow-blue-500/40",
  };

  const bgColors: Record<string, string> = {
    green: "bg-green-500",
    indigo: "bg-indigo-500",
    blue: "bg-blue-500",
  };

  return (
    <div className="relative">
      {/* NEW badge */}
      {showNew && (
        <span className="absolute -top-2 -right-1.5 bg-red-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full z-10 leading-none">
          NEW
        </span>
      )}

      {/* Pulsing glow ring */}
      <span className={`absolute inset-0 rounded-full ${bgColors[accent] || bgColors.green} opacity-0 animate-[micPulse_3s_ease-in-out_infinite]`} />

      <button
        type="button"
        onClick={handleClick}
        className={`
          relative w-11 h-11 rounded-full flex items-center justify-center
          ${bgColors[accent] || bgColors.green}
          text-white shadow-lg ${glowColors[accent] || glowColors.green}
          active:scale-90 transition-transform
          ${className}
        `}
        aria-label="Nagraj głosowo"
        title="Powiedz co szukasz"
      >
        <span className="text-lg">🎙️</span>
      </button>

      {/* Tooltip on first visit */}
      {showTip && (
        <div
          className="absolute bottom-full mb-2.5 right-0 w-52 p-2.5 rounded-xl bg-gray-900 text-white text-[11px] leading-snug shadow-xl z-50"
          style={{ animation: "fadeIn 0.3s ease" }}
          onClick={() => { setShowTip(false); localStorage.setItem("skladai_voiceTipShown", "1"); }}
        >
          {"🎙️ Powiedz co zjadłeś — AI rozpozna!"}
          <span className="absolute -bottom-1.5 right-4 w-3 h-3 bg-gray-900 rotate-45" />
        </div>
      )}

      {showUnsupported && (
        <div className="absolute bottom-full mb-2 right-0 w-56 p-2.5 rounded-xl bg-gray-900 text-white text-[11px] leading-snug shadow-xl z-50 animate-fade-in">
          {"🍎 Nagrywanie głosu wymaga Safari na iPhone. Otwórz SkładAI w Safari."}
        </div>
      )}
    </div>
  );
}
