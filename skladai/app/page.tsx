"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Scanner from "@/components/Scanner";
import HistoryList from "@/components/HistoryList";
import MorningAfter from "@/components/MorningAfter";
import FoodSearch from "@/components/FoodSearch";
import SkinProfileSetup, { hasSkinProfile } from "@/components/SkinProfileSetup";
import InciSearch from "@/components/InciSearch";
import {
  addToHistory,
  checkFreeTierLimit,
  incrementScanCount,
  getSavedMode,
  saveMode,
  updateStreak,
  getStreak,
  getHistory,
} from "@/lib/storage";
import { compressImageSmall } from "@/lib/compress";
import type { ScanMode, ScanHistoryItem } from "@/lib/types";
import Link from "next/link";
import { Apple, UtensilsCrossed, Sparkles, Pill, Bell } from "lucide-react";

/* ── tip arrays ── */
const FOOD_TIPS = [
  "Granola 'fit' ma często więcej cukru i kalorii niż zwykłe płatki owsiane za 3 zł",
  "'Proteinowy' jogurt za 8 zł vs zwykły Skyr za 4 zł — sprawdź skład, będziesz w szoku",
  "Produkt 'bez cukru' może mieć syrop glukozowo-fruktozowy — to TEN SAM cukier, inna nazwa",
  "Baton 'FIT' za 7 zł: 380 kcal, 18g cukru. Banan za 1 zł: 107 kcal, zero przetworzenia",
  "Napis 'FIT' na opakowaniu nie jest regulowany prawnie. Każdy może go użyć. Nawet na cukierkach",
  "Masło orzechowe 'fit' za 25 zł vs zwykłe 100% orzechów za 12 zł — ten sam skład, inna etykieta",
  "Owsianka 'proteinowa' za 8 zł = płatki owsiane za 2 zł + łyżka białka. Dopłacasz 6 zł za mieszanie",
  "Chleb 'fit' za 9 zł i zwykły żytni za 4 zł mają prawie identyczny skład. Płacisz za opakowanie",
  "Woda 'witaminowa' za 6 zł: cukier + aromaty + grosze witamin. Zwykła woda + owoc = lepiej i taniej",
  "Płatki śniadaniowe 'pełnoziarniste' mają tyle cukru co ciastka. Sprawdź tył opakowania, nie przód",
  "Porcja na opakowaniu to często 30g. A kto je 30g chipsów? Mnóż kalorie ×3 dla realnej porcji",
  "Składniki na etykiecie są od największej ilości. Jeśli cukier jest drugi — to głównie cukier jesz",
];

const COSMETIC_TIPS = [
  "Krem za 120 zł i za 25 zł mogą mieć IDENTYCZNY skład INCI. Różnica to opakowanie i marketing",
  "'Dermatologicznie testowany' nie znaczy 'zatwierdzony'. Każdy krem można 'przetestować'",
  "'Naturalny' kosmetyk może zawierać 95% chemii. Słowo 'naturalny' nie jest regulowane prawnie",
  "Kwas hialuronowy za 15 zł działa tak samo jak za 200 zł — to ten sam składnik",
  "Większość kremów przeciwzmarszczkowych za 50+ nie ma składników które naprawdę działają",
  "3 składniki które NAPRAWDĘ działają: retinol, witamina C, niacynamid. Reszta to marketing",
  "'Bez parabenów' to nie zawsze plus — zamienniki mogą być gorsze od parabenów",
  "SPF w kremie na dzień to za mało. Potrzebujesz osobnego filtra SPF 30+ każdego dnia",
  "Drogie serum z 'peptydami' może mieć ich 0.001%. Sprawdź pozycję na liście składników",
  "Perfumy (Fragrance/Parfum) to najczęstsza przyczyna alergii skórnych. A są prawie wszędzie",
  "Skład jest podany od największego do najmniejszego stężenia. 'Super składnik' na końcu = śladowe ilości",
  "Kolagen w kremie NIE wnika w skórę — cząsteczki są za duże. Ale nawilża powierzchnię",
];

const MEAL_TIPS = [
  "Sos i dressing to ukryte kalorie — AI je doliczy!",
  "Obiad babci to zwykle 800-1200 kcal. Ciekawe ile Twój?",
  "Restauracyjne porcje mają średnio 2x więcej kalorii niż domowe",
  "Zdjęcie z góry daje najlepszą estymację — AI widzi proporcje",
  "Kebab o 3 w nocy? AI nie ocenia, ale kalorie policzy",
];

