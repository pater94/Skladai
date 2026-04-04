// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ScanHistoryItem, CosmeticsAnalysisResult, FoodAnalysisResult, MealAnalysisResult, TextSearchResult, CheckFormResult, UserProfile, MealType } from "@/lib/types";
import { getHistoryItem, getProfile, addDiaryEntry, todayStr } from "@/lib/storage";
import ScoreRing, { getScoreColor } from "@/components/ScoreRing";
import ResultTabs from "@/components/ResultTabs";
import HealthAlerts from "@/components/HealthAlerts";
import MealPortionEditor from "@/components/MealPortionEditor";
import IngredientPopup from "@/components/IngredientPopup";

function FunComparisons({ items, isDark }: { items: string[]; isDark: boolean }): React.JSX.Element {
  if (!items || items.length === 0) return <></>;
  return (
    <div
      className="mt-3 anim-fade-up-1"
      style={{
        padding: 18, borderRadius: 16,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>
        💡 Ciekawostki
      </p>
      <ul className="space-y-2">
        {items.map((c: string, i: number) => (
          <li key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: "#6efcb4", fontSize: 8, marginTop: 6 }}>●</span>
            <span>{String(c)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SugarSpoons({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const full = Math.floor(count);
  const hasHalf = count - full >= 0.3;
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {Array.from({ length: Math.min(full, 15) }).map((_, i) => (
        <span key={i} className="text-[16px]">🥄</span>
      ))}
      {hasHalf && <span className="text-[12px] opacity-50">🥄</span>}
      {full > 15 && <span className="text-[11px] text-gray-400 ml-1">+{full - 15}</span>}
    </div>
  );
}

/* ── helpers to parse nutrition from food results ── */
function parseNutritionValue(val: string): number {
  const match = val?.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function extractFoodNutrition(food: FoodAnalysisResult) {
  let cal100 = 0, prot100 = 0, fat100 = 0, carb100 = 0, sugar100 = 0, salt100 = 0, fiber100 = 0;
  const nutr = food.nutrition || [];
  for (const n of nutr) {
    const v = parseNutritionValue(n.value);
    if (n.label.toLowerCase().includes("energ")) cal100 = v;
    if (n.label.toLowerCase().includes("tluszcz") || n.label.toLowerCase().includes("tłuszcz")) { if (!n.sub) fat100 = v; }
    if (n.label.toLowerCase().includes("weglo") || n.label.toLowerCase().includes("węglo")) { carb100 = v; if (n.sub) sugar100 = parseNutritionValue(n.sub); }
    if (n.label.toLowerCase().includes("bial") || n.label.toLowerCase().includes("biał")) prot100 = v;
    if (n.label.toLowerCase().includes("sol") || n.label.toLowerCase().includes("sól")) salt100 = v;
    if (n.label.toLowerCase().includes("blonnik") || n.label.toLowerCase().includes("błonnik")) fiber100 = v;
  }
  const wMatch = food.weight?.match(/(\d+)/);
  const packageG = wMatch ? parseInt(wMatch[1]) : 200;
  return { cal100, prot100, fat100, carb100, sugar100, salt100, fiber100, packageG };
}

/* ── Meal type options ── */
const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Śniadanie" },
  { id: "lunch", label: "Obiad" },
  { id: "dinner", label: "Kolacja" },
  { id: "snack", label: "Przekąska" },
];

/* ── Inline diary panel ── */
function DiaryPanel({
  result,
  scanId,
  isDark,
}: {
  result: FoodAnalysisResult | MealAnalysisResult;
  scanId: string;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [pct, setPct] = useState(100);
  const [added, setAdded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isMeal = "items" in result && result.items;

  let cal100 = 0, prot100 = 0, fat100 = 0, carb100 = 0, sugar100 = 0, salt100 = 0, fiber100 = 0;
  let packageG = 100;

  if (isMeal) {
    const meal = result as MealAnalysisResult;
    const t = meal.total;
    cal100 = t.calories;
    prot100 = t.protein;
    fat100 = t.fat;
    carb100 = t.carbs;
    packageG = 1;
  } else {
    const n = extractFoodNutrition(result as FoodAnalysisResult);
    cal100 = n.cal100; prot100 = n.prot100; fat100 = n.fat100; carb100 = n.carb100;
    sugar100 = n.sugar100; salt100 = n.salt100; fiber100 = n.fiber100; packageG = n.packageG;
  }

  const factor = isMeal ? (pct / 100) : (pct / 100);
  const portionG = isMeal ? Math.round(packageG * factor) : Math.round(packageG * factor);
  const portionCal = Math.round(cal100 * factor);
  const portionProt = Math.round(prot100 * factor * 10) / 10;
  const portionFat = Math.round(fat100 * factor * 10) / 10;
  const portionCarb = Math.round(carb100 * factor * 10) / 10;

  const handleAdd = () => {
    addDiaryEntry({
      date: todayStr(),
      mealType,
      productName: result.name,
      brand: result.brand || "",
      score: result.score,
      portion_g: isMeal ? factor : portionG,
      package_g: packageG,
      calories: portionCal,
      protein: portionProt,
      fat: portionFat,
      carbs: portionCarb,
      sugar: Math.round(sugar100 * factor * 10) / 10,
      salt: Math.round(salt100 * factor * 10) / 10,
      fiber: Math.round(fiber100 * factor * 10) / 10,
      scanId,
    });
    setAdded(true);
  };

  if (added) {
    return (
      <div className={`w-full py-4 rounded-[18px] text-center font-bold text-[15px] ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
        Dodano do dziennika!
      </div>
    );
  }

  return (
    <div>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full py-4 rounded-[18px] font-bold text-[15px] active:scale-[0.97] transition-all ${
          isDark
            ? "bg-white/5 border border-white/10 text-white/70"
            : "card-elevated text-[#1A3A0A]"
        }`}
      >
        {open ? "📝 Schowaj panel" : "📝 Dodaj do dziennika"}
      </button>

      {/* Expandable panel */}
      <div
        ref={panelRef}
        style={{
          maxHeight: open ? "600px" : "0px",
          opacity: open ? 1 : 0,
          transition: "max-height 0.3s ease, opacity 0.25s ease",
          overflow: "hidden",
        }}
      >
        <div className={`mt-3 rounded-[20px] p-5 ${isDark ? "bg-white/[0.04] border border-white/[0.08]" : "card-elevated"}`}>
          {/* Slider */}
          <p className={`text-[12px] font-semibold mb-2 ${isDark ? "text-white/55" : "text-gray-500"}`}>
            Ile zjadłeś?
          </p>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(+e.target.value)}
            className={`w-full h-2 rounded-full appearance-none cursor-pointer ${isDark ? "accent-purple-400" : "accent-[#1A3A0A]"}`}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>0%</span>
            <span className={`text-[12px] font-bold ${isDark ? "text-white/70" : "text-[#1A3A0A]"}`}>{pct}%</span>
            <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-300"}`}>100%</span>
          </div>

          {/* Portion info */}
          <p className={`text-[12px] mt-3 ${isDark ? "text-white/55" : "text-gray-400"}`}>
            {isMeal
              ? `Porcja: ${pct}% posiłku`
              : `Porcja: ${portionG}g z ${packageG}g (${pct}%)`}
          </p>

          {/* Recalculated macros */}
          <div className={`mt-2 rounded-[14px] px-4 py-3 ${isDark ? "bg-white/[0.04]" : "bg-[#EBF5D5]"}`}>
            <span className={`text-[13px] font-bold ${isDark ? "text-white/80" : "text-[#2D5A16]"}`}>
              {portionCal} kcal
            </span>
            <span className={`text-[12px] ml-3 ${isDark ? "text-white/55" : "text-[#2D5A16]/60"}`}>
              B: {portionProt}g | T: {portionFat}g | W: {portionCarb}g
            </span>
          </div>

          {/* Meal type pills */}
          <p className={`text-[11px] font-semibold mt-4 mb-2 uppercase tracking-wider ${isDark ? "text-white/30" : "text-gray-400"}`}>
            Posiłek
          </p>
          <div className="flex gap-2">
            {MEAL_TYPES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMealType(m.id)}
                className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all ${
                  mealType === m.id
                    ? isDark
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                      : "bg-[#1A3A0A] text-white"
                    : isDark
                      ? "bg-white/[0.04] text-white/40 border border-white/[0.06]"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            className={`w-full mt-4 py-3.5 rounded-[16px] font-bold text-[14px] active:scale-[0.97] transition-all ${
              isDark
                ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/20"
                : "bg-[#1A3A0A] text-white shadow-lg shadow-green-900/15"
            }`}
          >
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareCard({ name, score, verdict, isForma }: { name: string; score: number; verdict: string; isForma: boolean }) {
  const scoreColor = score >= 7 ? "#22c55e" : score >= 4 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ width: 400, padding: 32, background: "#0a0e0c", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <img src="/icons/icon-192.png" alt="" width={32} height={32} style={{ borderRadius: 8 }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>SkładAI</span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", marginBottom: 12, lineHeight: 1.3 }}>{name}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: `conic-gradient(${scoreColor} ${score * 36}deg, rgba(255,255,255,0.08) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#0a0e0c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: scoreColor }}>
            {score}
          </div>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor }}>
          {isForma ? "Ocena sylwetki" : `Ocena ${score}/10`}
        </span>
      </div>
      {verdict && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 20 }}>{verdict.slice(0, 120)}{verdict.length > 120 ? "..." : ""}</p>}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Sprawdź skład swoich produktów → skladai.vercel.app</p>
      </div>
    </div>
  );
}

export default function WynikiPage() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<ScanHistoryItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<"good" | "bad" | "sent" | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [scoreAnim, setScoreAnim] = useState(false);
  const [portion, setPortion] = useState(100);
  const [quantity, setQuantity] = useState(1);
  const [mealWeights, setMealWeights] = useState<Record<number, number>>({});
  const [textWeights, setTextWeights] = useState<Record<number, number>>({});

  useEffect(() => {
    const id = params.id as string;
    const found = getHistoryItem(id);
    if (!found) { router.push("/"); return; }
    setItem(found);
    setProfile(getProfile());
    setTimeout(() => setScoreAnim(true), 400);
  }, [params.id, router]);

  if (!item) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0e0c]">
        <div style={{ width: 48, height: 48, border: "4px solid rgba(110,252,180,0.3)", borderTopColor: "#6efcb4", borderRadius: "50%", animation: "spinSlow 0.8s linear infinite" }} />
      </div>
    );
  }

  const result = item.result;
  const scanType = item.scanType || "food";
  const isCosmetics = scanType === "cosmetics";
  const isMeal = scanType === "meal";
  const isTextSearch = result.type === "text_search";
  const isForma = scanType === "forma";
  const isSuplement = scanType === "suplement" || result.type === "suplement";
  const { color, bg, label } = getScoreColor(result.score);

  const foodResult = scanType === "food" ? (result as FoodAnalysisResult) : null;
  const textSearchResult = isTextSearch ? (result as TextSearchResult) : null;
  const cosmeticsResult = isCosmetics ? (result as CosmeticsAnalysisResult) : null;
  const mealResult = isMeal ? (result as MealAnalysisResult) : null;
  const formaResult = isForma ? (result as CheckFormResult) : null;

  const subtitle = isForma
    ? (formaResult?.score_label || "Analiza sylwetki")
    : isTextSearch
    ? "Wyszukiwanie AI"
    : isCosmetics
    ? [result.brand, cosmeticsResult?.volume, cosmeticsResult?.category].filter(Boolean).join(" · ")
    : isMeal
    ? "Analiza dania"
    : [result.brand, (result as FoodAnalysisResult).weight].filter(Boolean).join(" · ");

  const isDark = true; // all modes are now dark

  const sugarTeaspoons = foodResult?.sugar_teaspoons || textSearchResult?.sugar_teaspoons || mealResult?.sugar_teaspoons || 0;
  const funComparisons: string[] = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = (result as any)?.fun_comparisons;
    return Array.isArray(fc) ? fc.map(String) : [];
  })();

  /* ── Calculate calories for the main card ── */
  let mainCalories: number | null = null;
  if (foodResult && !isTextSearch) {
    const n = extractFoodNutrition(foodResult);
    if (n.cal100 > 0) {
      mainCalories = Math.round(n.cal100 * n.packageG / 100);
    }
  } else if (mealResult) {
    mainCalories = Math.round(mealResult.total.calories);
  } else if (textSearchResult) {
    mainCalories = Math.round(textSearchResult.total?.calories || 0);
  }

  const bgClass = isForma ? "bg-[#0a0e0c]" : "bg-[#0a0e0c]";
  const heroClass = isForma ? "" : isMeal ? "meal-hero" : "bg-gradient-to-b from-[#0a1a10] to-[#0a0e0c]";

  const accentColor = isCosmetics ? "#C084FC" : isSuplement ? "#3b82f6" : "#6efcb4";
  const accentRgb = isCosmetics ? "192,132,252" : isSuplement ? "59,130,246" : "110,252,180";

  const handleShare = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: "#0a0e0c",
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], "f.png", { type: "image/png" })] })) {
        const file = new File([blob], "skladai-wynik.png", { type: "image/png" });
        await navigator.share({
          title: "Wynik skanu SkładAI",
          text: `${result.name} — ocena ${result.score}/10`,
          files: [file],
        });
      } else {
        await navigator.clipboard.writeText(`${result.name} — ocena ${result.score}/10\nSprawdź: skladai.vercel.app`);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      // user cancelled share or error
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className={`min-h-[100dvh] ${bgClass}`} style={{ position: "relative", overflow: "hidden" }}>
      {/* Ambient blobs + film grain */}
      {!isForma && (
        <>
          <div style={{
            position: "absolute", top: -40, right: -60, width: 200, height: 200,
            borderRadius: "50%", background: `radial-gradient(circle, ${isMeal ? "#FBBF24" : accentColor}10 0%, transparent 70%)`,
            filter: "blur(50px)", animation: "float1 8s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", top: 350, left: -40, width: 160, height: 160,
            borderRadius: "50%", background: `radial-gradient(circle, ${isMeal ? "#FBBF24" : accentColor}06 0%, transparent 70%)`,
            filter: "blur(40px)", animation: "float2 10s ease-in-out infinite",
          }} />
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.4, zIndex: 1 }}>
            <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
            <rect width="100%" height="100%" filter="url(#grain)" opacity="0.08" />
          </svg>
          <style>{`
            @keyframes float1 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(20px); } }
            @keyframes float2 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
          `}</style>
        </>
      )}

      {/* Header */}
      {isForma ? (
        <>
          {/* Ambient blob + grain for forma */}
          <div style={{
            position: "absolute", top: -40, right: -60, width: 200, height: 200,
            borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 70%)",
            filter: "blur(50px)", animation: "float1 8s ease-in-out infinite",
          }} />
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.4, zIndex: 1 }}>
            <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
            <rect width="100%" height="100%" filter="url(#grain)" opacity="0.08" />
          </svg>
          <style>{`
            @keyframes float1 { 0%,100% { transform: translate(0,0); } 33% { transform: translate(15px,-20px); } 66% { transform: translate(-10px,10px); } }
          `}</style>

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{
              padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <button
                onClick={() => router.push("/forma")}
                className="active:scale-95 transition-all"
                style={{
                  padding: "7px 14px", borderRadius: 11,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                  fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)",
                  display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 13 }}>←</span> Powrót
              </button>
              <button
                onClick={() => router.push("/forma")}
                className="active:scale-95 transition-all"
                style={{
                  padding: "7px 14px", borderRadius: 11,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)",
                  cursor: "pointer",
                }}
              >
                Nowy CheckForm
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="max-w-md mx-auto" style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={() => router.push("/")}
              className="active:scale-95 transition-all"
              style={{
                padding: "8px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)", color: "rgba(255,255,255,0.6)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              ← Powrót
            </button>
            <button
              onClick={() => router.push("/")}
              className="active:scale-95 transition-all"
              style={{
                padding: "8px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)", color: "rgba(255,255,255,0.45)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Skanuj kolejny
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`max-w-md mx-auto pb-10 relative z-20 ${isForma ? "px-0 mt-0" : "px-0 mt-0"}`}>

        {/* ─── 1. SCORE CARD ─── */}
        {isForma ? (
          /* --- Premium Hero Card for CheckForm --- */
          (() => {
            const formaScoreColor = result.score >= 8 ? "#22c55e" : result.score >= 5 ? "#FBBF24" : "#ef4444";
            const scoreCircumForma = 2 * Math.PI * 18;
            const thumbnailSrc = item.thumbnail
              ? (item.thumbnail.startsWith("data:") ? item.thumbnail : `data:image/jpeg;base64,${item.thumbnail}`)
              : null;

            return (
              <div style={{
                margin: "0 16px 12px", borderRadius: 20,
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)", position: "relative", overflow: "hidden",
              }}>
                {/* Gradient stripe */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: "linear-gradient(90deg, transparent, #f97316, transparent)", zIndex: 3,
                }} />

                {/* Photo area */}
                <div style={{
                  position: "relative", width: "100%", height: 170,
                  background: "linear-gradient(135deg, #1a1208 0%, #0f1a0a 50%, #0a1210 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {thumbnailSrc ? (
                    <img src={thumbnailSrc} alt="Sylwetka" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 60, opacity: 0.8, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>🏋️</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>Twoje zdjęcie sylwetki</div>
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, height: 70,
                    background: "linear-gradient(transparent, rgba(10,14,12,0.95))",
                  }} />

                  {/* Score badge */}
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    width: 58, height: 58, borderRadius: 14,
                    background: "rgba(0,0,0,0.6)", border: "1.5px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(16px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 2, boxShadow: `0 0 16px ${formaScoreColor}15`,
                  }}>
                    <div style={{ position: "relative", width: 44, height: 44 }}>
                      <svg width="44" height="44" style={{ transform: "rotate(-90deg)", position: "absolute", top: 0, left: 0 }}>
                        <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
                        <circle cx="22" cy="22" r="18" stroke={formaScoreColor} strokeWidth="3" fill="none"
                          strokeLinecap="round"
                          strokeDasharray={scoreCircumForma}
                          strokeDashoffset={scoreCircumForma - (result.score / 10) * scoreCircumForma}
                          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
                        />
                      </svg>
                      <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: formaScoreColor, lineHeight: 1 }}>{result.score}</div>
                        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.4)" }}>/10</div>
                      </div>
                    </div>
                  </div>

                  {/* Forma tag */}
                  <div style={{
                    position: "absolute", top: 10, left: 10,
                    padding: "4px 10px", borderRadius: 9,
                    background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)",
                    backdropFilter: "blur(12px)",
                    fontSize: 10, fontWeight: 600, color: "#f97316", zIndex: 2,
                  }}>💪 Forma</div>
                </div>

                {/* Content below photo */}
                <div style={{ padding: "12px 18px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 2 }}>CheckForm</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{subtitle}</div>
                    </div>
                    <span style={{
                      padding: "4px 10px", borderRadius: 7, fontSize: 10, fontWeight: 600,
                      background: `${formaScoreColor}18`, color: formaScoreColor, border: `1px solid ${formaScoreColor}30`,
                    }}>{result.verdict_short || label}</span>
                  </div>

                  {/* AI Comment */}
                  <div style={{
                    padding: 11, borderRadius: 12,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.45, margin: 0 }}>
                      {result.verdict}
                    </p>
                  </div>

                  {/* Feedback */}
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 8 }}>
                    {feedbackSent === "good" || feedbackSent === "sent" ? (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Dzięki! 🙏</span>
                    ) : feedbackSent === "bad" ? (
                      <div style={{ width: "100%" }}>
                        <textarea rows={2} maxLength={300} placeholder="Co było nie tak?" value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <button onClick={() => { fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "bad", feedback_note: feedbackNote || null }) }); setFeedbackSent("sent"); }} style={{ flex: 1, padding: 8, borderRadius: 10, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", color: "#f97316", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Wyślij</button>
                          <button onClick={() => { setFeedbackSent(null); setFeedbackNote(""); }} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => { setFeedbackSent("good"); fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "good" }) }); }} className="active:scale-95 transition-transform" style={{
                          padding: "6px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
                          background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)",
                          fontSize: 12, cursor: "pointer",
                        }}>👍 Trafna</button>
                        <button onClick={() => setFeedbackSent("bad")} className="active:scale-95 transition-transform" style={{
                          padding: "6px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
                          background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)",
                          fontSize: 12, cursor: "pointer",
                        }}>👎 Błędna</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        ) : isMeal ? (
          /* --- Premium Hero Card for meal mode --- */
          (() => {
            const mealColor = "#FBBF24";
            const mealItems = mealResult?.items || [];
            const mealScoreColor = result.score >= 7 ? "#22c55e" : result.score >= 4 ? "#f59e0b" : "#ef4444";
            const scoreCircum = 2 * Math.PI * 20;

            // Initialize weights on first render
            if (mealItems.length > 0 && Object.keys(mealWeights).length === 0) {
              const init: Record<number, number> = {};
              mealItems.forEach((it, i) => { init[i] = it.estimated_weight_g; });
              // use a timeout to avoid setState during render
              setTimeout(() => setMealWeights(init), 0);
            }

            const getWeight = (i: number) => mealWeights[i] ?? mealItems[i]?.estimated_weight_g ?? 100;
            const getScaled = (i: number, field: "calories" | "protein" | "fat" | "carbs") => {
              const it = mealItems[i];
              if (!it) return 0;
              const w = getWeight(i);
              const per100 = field === "calories" ? it.calories_per_100g : field === "protein" ? it.protein_per_100g : field === "fat" ? it.fat_per_100g : it.carbs_per_100g;
              return Math.round(per100 * w / 100 * 10) / 10;
            };
            const totalKcal = mealItems.reduce((s, _, i) => s + Math.round(getScaled(i, "calories")), 0);
            const totalProtein = mealItems.reduce((s, _, i) => s + getScaled(i, "protein"), 0).toFixed(1);
            const totalFat = mealItems.reduce((s, _, i) => s + getScaled(i, "fat"), 0).toFixed(1);
            const totalCarbs = mealItems.reduce((s, _, i) => s + getScaled(i, "carbs"), 0).toFixed(1);

            const ingredientColors = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f43f5e", "#8b5cf6"];

            return (
              <>
                {/* Hero card with photo + score badge */}
                <div
                  className="anim-fade-up"
                  style={{
                    margin: "0 16px 16px", borderRadius: 22,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(20px)", position: "relative", overflow: "hidden",
                  }}
                >
                  {/* Gradient stripe top */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${mealColor}, transparent)`, zIndex: 3 }} />

                  {/* Dish photo area */}
                  <div style={{
                    position: "relative", width: "100%", height: 180,
                    background: "linear-gradient(135deg, #2a1f0a 0%, #1a1208 50%, #0f1a0a 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail.startsWith("data:") ? item.thumbnail : `data:image/jpeg;base64,${item.thumbnail}`}
                        alt={result.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ fontSize: 64, opacity: 0.9, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>🍽️</div>
                    )}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(transparent, rgba(10,14,12,0.9))" }} />

                    {/* Score badge - top right */}
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      width: 64, height: 64, borderRadius: 16,
                      background: "rgba(0,0,0,0.6)", border: "1.5px solid rgba(255,255,255,0.1)",
                      backdropFilter: "blur(16px)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      zIndex: 2,
                    }}>
                      <div style={{ position: "relative", width: 48, height: 48 }}>
                        <svg width="48" height="48" style={{ transform: "rotate(-90deg)", position: "absolute", top: 0, left: 0 }}>
                          <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
                          <circle cx="24" cy="24" r="20" stroke={mealScoreColor} strokeWidth="3" fill="none"
                            strokeLinecap="round"
                            strokeDasharray={scoreCircum}
                            strokeDashoffset={scoreAnim ? scoreCircum - (result.score / 10) * scoreCircum : scoreCircum}
                            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
                          />
                        </svg>
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: mealScoreColor, lineHeight: 1 }}>{result.score}</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>/10</div>
                        </div>
                      </div>
                    </div>

                    {/* Danie badge - top left */}
                    <div style={{
                      position: "absolute", top: 12, left: 12,
                      padding: "5px 12px", borderRadius: 10,
                      background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.25)",
                      backdropFilter: "blur(12px)",
                      fontSize: 11, fontWeight: 600, color: mealColor, zIndex: 2,
                    }}>🍽️ Danie</div>
                  </div>

                  {/* Content below photo */}
                  <div style={{ padding: "16px 20px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.3, marginBottom: 6 }}>
                          {result.name}
                        </div>
                        <span style={{
                          display: "inline-block", padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                          background: `${mealScoreColor}18`, color: mealScoreColor, border: `1px solid ${mealScoreColor}30`,
                        }}>{result.verdict_short || label}</span>
                      </div>
                    </div>

                    {/* AI Comment */}
                    <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, margin: 0 }}>
                        {result.verdict}
                      </p>
                    </div>

                    {/* Feedback row */}
                    <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: mealColor }}>⚡ {totalKcal} kcal</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        {feedbackSent === null ? (
                          <>
                            <button onClick={() => { setFeedbackSent("good"); fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "good" }) }); }} className="active:scale-95 transition-transform" style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>👍 Trafne</button>
                            <button onClick={() => setFeedbackSent("bad")} className="active:scale-95 transition-transform" style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>👎 Błędne</button>
                          </>
                        ) : feedbackSent === "bad" ? null : (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Dzięki! 🙏</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded bad feedback */}
                    {feedbackSent === "bad" && (
                      <div style={{ marginTop: 10, overflow: "hidden", animation: "feedbackSlideIn 0.3s ease-out" }}>
                        <div style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontWeight: 600 }}>Co było nie tak?</p>
                          <textarea autoFocus rows={2} maxLength={300} placeholder="Np. źle odczytał kalorie, to nie ten produkt..." value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit" }} />
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button onClick={() => { fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "bad", feedback_note: feedbackNote || null }) }); setFeedbackSent("sent"); }} style={{ flex: 1, padding: 10, borderRadius: 10, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: mealColor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{feedbackNote.trim() ? "Wyślij" : "Wyślij bez komentarza"}</button>
                            <button onClick={() => { setFeedbackSent(null); setFeedbackNote(""); }} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <style>{`@keyframes feedbackSlideIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 200px; } }`}</style>
                </div>

                {/* Total Macros — TABLE style */}
                <div className="anim-fade-up-1" style={{
                  margin: "0 16px 16px", padding: 18, borderRadius: 16,
                  background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.12)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.5 }}>
                    Podsumowanie dania
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      { label: "Kalorie", value: totalKcal, unit: "kcal", mColor: mealColor, icon: "⚡" },
                      { label: "Białko", value: totalProtein, unit: "g", mColor: "#60a5fa", icon: "🥩" },
                      { label: "Tłuszcz", value: totalFat, unit: "g", mColor: "#fb923c", icon: "🫒" },
                      { label: "Węglowodany", value: totalCarbs, unit: "g", mColor: "#4ade80", icon: "🌾" },
                    ].map((m, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14 }}>{m.icon}</span>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{m.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: m.mColor }}>{m.value}</span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{m.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-ingredient portion sliders */}
                <div className="anim-fade-up-2" style={{ margin: "0 16px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>🍽️ Korekta porcji</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Dopasuj do rzeczywistości</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {mealItems.map((comp, idx) => {
                      const w = getWeight(idx);
                      const minG = Math.max(comp.min_reasonable_g, Math.round(comp.estimated_weight_g * 0.2));
                      const maxG = Math.max(comp.max_reasonable_g, Math.round(comp.estimated_weight_g * 3));
                      const scaledKcal = Math.round(comp.calories_per_100g * w / 100);
                      const scaledP = (comp.protein_per_100g * w / 100).toFixed(1);
                      const scaledF = (comp.fat_per_100g * w / 100).toFixed(1);
                      const scaledC = (comp.carbs_per_100g * w / 100).toFixed(1);
                      const compColor = ingredientColors[idx % ingredientColors.length];

                      return (
                        <div key={idx} style={{
                          padding: 16, borderRadius: 16,
                          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 6, height: 24, borderRadius: 3, background: compColor, boxShadow: `0 0 8px ${compColor}40` }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{comp.name}</span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: compColor }}>{scaledKcal} kcal</span>
                          </div>

                          <div style={{ textAlign: "center", marginBottom: 8 }}>
                            <span style={{
                              display: "inline-block", padding: "5px 16px", borderRadius: 8,
                              background: `${compColor}15`, border: `1px solid ${compColor}30`,
                              fontSize: 16, fontWeight: 800, color: compColor,
                            }}>{w}g</span>
                          </div>

                          <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center", marginBottom: 2 }}>
                            <input type="range" min={minG} max={maxG} step={10} value={w}
                              onChange={e => setMealWeights(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                              style={{ width: "100%", height: 5, appearance: "none", background: "transparent", outline: "none", position: "relative", zIndex: 2, cursor: "pointer" }}
                            />
                            <div style={{
                              position: "absolute", top: "50%", left: 0, right: 0, height: 5,
                              transform: "translateY(-50%)", borderRadius: 3, overflow: "hidden",
                              background: "rgba(255,255,255,0.08)",
                            }}>
                              <div style={{
                                width: `${(w - minG) / (maxG - minG) * 100}%`,
                                height: "100%", background: compColor, borderRadius: 3, opacity: 0.7,
                              }} />
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{minG}g</span>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{maxG}g</span>
                          </div>

                          {/* Macros as mini table row */}
                          <div style={{
                            display: "flex", justifyContent: "space-between",
                            paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)",
                          }}>
                            {[
                              { label: "Białko", value: scaledP, mColor: "#60a5fa" },
                              { label: "Tłuszcz", value: scaledF, mColor: "#fb923c" },
                              { label: "Węgle", value: scaledC, mColor: "#4ade80" },
                            ].map((m, mi) => (
                              <div key={mi} style={{
                                flex: 1, textAlign: "center",
                                borderRight: mi < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
                              }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: m.mColor }}>{m.value}g</div>
                                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{m.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 10, marginTop: 8, textAlign: "center", color: "rgba(255,255,255,0.25)" }}>
                    ⚠️ Wartości szacunkowe na podstawie zdjęcia ±20%
                  </p>
                </div>
              </>
            );
          })()
        ) : isTextSearch && textSearchResult ? (
          /* --- Premium card for voice/text input --- */
          (() => {
            const mealColor = "#FBBF24";
            const tsItems = textSearchResult.items || [];
            const tsScoreColor = result.score >= 7 ? "#22c55e" : result.score >= 4 ? "#f59e0b" : "#ef4444";

            // Initialize weights
            if (tsItems.length > 0 && Object.keys(textWeights).length === 0) {
              const init: Record<number, number> = {};
              tsItems.forEach((it, i) => { init[i] = it.default_portion_g || 100; });
              setTimeout(() => setTextWeights(init), 0);
            }

            const getWeight = (i: number) => textWeights[i] ?? tsItems[i]?.default_portion_g ?? 100;
            const getScaled = (i: number, field: "calories" | "protein" | "fat" | "carbs") => {
              const it = tsItems[i];
              if (!it) return 0;
              const w = getWeight(i);
              const per100 = field === "calories" ? it.calories_per_100g : field === "protein" ? it.protein_per_100g : field === "fat" ? it.fat_per_100g : it.carbs_per_100g;
              return Math.round(per100 * w / 100 * 10) / 10;
            };
            const totalKcal = tsItems.reduce((s, _, i) => s + Math.round(getScaled(i, "calories")), 0);
            const totalProtein = tsItems.reduce((s, _, i) => s + getScaled(i, "protein"), 0).toFixed(1);
            const totalFat = tsItems.reduce((s, _, i) => s + getScaled(i, "fat"), 0).toFixed(1);
            const totalCarbs = tsItems.reduce((s, _, i) => s + getScaled(i, "carbs"), 0).toFixed(1);

            const ingredientColors = ["#f97316", "#a855f7", "#FBBF24", "#22c55e", "#3b82f6", "#ef4444"];
            const isMultiItem = tsItems.length > 1;

            return (
              <>
                {/* Header Card — compact score */}
                <div
                  className="anim-fade-up"
                  style={{
                    margin: "0 16px 16px", padding: "20px 20px 18px", borderRadius: 20,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(20px)", position: "relative", overflow: "hidden",
                  }}
                >
                  {/* Gradient stripe */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${mealColor}, transparent)`, zIndex: 3 }} />
                  {/* Ambient glow */}
                  <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${tsScoreColor}15 0%, transparent 70%)`, filter: "blur(20px)", animation: "breathe 3s ease-in-out infinite" }} />

                  {/* Name + compact score */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.3, marginBottom: 4 }}>
                        {result.name}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                        🎙️ Wpisane ręcznie
                      </div>
                    </div>
                    {/* Compact score badge */}
                    <div style={{
                      width: 56, height: 56, borderRadius: 16, marginLeft: 12, flexShrink: 0,
                      background: `${tsScoreColor}10`, border: `1.5px solid ${tsScoreColor}25`,
                      backdropFilter: "blur(8px)", boxShadow: `0 0 20px ${tsScoreColor}10`,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: tsScoreColor, lineHeight: 1 }}>{result.score}</div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>/10</div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                      background: `${tsScoreColor}18`, color: tsScoreColor, border: `1px solid ${tsScoreColor}30`,
                    }}>{result.verdict_short || label}</span>
                    <span style={{
                      padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 500,
                      background: isMultiItem ? "rgba(251,191,36,0.08)" : "rgba(110,252,180,0.08)",
                      color: isMultiItem ? "rgba(251,191,36,0.8)" : "rgba(110,252,180,0.8)",
                      border: isMultiItem ? "1px solid rgba(251,191,36,0.15)" : "1px solid rgba(110,252,180,0.15)",
                    }}>{isMultiItem ? "🍽️ Posiłek" : "🍎 Produkt"}</span>
                  </div>

                  {/* AI comment */}
                  <div style={{ marginTop: 14, padding: 13, borderRadius: 13, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                      {result.verdict}
                    </p>
                  </div>

                  {/* Feedback row */}
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: mealColor }}>⚡ {totalKcal} kcal</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {feedbackSent === null ? (
                        <>
                          <button onClick={() => { setFeedbackSent("good"); fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "good" }) }); }} className="active:scale-95 transition-transform" style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>👍 Trafne</button>
                          <button onClick={() => setFeedbackSent("bad")} className="active:scale-95 transition-transform" style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>👎 Błędne</button>
                        </>
                      ) : feedbackSent === "bad" ? null : (
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Dzięki! 🙏</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded bad feedback */}
                  {feedbackSent === "bad" && (
                    <div style={{ marginTop: 10, overflow: "hidden", animation: "feedbackSlideIn 0.3s ease-out" }}>
                      <div style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontWeight: 600 }}>Co było nie tak?</p>
                        <textarea autoFocus rows={2} maxLength={300} placeholder="Np. źle odczytał kalorie, to nie ten produkt..." value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={() => { fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "bad", feedback_note: feedbackNote || null }) }); setFeedbackSent("sent"); }} style={{ flex: 1, padding: 10, borderRadius: 10, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: mealColor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{feedbackNote.trim() ? "Wyślij" : "Wyślij bez komentarza"}</button>
                          <button onClick={() => { setFeedbackSent(null); setFeedbackNote(""); }} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <style>{`@keyframes feedbackSlideIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 200px; } }`}</style>
                </div>

                {/* Macro table */}
                <div className="anim-fade-up-1" style={{
                  margin: "0 16px 16px", padding: 18, borderRadius: 16,
                  background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.12)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.5 }}>
                    Podsumowanie posiłku
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      { label: "Kalorie", value: totalKcal, unit: "kcal", mColor: mealColor, icon: "⚡" },
                      { label: "Białko", value: totalProtein, unit: "g", mColor: "#60a5fa", icon: "🥩" },
                      { label: "Tłuszcz", value: totalFat, unit: "g", mColor: "#fb923c", icon: "🫒" },
                      { label: "Węglowodany", value: totalCarbs, unit: "g", mColor: "#4ade80", icon: "🌾" },
                    ].map((m, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14 }}>{m.icon}</span>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{m.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: m.mColor }}>{m.value}</span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{m.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-ingredient sliders */}
                {tsItems.length > 0 && (
                  <div className="anim-fade-up-2" style={{ margin: "0 16px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>🍽️ Dopasuj porcje</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Przesuń suwaki</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {tsItems.map((comp, idx) => {
                        const w = getWeight(idx);
                        const minG = comp.min_portion_g || 10;
                        const maxG = comp.max_portion_g || Math.round((comp.default_portion_g || 100) * 3);
                        const scaledKcal = Math.round(comp.calories_per_100g * w / 100);
                        const scaledP = (comp.protein_per_100g * w / 100).toFixed(1);
                        const scaledF = (comp.fat_per_100g * w / 100).toFixed(1);
                        const scaledC = (comp.carbs_per_100g * w / 100).toFixed(1);
                        const compColor = ingredientColors[idx % ingredientColors.length];

                        return (
                          <div key={idx} style={{
                            padding: "14px 16px", borderRadius: 14,
                            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                            backdropFilter: "blur(8px)",
                            animation: `fadeInUp 0.4s ease ${0.3 + idx * 0.06}s both`,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 5, height: 20, borderRadius: 3, background: compColor, boxShadow: `0 0 8px ${compColor}40` }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{comp.name}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: compColor }}>{w}g</span>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{scaledKcal} kcal</span>
                              </div>
                            </div>

                            <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center", marginBottom: 2 }}>
                              <input type="range" min={minG} max={maxG} step={5} value={w}
                                onChange={e => setTextWeights(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                                style={{ width: "100%", height: 6, appearance: "none", background: "transparent", outline: "none", position: "relative", zIndex: 2, cursor: "pointer" }}
                              />
                              <div style={{
                                position: "absolute", top: "50%", left: 0, right: 0, height: 6,
                                transform: "translateY(-50%)", borderRadius: 3, overflow: "hidden",
                                background: "rgba(255,255,255,0.08)",
                              }}>
                                <div style={{
                                  width: `${Math.max(0, Math.min(100, (w - minG) / (maxG - minG) * 100))}%`,
                                  height: "100%", background: `linear-gradient(90deg, ${compColor}80, ${compColor})`, borderRadius: 3,
                                }} />
                              </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{minG}g</span>
                              <div style={{ display: "flex", gap: 10 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa" }}>B:{scaledP}g</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#fb923c" }}>T:{scaledF}g</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80" }}>W:{scaledC}g</span>
                              </div>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{maxG}g</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Diary panel */}
                <div style={{ margin: "0 16px 0" }}>
                  <DiaryPanel
                    result={textSearchResult}
                    scanId={item.id}
                    isDark={true}
                  />
                </div>

                {/* Tips */}
                {(() => {
                  const tips: string[] = [];
                  if (result.pros) tips.push(...result.pros);
                  if (result.cons) tips.push(...result.cons);
                  if (result.tip) tips.push(result.tip);
                  if (tips.length === 0) return null;
                  return (
                    <div className="anim-fade-up-3" style={{ margin: "12px 16px 16px", padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>💡 Wskazówki</div>
                      {tips.map((tip, i) => (
                        <div key={i} style={{
                          padding: "8px 0", fontSize: 12, color: "rgba(255,255,255,0.55)",
                          borderBottom: i < tips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4,
                        }}>
                          <span style={{ color: "#FBBF24", fontSize: 10, marginTop: 3 }}>●</span> {tip}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            );
          })()
        ) : (
          /* --- Premium score card for food/cosmetics/suplement --- */
          <div
            className="anim-fade-up"
            style={{
              margin: "0 16px 16px", padding: 24, borderRadius: 22,
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)", position: "relative", overflow: "hidden",
            }}
          >
            {/* Gradient stripe top */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
            {/* Glow behind ring */}
            <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`, filter: "blur(20px)" }} />

            {/* Score ring + product info */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Animated SVG ring */}
              <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={color} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={scoreAnim ? `${2 * Math.PI * 42 * (1 - result.score / 10)}` : `${2 * Math.PI * 42}`}
                    style={{ transition: "stroke-dashoffset 1s ease-out", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                  />
                </svg>
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -50%) scale(${scoreAnim ? 1 : 0.5})`,
                  transition: "transform 0.5s ease-out", textAlign: "center",
                }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{result.score}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "block" }}>/10</span>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", lineHeight: 1.3, marginBottom: 4 }}>{result.name}</h1>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{subtitle}</p>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 999, backgroundColor: bg, color }}>{result.verdict_short || label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)" }}>
                    {isTextSearch ? "🔍 Szukaj" : isCosmetics ? "✨ Kosmetyk" : isSuplement ? "💊 Suplement" : "🛒 Żywność"}
                  </span>
                </div>
              </div>
            </div>

            {/* AI comment */}
            <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{result.verdict}</p>
            </div>

            {/* Feedback row: kcal on left, feedback on right */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                {mainCalories !== null && mainCalories > 0 && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>⚡ {mainCalories} kcal</span>
                )}
              </div>
              <div>
                {feedbackSent === "good" || feedbackSent === "sent" ? (
                  <p style={{ fontSize: 12, color: "rgba(110,252,180,0.5)" }}>Dzięki! 🙏</p>
                ) : feedbackSent === "bad" ? null : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setFeedbackSent("good"); fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "good" }) }); }} className="active:scale-95 transition-transform" style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer" }}>👍</button>
                    <button onClick={() => setFeedbackSent("bad")} className="active:scale-95 transition-transform" style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer" }}>👎</button>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded bad feedback */}
            {feedbackSent === "bad" && (
              <div style={{ marginTop: 10, overflow: "hidden", animation: "feedbackSlideIn 0.3s ease-out" }}>
                <div style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontWeight: 600 }}>Co było nie tak?</p>
                  <textarea autoFocus rows={2} maxLength={300} placeholder="Np. źle odczytał kalorie, to nie ten produkt..." value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => { fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: result.name, feedback: "bad", feedback_note: feedbackNote || null }) }); setFeedbackSent("sent"); }} style={{ flex: 1, padding: 10, borderRadius: 10, background: `rgba(${accentRgb},0.1)`, border: `1px solid rgba(${accentRgb},0.2)`, color: accentColor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{feedbackNote.trim() ? "Wyślij" : "Wyślij bez komentarza"}</button>
                    <button onClick={() => { setFeedbackSent(null); setFeedbackNote(""); }} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              </div>
            )}
            <style>{`@keyframes feedbackSlideIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 200px; } }`}</style>
          </div>
        )}

        {/* Meal portion editor is now inline in the premium hero card above */}

        {/* ─── PORTION & QUANTITY (food and suplement only, NOT cosmetics/meal/forma) ─── */}
        {(scanType === "food" || isSuplement) && !isTextSearch && !isMeal && !isForma && (
          <div className="anim-fade-up-1" style={{ margin: "0 16px 12px" }}>
            <div style={{ padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Quantity row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>📦 Ilość</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >−</button>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", minWidth: 24, textAlign: "center" }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >+</button>
                </div>
              </div>
              {/* Separator */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 14 }} />
              {/* Portion slider */}
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>🍽️ Ile zjadłeś?</span>
                <input
                  type="range" min={0} max={100} step={1} value={portion}
                  onChange={(e) => setPortion(+e.target.value)}
                  style={{ width: "100%", marginTop: 10, accentColor: accentColor }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>0%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{portion}%</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>100%</span>
                </div>
                {/* Quick buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {[25, 50, 75, 100].map((v) => (
                    <button
                      key={v}
                      onClick={() => setPortion(v)}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: portion === v ? `rgba(${accentRgb},0.15)` : "rgba(255,255,255,0.03)",
                        border: portion === v ? `1px solid rgba(${accentRgb},0.3)` : "1px solid rgba(255,255,255,0.06)",
                        color: portion === v ? accentColor : "rgba(255,255,255,0.4)",
                      }}
                    >{v}%</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MACRO TABLE (food and suplement only, NOT cosmetics) ─── */}
        {(scanType === "food" || isSuplement) && !isTextSearch && !isMeal && !isForma && (() => {
          const n = foodResult ? extractFoodNutrition(foodResult) : { cal100: 0, prot100: 0, fat100: 0, carb100: 0 };
          const multiplier = quantity * portion / 100;
          const kcal = Math.round(n.cal100 * multiplier);
          const prot = Math.round(n.prot100 * multiplier * 10) / 10;
          const fat = Math.round(n.fat100 * multiplier * 10) / 10;
          const carb = Math.round(n.carb100 * multiplier * 10) / 10;
          return (
            <div className="anim-fade-up-1" style={{ margin: "0 16px 12px" }}>
              <div style={{ padding: 18, borderRadius: 16, background: `rgba(${accentRgb},0.04)`, border: `1px solid rgba(${accentRgb},0.1)` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>WARTOŚCI ODŻYWCZE</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { icon: "🔥", label: "Kalorie", value: `${kcal} kcal` },
                    { icon: "🥩", label: "Białko", value: `${prot} g` },
                    { icon: "🧈", label: "Tłuszcz", value: `${fat} g` },
                    { icon: "🍞", label: "Węglowodany", value: `${carb} g` },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{row.icon} {row.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── 2. ALLERGEN BANNER ─── */}
        {!isCosmetics && !isMeal && !isForma && !isTextSearch && result.allergens && result.allergens.length > 0 && (
          <div className="anim-fade-up-1" style={{ margin: "0 16px 12px" }}>
            <div style={{ padding: 16, borderRadius: 16, background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.12)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24", marginBottom: 10 }}>⚠️ Alergeny</p>
              <div className="flex flex-wrap gap-2">
                {result.allergens.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIngredient(a)}
                    className="active:scale-95 transition-transform"
                    style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: "rgba(234,179,8,0.08)", color: "rgba(234,179,8,0.85)", border: "1px solid rgba(234,179,8,0.15)", cursor: "pointer" }}
                  >
                    {a} →
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Health alerts (food only, when profile exists) */}
        {foodResult && !isTextSearch && !isForma && profile && profile.onboarding_complete && (
          <div className="anim-fade-up-1" style={{ margin: "12px 16px 0" }}>
            <HealthAlerts result={foodResult} profile={profile} />
          </div>
        )}

        {/* ─── 3. DIARY PANEL (food + meal) ─── */}
        {(foodResult || mealResult) && !isForma && !isTextSearch && (
          <div style={{ margin: isMeal ? "0 16px 0" : "12px 16px 0" }}>
            <DiaryPanel
              result={(foodResult || mealResult)!}
              scanId={item.id}
              isDark={isDark}
            />
          </div>
        )}

        {/* ─── 4. TABS (food + cosmetics, not meal/forma) ─── */}
        {/* Link to recipes after fridge scan — prominent position */}
        {result.type === "fridge" && (
          <Link
            href="/przepisy"
            className="block w-full mt-4 py-4 text-center bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-bold rounded-[18px] active:scale-[0.97] transition-all text-[15px] shadow-xl shadow-orange-500/20 anim-fade-up-1"
          >
            🍳 Co ugotować z tych produktów?
          </Link>
        )}

        {!isMeal && !isForma && (
          <div className="anim-fade-up-2" style={{ margin: "8px 16px 0" }}>
            <ResultTabs result={result} scanType={scanType} isCosmetics={isCosmetics} onIngredientClick={setSelectedIngredient} />
          </div>
        )}

        {/* ─── 6. SUGAR SPOONS & FUN COMPARISONS ─── */}
        {sugarTeaspoons > 0 ? (
          isMeal ? (
            <div style={{ margin: "0 16px 8px" }}>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.03]">
                <span className="text-[12px]">🥄</span>
                <span className="text-[11px] font-semibold text-white/55">
                  {sugarTeaspoons} łyżeczek cukru
                </span>
              </div>
            </div>
          ) : (
            <div className="anim-fade-up-1" style={{ margin: "12px 16px 0", padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
                🥄 Łyżeczki cukru: {sugarTeaspoons}
              </p>
              <SugarSpoons count={sugarTeaspoons} />
              <p style={{ fontSize: 11, marginTop: 8, color: "rgba(255,255,255,0.4)" }}>
                1 łyżeczka = 4g cukru · WHO zaleca max 6 dziennie
              </p>
            </div>
          )
        ) : null}

        {/* FunComparisons — food/meal only (cosmetics data is now in tabs) */}
        {!isCosmetics && !isForma && (
          <div style={{ margin: "0 16px" }}>
            <FunComparisons items={funComparisons} isDark={isDark} />
          </div>
        )}

        {/* CheckForm body analysis */}
        {formaResult && (
          <div style={{ position: "relative", zIndex: 2 }}>
            {/* Body composition — right after hero card */}
            <div style={{
              margin: "0 16px 12px", padding: 16, borderRadius: 16,
              background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>🏋️ Kompozycja ciała</div>
              {(() => {
                const weight = profile?.weight_kg;
                const heightCm = profile?.height_cm;
                const bfMatch = formaResult.body_fat_range?.match(/(\d+)-(\d+)/);
                const bfMid = bfMatch ? (parseInt(bfMatch[1]) + parseInt(bfMatch[2])) / 2 : null;
                const aiFatKg = formaResult.estimated_fat_kg;
                const aiMuscleKg = formaResult.estimated_muscle_kg;
                const fatKg = aiFatKg ?? (weight && bfMid ? Math.round(weight * bfMid / 100 * 10) / 10 : null);
                const leanMass = weight && fatKg ? Math.round((weight - fatKg) * 10) / 10 : null;
                const muscleKg = aiMuscleKg ?? (leanMass ? Math.round(leanMass * 0.75 * 10) / 10 : null);
                const hasProfile = weight && weight > 0 && heightCm && heightCm > 0;

                if (!hasProfile) {
                  return (
                    <div style={{ padding: 14, borderRadius: 12, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
                        Uzupełnij wagę i wzrost w Profilu żeby zobaczyć szacunek kompozycji ciała
                      </p>
                      <button onClick={() => router.push("/profil")} style={{ fontSize: 12, color: "#f97316", fontWeight: 600, cursor: "pointer", background: "none", border: "none" }}>
                        Uzupełnij profil →
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {/* 3 tiles */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      <div style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#FBBF24" }}>{bfMid ? `${bfMid}%` : formaResult.body_fat_range}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>% tłuszczu</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{fatKg ? `~${fatKg}` : "—"} <span style={{ fontSize: 12 }}>kg</span></div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>tłuszcz</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{muscleKg ? `~${muscleKg}` : "—"} <span style={{ fontSize: 12 }}>kg</span></div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>mięśnie</div>
                      </div>
                    </div>

                    {/* Details rows */}
                    {[
                      { label: "Kategoria", value: formaResult.body_fat_category?.toUpperCase() || "—", color: "#22c55e" },
                      { label: "Ocena mięśni", value: formaResult.muscle_mass === "above_average" ? "Powyżej średniej" : formaResult.muscle_mass === "average" ? "Średnia" : "Poniżej średniej", color: "rgba(255,255,255,0.8)" },
                      { label: "BMI", value: `${formaResult.bmi} — ${formaResult.bmi_category}`, color: "rgba(255,255,255,0.8)" },
                    ].map((row, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)",
                      }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{row.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: row.color, textAlign: "right", maxWidth: "60%" }}>{row.value}</span>
                      </div>
                    ))}

                    <div style={{
                      marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)",
                      fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.4,
                    }}>
                      ⚠️ Szacunek AI — dokładność ±5%. Dla precyzji użyj DEXA scan.
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Strengths */}
            {formaResult.visible_strengths && formaResult.visible_strengths.length > 0 && (
              <div style={{ margin: "0 16px 12px", padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>✅ Mocne strony</div>
                {formaResult.visible_strengths.map((s, i) => (
                  <div key={i} style={{ padding: "6px 0", fontSize: 12, color: "rgba(255,255,255,0.55)", borderBottom: i < formaResult.visible_strengths.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#22c55e", fontSize: 10 }}>●</span> {s}
                  </div>
                ))}
              </div>
            )}

            {/* Areas to improve */}
            {formaResult.areas_to_improve && formaResult.areas_to_improve.length > 0 && (
              <div style={{ margin: "0 16px 12px", padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>🎯 Do poprawy</div>
                {formaResult.areas_to_improve.map((a, i) => (
                  <div key={i} style={{ padding: "6px 0", fontSize: 12, color: "rgba(255,255,255,0.55)", borderBottom: i < formaResult.areas_to_improve.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#3b82f6", fontSize: 10 }}>●</span> {a}
                  </div>
                ))}
              </div>
            )}

            {/* Tip */}
            {formaResult.tip && (
              <div style={{ margin: "0 16px 12px", padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>💡 Rada</div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, margin: 0 }}>{formaResult.tip}</p>
              </div>
            )}

            {/* Photo warnings */}
            {formaResult.photo_warnings && formaResult.photo_warnings.length > 0 && (
              <div style={{ margin: "0 16px 12px", padding: 14, borderRadius: 14, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#f97316", marginBottom: 6 }}>📸 Wskazówki do zdjęcia:</p>
                {formaResult.photo_warnings.map((w, i) => (
                  <p key={i} style={{ fontSize: 11, color: "rgba(249,115,22,0.7)", margin: "2px 0" }}>{w}</p>
                ))}
              </div>
            )}

            {/* Fun facts / Ciekawostki */}
            {funComparisons.length > 0 && (
              <div style={{ margin: "0 16px 12px", padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>💡 Ciekawostki</div>
                {funComparisons.map((fact, i) => (
                  <div key={i} style={{ padding: "6px 0", fontSize: 12, color: "rgba(255,255,255,0.55)", borderBottom: i < funComparisons.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: result.score >= 8 ? "#22c55e" : result.score >= 5 ? "#FBBF24" : "#ef4444", fontSize: 10 }}>●</span> {fact}
                  </div>
                ))}
              </div>
            )}

            {/* New CheckForm button */}
            <div
              onClick={() => router.push("/forma")}
              style={{
                margin: "0 16px 12px", padding: 14, borderRadius: 14,
                background: "linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.05) 100%)",
                border: "1px solid rgba(249,115,22,0.2)", textAlign: "center",
                fontSize: 13, fontWeight: 700, color: "#f97316", cursor: "pointer",
                boxShadow: "0 4px 20px rgba(249,115,22,0.1)",
              }}
            >
              📸 Zrób nowy CheckForm
            </div>
          </div>
        )}

        {/* ─── 7. TIPS — meal mode premium ─── */}
        {isMeal && (() => {
          const tips: string[] = [];
          if (result.pros) tips.push(...result.pros);
          if (result.cons) tips.push(...result.cons);
          if (result.tip) tips.push(result.tip);
          if (tips.length === 0) return null;
          return (
            <div className="anim-fade-up-3" style={{ margin: "12px 16px 16px", padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>💡 Wskazówki</div>
              {tips.map((tip, i) => (
                <div key={i} style={{
                  padding: "8px 0", fontSize: 12, color: "rgba(255,255,255,0.55)",
                  borderBottom: i < tips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4,
                }}>
                  <span style={{ color: "#FBBF24", fontSize: 10, marginTop: 3 }}>●</span> {tip}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ─── SHARE BUTTON ─── */}
        <div style={{ margin: "0 16px" }}>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: shareCopied ? "#22c55e" : "rgba(255,255,255,0.55)",
              fontWeight: 700,
              fontSize: 13,
              marginTop: 8,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {sharing ? "Generuję..." : shareCopied ? "✅ Link skopiowany!" : "📤 Udostępnij wynik"}
          </button>
        </div>

        {/* Hidden share card for html2canvas */}
        <div style={{ position: "absolute", left: -9999, top: 0 }}>
          <div ref={shareRef}>
            <ShareCard
              name={result.name}
              score={result.score}
              verdict={result.verdict || result.tip || ""}
              isForma={isForma}
            />
          </div>
        </div>

        {/* bottom spacing */}
        <div className="h-6" />
      </div>

      {/* Ingredient explanation popup */}
      <IngredientPopup ingredient={selectedIngredient} onClose={() => setSelectedIngredient(null)} />
    </div>
  );
}