/* ── accent config per mode ── */
const ACCENT_MAP: Record<string, { hex: string; rgb: string }> = {
  food:      { hex: "#6efcb4", rgb: "110,252,180" },
  meal:      { hex: "#FBBF24", rgb: "251,191,36" },
  cosmetics: { hex: "#C084FC", rgb: "192,132,252" },
  suplement: { hex: "#3b82f6", rgb: "59,130,246" },
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // State-based lock — disables button + blocks onChange
  const scanLockRef = useRef(false); // Synchronous ref lock (backup guard, same lifecycle as isScanning)
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ScanMode>("food");
  const [tipIndex, setTipIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showSkinQuiz, setShowSkinQuiz] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const router = useRouter();

  const fridgeInputRef = useRef<HTMLInputElement>(null);

  const accent = ACCENT_MAP[mode] || ACCENT_MAP.food;

  useEffect(() => {
    setMode(getSavedMode());
    setStreak(getStreak());
    // Load 3 most recent scans
    const all = getHistory();
    setRecentScans(all.slice(0, 3));
  }, []);

  useEffect(() => {
    const tips = mode === "cosmetics" ? COSMETIC_TIPS : mode === "meal" ? MEAL_TIPS : FOOD_TIPS;
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [mode]);

  const handleModeChange = (newMode: ScanMode) => {
    setMode(newMode);
    saveMode(newMode);
    setError(null);
    setTipIndex(0);
    if (newMode === "cosmetics" && !hasSkinProfile()) {
      setShowSkinQuiz(true);
    }
  };

  const handleScan = useCallback(
    async (base64: string) => {
      // Synchronous lock — prevents double scanning even with rapid calls
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setError(null);
      const { allowed, isPremium: isPrem } = checkFreeTierLimit();
      if (!allowed) {
        setError(isPrem ? "Osiągnięto limit. Spróbuj jutro." : "Limit 5 skanów/dzień w wersji Free. Odblokuj Premium!");
        scanLockRef.current = false;
        return;
      }
      if (!navigator.onLine) { setError("Brak połączenia z internetem."); scanLockRef.current = false; return; }
      setIsLoading(true);
      setLoadingMessage(undefined);

      const skinProfile = mode === "cosmetics" ? (() => {
        try { return JSON.parse(localStorage.getItem("skladai_skin_profile") || "null"); } catch { return null; }
      })() : null;

      const DUAL_SEP = "|||SECOND|||";

      const doScan = async (imageData: string) => {
        let primaryImg = imageData;
        let secondImg: string | undefined;
        if (imageData.includes(DUAL_SEP)) {
          const parts = imageData.split(DUAL_SEP);
          primaryImg = parts[0];
          secondImg = parts[1];
        }

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: primaryImg,
            ...(secondImg ? { image2: secondImg } : {}),
            mode,
            ...(skinProfile ? { skinProfile } : {}),
          }),
        });
        let data;
        try { data = await res.json(); } catch {
          throw new Error(`server_${res.status}`);
        }
        if (!res.ok) throw new Error(data.error || `error_${res.status}`);
        return data;
      };

      try {
        let data;
        try {
          data = await doScan(base64);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("504") || msg.includes("413") || msg.includes("server_504")) {
            setLoadingMessage("Ponawianie z mniejszym zdjęciem...");
            const smallerImage = await compressImageSmall(base64);
            data = await doScan(smallerImage);
          } else {
            throw err;
          }
        }

        incrementScanCount();
        updateStreak();
        const canvas = document.createElement("canvas");
        const img = new window.Image();
        img.src = base64;
        await new Promise((resolve) => { img.onload = resolve; });
        canvas.width = 96; canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, 96, 96);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.5);
        const historyItem = addToHistory(data, thumbnail, mode);
        router.push(`/wyniki/${historyItem.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("504") || msg.includes("timeout")) {
          setError("Nie udało się przeanalizować produktu. Spróbuj ponownie — upewnij się, że etykieta ze składem jest dobrze widoczna.");
        } else {
          setError(msg || "Wystąpił błąd. Spróbuj ponownie.");
        }
      } finally { setIsLoading(false); setIsScanning(false); scanLockRef.current = false; }
    },
    [router, mode]
  );

  const handleFridgeScan = useCallback(
    async (base64: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setError(null);
      const { allowed } = checkFreeTierLimit();
      if (!allowed) { setError("Limit skanów wyczerpany."); scanLockRef.current = false; return; }
      if (!navigator.onLine) { setError("Brak połączenia z internetem."); scanLockRef.current = false; return; }
      setIsLoading(true);
      setLoadingMessage("Skanuję lodówkę...");
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mode: "fridge_scan" }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Błąd."); setIsLoading(false); return; }
        incrementScanCount();
        updateStreak();
        if (data.products && Array.isArray(data.products)) {
          const productNames = data.products.map((p: { name: string }) => p.name).join(", ");
          localStorage.setItem("skladai_fridge_products", productNames);
        }
        const canvas = document.createElement("canvas");
        const img = new window.Image();
        img.src = base64;
        await new Promise((resolve) => { img.onload = resolve; });
        canvas.width = 96; canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, 96, 96);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.5);
        data.type = "fridge";
        const historyItem = addToHistory(data, thumbnail, "food" as ScanMode);
        router.push(`/wyniki/${historyItem.id}`);
      } catch { setError("Nie udało się przeanalizować produktu. Spróbuj ponownie — upewnij się, że etykieta ze składem jest dobrze widoczna."); }
      finally { setIsLoading(false); scanLockRef.current = false; }
    },
    [router]
  );

  const isCosmetics = mode === "cosmetics";
  const isMeal = mode === "meal";
  const isSuplement = mode === "suplement";
  const tips = isMeal ? MEAL_TIPS : isCosmetics ? COSMETIC_TIPS : FOOD_TIPS;

  /* ── helper: handle direct camera file for the custom viewfinder ── */
  const handleDirectFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, isFridge?: boolean) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.target.value = "";
      // For fridge, use compressImage default; for regular, use compressImage from Scanner
      // We delegate to Scanner component for preview/dual-photo logic,
      // but for fridge we handle directly
      if (isFridge && handleFridgeScan) {
        const { compressImage } = await import("@/lib/compress");
        const compressed = await compressImage(file);
        handleFridgeScan(compressed);
      }
    },
    [handleFridgeScan]
  );

  const onFridgeInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await handleDirectFile(e, true);
    },
    [handleDirectFile]
  );

  /* ── time-ago helper ── */
  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "teraz";
    if (mins < 60) return `${mins} min temu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h temu`;
    const days = Math.floor(hrs / 24);
    return `${days}d temu`;
  }

  function getScoreColor(score: number): string {
    if (score >= 7) return "#22c55e";
    if (score >= 4) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div className="min-h-[100dvh] relative overflow-hidden" style={{ background: "#0a0f0d" }}>
      {/* ── Floating blobs ── */}
      <div
        className="fixed top-[-10%] left-[-5%] w-72 h-72 rounded-full opacity-30 pointer-events-none"
        style={{ background: "#10b981", filter: "blur(50px)", animation: "float1 9s ease-in-out infinite" }}
      />
      <div
        className="fixed top-[30%] right-[-10%] w-60 h-60 rounded-full opacity-25 pointer-events-none"
        style={{ background: "#06b6d4", filter: "blur(45px)", animation: "float2 8s ease-in-out infinite" }}
      />
      <div
        className="fixed bottom-[10%] left-[20%] w-56 h-56 rounded-full opacity-20 pointer-events-none"
        style={{ background: "#34d399", filter: "blur(40px)", animation: "float3 10s ease-in-out infinite" }}
      />
      <div
        className="fixed top-[60%] right-[30%] w-40 h-40 rounded-full opacity-15 pointer-events-none"
        style={{ background: "#10b981", filter: "blur(50px)", animation: "float1 7s ease-in-out infinite reverse" }}
      />

      {/* ── Film grain overlay ── */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-md mx-auto px-5 pb-28">
        {/* ══ 1. TOP BAR ══ */}
        <div className="flex items-center justify-between pt-6 pb-4 anim-fade-up">
          <h1 className="text-[28px] font-black tracking-[-1px]">
            <span className="text-white">Skład</span>
            <span style={{ color: accent.hex, textShadow: `0 0 20px ${accent.hex}60` }} className="transition-colors duration-300">AI</span>
          </h1>
          <div className="flex items-center gap-3">
            {streak >= 1 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold text-white/80"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <span>&#128293;</span>
                <span>{streak}</span>
              </div>
            )}
            <button className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Bell size={16} className="text-white/40" />
            </button>
          </div>
        </div>

        {/* ══ 2. HEADLINE ══ */}
        {(() => {
          const headlines: Record<string, { line1: string; accent: string; line2: string; sub: string }> = {
            food:      { line1: "Sprawdź co", accent: "naprawdę", line2: "jesz",              sub: "Zrób zdjęcie etykiety. AI przeanalizuje skład." },
            meal:      { line1: "Sprawdź co", accent: "naprawdę", line2: "jesz",              sub: "Zrób zdjęcie dania. AI oszacuje kalorie." },
            cosmetics: { line1: "Sprawdź co", accent: "nakładasz", line2: "na skórę",         sub: "Zrób zdjęcie składu INCI. AI oceni bezpieczeństwo." },
            suplement: { line1: "Sprawdź swój", accent: "suplement", line2: "witaminowy",      sub: "Zrób zdjęcie etykiety. AI oceni skład i dawkowanie." },
          };
          const h = headlines[mode] || headlines.food;
          return (
            <div className="text-center mt-2 mb-7 anim-fade-up-1">
              <h2 className="text-[26px] font-extrabold text-white leading-tight">
                {h.line1}{" "}
                <span style={{ color: accent.hex, textShadow: `0 0 30px ${accent.hex}50` }} className="transition-colors duration-300">
                  {h.accent}
                </span>{" "}
                {h.line2}
              </h2>
              <p className="text-[13px] mt-2 font-medium transition-all duration-300" style={{ color: "rgba(255,255,255,0.35)" }}>
                {h.sub}
              </p>
            </div>
          );
        })()}

        {/* ══ 3. SUB-TABS ══ */}
        <div
          className="rounded-2xl p-1 mb-6 anim-fade-up-2"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex gap-1">
            {([
              { id: "food" as ScanMode, Icon: Apple, label: "Żywność", color: "#6efcb4" },
              { id: "meal" as ScanMode, Icon: UtensilsCrossed, label: "Danie", color: "#FBBF24" },
              { id: "cosmetics" as ScanMode, Icon: Sparkles, label: "Kosmetyk", color: "#C084FC" },
              { id: "suplement" as ScanMode, Icon: Pill, label: "Suplement", color: "#3b82f6" },
            ]).map((tab) => {
              const isActive = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleModeChange(tab.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-1 text-[12px] rounded-xl font-semibold transition-all duration-300"
                  style={{
                    backgroundColor: isActive ? `${tab.color}15` : "transparent",
                    color: isActive ? tab.color : "rgba(255,255,255,0.35)",
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  <tab.Icon size={15} strokeWidth={2.2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Morning After (food mode only) ── */}
        {mode === "food" && <MorningAfter />}

        {/* ══ Loading state ══ */}
        {isLoading && (
          <Scanner onScan={handleScan} isLoading={isLoading} mode={mode} loadingMessage={loadingMessage} onFridgeScan={handleFridgeScan} />
        )}

        {/* ══ 4. VIEWFINDER (main CTA) ══ */}
        {!isLoading && (
          <div className="anim-fade-up-2">
            {/* Neon viewfinder */}
            <div className="flex flex-col items-center mb-5">
              <button
                disabled={isLoading || isScanning}
                onClick={() => {
                  if (isLoading || isScanning) return;
                  const inp = document.getElementById("main-camera-input") as HTMLInputElement;
                  inp?.click();
                }}
                className="relative w-[220px] h-[220px] rounded-[36px] flex flex-col items-center justify-center active:scale-[0.96] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(${accent.rgb},0.1)`,
                  boxShadow: `0 0 30px rgba(${accent.rgb},0.05)`,
                  animation: "pulse-glow 3s ease-in-out infinite",
                  ["--accent-rgb" as string]: accent.rgb,
                }}
              >
                {/* 4 corner L-shapes */}
                <div className="absolute top-3 left-3 w-8 h-8 border-t-[3px] border-l-[3px] rounded-tl-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />
                <div className="absolute top-3 right-3 w-8 h-8 border-t-[3px] border-r-[3px] rounded-tr-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />
                <div className="absolute bottom-3 left-3 w-8 h-8 border-b-[3px] border-l-[3px] rounded-bl-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />
                <div className="absolute bottom-3 right-3 w-8 h-8 border-b-[3px] border-r-[3px] rounded-br-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />

                {/* Animated scan line */}
                <div
                  className="absolute left-[15%] right-[15%] h-[2px] pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${accent.hex} 50%, transparent 100%)`,
                    opacity: 0.4,
                    animation: "scanline 2.8s ease-in-out infinite alternate",
                  }}
                />

                {/* Camera icon */}
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={accent.hex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 mb-3 transition-colors duration-300">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>

                {/* SKANUJ text */}
                <span
                  className="text-[14px] font-bold tracking-[3px] uppercase transition-colors duration-300"
                  style={{ color: accent.hex, textShadow: `0 0 15px rgba(${accent.rgb},0.4)` }}
                >
                  SKANUJ
                </span>
              </button>

              {/* Hidden camera input */}
              <input id="main-camera-input" type="file" accept="image/*" capture="environment" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith("image/")) return;
                // LOCK immediately — before any async op — prevents second onChange from slipping through
                if (scanLockRef.current) return;
                scanLockRef.current = true;
                setIsScanning(true);
                // Clone before reset — Android clears files[] after native preview
                const fileClone = new File([file], file.name, { type: file.type });
                e.target.value = "";
                try {
                  const { compressImage } = await import("@/lib/compress");
                  const maxDim = mode === "cosmetics" ? 1200 : 2000;
                  const compressed = await compressImage(fileClone, maxDim);
                  // handleScan will check lock again internally and also reset it in finally
                  scanLockRef.current = false; // release so handleScan can re-acquire properly
                  handleScan(compressed);
                } catch { setIsScanning(false); scanLockRef.current = false; }
              }} className="hidden" />
              <input id="gallery-input" type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith("image/")) return;
                if (scanLockRef.current) return;
                scanLockRef.current = true;
                setIsScanning(true);
                const fileClone = new File([file], file.name, { type: file.type });
                e.target.value = "";
                try {
                  const { compressImage } = await import("@/lib/compress");
                  const maxDim = mode === "cosmetics" ? 1200 : 2000;
                  const compressed = await compressImage(fileClone, maxDim);
                  scanLockRef.current = false;
                  handleScan(compressed);
                } catch { setIsScanning(false); scanLockRef.current = false; }
              }} className="hidden" />

              {/* Sub-buttons: Lodówka (tylko Żywność) + Galeria (zawsze) */}
              <div className="flex gap-3 mt-4 w-full max-w-[280px]">
                {mode === "food" && (
                  <button
                    disabled={isLoading || isScanning}
                    onClick={() => { if (!isLoading && !isScanning) fridgeInputRef.current?.click(); }}
                    className="flex-[1.3] relative rounded-2xl py-3 px-3 text-center active:scale-[0.96] transition-all disabled:opacity-50"
                    style={{ background: `rgba(${accent.rgb},0.06)`, border: `1px solid rgba(${accent.rgb},0.12)` }}
                  >
                    <span className="absolute -top-1.5 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: accent.hex }}>NEW</span>
                    <span className="text-[13px] font-bold text-white/80 block">🧊 Lodówka</span>
                    <span className="text-[9px] text-white/30 block mt-0.5">Multi-skan AI</span>
                  </button>
                )}
                <button
                  disabled={isLoading || isScanning}
                  onClick={() => { if (!isLoading && !isScanning) (document.getElementById("gallery-input") as HTMLInputElement)?.click(); }}
                  className={`${mode === "food" ? "flex-[0.7]" : "flex-1"} rounded-2xl py-3 px-3 text-center active:scale-[0.96] transition-all disabled:opacity-50`}
                  style={{ background: `rgba(${accent.rgb},0.04)`, border: `1px solid rgba(${accent.rgb},0.08)` }}
                >
                  <span className="text-[13px] font-semibold text-white/60 block">🖼️ Galeria</span>
                </button>
              </div>
            </div>

            {/* Wyszukiwarka — glass dark style (bez wyboru posiłku) */}
            {(mode === "food" || mode === "meal") && (
              <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center px-4 py-3 gap-3">
                  <span className="text-white/20 text-[14px]">🔍</span>
                  <input
                    type="text"
                    placeholder="Wpisz lub powiedz co jesz..."
                    className="flex-1 bg-transparent text-white/80 text-[13px] outline-none placeholder:text-white/25"
                    onFocus={() => {
                      // Navigate to a search-focused view or expand inline
                    }}
                  />
                  <button className="w-9 h-9 rounded-full flex items-center justify-center transition-all" style={{ background: `rgba(${accent.rgb},0.08)`, border: `1px solid rgba(${accent.rgb},0.15)`, animation: "mic-pulse 3s ease-in-out infinite" }}>
                    <span className="text-[16px]">🎙️</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* (duplicate Scanner removed — already rendered above) */}

        {/* ══ Quick links (suplement only) ══ */}
        {isSuplement && !isLoading && (
          <div className="mt-5 space-y-3 anim-fade-up-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/promile", emoji: "🍺", label: "Alkomat" },
                { href: "/forma", emoji: "💪", label: "Sprawdź formę" },
                { href: "/beauty-academy", emoji: "📚", label: "Academy" },
                { href: "/dashboard", emoji: "📊", label: "Dziennik" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl p-3.5 text-center active:scale-[0.97] transition-transform"
                  style={{
                    background: "rgba(59,130,246,0.04)",
                    border: "1px solid rgba(59,130,246,0.10)",
                  }}
                >
                  <span className="text-[20px] block">{link.emoji}</span>
                  <span className="text-[11px] font-bold text-white/50 mt-1 block">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ══ INCI Search + Quick links (cosmetics only) ══ */}
        {isCosmetics && !isLoading && (
          <div className="mt-5 space-y-3 anim-fade-up-3">
            <InciSearch />
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/rutyna", emoji: "🪞", label: "Moja rutyna" },
                { href: "/lazienka", emoji: "🚿", label: "Moja łazienka" },
                { href: "/beauty-academy", emoji: "📚", label: "Beauty Academy" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl p-3.5 text-center active:scale-[0.97] transition-transform"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-[20px] block">{link.emoji}</span>
                  <span className="text-[11px] font-bold text-white/50 mt-1 block">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ══ Error ══ */}
        {error && (
          <div
            className="mt-4 p-4 rounded-2xl text-sm text-center font-semibold text-red-400"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.15)",
            }}
          >
            {error}
          </div>
        )}

        {/* ══ 7. TIP BANNER ══ */}
        <div
          className="mt-5 p-4 rounded-2xl anim-fade-up-3 transition-all duration-500"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid rgba(${accent.rgb},0.12)`,
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-base mt-0.5">{isMeal ? "🍽️" : isCosmetics ? "✨" : isSuplement ? "💊" : "🌿"}</span>
            <div>
              <p
                className="text-[9px] tracking-[1.5px] uppercase font-semibold mb-1.5 transition-colors duration-300"
                style={{ color: accent.hex }}
              >
                PORADA
              </p>
              <p className="text-[12px] leading-relaxed font-medium text-white/50 transition-opacity duration-300">
                {tips[tipIndex]}
              </p>
            </div>
          </div>
        </div>

        {/* ══ 8. RECENT SCANS (below fold) ══ */}
        {recentScans.length > 0 && (
          <div className="mt-10 anim-fade-up-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-white/80">Ostatnie skany</h3>
              <Link href="/dashboard" className="text-[11px] font-semibold transition-colors duration-300" style={{ color: accent.hex }}>
                Zobacz wszystkie
              </Link>
            </div>
            <div className="space-y-2">
              {recentScans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/wyniki/${scan.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl active:scale-[0.98] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: getScoreColor(scan.score) }}
                  >
                    {scan.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white/80 truncate">{scan.name}</p>
                    <p className="text-[10px] text-white/30">{timeAgo(scan.date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══ Full History ══ */}
        <HistoryList isCosmetics={true} mode={mode} />
      </div>

      {/* ══ Skin profile quiz ══ */}
      {showSkinQuiz && (
        <SkinProfileSetup
          onComplete={() => setShowSkinQuiz(false)}
          onSkip={() => setShowSkinQuiz(false)}
        />
      )}

      {/* ── Hidden fridge input ── */}
      <input ref={fridgeInputRef} type="file" accept="image/*" capture="environment" onChange={onFridgeInputChange} className="hidden" />
    </div>
  );
}
